"""Market scan pipeline: Google Shopping per probe + Google Trends, normalize, save, analyze.

Credit safety:
* A new live scan is refused while the previous live scan is younger than
  ``SCAN_MIN_INTERVAL_MINUTES`` unless ``force`` is set.
* Responses are disk-cached for the same window, so a forced re-run inside it replays
  cached data at zero credits; ``refresh`` bypasses the cache.
* ``dry_run`` only reports the estimated credit cost.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from app import repo
from app.core.config import get_settings
from app.services import serpapi
from app.services.analytics_service import analyze_scan, known_brands
from app.services.normalize import normalize_products


class ScanGuardError(RuntimeError):
    def __init__(self, message: str, *, minutes_since_last: float, estimate: dict[str, Any]):
        super().__init__(message)
        self.minutes_since_last = minutes_since_last
        self.estimate = estimate


def _cache_window() -> timedelta:
    return timedelta(minutes=max(1, get_settings().scan_min_interval_minutes))


def _planned_calls(market: dict[str, Any]) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    shopping = [serpapi.shopping_params(keyword, market["country"]) for keyword in market["keywords"]]
    trends = [serpapi.trends_params(batch, market["country"]) for batch in serpapi.trends_batches(market["keywords"])]
    return shopping, trends


def estimate_scan(market: dict[str, Any], *, refresh: bool = False) -> dict[str, Any]:
    shopping, trends = _planned_calls(market)
    window = _cache_window()
    calls = shopping + trends
    live = sum(1 for params in calls if refresh or not serpapi.is_cached(params, window))
    return {
        "shopping_calls": len(shopping),
        "trends_calls": len(trends),
        "estimated_credits": live,
        "cached_calls": len(calls) - live,
    }


def _minutes_since_last_live_scan(market_id: int, now: datetime) -> float | None:
    last = repo.latest_scan(market_id, "shopping", live_only=True)
    if last is None:
        return None
    return (now - datetime.fromisoformat(last["scanned_at"])).total_seconds() / 60.0


def shopping_row(product: dict[str, Any], keyword: str, fallback_position: int) -> dict[str, Any]:
    position = product.get("position")
    return {
        "keyword": keyword,
        "product_id": product.get("product_id"),
        "title": product.get("title") or "Untitled product",
        "source": product.get("source"),
        "price": product.get("extracted_price"),
        "old_price": product.get("extracted_old_price"),
        "position": position if isinstance(position, int) else fallback_position,
        "rating": product.get("rating"),
        "reviews": product.get("reviews"),
        "product_link": product.get("product_link") or product.get("link"),
        "thumbnail": product.get("thumbnail"),
    }


async def run_scan(
    market: dict[str, Any],
    *,
    force: bool = False,
    dry_run: bool = False,
    refresh: bool = False,
    now: datetime | None = None,
) -> dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    settings = get_settings()
    estimate = estimate_scan(market, refresh=refresh)
    minutes_since = _minutes_since_last_live_scan(market["id"], now)
    guard_active = minutes_since is not None and minutes_since < settings.scan_min_interval_minutes
    base = {
        "market_id": market["id"],
        "keyword_count": len(market["keywords"]),
        "guard_active": guard_active,
        "minutes_since_last_scan": round(minutes_since, 1) if minutes_since is not None else None,
        **estimate,
    }
    if dry_run:
        return {
            **base, "dry_run": True, "scanned_at": None, "products_observed": 0,
            "message": f"Dry run: this scan would use about {estimate['estimated_credits']} SerpAPI credit(s).",
        }
    if guard_active and not force:
        raise ScanGuardError(
            f"The last live scan was {minutes_since:.0f} minute(s) ago (minimum interval "
            f"{settings.scan_min_interval_minutes} minutes). Re-run with force=true to scan anyway; "
            f"estimated cost {estimate['estimated_credits']} SerpAPI credit(s).",
            minutes_since_last=minutes_since or 0.0,
            estimate=estimate,
        )

    scanned_at = now.isoformat()
    window = _cache_window()
    credits = 0
    cached_calls = 0
    raw_rows: list[dict[str, Any]] = []
    for keyword in market["keywords"]:
        response = await serpapi.search(
            serpapi.shopping_params(keyword, market["country"]), max_age=window, force_refresh=refresh
        )
        credits += response.credits
        cached_calls += int(response.from_cache)
        results = response.payload.get("shopping_results") or []
        raw_rows.extend(shopping_row(product, keyword, i + 1) for i, product in enumerate(results))

    products = normalize_products(raw_rows, known_brands(market), repo.product_history(market["id"]))
    shopping_scan_id = repo.save_shopping_scan(market["id"], scanned_at, products, credits_used=credits)

    warnings: list[str] = []
    trend_points: list[dict[str, Any]] = []
    trends_credits = 0
    try:
        for index, batch in enumerate(serpapi.trends_batches(market["keywords"])):
            response = await serpapi.search(
                serpapi.trends_params(batch, market["country"]), max_age=window, force_refresh=refresh
            )
            trends_credits += response.credits
            cached_calls += int(response.from_cache)
            trend_points.extend(serpapi.parse_trends(response.payload, batch, f"{shopping_scan_id}-{index}", now))
    except (serpapi.SerpApiError, serpapi.SerpApiConfigurationError) as error:
        warnings.append(f"Google Trends unavailable, demand uses the previous trends data if any: {error}")
    if trend_points:
        repo.save_trends_scan(market["id"], scanned_at, trend_points, credits_used=trends_credits)
    elif not warnings:
        warnings.append("Google Trends returned no data for these keywords.")
    credits += trends_credits

    analysis = analyze_scan(market["id"], shopping_scan_id)
    message = (
        "Scan replayed from the response cache (0 SerpAPI credits); pass refresh=true for fresh data."
        if credits == 0 else
        f"Live scan completed through SerpAPI ({credits} credit(s))."
    )
    return {
        **base,
        "dry_run": False,
        "scan_id": shopping_scan_id,
        "scanned_at": scanned_at,
        "products_observed": len(products),
        "products": len(products),
        "trend_points": len(trend_points),
        "events": len(analysis["events"]),
        "opportunities": len(analysis["opportunities"]),
        "credits_used": credits,
        "cached_calls": cached_calls,
        "warnings": warnings,
        "message": message,
    }

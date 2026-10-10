"""Change detection between shopping scans.

Event types: ``NEW_PRODUCT``, ``NEW_COMPETITOR``, ``PRICE_DECREASE``, ``PRICE_INCREASE``,
``DISCOUNT_STARTED``, ``RANK_GAIN``, ``RANK_LOSS``.

* Price and discount events compare the *same offer* only: the same Google product at the
  same retailer. ``product_id`` alone is a catalog entry shared by many sellers.
* Presence events (new product / new competitor) need at least two earlier scans and
  absence from all of them, because the Shopping shelf reshuffles between requests.
* Every event carries ``metadata`` evidence, a ``caveat`` and a ``confidence`` that is
  separate from its ``severity``.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Sequence
from typing import Any

from app.intelligence.common import Observation, brand_key, fmt_number, positive_price

PRICE_CHANGE_THRESHOLD_PCT = 5.0
RANK_CHANGE_THRESHOLD = 3
RANK_EVENT_MAX_POSITION = 20
MIN_HISTORY_FOR_PRESENCE = 2
MAX_EVENTS_PER_TYPE = 15

SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}
CONFIDENCE_ORDER = {"high": 0, "medium": 1, "low": 2}

CAVEATS = {
    "price": "Same product at the same retailer; the listed price may include a temporary promotion.",
    "discount": "Based on the strike-through price the retailer shows on Google Shopping.",
    "rank": "Google Shopping ordering varies between requests; small moves are often noise.",
    "presence": "A sampled search shelf: absence from earlier scans does not prove a launch date.",
}


def _offer_key(obs: Observation) -> str:
    product = (str(obs.get("product_id") or "").strip()) or obs.get("canonical_key") or obs.get("title") or ""
    return f"{product}|{(obs.get('source') or '').strip().lower()}"


def _first_by(observations: Sequence[Observation], key_fn) -> dict[str, Observation]:
    """Index observations by key, keeping the best-positioned one per key."""
    index: dict[str, Observation] = {}
    for obs in observations:
        key = key_fn(obs)
        current = index.get(key)
        if current is None or (obs.get("position") or 999) < (current.get("position") or 999):
            index[key] = obs
    return index


def _short(title: str | None, limit: int = 70) -> str:
    title = (title or "Untitled product").strip()
    return title if len(title) <= limit else title[: limit - 1].rstrip() + "…"


def _event(kind: str, severity: str, confidence: str, obs: Observation | None, *, summary: str,
           previous_value: float | None, current_value: float | None, caveat: str,
           **metadata: Any) -> dict:
    return {
        "type": kind,
        "severity": severity,
        "confidence": confidence,
        "brand": obs.get("brand") if obs else metadata.get("brand"),
        "product": obs.get("title") if obs else None,
        "keyword": obs.get("keyword") if obs else metadata.get("keyword"),
        "previous_value": previous_value,
        "current_value": current_value,
        "summary": summary,
        "metadata": {**metadata, "caveat": caveat},
    }


def price_events(current: Sequence[Observation], previous: Sequence[Observation]) -> list[dict]:
    before = _first_by(previous, _offer_key)
    events = []
    for key, obs in _first_by(current, _offer_key).items():
        old = before.get(key)
        if old is None:
            continue
        new_price, old_price = positive_price(obs.get("price")), positive_price(old.get("price"))
        if new_price is None or old_price is None:
            continue
        change = (new_price - old_price) / old_price * 100.0
        if abs(change) < PRICE_CHANGE_THRESHOLD_PCT:
            continue
        magnitude = abs(change)
        severity = "high" if magnitude >= 20 else "medium" if magnitude >= 10 else "low"
        direction = "dropped" if change < 0 else "rose"
        events.append(_event(
            "PRICE_DECREASE" if change < 0 else "PRICE_INCREASE", severity, "high", obs,
            summary=(f"{_short(obs.get('title'))} at {obs.get('source') or 'a retailer'} {direction} "
                     f"{fmt_number(magnitude)}% ({fmt_number(old_price)} to {fmt_number(new_price)})."),
            previous_value=old_price, current_value=new_price, caveat=CAVEATS["price"],
            change_pct=round(change, 1), offer_key=key, source=obs.get("source"),
        ))
    return events


def discount_events(current: Sequence[Observation], previous: Sequence[Observation]) -> list[dict]:
    before = _first_by(previous, _offer_key)
    events = []
    for key, obs in _first_by(current, _offer_key).items():
        old = before.get(key)
        if old is None:
            continue
        price, list_price = positive_price(obs.get("price")), positive_price(obs.get("old_price"))
        was_discounted = (positive_price(old.get("old_price")) or 0) > (positive_price(old.get("price")) or 0)
        if price is None or list_price is None or list_price <= price or was_discounted:
            continue
        depth = (list_price - price) / list_price * 100.0
        severity = "high" if depth >= 30 else "medium" if depth >= 15 else "low"
        events.append(_event(
            "DISCOUNT_STARTED", severity, "high", obs,
            summary=(f"{_short(obs.get('title'))} at {obs.get('source') or 'a retailer'} is now "
                     f"{fmt_number(depth)}% off ({fmt_number(list_price)} to {fmt_number(price)})."),
            previous_value=list_price, current_value=price, caveat=CAVEATS["discount"],
            discount_pct=round(depth, 1), offer_key=key, source=obs.get("source"),
        ))
    return events


def _position_index(observations: Sequence[Observation]) -> dict[str, Observation]:
    return _first_by(
        [obs for obs in observations if obs.get("canonical_key") and isinstance(obs.get("position"), int)],
        lambda obs: f"{obs.get('keyword', '')}\x00{obs['canonical_key']}",
    )


def rank_events(current: Sequence[Observation], previous: Sequence[Observation]) -> list[dict]:
    before = _position_index(previous)
    events = []
    for key, obs in _position_index(current).items():
        old = before.get(key)
        if old is None:
            continue
        new_pos, old_pos = obs["position"], old["position"]
        delta = old_pos - new_pos  # positive = moved up the shelf
        if abs(delta) < RANK_CHANGE_THRESHOLD or min(new_pos, old_pos) > RANK_EVENT_MAX_POSITION:
            continue
        magnitude = abs(delta)
        severity = "high" if magnitude >= 10 else "medium" if magnitude >= 5 else "low"
        confidence = "medium" if min(new_pos, old_pos) <= 10 else "low"
        verb = "climbed" if delta > 0 else "fell"
        events.append(_event(
            "RANK_GAIN" if delta > 0 else "RANK_LOSS", severity, confidence, obs,
            summary=(f"{_short(obs.get('title'))} {verb} from position {old_pos} to {new_pos} "
                     f"for \"{obs.get('keyword')}\"."),
            previous_value=float(old_pos), current_value=float(new_pos), caveat=CAVEATS["rank"],
            positions_moved=delta,
        ))
    return events


def new_product_events(current: Sequence[Observation], history: Sequence[Sequence[Observation]]) -> list[dict]:
    if len(history) < MIN_HISTORY_FOR_PRESENCE:
        return []
    seen = {obs.get("canonical_key") for scan in history for obs in scan if obs.get("canonical_key")}
    grouped: dict[str, list[Observation]] = defaultdict(list)
    for obs in current:
        key = obs.get("canonical_key")
        if key and key not in seen:
            grouped[key].append(obs)
    events = []
    for key, listings in grouped.items():
        best = min(listings, key=lambda o: o.get("position") or 999)
        position = best.get("position") or 999
        severity = "high" if position <= 5 else "medium" if position <= 15 else "low"
        if position > 30:
            confidence = "low"
        elif len(history) >= 3:
            confidence = "high"
        else:
            confidence = "medium"
        keywords = sorted({o.get("keyword", "") for o in listings})
        events.append(_event(
            "NEW_PRODUCT", severity, confidence, best,
            summary=(f"New on the shelf: {_short(best.get('title'))}"
                     f"{' by ' + best['brand'] if best.get('brand') else ''}, best position {position}."),
            previous_value=None, current_value=float(position), caveat=CAVEATS["presence"],
            canonical_key=key, listings=len(listings), keywords=keywords, scans_checked=len(history),
            price=positive_price(best.get("price")),
        ))
    return events


def new_competitor_events(
    current: Sequence[Observation],
    history: Sequence[Sequence[Observation]],
    own_brand: str | None = None,
) -> list[dict]:
    if len(history) < MIN_HISTORY_FOR_PRESENCE:
        return []
    seen = {brand_key(obs.get("brand")) for scan in history for obs in scan if obs.get("brand")}
    own = brand_key(own_brand)
    grouped: dict[str, list[Observation]] = defaultdict(list)
    for obs in current:
        key = brand_key(obs.get("brand"))
        if key and key not in seen and key != own:
            grouped[key].append(obs)
    events = []
    for listings in grouped.values():
        best = min(listings, key=lambda o: o.get("position") or 999)
        position = best.get("position") or 999
        severity = "high" if position <= 10 else "medium"
        all_inferred = all(o.get("brand_inferred") for o in listings)
        if all_inferred and len(listings) == 1:
            confidence = "low"
        elif len(listings) >= 2 and len(history) >= 3:
            confidence = "high"
        else:
            confidence = "medium"
        events.append(_event(
            "NEW_COMPETITOR", severity, confidence, best,
            summary=(f"New brand on the shelf: {best.get('brand')} with {len(listings)} "
                     f"listing{'s' if len(listings) != 1 else ''}, best position {position}."),
            previous_value=None, current_value=float(len(listings)), caveat=CAVEATS["presence"],
            listings=len(listings), brand_inferred=all_inferred, scans_checked=len(history),
        ))
    return events


def _magnitude(event: dict) -> float:
    meta = event["metadata"]
    for field in ("change_pct", "discount_pct", "positions_moved"):
        if field in meta and meta[field] is not None:
            return abs(float(meta[field]))
    return -(event.get("current_value") or 0.0)  # presence events: better position first


def rank_order(event: dict) -> tuple:
    return (SEVERITY_ORDER.get(event["severity"], 3), CONFIDENCE_ORDER.get(event["confidence"], 3), -_magnitude(event))


def detect_events(
    current: Sequence[Observation],
    history: Sequence[Sequence[Observation]],
    *,
    own_brand: str | None = None,
) -> list[dict]:
    """Events for ``current`` given earlier scans (oldest first). No history, no events."""
    if not history:
        return []
    previous = history[-1]
    groups = [
        price_events(current, previous),
        discount_events(current, previous),
        rank_events(current, previous),
        new_product_events(current, history),
        new_competitor_events(current, history, own_brand),
    ]
    own = brand_key(own_brand)
    events: list[dict] = []
    for group in groups:
        group.sort(key=rank_order)
        events.extend(group[:MAX_EVENTS_PER_TYPE])
    for event in events:
        event["metadata"]["is_mine"] = bool(own) and brand_key(event.get("brand")) == own
    events.sort(key=rank_order)
    return events

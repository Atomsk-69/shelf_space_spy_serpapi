from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.db import get_connection
from app.schemas import MarketSummary, ScanResponse
from app.services.serpapi import SerpApiConfigurationError, shopping_search

router = APIRouter(prefix="/markets", tags=["markets"])


def get_market_summaries(user_id: int) -> list[MarketSummary]:
    with get_connection() as connection:
        markets = connection.execute(
            "SELECT id, name, country, category, brand_name FROM markets WHERE user_id = ?", (user_id,)
        ).fetchall()
        summaries = []
        for market in markets:
            keywords = connection.execute(
                "SELECT keyword FROM market_keywords WHERE market_id = ? ORDER BY id", (market["id"],)
            ).fetchall()
            competitors = connection.execute(
                "SELECT brand_name FROM competitors WHERE market_id = ? ORDER BY id", (market["id"],)
            ).fetchall()
            summaries.append(MarketSummary(
                **dict(market),
                keywords=[item["keyword"] for item in keywords],
                competitors=[item["brand_name"] for item in competitors],
            ))
    return summaries


def get_owned_market(market_id: int, user_id: int) -> MarketSummary:
    matches = [market for market in get_market_summaries(user_id) if market.id == market_id]
    if not matches:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Market not found")
    return matches[0]


@router.get("", response_model=list[MarketSummary])
def list_markets(current_user: Annotated[dict[str, object], Depends(get_current_user)]) -> list[MarketSummary]:
    return get_market_summaries(int(current_user["id"]))


@router.get("/{market_id}", response_model=MarketSummary)
def get_market(market_id: int, current_user: Annotated[dict[str, object], Depends(get_current_user)]) -> MarketSummary:
    return get_owned_market(market_id, int(current_user["id"]))


@router.post("/{market_id}/scan", response_model=ScanResponse)
async def scan_market(market_id: int, current_user: Annotated[dict[str, object], Depends(get_current_user)]) -> ScanResponse:
    market = get_owned_market(market_id, int(current_user["id"]))
    observed_at = datetime.now(timezone.utc).isoformat()
    observations: list[tuple[object, ...]] = []
    try:
        for keyword in market.keywords:
            for product in await shopping_search(keyword, market.country):
                extracted_price = product.get("extracted_price")
                observations.append((
                    market.id, keyword, observed_at, str(product.get("product_id", "")),
                    product.get("title", "Untitled product"), product.get("source"), extracted_price,
                    product.get("extracted_old_price"), product.get("position"), product.get("rating"),
                    product.get("reviews"), product.get("product_link"), product.get("thumbnail"),
                ))
    except SerpApiConfigurationError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error

    with get_connection() as connection:
        connection.executemany(
            """INSERT INTO product_observations
               (market_id, keyword, observed_at, product_id, title, source, price, old_price,
                position, rating, reviews, product_link, thumbnail)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            observations,
        )
    return ScanResponse(
        market_id=market.id,
        scanned_at=observed_at,
        keyword_count=len(market.keywords),
        products_observed=len(observations),
        message="Live Google Shopping scan completed through SerpAPI.",
    )

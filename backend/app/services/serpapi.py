from typing import Any

import httpx

from app.core.config import get_settings

SERPAPI_URL = "https://serpapi.com/search.json"


class SerpApiConfigurationError(RuntimeError):
    pass


async def shopping_search(keyword: str, country: str) -> list[dict[str, Any]]:
    settings = get_settings()
    if not settings.serpapi_api_key:
        raise SerpApiConfigurationError("SERPAPI_API_KEY is missing. Add it to backend/.env and restart the API.")

    params = {
        "engine": "google_shopping",
        "q": keyword,
        "gl": country.lower(),
        "hl": "en",
        "api_key": settings.serpapi_api_key,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(SERPAPI_URL, params=params)
        response.raise_for_status()
        payload = response.json()
    if error := payload.get("error"):
        raise RuntimeError(f"SerpAPI error: {error}")
    return payload.get("shopping_results", [])

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    """Runtime configuration loaded from backend/.env when it exists."""

    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")

    app_name: str
    environment: str
    frontend_origins: str
    serpapi_api_key: str = ""
    jwt_secret: str
    jwt_algorithm: str
    access_token_expire_minutes: int
    demo_user_email: str
    demo_user_password: str
    demo_user_name: str
    demo_market_name: str
    demo_market_country: str
    demo_market_category: str
    demo_brand_name: str
    demo_market_keywords: str
    demo_competitors: str

    # Optional LLM narration. Without a key the weekly brief uses the deterministic template.
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-5-5"

    # SerpAPI credit protection.
    scan_min_interval_minutes: int = 60
    suggest_cache_ttl_hours: int = 168
    serpapi_cache_dir: str = ""
    trends_date_range: str = "today 12-m"

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]

    @property
    def market_keywords(self) -> list[str]:
        return [keyword.strip() for keyword in self.demo_market_keywords.split(",") if keyword.strip()]

    @property
    def competitors(self) -> list[str]:
        return [brand.strip() for brand in self.demo_competitors.split(",") if brand.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # values come from the environment / backend/.env

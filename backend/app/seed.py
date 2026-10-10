from app.core.security import hash_password
from app.core.config import get_settings
from app.db import get_connection


def seed_demo_data() -> None:
    """Create the single, documented hackathon account and its starter market."""
    settings = get_settings()
    with get_connection() as connection:
        user = connection.execute("SELECT id FROM users WHERE email = ?", (settings.demo_user_email,)).fetchone()
        if user is None:
            cursor = connection.execute(
                "INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)",
                (settings.demo_user_email, settings.demo_user_name, hash_password(settings.demo_user_password)),
            )
            user_id = cursor.lastrowid
        else:
            user_id = user["id"]

        market = connection.execute(
            "SELECT id FROM markets WHERE user_id = ? AND name = ?", (user_id, settings.demo_market_name)
        ).fetchone()
        if market is not None:
            return

        cursor = connection.execute(
            "INSERT INTO markets (user_id, name, country, category, brand_name) VALUES (?, ?, ?, ?, ?)",
            (
                user_id,
                settings.demo_market_name,
                settings.demo_market_country,
                settings.demo_market_category,
                settings.demo_brand_name,
            ),
        )
        market_id = cursor.lastrowid
        connection.executemany(
            "INSERT INTO market_keywords (market_id, keyword) VALUES (?, ?)",
            [(market_id, keyword) for keyword in settings.market_keywords],
        )
        connection.executemany(
            "INSERT INTO competitors (market_id, brand_name) VALUES (?, ?)",
            [(market_id, brand) for brand in settings.competitors],
        )

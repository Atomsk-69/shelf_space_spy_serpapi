"""SQLite connection handling and idempotent schema migrations.

All queries live in :mod:`app.repo`; this module only owns the file location, the
connection context manager and the schema. ``initialize_database()`` is safe to run on
every start: it creates missing tables, adds missing columns and backfills legacy rows.
"""

import os
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

DATABASE_PATH = Path(__file__).resolve().parents[1] / "data" / "shelf_space_spy.db"
DATABASE_ENV_VAR = "SHELF_SPACE_SPY_DB"


def database_path() -> Path:
    """Database file in use. Tests and scripts can point elsewhere with SHELF_SPACE_SPY_DB."""
    override = os.environ.get(DATABASE_ENV_VAR)
    return Path(override) if override else DATABASE_PATH


def _connect() -> sqlite3.Connection:
    path = database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=30)
    connection.row_factory = sqlite3.Row
    return connection


BASE_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS markets (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    category TEXT NOT NULL,
    brand_name TEXT,
    created_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS market_keywords (
    id INTEGER PRIMARY KEY,
    market_id INTEGER NOT NULL,
    keyword TEXT NOT NULL,
    FOREIGN KEY (market_id) REFERENCES markets(id)
);

CREATE TABLE IF NOT EXISTS competitors (
    id INTEGER PRIMARY KEY,
    market_id INTEGER NOT NULL,
    brand_name TEXT NOT NULL,
    FOREIGN KEY (market_id) REFERENCES markets(id)
);

CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY,
    market_id INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('shopping', 'trends')),
    scanned_at TEXT NOT NULL,
    is_demo INTEGER NOT NULL DEFAULT 0,
    credits_used INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (market_id) REFERENCES markets(id)
);

CREATE TABLE IF NOT EXISTS product_observations (
    id INTEGER PRIMARY KEY,
    market_id INTEGER NOT NULL,
    keyword TEXT NOT NULL,
    observed_at TEXT NOT NULL,
    product_id TEXT,
    title TEXT NOT NULL,
    source TEXT,
    price REAL,
    old_price REAL,
    position INTEGER,
    rating REAL,
    reviews INTEGER,
    product_link TEXT,
    thumbnail TEXT,
    scan_id INTEGER,
    brand TEXT,
    brand_inferred INTEGER NOT NULL DEFAULT 0,
    canonical_key TEXT,
    is_demo INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (market_id) REFERENCES markets(id),
    FOREIGN KEY (scan_id) REFERENCES scans(id)
);

CREATE TABLE IF NOT EXISTS trend_observations (
    id INTEGER PRIMARY KEY,
    market_id INTEGER NOT NULL,
    scan_id INTEGER NOT NULL,
    keyword TEXT NOT NULL,
    batch_id TEXT NOT NULL,
    week_start TEXT NOT NULL,
    interest REAL NOT NULL,
    is_partial INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (market_id) REFERENCES markets(id),
    FOREIGN KEY (scan_id) REFERENCES scans(id)
);

CREATE TABLE IF NOT EXISTS market_events (
    id INTEGER PRIMARY KEY,
    market_id INTEGER NOT NULL,
    scan_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    severity TEXT NOT NULL,
    brand TEXT,
    product TEXT,
    keyword TEXT,
    previous_value REAL,
    current_value REAL,
    confidence TEXT NOT NULL DEFAULT 'medium',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    detected_at TEXT NOT NULL,
    FOREIGN KEY (market_id) REFERENCES markets(id),
    FOREIGN KEY (scan_id) REFERENCES scans(id)
);

CREATE TABLE IF NOT EXISTS opportunities (
    id INTEGER PRIMARY KEY,
    market_id INTEGER NOT NULL,
    scan_id INTEGER NOT NULL,
    keyword TEXT NOT NULL,
    score REAL NOT NULL,
    label TEXT NOT NULL,
    components_json TEXT NOT NULL DEFAULT '{}',
    explanation_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT,
    FOREIGN KEY (market_id) REFERENCES markets(id),
    FOREIGN KEY (scan_id) REFERENCES scans(id)
);

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY,
    market_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    inputs_json TEXT NOT NULL DEFAULT '{}',
    source TEXT NOT NULL CHECK (source IN ('llm', 'template')),
    created_at TEXT NOT NULL,
    FOREIGN KEY (market_id) REFERENCES markets(id)
);
"""

INDEXES = """
CREATE INDEX IF NOT EXISTS idx_scans_market ON scans(market_id, kind, scanned_at);
CREATE INDEX IF NOT EXISTS idx_observations_scan ON product_observations(scan_id);
CREATE INDEX IF NOT EXISTS idx_observations_market ON product_observations(market_id);
CREATE INDEX IF NOT EXISTS idx_trends_scan ON trend_observations(scan_id);
CREATE INDEX IF NOT EXISTS idx_events_market ON market_events(market_id, detected_at);
CREATE INDEX IF NOT EXISTS idx_opportunities_scan ON opportunities(scan_id);
CREATE INDEX IF NOT EXISTS idx_reports_market ON reports(market_id, created_at);
"""

# Columns added after the first release. Each entry is (table, column, DDL fragment).
ADDED_COLUMNS: list[tuple[str, str, str]] = [
    ("markets", "created_at", "TEXT"),
    ("product_observations", "scan_id", "INTEGER REFERENCES scans(id)"),
    ("product_observations", "brand", "TEXT"),
    ("product_observations", "brand_inferred", "INTEGER NOT NULL DEFAULT 0"),
    ("product_observations", "canonical_key", "TEXT"),
    ("product_observations", "is_demo", "INTEGER NOT NULL DEFAULT 0"),
]


def _columns(connection: sqlite3.Connection, table: str) -> dict[str, sqlite3.Row]:
    return {row["name"]: row for row in connection.execute(f"PRAGMA table_info({table})")}


def _make_brand_name_optional(connection: sqlite3.Connection) -> None:
    """markets.brand_name used to be NOT NULL; SQLite needs a table rebuild to relax it."""
    columns = _columns(connection, "markets")
    if "brand_name" not in columns or not columns["brand_name"]["notnull"]:
        return
    created_at = "created_at" if "created_at" in columns else "NULL"
    connection.executescript(
        f"""
        BEGIN;
        CREATE TABLE markets_rebuild (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            country TEXT NOT NULL,
            category TEXT NOT NULL,
            brand_name TEXT,
            created_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        INSERT INTO markets_rebuild (id, user_id, name, country, category, brand_name, created_at)
            SELECT id, user_id, name, country, category, NULLIF(brand_name, ''), {created_at} FROM markets;
        DROP TABLE markets;
        ALTER TABLE markets_rebuild RENAME TO markets;
        COMMIT;
        """
    )


def _backfill_legacy_scans(connection: sqlite3.Connection) -> None:
    """Group pre-migration observations into one shopping scan per (market, observed_at)."""
    legacy = connection.execute(
        """SELECT market_id, observed_at, COUNT(DISTINCT keyword) AS keywords
           FROM product_observations WHERE scan_id IS NULL
           GROUP BY market_id, observed_at ORDER BY observed_at"""
    ).fetchall()
    for row in legacy:
        cursor = connection.execute(
            "INSERT INTO scans (market_id, kind, scanned_at, is_demo, credits_used) VALUES (?, 'shopping', ?, 0, ?)",
            (row["market_id"], row["observed_at"], row["keywords"]),
        )
        connection.execute(
            "UPDATE product_observations SET scan_id = ? WHERE market_id = ? AND observed_at = ? AND scan_id IS NULL",
            (cursor.lastrowid, row["market_id"], row["observed_at"]),
        )


def initialize_database() -> None:
    connection = _connect()
    try:
        # foreign_keys stays OFF here (SQLite default) so the markets rebuild can drop the old table.
        connection.executescript(BASE_SCHEMA)
        for table, column, ddl in ADDED_COLUMNS:
            if column not in _columns(connection, table):
                connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")
        connection.commit()
        _make_brand_name_optional(connection)
        connection.executescript(INDEXES)
        _backfill_legacy_scans(connection)
        connection.commit()
    finally:
        connection.close()


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    connection = _connect()
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()

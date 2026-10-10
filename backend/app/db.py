import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

DATABASE_PATH = Path(__file__).resolve().parents[1] / "data" / "shelf_space_spy.db"


def initialize_database() -> None:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.executescript(
            """
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
                brand_name TEXT NOT NULL,
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
                FOREIGN KEY (market_id) REFERENCES markets(id)
            );
            """
        )
        connection.commit()


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()

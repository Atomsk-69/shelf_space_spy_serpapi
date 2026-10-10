"""Every SQL statement in the application lives here.

Callers get plain dicts back, so swapping SQLite for Postgres later only touches this
module and :mod:`app.db`.
"""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterable, Sequence
from datetime import datetime, timezone
from typing import Any

from app.db import get_connection


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _rows(cursor: sqlite3.Cursor) -> list[dict[str, Any]]:
    return [dict(row) for row in cursor.fetchall()]


def _one(cursor: sqlite3.Cursor) -> dict[str, Any] | None:
    row = cursor.fetchone()
    return dict(row) if row is not None else None


def _placeholders(values: Sequence[Any]) -> str:
    return ",".join("?" for _ in values)


# --------------------------------------------------------------------------- users


def get_user_by_email(email: str) -> dict[str, Any] | None:
    with get_connection() as conn:
        return _one(conn.execute(
            "SELECT id, email, name, password_hash FROM users WHERE email = ?", (email,)
        ))


def get_user_by_id(user_id: int | str) -> dict[str, Any] | None:
    with get_connection() as conn:
        return _one(conn.execute("SELECT id, email, name FROM users WHERE id = ?", (user_id,)))


def create_user(email: str, name: str, password_hash: str) -> int:
    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)", (email, name, password_hash)
        )
        return int(cursor.lastrowid or 0)


# --------------------------------------------------------------------------- markets


def _hydrate_market(conn: sqlite3.Connection, market: dict[str, Any]) -> dict[str, Any]:
    market["keywords"] = [
        row["keyword"] for row in conn.execute(
            "SELECT keyword FROM market_keywords WHERE market_id = ? ORDER BY id", (market["id"],)
        )
    ]
    market["competitors"] = [
        row["brand_name"] for row in conn.execute(
            "SELECT brand_name FROM competitors WHERE market_id = ? ORDER BY id", (market["id"],)
        )
    ]
    return market


def list_markets(user_id: int) -> list[dict[str, Any]]:
    with get_connection() as conn:
        markets = _rows(conn.execute(
            "SELECT id, user_id, name, country, category, brand_name, created_at FROM markets "
            "WHERE user_id = ? ORDER BY id",
            (user_id,),
        ))
        return [_hydrate_market(conn, market) for market in markets]


def get_market(market_id: int, user_id: int | None = None) -> dict[str, Any] | None:
    query = "SELECT id, user_id, name, country, category, brand_name, created_at FROM markets WHERE id = ?"
    params: tuple[Any, ...] = (market_id,)
    if user_id is not None:
        query += " AND user_id = ?"
        params = (market_id, user_id)
    with get_connection() as conn:
        market = _one(conn.execute(query, params))
        return _hydrate_market(conn, market) if market else None


def find_market_by_name(user_id: int, name: str) -> dict[str, Any] | None:
    with get_connection() as conn:
        return _one(conn.execute("SELECT id FROM markets WHERE user_id = ? AND name = ?", (user_id, name)))


def all_market_ids() -> list[int]:
    with get_connection() as conn:
        return [row["id"] for row in conn.execute("SELECT id FROM markets ORDER BY id")]


def _replace_market_lists(
    conn: sqlite3.Connection, market_id: int, keywords: Iterable[str] | None, competitors: Iterable[str] | None
) -> None:
    if keywords is not None:
        conn.execute("DELETE FROM market_keywords WHERE market_id = ?", (market_id,))
        conn.executemany(
            "INSERT INTO market_keywords (market_id, keyword) VALUES (?, ?)",
            [(market_id, keyword) for keyword in keywords],
        )
    if competitors is not None:
        conn.execute("DELETE FROM competitors WHERE market_id = ?", (market_id,))
        conn.executemany(
            "INSERT INTO competitors (market_id, brand_name) VALUES (?, ?)",
            [(market_id, brand) for brand in competitors],
        )


def create_market(
    user_id: int,
    *,
    name: str,
    country: str,
    category: str,
    brand_name: str | None,
    keywords: Sequence[str],
    competitors: Sequence[str],
) -> int:
    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO markets (user_id, name, country, category, brand_name, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, name, country, category, brand_name, utc_now()),
        )
        market_id = int(cursor.lastrowid or 0)
        _replace_market_lists(conn, market_id, keywords, competitors)
        return market_id


_UNSET: Any = object()


def update_market(
    market_id: int,
    *,
    name: str | None = None,
    country: str | None = None,
    category: str | None = None,
    brand_name: str | None = _UNSET,
    keywords: Sequence[str] | None = None,
    competitors: Sequence[str] | None = None,
) -> None:
    fields: dict[str, Any] = {}
    if name is not None:
        fields["name"] = name
    if country is not None:
        fields["country"] = country
    if category is not None:
        fields["category"] = category
    if brand_name is not _UNSET:
        fields["brand_name"] = brand_name
    with get_connection() as conn:
        if fields:
            assignments = ", ".join(f"{column} = ?" for column in fields)
            conn.execute(f"UPDATE markets SET {assignments} WHERE id = ?", (*fields.values(), market_id))
        _replace_market_lists(conn, market_id, keywords, competitors)


def delete_market(market_id: int) -> None:
    with get_connection() as conn:
        for table in (
            "reports", "opportunities", "market_events", "trend_observations",
            "product_observations", "scans", "competitors", "market_keywords",
        ):
            conn.execute(f"DELETE FROM {table} WHERE market_id = ?", (market_id,))
        conn.execute("DELETE FROM markets WHERE id = ?", (market_id,))


# --------------------------------------------------------------------------- scans

_OBSERVATION_COLUMNS = (
    "market_id", "keyword", "observed_at", "product_id", "title", "source", "price", "old_price",
    "position", "rating", "reviews", "product_link", "thumbnail", "scan_id", "brand", "brand_inferred",
    "canonical_key", "is_demo",
)


def _insert_scan(conn: sqlite3.Connection, market_id: int, kind: str, scanned_at: str, is_demo: bool, credits: int) -> int:
    cursor = conn.execute(
        "INSERT INTO scans (market_id, kind, scanned_at, is_demo, credits_used) VALUES (?, ?, ?, ?, ?)",
        (market_id, kind, scanned_at, int(is_demo), credits),
    )
    return int(cursor.lastrowid or 0)


def save_shopping_scan(
    market_id: int,
    scanned_at: str,
    observations: Sequence[dict[str, Any]],
    *,
    is_demo: bool = False,
    credits_used: int = 0,
) -> int:
    """Insert one shopping scan and its observations atomically. Returns the scan id."""
    with get_connection() as conn:
        scan_id = _insert_scan(conn, market_id, "shopping", scanned_at, is_demo, credits_used)
        rows = []
        for item in observations:
            row = {column: item.get(column) for column in _OBSERVATION_COLUMNS}
            row.update(market_id=market_id, observed_at=scanned_at, scan_id=scan_id, is_demo=int(is_demo))
            row["brand_inferred"] = int(bool(item.get("brand_inferred")))
            rows.append(tuple(row[column] for column in _OBSERVATION_COLUMNS))
        conn.executemany(
            f"INSERT INTO product_observations ({', '.join(_OBSERVATION_COLUMNS)}) "
            f"VALUES ({_placeholders(_OBSERVATION_COLUMNS)})",
            rows,
        )
        return scan_id


def save_trends_scan(
    market_id: int,
    scanned_at: str,
    points: Sequence[dict[str, Any]],
    *,
    is_demo: bool = False,
    credits_used: int = 0,
) -> int:
    with get_connection() as conn:
        scan_id = _insert_scan(conn, market_id, "trends", scanned_at, is_demo, credits_used)
        conn.executemany(
            """INSERT INTO trend_observations
               (market_id, scan_id, keyword, batch_id, week_start, interest, is_partial)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            [
                (market_id, scan_id, p["keyword"], p["batch_id"], p["week_start"], float(p["interest"]),
                 int(bool(p.get("is_partial"))))
                for p in points
            ],
        )
        return scan_id


def list_scans(market_id: int, kind: str | None = None) -> list[dict[str, Any]]:
    """Scans in chronological order (oldest first)."""
    query = "SELECT id, market_id, kind, scanned_at, is_demo, credits_used FROM scans WHERE market_id = ?"
    params: list[Any] = [market_id]
    if kind:
        query += " AND kind = ?"
        params.append(kind)
    query += " ORDER BY scanned_at, id"
    with get_connection() as conn:
        return _rows(conn.execute(query, params))


def latest_scan(market_id: int, kind: str, *, live_only: bool = False) -> dict[str, Any] | None:
    query = "SELECT id, market_id, kind, scanned_at, is_demo, credits_used FROM scans WHERE market_id = ? AND kind = ?"
    if live_only:
        query += " AND is_demo = 0"
    query += " ORDER BY scanned_at DESC, id DESC LIMIT 1"
    with get_connection() as conn:
        return _one(conn.execute(query, (market_id, kind)))


def delete_demo_data(market_id: int) -> int:
    """Remove every demo scan of a market and the rows derived from it. Returns scans removed."""
    with get_connection() as conn:
        scan_ids = [row["id"] for row in conn.execute(
            "SELECT id FROM scans WHERE market_id = ? AND is_demo = 1", (market_id,)
        )]
        if not scan_ids:
            return 0
        marks = _placeholders(scan_ids)
        for table in ("opportunities", "market_events", "trend_observations", "product_observations"):
            conn.execute(f"DELETE FROM {table} WHERE scan_id IN ({marks})", scan_ids)
        conn.execute(f"DELETE FROM scans WHERE id IN ({marks})", scan_ids)
        return len(scan_ids)


# --------------------------------------------------------------------------- observations


def observations_for_scans(scan_ids: Sequence[int]) -> dict[int, list[dict[str, Any]]]:
    result: dict[int, list[dict[str, Any]]] = {scan_id: [] for scan_id in scan_ids}
    if not scan_ids:
        return result
    with get_connection() as conn:
        rows = _rows(conn.execute(
            f"SELECT * FROM product_observations WHERE scan_id IN ({_placeholders(scan_ids)}) "
            "ORDER BY scan_id, keyword, position",
            list(scan_ids),
        ))
    for row in rows:
        result[row["scan_id"]].append(row)
    return result


def observations_for_scan(scan_id: int) -> list[dict[str, Any]]:
    return observations_for_scans([scan_id])[scan_id]


def product_history(market_id: int) -> list[dict[str, Any]]:
    """Previously normalized products of a market, used to keep canonical keys stable."""
    with get_connection() as conn:
        return _rows(conn.execute(
            """SELECT product_id, title, brand, canonical_key FROM product_observations
               WHERE market_id = ? AND canonical_key IS NOT NULL ORDER BY id""",
            (market_id,),
        ))


def observations_missing_normalization(market_id: int) -> list[dict[str, Any]]:
    with get_connection() as conn:
        return _rows(conn.execute(
            "SELECT id, scan_id, product_id, title, source, keyword FROM product_observations "
            "WHERE market_id = ? AND canonical_key IS NULL ORDER BY scan_id, keyword, position",
            (market_id,),
        ))


def shopping_scans_without_analysis(market_id: int) -> list[dict[str, Any]]:
    with get_connection() as conn:
        return _rows(conn.execute(
            """SELECT s.id, s.scanned_at FROM scans s
               WHERE s.market_id = ? AND s.kind = 'shopping'
                 AND NOT EXISTS (SELECT 1 FROM opportunities o WHERE o.scan_id = s.id)
               ORDER BY s.scanned_at, s.id""",
            (market_id,),
        ))


def update_observation_normalization(updates: Sequence[tuple[str | None, bool, str, int]]) -> None:
    """updates: (brand, brand_inferred, canonical_key, observation_id)."""
    with get_connection() as conn:
        conn.executemany(
            "UPDATE product_observations SET brand = ?, brand_inferred = ?, canonical_key = ? WHERE id = ?",
            [(brand, int(inferred), key, obs_id) for brand, inferred, key, obs_id in updates],
        )


# --------------------------------------------------------------------------- trends


def trend_points_for_scan(scan_id: int) -> list[dict[str, Any]]:
    with get_connection() as conn:
        return _rows(conn.execute(
            "SELECT keyword, batch_id, week_start, interest, is_partial FROM trend_observations "
            "WHERE scan_id = ? ORDER BY keyword, week_start",
            (scan_id,),
        ))


# --------------------------------------------------------------------------- events


def replace_events(market_id: int, scan_id: int, detected_at: str, events: Sequence[dict[str, Any]]) -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM market_events WHERE scan_id = ?", (scan_id,))
        conn.executemany(
            """INSERT INTO market_events
               (market_id, scan_id, type, severity, brand, product, keyword, previous_value,
                current_value, confidence, metadata_json, detected_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [
                (
                    market_id, scan_id, e["type"], e["severity"], e.get("brand"), e.get("product"),
                    e.get("keyword"), e.get("previous_value"), e.get("current_value"),
                    e.get("confidence", "medium"),
                    json.dumps({**e.get("metadata", {}), "summary": e.get("summary")}, default=str),
                    detected_at,
                )
                for e in events
            ],
        )


def list_events(market_id: int, *, since: str | None = None, limit: int = 200) -> list[dict[str, Any]]:
    query = (
        "SELECT e.*, s.is_demo AS is_demo FROM market_events e JOIN scans s ON s.id = e.scan_id "
        "WHERE e.market_id = ?"
    )
    params: list[Any] = [market_id]
    if since:
        query += " AND e.detected_at >= ?"
        params.append(since)
    query += " ORDER BY e.detected_at DESC, e.id LIMIT ?"
    params.append(limit)
    with get_connection() as conn:
        rows = _rows(conn.execute(query, params))
    for row in rows:
        row["metadata"] = json.loads(row.pop("metadata_json") or "{}")
        row["is_demo"] = bool(row["is_demo"])
    return rows


# --------------------------------------------------------------------------- opportunities


def replace_opportunities(market_id: int, scan_id: int, opportunities: Sequence[dict[str, Any]]) -> None:
    created_at = utc_now()
    with get_connection() as conn:
        conn.execute("DELETE FROM opportunities WHERE scan_id = ?", (scan_id,))
        conn.executemany(
            """INSERT INTO opportunities
               (market_id, scan_id, keyword, score, label, components_json, explanation_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            [
                (
                    market_id, scan_id, o["keyword"], o["score"], o["label"],
                    json.dumps(o.get("components", {})),
                    json.dumps({
                        key: o.get(key)
                        for key in ("reasons", "caveats", "confidence", "demand_growth", "supply_growth", "inputs")
                    }, default=str),
                    created_at,
                )
                for o in opportunities
            ],
        )


def opportunities_for_scan(scan_id: int) -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = _rows(conn.execute(
            "SELECT keyword, score, label, components_json, explanation_json FROM opportunities "
            "WHERE scan_id = ? ORDER BY score DESC, keyword",
            (scan_id,),
        ))
    result = []
    for row in rows:
        explanation = json.loads(row["explanation_json"] or "{}")
        result.append({
            "keyword": row["keyword"],
            "score": row["score"],
            "label": row["label"],
            "components": json.loads(row["components_json"] or "{}"),
            **explanation,
        })
    return result


# --------------------------------------------------------------------------- reports


def insert_report(market_id: int, content: str, inputs: dict[str, Any], source: str) -> dict[str, Any]:
    created_at = utc_now()
    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO reports (market_id, content, inputs_json, source, created_at) VALUES (?, ?, ?, ?, ?)",
            (market_id, content, json.dumps(inputs, default=str), source, created_at),
        )
        report_id = int(cursor.lastrowid or 0)
    return {"id": report_id, "market_id": market_id, "content": content, "source": source, "created_at": created_at}


def latest_report(market_id: int) -> dict[str, Any] | None:
    with get_connection() as conn:
        return _one(conn.execute(
            "SELECT id, market_id, content, source, created_at FROM reports WHERE market_id = ? "
            "ORDER BY created_at DESC, id DESC LIMIT 1",
            (market_id,),
        ))

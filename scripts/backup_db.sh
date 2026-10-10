#!/usr/bin/env bash
# Back up the local SQLite database to the gitignored backups/ folder (macOS/Linux).
# Usage: scripts/backup_db.sh [destination-file]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="$ROOT/backend/data/shelf_space_spy.db"
[[ -f "$DB" ]] || { echo "No database at $DB. Nothing to back up."; exit 0; }

mkdir -p "$ROOT/backups"
DEST="${1:-$ROOT/backups/shelf_space_spy-$(date +%Y%m%d-%H%M%S).db}"

# SQLite's online backup API gives a consistent copy even while the API is running.
python3 - "$DB" "$DEST" <<'PY'
import sqlite3, sys
src, dst = sqlite3.connect(sys.argv[1]), sqlite3.connect(sys.argv[2])
src.backup(dst)
dst.close(); src.close()
PY
echo "Backed up database to $DEST ($(wc -c < "$DEST" | tr -d ' ') bytes)."

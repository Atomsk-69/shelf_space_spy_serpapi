#!/usr/bin/env bash
# Start the Shelf Space Spy API (:8000) and UI (:5173) for local development (macOS/Linux).
# Usage: scripts/dev.sh [--api-only|--ui-only]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-all}"
PIDS=()

cleanup() {
  for pid in "${PIDS[@]:-}"; do kill "$pid" 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM

port_busy() { lsof -iTCP:"$1" -sTCP:LISTEN -t >/dev/null 2>&1; }

if [[ "$MODE" != "--ui-only" ]]; then
  [[ -d "$ROOT/backend/.venv" ]] || { echo "backend/.venv missing. Run: cd backend && uv sync" >&2; exit 1; }
  if [[ ! -f "$ROOT/backend/.env" ]]; then
    echo "backend/.env missing; copying .env.example (add your SERPAPI_API_KEY)."
    cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
  fi
  port_busy 8000 && { echo "Port 8000 is busy. Stop that process and re-run." >&2; exit 1; }
  (cd "$ROOT/backend" && exec .venv/bin/python -m uvicorn app.main:app --reload --port 8000) &
  PIDS+=($!)
  echo "API starting on http://localhost:8000 (docs at /docs)."
fi

if [[ "$MODE" != "--api-only" ]]; then
  [[ -d "$ROOT/frontend/node_modules" ]] || { echo "frontend/node_modules missing. Run: cd frontend && npm install" >&2; exit 1; }
  port_busy 5173 && { echo "Port 5173 is busy. Stop that process and re-run." >&2; exit 1; }
  (cd "$ROOT/frontend" && exec npm run dev) &
  PIDS+=($!)
  echo "UI starting on http://localhost:5173."
fi

wait

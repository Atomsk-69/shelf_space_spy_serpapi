# Shelf Space Spy

AI market intelligence for small brands. Pick any market (a category plus a country),
and the app samples Google Shopping and Google Trends through SerpAPI, remembers every
snapshot, detects what changed, scores demand-versus-supply opportunities, and writes a
weekly brief. No category logic lives in the code: the seeded market is only an example
from `backend/.env`.

## Run it

### One command (Windows PowerShell)

```powershell
.\scripts\dev.ps1            # API on :8000 and UI on :5173, each in its own window
.\scripts\dev.ps1 -ApiOnly   # backend only
```

The script first checks ports 8000 and 5173. A stale `uvicorn`/`python` process on 8000
(or `node` on 5173) is stopped, so two API servers never share the SQLite file; any other
program holding a port aborts the script. Restart with the script after pulling backend
changes: `uvicorn --reload` on Windows does not always pick them up.

### Manual steps

```powershell
cd backend
uv sync                                  # creates backend/.venv (Python 3.12)
Copy-Item .env.example .env              # then add SERPAPI_API_KEY
.\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

```powershell
cd frontend
npm install
npm run dev                              # http://localhost:5173
```

API health: `http://localhost:8000/api/health`; interactive docs: `http://localhost:8000/docs`.
On start-up the API migrates the database in place (idempotent), seeds the demo account
and example market, and normalizes/analyzes any scans that predate the analytics.

### Tests, lint, types

```powershell
cd backend
.\.venv\Scripts\python -m pytest             # no network, no SerpAPI credits, no real keys
uvx ruff check app tests
uv run --with mypy mypy app
```

Tests use a temporary SQLite file, a temporary response cache and a fake SerpAPI layer;
any real network call fails the test.

### Demo history

Change detection needs history. To demo a market that has at least one real scan:

```powershell
cd backend
.\.venv\Scripts\python -m app.seed_history --market-id 1     # or --all; --force replaces
```

or `POST /api/markets/{id}/demo-history`. This adds four backdated weekly scans (and a
Google Trends series when the market has no real one), all flagged `is_demo=1`, by
perturbing the latest real scan. The dashboard returns `has_demo_history: true` and every
event measured against demo data is marked `is_demo`.

### Back up the database

```powershell
.\scripts\backup_db.ps1      # copies backend/data/shelf_space_spy.db to backups/ (gitignored)
```

## Environment variables

All configuration is read from `backend/.env` (see `.env.example`). Never commit `.env`.

| Variable | Purpose |
| --- | --- |
| `SERPAPI_API_KEY` | Required for live scans and market suggestions. |
| `ANTHROPIC_API_KEY` | Optional. Enables Claude narration of the weekly brief; without it the deterministic template is used. |
| `ANTHROPIC_MODEL` | Defaults to `claude-sonnet-5-5`. |
| `SCAN_MIN_INTERVAL_MINUTES` | Credit guard: a new live scan within this window is refused unless `force=true` (default 60). |
| `SUGGEST_CACHE_TTL_HOURS` | How long cached suggestion responses are reused (default 168). |
| `DEMO_*` | Demo account and example market. |

## Credit safety

* Every SerpAPI response is cached on disk under `backend/data/serpapi_cache/` by request
  parameters (the API key is never stored). Suggestions reuse the cache for a week;
  scans for the guard window, so a forced re-scan inside it costs 0 credits.
* `POST /api/markets/{id}/scan?dry_run=true` returns the estimated credit cost.
* A scan costs one credit per probe keyword plus one per Google Trends batch (at most five
  keywords per market, so one batch). Market suggestions cost two credits.

## API

| Method and path | What it does |
| --- | --- |
| `POST /api/auth/login`, `GET /api/auth/me` | JWT login (bearer token, no cookies). |
| `GET /api/markets`, `GET /api/markets/{id}` | List / read your markets. |
| `POST /api/markets` | Create: `{category, country, keywords[1-5], competitors[], brand_name?, name?}`. |
| `PUT /api/markets/{id}`, `DELETE /api/markets/{id}` | Partial update / delete. |
| `POST /api/markets/suggest` | `{category, country}` to `{keywords[], brands[{name, count, inferred}]}`. |
| `POST /api/markets/{id}/scan` | Live scan. Query or JSON body: `force`, `dry_run`, `refresh` (bypass cache). |
| `POST /api/markets/{id}/demo-history` | Add flagged demo history (`?force=true` replaces it). |
| `GET /api/markets/{id}/dashboard` | `{kpis, events, shelf_share, competitors, opportunities, has_demo_history, report}`; `?include_low_confidence=true` shows every event. |
| `POST /api/markets/{id}/reports/weekly`, `GET /api/markets/{id}/reports/latest` | Generate / read the weekly brief. |

## How the numbers are made

SerpAPI, then deterministic analytics (`backend/app/intelligence/`, pure functions), then
events and scores; the LLM only narrates.

* **Shelf share**: position-weighted visibility, `1 / (1 + 0.1 (position - 1))`, per brand;
  listings without a detected brand form an `Unbranded` entry. A sampled search shelf is
  not market share.
* **Brands**: `source` is the retailer, not the maker. Brands come from the market's
  confirmed list, then `by X` / `X |` title patterns, then a first-word guess flagged
  `inferred`. Multi-brand retailers are never reported as brands.
* **Events**: price and discount changes compare the same offer only (same product at the
  same retailer, at least 5%); rank moves need 3+ positions; new products and new brands
  need absence from at least two earlier scans. Each event carries evidence, a caveat and
  a confidence; low-confidence events are hidden by default.
* **Demand**: Google Trends, last 4 complete weeks vs the 8 before, partial weeks excluded,
  never mixing request batches; very low interest is flagged.
* **Opportunity score** (0-100): demand 40, room 25 (fragmented shelf, SKU growth vs about a
  week earlier), incumbent pressure 20 (reviews of the top 10), price headroom 15. Golden
  >= 75, Attractive 55-74, Monitor 35-54, Crowded < 35. Every score lists reasons and
  caveats; confidence (data volume, scan count, shelf stability) is reported separately.
* **Weekly brief**: Claude receives only the computed JSON; any number in its text that is
  not in that JSON triggers one regeneration, then the template is used instead.

## Demo account

```text
Email:    demo@shelfspacespy.com
Password: Demo@123
```

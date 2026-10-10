# Shelf Space Spy

AI market intelligence for small brands. The application samples Google Shopping
and Google Trends through SerpAPI, remembers the results, then surfaces market
changes and demand-versus-supply opportunities.

## Phase 0: local foundation

### Backend

```powershell
cd backend
uv sync
Copy-Item .env.example .env
uv run uvicorn app.main:app --reload --port 8000
```

`uv sync` creates and manages `backend/.venv` automatically. If a terminal opened
before uv was installed cannot find `uv`, restart it first.

The API health check is available at `http://localhost:8000/api/health` and the
interactive API documentation at `http://localhost:8000/docs`.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). The frontend
checks the API health endpoint and shows its connection state.

## Environment variables

Copy `backend/.env.example` to `backend/.env`. All runtime configuration —
including JWT settings, the demo account, starter market, and `SERPAPI_API_KEY`
— is read from this file. Add your real SerpAPI key, save the file, and restart
the backend. Never commit `.env`.

## Demo account

```text
Email:    demo@shelfspacespy.com
Password: Demo@123
```

The frontend receives an access token and sends it in the `Authorization: Bearer`
header. It uses `sessionStorage`; no cookie authentication or CSRF mechanism is
used in this hackathon implementation.

# Flowcast

Flowcast is a micro-business finance dashboard that combines **90-day cash flow forecasting** with **banking API cost optimization**. It helps small businesses predict balance dips, understand runway, and reduce unnecessary Plaid-style API spend.

## Features

### Cash Flow Forecaster
- Dashboard with current balance, 30-day income/expenses, and runway
- Mock-load or auto-seeded transaction history (recurring income, rent, payroll, subscriptions, inventory, etc.)
- 90-day forecast with predicted balance and upper/lower bounds
- Configurable balance threshold alerts (Safe / Warning / Critical)

### API Banking Cost Optimizer
- Tracks mock banking API calls (endpoint, latency, status, cost)
- Cost summary, timeline charts, and endpoint breakdown
- Pattern detection: burst calls, expensive endpoints, polling, repeated failures
- Optimization suggestions with estimated monthly savings

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React, TypeScript, Vite, Recharts |
| Backend | FastAPI, Python, SQLAlchemy |
| Database | PostgreSQL (schema ready for TimescaleDB hypertables on `api_usage_logs.time`) |
| Forecasting | Simple daily-average placeholder (`SimpleAverageForecastModel`) — swap for Prophet later |
| Auth | Mock user via `GET /auth/me` |
| Banking | Mock Plaid-style sandbox data |

## Project structure

```
flowcast/
├── frontend/          # React + TypeScript UI
│   ├── src/
│   │   ├── api/       # API client
│   │   ├── charts/    # Recharts components
│   │   ├── components/
│   │   ├── hooks/     # Plaid Link flow
│   │   ├── lib/       # Onboarding session helpers
│   │   └── pages/     # Landing, onboarding, link bank, dashboard
├── backend/           # FastAPI application
│   ├── routers/
│   ├── services/      # Forecasting, alerts, API insights
│   ├── database/
│   └── mock_data/
├── docker-compose.yml # PostgreSQL
└── README.md
```

## Prerequisites

- Python 3.9+ (3.11+ recommended for PostgreSQL driver wheels)
- Node.js 18+
- Docker & Docker Compose (optional — for PostgreSQL; SQLite works out of the box)

## Quick start

### 1. Backend (SQLite — no Docker required)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

On first startup the API creates `flowcast.db`, tables, and seeds mock transactions + API logs.

### PostgreSQL (optional, production-like)

```bash
docker compose up -d
cd backend
pip install -r requirements-postgres.txt
export DATABASE_URL=postgresql+psycopg://flowcast:flowcast@localhost:5432/flowcast
uvicorn main:app --reload --port 8000
```

**API docs:** http://127.0.0.1:8000/docs

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — Vite proxies `/api` to the backend.

### 3. Onboarding flow

1. Open http://localhost:5173 and click **Get started**.
2. On the setup screen, click **Connect Account** → full-screen bank connect page (`/onboarding/connect`).
3. Choose **account type** and **bank**, then:
   - **Demo mode** (no Plaid keys): enter business name → **Connect demo bank**
   - **Plaid mode**: add keys to `backend/.env` (see below) → **Continue to Plaid sign-in**
4. Back on setup, click **Sync Now** to import transactions.
5. Click **Go to Dashboard**.

**Plaid keys (optional):** copy `backend/.env.example` to `backend/.env`:

```bash
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_sandbox_secret
PLAID_ENV=sandbox
```

Sandbox tip: in Plaid Link, use *First Platypus Bank* with the test credentials Plaid provides.

**Both backend and frontend must be running** — the connect page calls `GET /plaid/status` on the API (proxied via Vite at `/api`).

## API routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/transactions` | List transactions |
| POST | `/transactions/mock-load` | Seed sandbox transactions + API logs |
| GET | `/forecast/{account_id}` | 90-day cash flow forecast |
| GET | `/alerts/{account_id}` | Cash flow alerts & risk level |
| GET | `/api-costs/summary` | API cost summary by endpoint |
| GET | `/api-costs/timeline` | Daily API usage timeline |
| GET | `/api-costs/insights` | Optimization patterns & savings |
| POST | `/api-costs/mock-call` | Log a simulated API call |
| GET | `/auth/me` | Mock authenticated user |
| POST | `/plaid/link-token` | Create Plaid Link token |
| POST | `/plaid/demo-connect` | Connect demo bank (no Plaid keys) |
| POST | `/plaid/exchange-public-token` | Exchange Plaid public token after Link |
| POST | `/plaid/sync-transactions` | Sync transactions (Plaid or demo) |
| GET | `/plaid/status` | Plaid / bank connection status |

Default account ID: `acct_main`

## Environment variables

| Variable | Default |
|----------|---------|
| `DATABASE_URL` | `postgresql://flowcast:flowcast@localhost:5432/flowcast` |
| `CORS_ORIGINS` | `http://localhost:5173` |
| `BALANCE_THRESHOLD_USD` | `2000` |
| `PLAID_CLIENT_ID` | — (required for Plaid Link) |
| `PLAID_SECRET` | — |
| `PLAID_ENV` | `sandbox` |

## Future improvements

- **Plaid** — Replace mock loaders with Link, `/transactions/sync`, webhooks
- **Prophet / ML** — Implement `ForecastModel` with Prophet or custom pipeline
- **TimescaleDB** — Convert `api_usage_logs` to a hypertable on `time`
- **Alerts** — SendGrid email + Twilio SMS when risk ≥ warning
- **Real auth** — JWT/OAuth session management
- **CSV upload** — Transaction import from bank exports

## License

MIT (demo / portfolio project)

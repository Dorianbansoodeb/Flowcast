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
│   │   └── pages/
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

### 3. Plaid bank onboarding (optional)

1. Create a [Plaid](https://dashboard.plaid.com) account and copy your **sandbox** `client_id` and `secret`.
2. Copy `backend/.env.example` to `backend/.env` and set:

```bash
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_sandbox_secret
PLAID_ENV=sandbox
```

3. Restart the backend, then click **Get started** on the landing page.
4. Use **Connect bank with Plaid** (sandbox: try *First Platypus Bank* with test credentials).
5. Transactions sync automatically; you are redirected to the dashboard.

Without Plaid keys, the connect screen offers **Continue with demo data** (mock transactions).

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
| POST | `/plaid/exchange-public-token` | Exchange public token + sync transactions |
| POST | `/plaid/sync-transactions` | Incremental Plaid transaction sync |
| GET | `/plaid/status` | Plaid connection status |

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

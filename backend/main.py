"""Flowcast API — micro-business finance dashboard backend."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database.connection import Base, engine, SessionLocal
from mock_data.generator import seed_api_usage, seed_transactions
from routers import alerts, api_costs, demo, forecast, plaid, transactions


def init_db():
    Base.metadata.create_all(bind=engine)
    _migrate_plaid_connection_columns()


def _migrate_plaid_connection_columns():
    """Add new PlaidConnection columns on existing SQLite DBs."""
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    if "plaid_connections" not in inspector.get_table_names():
        return
    existing = {c["name"] for c in inspector.get_columns("plaid_connections")}
    alters = []
    if "account_type" not in existing:
        alters.append("ALTER TABLE plaid_connections ADD COLUMN account_type VARCHAR(64)")
    if "bank_name" not in existing:
        alters.append("ALTER TABLE plaid_connections ADD COLUMN bank_name VARCHAR(128)")
    if "is_demo" not in existing:
        alters.append("ALTER TABLE plaid_connections ADD COLUMN is_demo INTEGER DEFAULT 0")
    if not alters:
        return
    with engine.begin() as conn:
        for stmt in alters:
            conn.execute(text(stmt))


def seed_if_empty():
    db = SessionLocal()
    try:
        from database.models import Transaction

        if db.query(Transaction).count() == 0:
            seed_transactions(db)
            seed_api_usage(db)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seed_if_empty()
    yield


app = FastAPI(
    title="Flowcast API",
    description="Cash flow forecasting and banking API cost optimization",
    version="0.1.0",
    lifespan=lifespan,
)

origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transactions.router)
app.include_router(plaid.router)
app.include_router(forecast.router)
app.include_router(alerts.router)
app.include_router(api_costs.router)
app.include_router(demo.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "flowcast-api"}


@app.get("/auth/me")
def mock_auth_me():
    """Mock user session for MVP."""
    return {
        "id": "user_demo",
        "email": "owner@brightline-studio.demo",
        "name": "Alex Morgan",
        "business": "Brightline Studio",
        "account_id": settings.default_account_id,
    }

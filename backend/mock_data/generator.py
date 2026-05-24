from __future__ import annotations

"""
Mock transaction and API usage data for sandbox MVP.
# PLAID: Replace with Plaid /transactions/sync and /accounts/balance/get responses.
"""

import random
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from config import settings
from database.models import AccountBalance, ApiUsageLog, Transaction

# Endpoint costs mimic Plaid-style pricing (USD per call, illustrative)
DEMO_CLIENT_ACCOUNTS = {
    "acct_main": "Brightline Studio (primary)",
    "acct_oak_co": "Oak & Co. Design",
    "acct_wholesale": "Wholesale Supply Co",
}

ENDPOINT_COSTS = {
    "/transactions/get": Decimal("0.0040"),
    "/transactions/sync": Decimal("0.0030"),
    "/accounts/balance/get": Decimal("0.0020"),
    "/accounts/get": Decimal("0.0015"),
    "/identity/get": Decimal("0.0080"),
    "/auth/get": Decimal("0.0025"),
    "/item/webhook/update": Decimal("0.0005"),
}

RECURRING_EXPENSES = [
    ("Rent", "Metro Property Mgmt", -3200, 1),
    ("Payroll", "Gusto Payroll", -4800, 15),
    ("Software", "Adobe Creative Cloud", -54.99, 5),
    ("Software", "Shopify", -89, 5),
    ("Software", "QuickBooks", -55, 10),
    ("Utilities", "Pacific Gas & Electric", -180, 12),
    ("Insurance", "Next Insurance", -210, 20),
]

RECURRING_INCOME = [
    ("Client Retainer", "Brightline Studio", 4500, 1),
    ("Client Retainer", "Oak & Co. Design", 2800, 15),
    ("E-commerce", "Shopify Payouts", 1200, 28),
]

VARIABLE_CATEGORIES = [
    ("Inventory", "Wholesale Supply Co", -400, -1200),
    ("Marketing", "Meta Ads", -150, -600),
    ("Supplies", "Amazon Business", -30, -200),
    ("Travel", "Uber", -15, -120),
    ("Meals", "Local Cafe", -12, -85),
    ("Fees", "Stripe Fees", -25, -180),
]


def _tx_id() -> str:
    return f"txn_{uuid.uuid4().hex[:12]}"


def generate_transactions(
    account_id: str,
    days_back: int = 120,
    start_balance: Decimal = Decimal("18500.00"),
) -> list[dict]:
    """Build sample transaction dicts for a micro-business."""
    today = date.today()
    start = today - timedelta(days=days_back)
    txs: list[dict] = []
    d = start

    while d <= today:
        for cat, merchant, amount, dom in RECURRING_EXPENSES:
            if d.day == dom:
                txs.append(
                    {
                        "id": _tx_id(),
                        "account_id": account_id,
                        "amount": Decimal(str(amount)),
                        "date": d,
                        "category": cat,
                        "merchant_name": merchant,
                        "is_income": False,
                    }
                )
        for cat, merchant, amount, dom in RECURRING_INCOME:
            if d.day == dom:
                txs.append(
                    {
                        "id": _tx_id(),
                        "account_id": account_id,
                        "amount": Decimal(str(amount)),
                        "date": d,
                        "category": cat,
                        "merchant_name": merchant,
                        "is_income": True,
                    }
                )
        if d.weekday() == 2 and random.random() < 0.35:
            cat, merchant, lo, hi = random.choice(VARIABLE_CATEGORIES)
            amt = Decimal(str(round(random.uniform(lo, hi), 2)))
            txs.append(
                {
                    "id": _tx_id(),
                    "account_id": account_id,
                    "amount": amt,
                    "date": d,
                    "category": cat,
                    "merchant_name": merchant,
                    "is_income": False,
                }
            )
        if random.random() < 0.08:
            txs.append(
                {
                    "id": _tx_id(),
                    "account_id": account_id,
                    "amount": Decimal(str(round(random.uniform(-95, -18), 2))),
                    "date": d,
                    "category": "Misc",
                    "merchant_name": random.choice(
                        ["Office Depot", "FedEx", "Zoom", "Slack"]
                    ),
                    "is_income": False,
                }
            )
        d += timedelta(days=1)

    txs.sort(key=lambda t: t["date"])
    balance = start_balance
    for t in txs:
        balance += t["amount"]
    return txs


def seed_transactions(db: Session, account_id: Optional[str] = None) -> int:
    account_id = account_id or settings.default_account_id
    db.query(Transaction).filter(Transaction.account_id == account_id).delete()
    rows = generate_transactions(account_id)
    for r in rows:
        db.add(Transaction(**r))
    net = sum(r["amount"] for r in rows)
    start = Decimal("18500.00")
    db.merge(
        AccountBalance(
            account_id=account_id,
            current_balance=start + net,
        )
    )
    db.commit()
    return len(rows)


def seed_api_usage(db: Session, account_id: Optional[str] = None, days: int = 14) -> int:
    """Generate mock API call history with some expensive patterns."""
    primary = account_id or settings.default_account_id
    db.query(ApiUsageLog).filter(
        ApiUsageLog.account_id.in_(list(DEMO_CLIENT_ACCOUNTS.keys()))
    ).delete(synchronize_session=False)

    now = datetime.utcnow()
    logs: list[ApiUsageLog] = []
    endpoints = list(ENDPOINT_COSTS.keys())
    client_ids = list(DEMO_CLIENT_ACCOUNTS.keys())
    client_weights = [50, 30, 20]

    for day_offset in range(days, 0, -1):
        base = now - timedelta(days=day_offset)
        calls_today = random.randint(8, 35)
        for _ in range(calls_today):
            ep = random.choices(
                endpoints,
                weights=[30, 25, 15, 10, 8, 7, 5],
            )[0]
            status = 200 if random.random() > 0.06 else random.choice([400, 429, 500])
            target_account = random.choices(client_ids, weights=client_weights)[0]
            logs.append(
                ApiUsageLog(
                    time=base + timedelta(
                        hours=random.randint(6, 20),
                        minutes=random.randint(0, 59),
                    ),
                    endpoint=ep,
                    latency_ms=random.randint(80, 1200),
                    status=status,
                    cost_usd=ENDPOINT_COSTS[ep] if status == 200 else Decimal("0"),
                    account_id=target_account,
                )
            )

        # Expensive pattern: burst /transactions/get in one hour (Oak & Co. syncs aggressively)
        if day_offset % 3 == 0:
            burst_time = base.replace(hour=14, minute=0, second=0, microsecond=0)
            burst_account = "acct_oak_co"
            for i in range(8):
                logs.append(
                    ApiUsageLog(
                        time=burst_time + timedelta(minutes=i * 8),
                        endpoint="/transactions/get",
                        latency_ms=random.randint(200, 500),
                        status=200,
                        cost_usd=ENDPOINT_COSTS["/transactions/get"],
                        account_id=burst_account,
                    )
                )

        # Repeated failed identity calls on wholesale account
        if day_offset % 5 == 0:
            for i in range(4):
                logs.append(
                    ApiUsageLog(
                        time=base.replace(hour=9, minute=15 + i * 2),
                        endpoint="/identity/get",
                        latency_ms=random.randint(300, 900),
                        status=500,
                        cost_usd=Decimal("0"),
                        account_id="acct_wholesale",
                    )
                )

    db.add_all(logs)
    db.commit()
    return len(logs)


def record_mock_api_call(
    db: Session,
    endpoint: str,
    account_id: Optional[str] = None,
    status: int = 200,
) -> ApiUsageLog:
    account_id = account_id or settings.default_account_id
    cost = ENDPOINT_COSTS.get(endpoint, Decimal("0.001"))
    log = ApiUsageLog(
        time=datetime.utcnow(),
        endpoint=endpoint,
        latency_ms=random.randint(100, 400),
        status=status,
        cost_usd=cost if status == 200 else Decimal("0"),
        account_id=account_id,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log

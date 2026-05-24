"""Transaction analytics for dashboard charts."""

from __future__ import annotations

from typing import Optional
from calendar import monthrange
from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy.orm import Session

from database.models import Transaction

RECURRING_CATEGORIES = {
    "Rent",
    "Payroll",
    "Software",
    "Utilities",
    "Insurance",
    "Client Retainer",
    "E-commerce",
}

SPEND_BUCKET_MAP = {
    "Rent": "Rent",
    "Payroll": "Payroll",
    "Inventory": "Suppliers",
    "Supplies": "Suppliers",
    "Software": "Subscriptions",
    "Shopify": "Subscriptions",
    "QuickBooks": "Subscriptions",
}


def _expense_bucket(category: str) -> str:
    return SPEND_BUCKET_MAP.get(category, "Other")


def get_spending_breakdown(db: Session, account_id: str, days: int = 30) -> dict:
    cutoff = date.today() - timedelta(days=days)
    txs = (
        db.query(Transaction)
        .filter(
            Transaction.account_id == account_id,
            Transaction.is_income.is_(False),
            Transaction.date >= cutoff,
        )
        .all()
    )

    buckets: dict[str, float] = defaultdict(float)
    for t in txs:
        bucket = _expense_bucket(t.category)
        if bucket == "Other" and t.category not in SPEND_BUCKET_MAP:
            if t.category in ("Marketing", "Travel", "Meals", "Fees", "Misc", "Utilities"):
                if t.category == "Utilities":
                    bucket = "Other"
                else:
                    bucket = "Other"
        buckets[bucket] += abs(float(t.amount))

    order = ["Rent", "Payroll", "Suppliers", "Subscriptions", "Other"]
    categories = [
        {"name": name, "amount": round(buckets.get(name, 0.0), 2)}
        for name in order
        if buckets.get(name, 0.0) > 0
    ]
    total = round(sum(c["amount"] for c in categories), 2)

    return {
        "account_id": account_id,
        "period_days": days,
        "total_expenses": total,
        "categories": categories,
    }


def get_cash_flow_calendar(
    db: Session,
    account_id: str,
    year: Optional[int] = None,
    month: Optional[int] = None,
) -> dict:
    today = date.today()
    year = year or today.year
    month = month or today.month
    start = date(year, month, 1)
    _, last_day = monthrange(year, month)
    end = date(year, month, last_day)

    txs = (
        db.query(Transaction)
        .filter(
            Transaction.account_id == account_id,
            Transaction.date >= start,
            Transaction.date <= end,
        )
        .all()
    )

    by_date: dict[date, dict] = defaultdict(
        lambda: {"income": 0.0, "expenses": 0.0, "net": 0.0, "transaction_count": 0}
    )
    for t in txs:
        amt = float(t.amount)
        row = by_date[t.date]
        row["transaction_count"] += 1
        if t.is_income or amt > 0:
            row["income"] += amt
        else:
            row["expenses"] += abs(amt)
        row["net"] += amt

    expense_vals = [d["expenses"] for d in by_date.values() if d["expenses"] > 0]
    avg_expense = sum(expense_vals) / len(expense_vals) if expense_vals else 500.0
    heavy_threshold = max(avg_expense * 1.75, 1500.0)

    days_out = []
    d = start
    while d <= end:
        row = by_date.get(d, {"income": 0.0, "expenses": 0.0, "net": 0.0, "transaction_count": 0})
        net = row["net"]
        expenses = row["expenses"]
        if net > 0:
            mood = "inflow"
        elif expenses >= heavy_threshold:
            mood = "heavy"
        elif net < 0:
            mood = "outflow"
        else:
            mood = "neutral"

        days_out.append(
            {
                "date": d.isoformat(),
                "day": d.day,
                "weekday": d.weekday(),
                "income": round(row["income"], 2),
                "expenses": round(expenses, 2),
                "net": round(net, 2),
                "transaction_count": row["transaction_count"],
                "mood": mood,
            }
        )
        d += timedelta(days=1)

    return {
        "account_id": account_id,
        "year": year,
        "month": month,
        "heavy_spend_threshold": round(heavy_threshold, 2),
        "days": days_out,
    }


def list_recurring_categories() -> list[str]:
    return sorted(RECURRING_CATEGORIES)

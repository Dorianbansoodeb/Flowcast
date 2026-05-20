from __future__ import annotations

"""
Cash flow forecasting service.

Current: daily average net flow + recurring pattern detection (placeholder).
Future: swap in Prophet, ARIMA, or ML pipeline via ForecastModel protocol.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional, Protocol

import numpy as np
from sqlalchemy.orm import Session

from config import settings
from database.models import AccountBalance, Transaction


@dataclass
class ForecastPoint:
    date: date
    balance: float
    lower: float
    upper: float
    net_flow: float


class ForecastModel(Protocol):
    def predict(
        self,
        history_dates: list[date],
        history_balances: list[float],
        horizon_days: int,
        recurring_net: float,
    ) -> list[ForecastPoint]:
        ...


class SimpleAverageForecastModel:
    """
    Placeholder model: rolling mean daily net + recurring adjustment.
    # PROPHET: Replace with prophet.Prophet().fit() on daily balance series.
    """

    def predict(
        self,
        history_dates: list[date],
        history_balances: list[float],
        horizon_days: int,
        recurring_net: float,
    ) -> list[ForecastPoint]:
        if len(history_balances) < 2:
            daily_net = recurring_net / 30.0
            volatility = abs(daily_net) * 0.15
        else:
            nets = np.diff(history_balances)
            daily_net = float(np.mean(nets[-30:])) if len(nets) >= 30 else float(np.mean(nets))
            volatility = float(np.std(nets[-30:])) if len(nets) >= 5 else abs(daily_net) * 0.2

        last_date = history_dates[-1] if history_dates else date.today()
        last_balance = history_balances[-1] if history_balances else 0.0
        adjusted_daily = daily_net * 0.7 + (recurring_net / 30.0) * 0.3

        points: list[ForecastPoint] = []
        balance = last_balance
        for i in range(1, horizon_days + 1):
            d = last_date + timedelta(days=i)
            balance += adjusted_daily
            spread = max(volatility * 1.96, 50.0)
            points.append(
                ForecastPoint(
                    date=d,
                    balance=round(balance, 2),
                    lower=round(balance - spread, 2),
                    upper=round(balance + spread, 2),
                    net_flow=round(adjusted_daily, 2),
                )
            )
        return points


def _build_balance_history(db: Session, account_id: str) -> tuple[list[date], list[float]]:
    txs = (
        db.query(Transaction)
        .filter(Transaction.account_id == account_id)
        .order_by(Transaction.date)
        .all()
    )
    if not txs:
        return [], []

    bal_row = db.get(AccountBalance, account_id)
    end_balance = float(bal_row.current_balance) if bal_row else 0.0

    by_date: dict[date, float] = {}
    for t in txs:
        by_date[t.date] = by_date.get(t.date, 0.0) + float(t.amount)

    min_d, max_d = min(by_date), max(by_date)
    dates: list[date] = []
    daily_nets: list[float] = []
    d = min_d
    while d <= max_d:
        dates.append(d)
        daily_nets.append(by_date.get(d, 0.0))
        d += timedelta(days=1)

    balances = []
    running = end_balance - sum(daily_nets)
    for net in daily_nets:
        running += net
        balances.append(round(running, 2))

    return dates, balances


def _estimate_monthly_recurring(db: Session, account_id: str) -> float:
    """Sum typical monthly recurring from last 60 days."""
    cutoff = date.today() - timedelta(days=60)
    txs = (
        db.query(Transaction)
        .filter(
            Transaction.account_id == account_id,
            Transaction.date >= cutoff,
        )
        .all()
    )
    recurring_cats = {"Rent", "Payroll", "Software", "Utilities", "Insurance", "Client Retainer", "E-commerce"}
    total = sum(float(t.amount) for t in txs if t.category in recurring_cats)
    return total


def generate_forecast(
    db: Session,
    account_id: str,
    horizon_days: Optional[int] = None,
    model: Optional[ForecastModel] = None,
) -> dict:
    horizon = horizon_days or settings.forecast_days
    model = model or SimpleAverageForecastModel()

    dates, balances = _build_balance_history(db, account_id)
    recurring = _estimate_monthly_recurring(db, account_id)

    if not dates:
        bal_row = db.get(AccountBalance, account_id)
        start = float(bal_row.current_balance) if bal_row else 10000.0
        dates = [date.today()]
        balances = [start]

    points = model.predict(dates, balances, horizon, recurring)

    bal_row = db.get(AccountBalance, account_id)
    current = float(bal_row.current_balance) if bal_row else balances[-1]

    income_30 = (
        db.query(Transaction)
        .filter(
            Transaction.account_id == account_id,
            Transaction.is_income.is_(True),
            Transaction.date >= date.today() - timedelta(days=30),
        )
        .all()
    )
    expense_30 = (
        db.query(Transaction)
        .filter(
            Transaction.account_id == account_id,
            Transaction.is_income.is_(False),
            Transaction.date >= date.today() - timedelta(days=30),
        )
        .all()
    )
    income_sum = sum(float(t.amount) for t in income_30)
    expense_sum = abs(sum(float(t.amount) for t in expense_30))

    avg_daily_net = float(np.mean([p.net_flow for p in points[:30]])) if points else 0
    runway_days = int(current / abs(avg_daily_net)) if avg_daily_net < 0 else 999

    return {
        "account_id": account_id,
        "current_balance": round(current, 2),
        "income_30d": round(income_sum, 2),
        "expenses_30d": round(expense_sum, 2),
        "projected_runway_days": min(runway_days, horizon),
        "forecast": [
            {
                "date": p.date.isoformat(),
                "balance": p.balance,
                "lower": p.lower,
                "upper": p.upper,
                "net_flow": p.net_flow,
            }
            for p in points
        ],
        "model": "simple_average_v1",
    }

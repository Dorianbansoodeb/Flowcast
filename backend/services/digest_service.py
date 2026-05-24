"""Weekly email digest preview (SendGrid integration placeholder)."""

from __future__ import annotations

from typing import Optional

from datetime import date, timedelta

from sqlalchemy.orm import Session

from services.alerts_service import generate_cash_flow_alerts
from services.forecasting import generate_forecast
from services.transaction_analytics import get_spending_breakdown
from database.models import Transaction


def build_weekly_digest(db: Session, account_id: str, threshold: Optional[float] = None) -> dict:
    forecast = generate_forecast(db, account_id)
    alerts_payload = generate_cash_flow_alerts(db, account_id, threshold)
    spending = get_spending_breakdown(db, account_id, days=7)

    week_start = date.today() - timedelta(days=7)
    week_txs = (
        db.query(Transaction)
        .filter(
            Transaction.account_id == account_id,
            Transaction.date >= week_start,
            Transaction.is_income.is_(False),
        )
        .all()
    )
    biggest = max(week_txs, key=lambda t: abs(float(t.amount)), default=None)

    risk_alerts = [a for a in alerts_payload["alerts"] if a["risk_level"] != "safe"]
    next_risk = risk_alerts[0]["message"] if risk_alerts else None

    subject = f"Flowcast weekly digest — ${forecast['current_balance']:,.0f} balance"
    lines = [
        f"Good morning! Here's your Flowcast snapshot for the week of {week_start.strftime('%B %d')}.",
        "",
        f"Current balance: ${forecast['current_balance']:,.2f}",
        f"Runway: {forecast['projected_runway_days']} days at current burn",
        f"Biggest expense (7d): "
        + (
            f"{biggest.merchant_name} (${abs(float(biggest.amount)):,.2f})"
            if biggest
            else "None recorded"
        ),
        f"30-day forecast minimum: "
        + (
            f"${min(p['balance'] for p in forecast['forecast']):,.2f}"
            if forecast["forecast"]
            else "N/A"
        ),
    ]
    if next_risk:
        lines.append(f"Upcoming risk: {next_risk}")
    if spending["categories"]:
        top = max(spending["categories"], key=lambda c: c["amount"])
        lines.append(f"Top spend category (7d): {top['name']} (${top['amount']:,.2f})")

    return {
        "account_id": account_id,
        "subject": subject,
        "preview_text": "\n".join(lines),
        "current_balance": forecast["current_balance"],
        "runway_days": forecast["projected_runway_days"],
        "biggest_expense": (
            {
                "merchant": biggest.merchant_name,
                "amount": abs(float(biggest.amount)),
                "category": biggest.category,
            }
            if biggest
            else None
        ),
        "forecast_30d_min": (
            min(p["balance"] for p in forecast["forecast"][:30])
            if forecast["forecast"]
            else None
        ),
        "risk_message": next_risk,
        "delivery_note": "Email delivery requires SendGrid — preview only in demo mode.",
    }

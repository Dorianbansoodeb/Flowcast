from __future__ import annotations

"""
Cash flow and balance alert generation.
# SENDGRID/TWILIO: Dispatch alert notifications when risk_level >= warning.
"""

from datetime import date
from typing import Optional

from sqlalchemy.orm import Session

from config import settings
from database.models import AlertRecord
from services.forecasting import generate_forecast


def _risk_level(balance: float, threshold: float) -> str:
    if balance < threshold * 0.5:
        return "critical"
    if balance < threshold:
        return "warning"
    return "safe"


def generate_cash_flow_alerts(
    db: Session,
    account_id: str,
    threshold: Optional[float] = None,
) -> list[dict]:
    threshold = threshold if threshold is not None else settings.balance_threshold_usd
    forecast = generate_forecast(db, account_id)
    alerts: list[dict] = []

    min_balance = forecast["current_balance"]
    min_date: Optional[date] = None

    for point in forecast["forecast"]:
        bal = point["balance"]
        if bal < min_balance:
            min_balance = bal
            min_date = date.fromisoformat(point["date"])

    for point in forecast["forecast"]:
        bal = point["balance"]
        d = date.fromisoformat(point["date"])
        if bal < threshold:
            level = _risk_level(bal, threshold)
            msg = (
                f"Cash flow warning: balance predicted to drop below "
                f"${threshold:,.0f} on {d.strftime('%B %d')}."
            )
            alerts.append(
                {
                    "type": "cash_flow",
                    "risk_level": level,
                    "message": msg,
                    "predicted_date": d.isoformat(),
                    "predicted_balance": bal,
                    "threshold": threshold,
                }
            )
            break

    runway = forecast["projected_runway_days"]
    if runway < 30 and forecast["forecast"]:
        alerts.append(
            {
                "type": "runway",
                "risk_level": "critical" if runway < 14 else "warning",
                "message": f"Projected runway is only {runway} days at current burn rate.",
                "predicted_date": None,
                "predicted_balance": None,
                "threshold": threshold,
            }
        )

    overall = "safe"
    if any(a["risk_level"] == "critical" for a in alerts):
        overall = "critical"
    elif alerts:
        overall = "warning"

    if min_date and min_balance < threshold * 1.5:
        alerts.append(
            {
                "type": "summary",
                "risk_level": _risk_level(min_balance, threshold),
                "message": (
                    f"Lowest projected balance ${min_balance:,.2f} on "
                    f"{min_date.strftime('%B %d')}."
                ),
                "predicted_date": min_date.isoformat(),
                "predicted_balance": min_balance,
                "threshold": threshold,
            }
        )

    return {
        "account_id": account_id,
        "overall_risk": overall,
        "threshold": threshold,
        "alerts": alerts,
    }


def persist_alerts(db: Session, account_id: str, payload: dict) -> None:
    db.query(AlertRecord).filter(AlertRecord.account_id == account_id).delete()
    for a in payload["alerts"]:
        db.add(
            AlertRecord(
                account_id=account_id,
                alert_type=a["type"],
                risk_level=a["risk_level"],
                message=a["message"],
                predicted_date=(
                    date.fromisoformat(a["predicted_date"])
                    if a.get("predicted_date")
                    else None
                ),
            )
        )
    db.commit()

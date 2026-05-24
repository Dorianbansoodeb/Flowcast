"""
Banking API cost analysis and optimization suggestions.
"""

from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from database.models import ApiUsageLog
from config import settings
from mock_data.generator import ENDPOINT_COSTS

SAVINGS_ESTIMATES = {
    "batch_transactions": 45.0,
    "webhook_sync": 120.0,
    "reduce_identity": 80.0,
    "cache_balance": 25.0,
    "retry_backoff": 15.0,
}


def get_cost_summary(db: Session, account_id: str, days: int = 30) -> dict:
    cutoff = datetime.utcnow() - timedelta(days=days)
    q = db.query(ApiUsageLog).filter(
        ApiUsageLog.account_id == account_id,
        ApiUsageLog.time >= cutoff,
    )

    logs = q.all()
    total_cost = sum(float(l.cost_usd) for l in logs)
    total_calls = len(logs)
    failed = [l for l in logs if l.status >= 400]

    by_endpoint: dict[str, dict] = defaultdict(
        lambda: {"calls": 0, "cost": 0.0, "failures": 0}
    )
    for l in logs:
        ep = l.endpoint
        by_endpoint[ep]["calls"] += 1
        by_endpoint[ep]["cost"] += float(l.cost_usd)
        if l.status >= 400:
            by_endpoint[ep]["failures"] += 1

    endpoints = sorted(
        [
            {
                "endpoint": ep,
                "calls": data["calls"],
                "cost_usd": round(data["cost"], 4),
                "failures": data["failures"],
            }
            for ep, data in by_endpoint.items()
        ],
        key=lambda x: x["cost_usd"],
        reverse=True,
    )

    return {
        "account_id": account_id,
        "period_days": days,
        "total_cost_usd": round(total_cost, 4),
        "total_calls": total_calls,
        "failed_calls": len(failed),
        "by_endpoint": endpoints,
        "most_expensive": endpoints[:5],
    }


def get_cost_timeline(db: Session, account_id: str, days: int = 14) -> list[dict]:
    cutoff = datetime.utcnow() - timedelta(days=days)
    rows = (
        db.query(
            func.date(ApiUsageLog.time).label("day"),
            func.count().label("calls"),
            func.sum(ApiUsageLog.cost_usd).label("cost"),
            func.sum(case((ApiUsageLog.status >= 400, 1), else_=0)).label("failures"),
        )
        .filter(ApiUsageLog.account_id == account_id, ApiUsageLog.time >= cutoff)
        .group_by(func.date(ApiUsageLog.time))
        .order_by(func.date(ApiUsageLog.time))
        .all()
    )
    return [
        {
            "date": str(r.day),
            "calls": r.calls,
            "cost_usd": round(float(r.cost or 0), 4),
            "failures": int(r.failures or 0),
        }
        for r in rows
    ]


def detect_patterns(db: Session, account_id: str) -> list[dict]:
    """Detect expensive API usage patterns."""
    cutoff = datetime.utcnow() - timedelta(hours=48)
    logs = (
        db.query(ApiUsageLog)
        .filter(ApiUsageLog.account_id == account_id, ApiUsageLog.time >= cutoff)
        .order_by(ApiUsageLog.time)
        .all()
    )

    insights: list[dict] = []
    hour_buckets: dict[tuple[str, str], int] = defaultdict(int)

    for log in logs:
        hour_key = log.time.strftime("%Y-%m-%d %H")
        key = (log.endpoint, hour_key)
        hour_buckets[key] += 1
        if hour_buckets[key] > 3:
            insights.append(
                {
                    "pattern": "burst_calls",
                    "severity": "warning",
                    "endpoint": log.endpoint,
                    "message": (
                        f"Same endpoint called more than 3 times in one hour: {log.endpoint}"
                    ),
                    "suggestion": (
                        "Batch or cache /transactions/get calls"
                        if "transactions" in log.endpoint
                        else f"Reduce polling frequency for {log.endpoint}"
                    ),
                    "estimated_savings_usd": SAVINGS_ESTIMATES["batch_transactions"],
                }
            )
            hour_buckets[key] = 0

    identity_calls = sum(1 for l in logs if l.endpoint == "/identity/get")
    if identity_calls > 5:
        insights.append(
            {
                "pattern": "expensive_endpoint",
                "severity": "warning",
                "endpoint": "/identity/get",
                "message": "Avoid calling /identity/get more than necessary",
                "suggestion": "Cache identity data for 24h after first successful fetch",
                "estimated_savings_usd": SAVINGS_ESTIMATES["reduce_identity"],
            }
        )

    tx_get = sum(1 for l in logs if l.endpoint == "/transactions/get")
    if tx_get > 20:
        insights.append(
            {
                "pattern": "polling",
                "severity": "warning",
                "endpoint": "/transactions/get",
                "message": "High volume of transaction polling detected",
                "suggestion": "Use webhook-based sync instead of polling",
                "estimated_savings_usd": SAVINGS_ESTIMATES["webhook_sync"],
            }
        )

    failed = [l for l in logs if l.status >= 400]
    fail_by_ep: dict[str, int] = defaultdict(int)
    for l in failed:
        fail_by_ep[l.endpoint] += 1
    for ep, count in fail_by_ep.items():
        if count >= 3:
            insights.append(
                {
                    "pattern": "repeated_failures",
                    "severity": "critical",
                    "endpoint": ep,
                    "message": f"Repeated failed calls to {ep} ({count} in 48h)",
                    "suggestion": "Add exponential backoff and circuit breaker before retrying",
                    "estimated_savings_usd": SAVINGS_ESTIMATES["retry_backoff"],
                }
            )

    balance_poll = sum(1 for l in logs if l.endpoint == "/accounts/balance/get")
    if balance_poll > 15:
        insights.append(
            {
                "pattern": "balance_polling",
                "severity": "warning",
                "endpoint": "/accounts/balance/get",
                "message": "Frequent balance checks increase API cost",
                "suggestion": "Cache balance for 15 minutes between user sessions",
                "estimated_savings_usd": SAVINGS_ESTIMATES["cache_balance"],
            }
        )

    seen = set()
    unique = []
    for i in insights:
        key = (i["pattern"], i.get("endpoint"))
        if key not in seen:
            seen.add(key)
            unique.append(i)
    return unique


def get_cost_by_account(db: Session, days: int = 30) -> dict:
    """Break down API spend across connected demo client accounts."""
    from mock_data.generator import DEMO_CLIENT_ACCOUNTS

    cutoff = datetime.utcnow() - timedelta(days=days)
    logs = db.query(ApiUsageLog).filter(ApiUsageLog.time >= cutoff).all()

    by_account: dict[str, dict] = defaultdict(
        lambda: {"calls": 0, "cost": 0.0, "failures": 0}
    )
    for log in logs:
        acct = log.account_id
        by_account[acct]["calls"] += 1
        by_account[acct]["cost"] += float(log.cost_usd)
        if log.status >= 400:
            by_account[acct]["failures"] += 1

    accounts = []
    for acct_id, label in DEMO_CLIENT_ACCOUNTS.items():
        data = by_account.get(acct_id, {"calls": 0, "cost": 0.0, "failures": 0})
        if data["calls"] > 0 or acct_id == settings.default_account_id:
            accounts.append(
                {
                    "account_id": acct_id,
                    "label": label,
                    "calls": data["calls"],
                    "cost_usd": round(data["cost"], 4),
                    "failures": data["failures"],
                }
            )

    for acct_id, data in by_account.items():
        if acct_id not in DEMO_CLIENT_ACCOUNTS:
            accounts.append(
                {
                    "account_id": acct_id,
                    "label": acct_id,
                    "calls": data["calls"],
                    "cost_usd": round(data["cost"], 4),
                    "failures": data["failures"],
                }
            )

    accounts.sort(key=lambda x: x["cost_usd"], reverse=True)
    total = round(sum(a["cost_usd"] for a in accounts), 4)

    return {
        "period_days": days,
        "accounts": accounts,
        "total_cost_usd": total,
    }


def get_insights(db: Session, account_id: str) -> dict:
    patterns = detect_patterns(db, account_id)
    total_savings = sum(p.get("estimated_savings_usd", 0) for p in patterns)
    summary = get_cost_summary(db, account_id)

    return {
        "account_id": account_id,
        "patterns": patterns,
        "total_estimated_savings_usd": round(total_savings, 2),
        "summary": summary,
        "endpoint_pricing": {k: float(v) for k, v in ENDPOINT_COSTS.items()},
    }

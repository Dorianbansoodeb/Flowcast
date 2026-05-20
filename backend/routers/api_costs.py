from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from config import settings
from database.connection import get_db
from mock_data.generator import record_mock_api_call
from schemas import MockApiCallRequest
from services.api_cost_insights import (
    detect_patterns,
    get_cost_summary,
    get_cost_timeline,
    get_insights,
)

router = APIRouter(prefix="/api-costs", tags=["api-costs"])


@router.get("/summary")
def api_cost_summary(
    account_id: str = Query(default=None),
    days: int = Query(default=30, ge=1, le=90),
    db: Session = Depends(get_db),
):
    account_id = account_id or settings.default_account_id
    return get_cost_summary(db, account_id, days)


@router.get("/timeline")
def api_cost_timeline(
    account_id: str = Query(default=None),
    days: int = Query(default=14, ge=1, le=90),
    db: Session = Depends(get_db),
):
    account_id = account_id or settings.default_account_id
    return {"account_id": account_id, "timeline": get_cost_timeline(db, account_id, days)}


@router.get("/insights")
def api_cost_insights(
    account_id: str = Query(default=None),
    db: Session = Depends(get_db),
):
    account_id = account_id or settings.default_account_id
    return get_insights(db, account_id)


@router.post("/mock-call")
def mock_api_call(body: MockApiCallRequest, db: Session = Depends(get_db)):
    """
    Simulate a banking API call for cost tracking demo.
    # PLAID: Log real API responses from Plaid client middleware.
    """
    log = record_mock_api_call(db, body.endpoint, body.account_id, body.status)
    patterns = detect_patterns(db, body.account_id)
    return {
        "logged": True,
        "id": log.id,
        "endpoint": log.endpoint,
        "cost_usd": float(log.cost_usd),
        "status": log.status,
        "new_patterns_detected": len(patterns),
    }

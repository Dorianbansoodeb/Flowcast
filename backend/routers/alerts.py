from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database.connection import get_db
from schemas import AlertsOut
from services.alerts_service import generate_cash_flow_alerts, persist_alerts

router = APIRouter(tags=["alerts"])


@router.get("/alerts/{account_id}", response_model=AlertsOut)
def get_alerts(
    account_id: str,
    threshold: Optional[float] = Query(default=None),
    persist: bool = Query(default=True),
    db: Session = Depends(get_db),
):
    payload = generate_cash_flow_alerts(db, account_id, threshold)
    if persist:
        persist_alerts(db, account_id, payload)
    return AlertsOut(**payload)

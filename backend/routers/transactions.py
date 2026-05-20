from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from config import settings
from database.connection import get_db
from database.models import Transaction
from mock_data.generator import seed_api_usage, seed_transactions
from schemas import MockLoadRequest, TransactionOut

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=list[TransactionOut])
def list_transactions(
    account_id: str = Query(default=None),
    limit: int = Query(default=500, le=2000),
    db: Session = Depends(get_db),
):
    account_id = account_id or settings.default_account_id
    rows = (
        db.query(Transaction)
        .filter(Transaction.account_id == account_id)
        .order_by(Transaction.date.desc())
        .limit(limit)
        .all()
    )
    return [
        TransactionOut(
            id=r.id,
            account_id=r.account_id,
            amount=float(r.amount),
            date=r.date,
            category=r.category,
            merchant_name=r.merchant_name,
            is_income=r.is_income,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.post("/mock-load")
def mock_load_transactions(body: MockLoadRequest, db: Session = Depends(get_db)):
    """
    Load sandbox transaction history.
    # PLAID: Replace with link token flow + /transactions/sync webhook pipeline.
    """
    count = seed_transactions(db, body.account_id)
    api_count = 0
    if body.seed_api:
        api_count = seed_api_usage(db, body.account_id)
    return {
        "message": "Mock data loaded",
        "transactions_created": count,
        "api_logs_created": api_count,
        "account_id": body.account_id,
    }

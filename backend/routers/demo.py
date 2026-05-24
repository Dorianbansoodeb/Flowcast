"""One-click demo mode for portfolio visitors."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from config import settings
from database.connection import get_db
from mock_data.generator import seed_api_usage, seed_transactions
from services.plaid_service import demo_connect

router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("/quick-start")
def quick_start_demo(db: Session = Depends(get_db)):
    """
    Load sample transactions, API usage, and a demo bank connection.
    Skips onboarding — intended for landing-page "Try demo".
    """
    account_id = settings.default_account_id
    tx_count = seed_transactions(db, account_id)
    api_count = seed_api_usage(db, account_id)
    demo_connect(
        db,
        account_id=account_id,
        account_type="Business checking",
        bank_name="RBC Royal Bank",
        business_name="Brightline Studio",
    )
    return {
        "message": "Demo workspace ready",
        "account_id": account_id,
        "transactions_created": tx_count,
        "api_logs_created": api_count,
        "is_demo": True,
    }

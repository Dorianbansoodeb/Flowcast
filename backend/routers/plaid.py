from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from config import settings
from database.connection import get_db
from schemas import (
    PlaidExchangeRequest,
    PlaidLinkTokenRequest,
    PlaidLinkTokenResponse,
    PlaidStatusResponse,
    PlaidSyncRequest,
    PlaidSyncResponse,
)
from services import plaid_service

router = APIRouter(prefix="/plaid", tags=["plaid"])


@router.get("/status", response_model=PlaidStatusResponse)
def get_plaid_status(
    account_id: str | None = None,
    db: Session = Depends(get_db),
):
    account_id = account_id or settings.default_account_id
    return plaid_service.plaid_status(db, account_id)


@router.post("/link-token", response_model=PlaidLinkTokenResponse)
def create_link_token(body: PlaidLinkTokenRequest):
    account_id = body.account_id or settings.default_account_id
    result = plaid_service.create_link_token(account_id)
    return PlaidLinkTokenResponse(
        link_token=result["link_token"],
        expiration=result.get("expiration"),
        plaid_env=settings.plaid_env,
    )


@router.post("/exchange-public-token")
def exchange_public_token(body: PlaidExchangeRequest, db: Session = Depends(get_db)):
    account_id = body.account_id or settings.default_account_id
    conn = plaid_service.exchange_public_token(db, body.public_token, account_id)
    sync = plaid_service.sync_transactions(db, account_id, replace_existing=True)
    return {
        "message": "Bank account connected",
        "account_id": account_id,
        "item_id": conn.item_id,
        "institution_name": conn.institution_name,
        "sync": sync,
    }


@router.post("/sync-transactions", response_model=PlaidSyncResponse)
def sync_transactions(body: PlaidSyncRequest, db: Session = Depends(get_db)):
    account_id = body.account_id or settings.default_account_id
    result = plaid_service.sync_transactions(
        db, account_id, replace_existing=body.replace_existing
    )
    return PlaidSyncResponse(**result)

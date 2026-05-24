from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from config import settings
from database.connection import get_db
from schemas import (
    PlaidConnectResponse,
    PlaidDemoConnectRequest,
    PlaidExchangeRequest,
    PlaidInstitutionsResponse,
    PlaidLinkTokenRequest,
    PlaidLinkTokenResponse,
    PlaidStatusResponse,
    PlaidSyncRequest,
    PlaidSyncResponse,
)
from services import plaid_service

router = APIRouter(prefix="/plaid", tags=["plaid"])


def _connect_response(conn) -> PlaidConnectResponse:
    return PlaidConnectResponse(
        message="Bank account connected",
        account_id=conn.account_id,
        item_id=conn.item_id,
        institution_name=conn.institution_name,
        account_type=conn.account_type,
        bank_name=conn.bank_name,
        is_demo=conn.is_demo,
    )


@router.get("/status", response_model=PlaidStatusResponse)
def get_plaid_status(
    account_id: Optional[str] = None,
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


@router.get("/institutions", response_model=PlaidInstitutionsResponse)
def list_institutions(
    query: str = "",
    offset: int = 0,
    count: int = 100,
):
    result = plaid_service.search_institutions(query=query, offset=offset, count=count)
    return PlaidInstitutionsResponse(**result)


@router.post("/demo-connect", response_model=PlaidConnectResponse)
def demo_connect(body: PlaidDemoConnectRequest, db: Session = Depends(get_db)):
    account_id = body.account_id or settings.default_account_id
    conn = plaid_service.demo_connect(
        db,
        account_id,
        body.account_type.strip(),
        body.bank_name.strip(),
        body.business_name.strip(),
    )
    return _connect_response(conn)


@router.post("/exchange-public-token", response_model=PlaidConnectResponse)
def exchange_public_token(body: PlaidExchangeRequest, db: Session = Depends(get_db)):
    account_id = body.account_id or settings.default_account_id
    conn = plaid_service.exchange_public_token(
        db,
        body.public_token,
        account_id,
        account_type=body.account_type,
        bank_name=body.bank_name,
    )
    return _connect_response(conn)


@router.post("/sync-transactions", response_model=PlaidSyncResponse)
def sync_transactions(body: PlaidSyncRequest, db: Session = Depends(get_db)):
    account_id = body.account_id or settings.default_account_id
    result = plaid_service.sync_transactions(
        db, account_id, replace_existing=body.replace_existing
    )
    return PlaidSyncResponse(**result)

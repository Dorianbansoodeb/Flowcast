"""Plaid Link, token exchange, and transaction sync."""
from __future__ import annotations

import time
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from config import settings
from database.models import AccountBalance, PlaidConnection, Transaction
from mock_data.generator import record_mock_api_call, seed_transactions

DEMO_ACCESS_TOKEN = "access-demo"
_plaid_client = None


def _get_plaid_client():
    global _plaid_client
    if not settings.plaid_configured:
        raise HTTPException(
            status_code=503,
            detail="Plaid is not configured. Set PLAID_CLIENT_ID and PLAID_SECRET in backend/.env",
        )
    if _plaid_client is not None:
        return _plaid_client

    from plaid import ApiClient, Configuration, Environment
    from plaid.api import plaid_api

    env_map = {
        "sandbox": Environment.Sandbox,
        "development": Environment.Development,
        "production": Environment.Production,
    }
    host = env_map.get(settings.plaid_env.lower(), Environment.Sandbox)

    configuration = Configuration(
        host=host,
        api_key={
            "clientId": settings.plaid_client_id,
            "secret": settings.plaid_secret,
        },
    )
    api_client = ApiClient(configuration)
    _plaid_client = plaid_api.PlaidApi(api_client)
    return _plaid_client


def _resolve_institution_name(client, access_token: str, fallback: str) -> str:
    from plaid.model.country_code import CountryCode
    from plaid.model.institutions_get_by_id_request import InstitutionsGetByIdRequest
    from plaid.model.item_get_request import ItemGetRequest

    try:
        item_resp = client.item_get(ItemGetRequest(access_token=access_token))
        institution_id = item_resp.get("item", {}).get("institution_id")
        if not institution_id:
            return fallback
        inst_resp = client.institutions_get_by_id(
            InstitutionsGetByIdRequest(
                institution_id=institution_id,
                country_codes=[CountryCode("US")],
            )
        )
        return inst_resp.get("institution", {}).get("name") or fallback
    except Exception:
        return fallback


def _upsert_connection(
    db: Session,
    account_id: str,
    *,
    item_id: str,
    access_token: str,
    institution_name: Optional[str],
    account_type: Optional[str],
    bank_name: Optional[str],
    is_demo: bool,
    reset_cursor: bool = True,
) -> PlaidConnection:
    existing = db.query(PlaidConnection).filter(PlaidConnection.account_id == account_id).first()
    if existing:
        existing.item_id = item_id
        existing.access_token = access_token
        existing.institution_name = institution_name
        existing.account_type = account_type
        existing.bank_name = bank_name
        existing.is_demo = is_demo
        if reset_cursor:
            existing.sync_cursor = None
        conn = existing
    else:
        conn = PlaidConnection(
            account_id=account_id,
            item_id=item_id,
            access_token=access_token,
            institution_name=institution_name,
            account_type=account_type,
            bank_name=bank_name,
            is_demo=is_demo,
        )
        db.add(conn)
    db.commit()
    db.refresh(conn)
    return conn


def create_link_token(account_id: str) -> dict:
    from plaid.model.country_code import CountryCode
    from plaid.model.link_token_create_request import LinkTokenCreateRequest
    from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
    from plaid.model.products import Products

    client = _get_plaid_client()
    try:
        request = LinkTokenCreateRequest(
            products=[Products("transactions")],
            client_name="Flowcast",
            country_codes=[CountryCode("US")],
            language="en",
            user=LinkTokenCreateRequestUser(client_user_id=account_id),
        )
        response = client.link_token_create(request)
        link_token = response["link_token"]
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Plaid link token failed: {exc}") from exc

    return {
        "link_token": link_token,
        "expiration": response.get("expiration"),
    }


def demo_connect(
    db: Session,
    account_id: str,
    account_type: str,
    bank_name: str,
    business_name: str,
) -> PlaidConnection:
    display = f"{business_name.strip()} — {bank_name}"
    item_id = f"demo_{uuid.uuid4().hex[:12]}"
    conn = _upsert_connection(
        db,
        account_id,
        item_id=item_id,
        access_token=DEMO_ACCESS_TOKEN,
        institution_name=display,
        account_type=account_type,
        bank_name=bank_name,
        is_demo=True,
    )
    record_mock_api_call(db, "/link/demo-connect", account_id, 200)
    return conn


def exchange_public_token(
    db: Session,
    public_token: str,
    account_id: str,
    account_type: Optional[str] = None,
    bank_name: Optional[str] = None,
) -> PlaidConnection:
    from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest

    client = _get_plaid_client()
    fallback_name = bank_name or "Linked bank"
    try:
        request = ItemPublicTokenExchangeRequest(public_token=public_token)
        response = client.item_public_token_exchange(request)
        access_token = response["access_token"]
        item_id = response["item_id"]
        status = 200
    except Exception as exc:
        record_mock_api_call(db, "/item/public_token/exchange", account_id, 500)
        raise HTTPException(
            status_code=502, detail=f"Plaid token exchange failed: {exc}"
        ) from exc

    record_mock_api_call(db, "/item/public_token/exchange", account_id, status)
    institution_name = _resolve_institution_name(client, access_token, fallback_name)

    return _upsert_connection(
        db,
        account_id,
        item_id=item_id,
        access_token=access_token,
        institution_name=institution_name,
        account_type=account_type,
        bank_name=bank_name or institution_name,
        is_demo=False,
    )


def _plaid_tx_to_row(account_id: str, tx: dict) -> dict:
    raw = Decimal(str(tx["amount"]))
    is_income = raw < 0
    stored_amount = abs(raw) if is_income else -abs(raw)

    pfc = tx.get("personal_finance_category") or {}
    category = pfc.get("primary") or pfc.get("detailed") or "Uncategorized"
    category = str(category).replace("_", " ").title()

    merchant = tx.get("merchant_name") or tx.get("name") or "Unknown"
    tx_date = tx.get("date")
    if isinstance(tx_date, str):
        tx_date = date.fromisoformat(tx_date)

    return {
        "id": f"plaid_{tx['transaction_id']}",
        "account_id": account_id,
        "amount": stored_amount,
        "date": tx_date,
        "category": category,
        "merchant_name": merchant,
        "is_income": is_income,
    }


def sync_transactions(db: Session, account_id: str, replace_existing: bool = True) -> dict:
    conn = db.query(PlaidConnection).filter(PlaidConnection.account_id == account_id).first()
    if not conn:
        raise HTTPException(
            status_code=404,
            detail="No bank account linked. Connect your bank first.",
        )

    if conn.is_demo or conn.access_token == DEMO_ACCESS_TOKEN:
        if replace_existing:
            count = seed_transactions(db, account_id)
        else:
            count = db.query(Transaction).filter(Transaction.account_id == account_id).count()
        balance = _update_balance_from_transactions(db, account_id)
        record_mock_api_call(db, "/transactions/sync", account_id, 200)
        return {
            "account_id": account_id,
            "added": count,
            "modified": 0,
            "removed": 0,
            "sync_pages": 1,
            "current_balance": float(balance),
            "institution_name": conn.institution_name,
        }

    from plaid.model.transactions_sync_request import TransactionsSyncRequest

    client = _get_plaid_client()
    cursor = conn.sync_cursor
    added_count = 0
    modified_count = 0
    removed_count = 0
    pages = 0

    if replace_existing:
        db.query(Transaction).filter(Transaction.account_id == account_id).delete()

    while True:
        try:
            request = TransactionsSyncRequest(
                access_token=conn.access_token,
                cursor=cursor,
            )
            response = client.transactions_sync(request)
            status = 200
        except Exception as exc:
            record_mock_api_call(db, "/transactions/sync", account_id, 500)
            raise HTTPException(
                status_code=502, detail=f"Plaid transaction sync failed: {exc}"
            ) from exc

        record_mock_api_call(db, "/transactions/sync", account_id, status)
        pages += 1

        for tx in response.get("added", []):
            db.merge(Transaction(**_plaid_tx_to_row(account_id, tx)))
            added_count += 1

        for tx in response.get("modified", []):
            db.merge(Transaction(**_plaid_tx_to_row(account_id, tx)))
            modified_count += 1

        for removed in response.get("removed", []):
            tid = f"plaid_{removed['transaction_id']}"
            db.query(Transaction).filter(Transaction.id == tid).delete()
            removed_count += 1

        cursor = response.get("next_cursor")
        if not response.get("has_more"):
            break

    conn.sync_cursor = cursor
    conn.updated_at = datetime.utcnow()
    db.commit()

    balance = _update_balance_from_transactions(db, account_id)

    return {
        "account_id": account_id,
        "added": added_count,
        "modified": modified_count,
        "removed": removed_count,
        "sync_pages": pages,
        "current_balance": float(balance),
        "institution_name": conn.institution_name,
    }


def _update_balance_from_transactions(db: Session, account_id: str) -> Decimal:
    rows = (
        db.query(Transaction)
        .filter(Transaction.account_id == account_id)
        .order_by(Transaction.date.asc())
        .all()
    )
    net = sum((r.amount for r in rows), Decimal("0"))
    balance = Decimal("18500.00") + net if rows else Decimal("18500.00")

    db.merge(
        AccountBalance(
            account_id=account_id,
            current_balance=balance,
        )
    )
    db.commit()
    return balance


def plaid_status(db: Session, account_id: str) -> dict:
    conn = db.query(PlaidConnection).filter(PlaidConnection.account_id == account_id).first()
    tx_count = db.query(Transaction).filter(Transaction.account_id == account_id).count()
    is_demo = False
    if conn is not None:
        is_demo = bool(getattr(conn, "is_demo", False))
    return {
        "plaid_configured": settings.plaid_configured,
        "plaid_env": settings.plaid_env if settings.plaid_configured else None,
        "linked": conn is not None,
        "institution_name": conn.institution_name if conn else None,
        "account_type": getattr(conn, "account_type", None) if conn else None,
        "bank_name": getattr(conn, "bank_name", None) if conn else None,
        "is_demo": is_demo,
        "item_id": conn.item_id if conn else None,
        "transaction_count": tx_count,
    }

"""Plaid Link, token exchange, and transaction sync."""
from __future__ import annotations

import time
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from config import settings
from database.models import AccountBalance, PlaidConnection, Transaction
from mock_data.generator import ENDPOINT_COSTS, record_mock_api_call

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


def create_link_token(account_id: str) -> dict:
    from plaid.model.country_code import CountryCode
    from plaid.model.link_token_create_request import LinkTokenCreateRequest
    from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
    from plaid.model.products import Products

    client = _get_plaid_client()
    started = time.perf_counter()
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
        status = 200
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Plaid link token failed: {exc}") from exc
    finally:
        latency = int((time.perf_counter() - started) * 1000)

    return {
        "link_token": link_token,
        "expiration": response.get("expiration"),
        "latency_ms": latency,
        "status": status,
    }


def exchange_public_token(
    db: Session,
    public_token: str,
    account_id: str,
) -> PlaidConnection:
    from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest

    client = _get_plaid_client()
    started = time.perf_counter()
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
    finally:
        latency = int((time.perf_counter() - started) * 1000)

    record_mock_api_call(db, "/item/public_token/exchange", account_id, status)

    institution_name: Optional[str] = None
    try:
        from plaid.model.item_get_request import ItemGetRequest

        item_resp = client.item_get(ItemGetRequest(access_token=access_token))
        institution_name = item_resp.get("item", {}).get("institution_id")
    except Exception:
        pass

    existing = db.query(PlaidConnection).filter(PlaidConnection.account_id == account_id).first()
    if existing:
        existing.item_id = item_id
        existing.access_token = access_token
        existing.institution_name = institution_name
        existing.sync_cursor = None
        conn = existing
    else:
        conn = PlaidConnection(
            account_id=account_id,
            item_id=item_id,
            access_token=access_token,
            institution_name=institution_name,
        )
        db.add(conn)
    db.commit()
    db.refresh(conn)
    return conn


def _plaid_tx_to_row(account_id: str, tx: dict) -> dict:
    raw = Decimal(str(tx["amount"]))
    # Plaid: positive = debit (out), negative = credit (in)
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
            detail="No bank account linked. Connect via Plaid first.",
        )

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
        started = time.perf_counter()
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
        finally:
            int((time.perf_counter() - started) * 1000)

        record_mock_api_call(db, "/transactions/sync", account_id, status)
        pages += 1

        for tx in response.get("added", []):
            row = _plaid_tx_to_row(account_id, tx)
            db.merge(Transaction(**row))
            added_count += 1

        for tx in response.get("modified", []):
            row = _plaid_tx_to_row(account_id, tx)
            db.merge(Transaction(**row))
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
    return {
        "plaid_configured": settings.plaid_configured,
        "plaid_env": settings.plaid_env if settings.plaid_configured else None,
        "linked": conn is not None,
        "institution_name": conn.institution_name if conn else None,
        "item_id": conn.item_id if conn else None,
        "transaction_count": tx_count,
    }

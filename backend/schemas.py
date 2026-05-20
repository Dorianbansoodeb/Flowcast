from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class TransactionOut(BaseModel):
    id: str
    account_id: str
    amount: float
    date: date
    category: str
    merchant_name: str
    is_income: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MockLoadRequest(BaseModel):
    account_id: str = "acct_main"
    seed_api: bool = True


class PlaidLinkTokenRequest(BaseModel):
    account_id: str = "acct_main"


class PlaidLinkTokenResponse(BaseModel):
    link_token: str
    expiration: Optional[str] = None
    plaid_env: str = "sandbox"


class PlaidExchangeRequest(BaseModel):
    public_token: str
    account_id: str = "acct_main"


class PlaidSyncRequest(BaseModel):
    account_id: str = "acct_main"
    replace_existing: bool = False


class PlaidSyncResponse(BaseModel):
    account_id: str
    added: int
    modified: int
    removed: int
    sync_pages: int
    current_balance: float
    institution_name: Optional[str] = None


class PlaidStatusResponse(BaseModel):
    plaid_configured: bool
    plaid_env: Optional[str] = None
    linked: bool
    institution_name: Optional[str] = None
    item_id: Optional[str] = None
    transaction_count: int


class MockApiCallRequest(BaseModel):
    endpoint: str = "/transactions/get"
    account_id: str = "acct_main"
    status: int = 200


class ForecastPointOut(BaseModel):
    date: str
    balance: float
    lower: float
    upper: float
    net_flow: float


class ForecastOut(BaseModel):
    account_id: str
    current_balance: float
    income_30d: float
    expenses_30d: float
    projected_runway_days: int
    forecast: list[ForecastPointOut]
    model: str


class AlertItem(BaseModel):
    type: str
    risk_level: str
    message: str
    predicted_date: Optional[str] = None
    predicted_balance: Optional[float] = None
    threshold: float


class AlertsOut(BaseModel):
    account_id: str
    overall_risk: str
    threshold: float
    alerts: list[AlertItem]

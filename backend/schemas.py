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
    account_type: Optional[str] = None
    bank_name: Optional[str] = None


class PlaidDemoConnectRequest(BaseModel):
    account_id: str = "acct_main"
    account_type: str
    bank_name: str
    business_name: str


class PlaidConnectResponse(BaseModel):
    message: str
    account_id: str
    item_id: str
    institution_name: Optional[str] = None
    account_type: Optional[str] = None
    bank_name: Optional[str] = None
    is_demo: bool = False


class PlaidInstitutionOut(BaseModel):
    id: str
    name: str


class PlaidInstitutionsResponse(BaseModel):
    institutions: list[PlaidInstitutionOut]
    total: int
    source: str


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
    account_type: Optional[str] = None
    bank_name: Optional[str] = None
    is_demo: bool = False
    item_id: Optional[str] = None
    transaction_count: int
    country_codes: list[str] = ["CA"]


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


class SpendingCategory(BaseModel):
    name: str
    amount: float


class SpendingBreakdownOut(BaseModel):
    account_id: str
    period_days: int
    total_expenses: float
    categories: list[SpendingCategory]


class CalendarDay(BaseModel):
    date: str
    day: int
    weekday: int
    income: float
    expenses: float
    net: float
    transaction_count: int
    mood: str


class CashFlowCalendarOut(BaseModel):
    account_id: str
    year: int
    month: int
    heavy_spend_threshold: float
    days: list[CalendarDay]


class WeeklyDigestOut(BaseModel):
    account_id: str
    subject: str
    preview_text: str
    current_balance: float
    runway_days: int
    biggest_expense: Optional[dict] = None
    forecast_30d_min: Optional[float] = None
    risk_message: Optional[str] = None
    delivery_note: str


class AccountCostRow(BaseModel):
    account_id: str
    label: str
    calls: int
    cost_usd: float
    failures: int


class CostByAccountOut(BaseModel):
    period_days: int
    accounts: list[AccountCostRow]
    total_cost_usd: float

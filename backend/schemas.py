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

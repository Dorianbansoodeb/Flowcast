"""PostgreSQL models structured for future TimescaleDB hypertables on time-series tables."""
from __future__ import annotations

from datetime import date as date_type, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from database.connection import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    account_id: Mapped[str] = mapped_column(String(64), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    date: Mapped[date_type] = mapped_column(Date, index=True)
    category: Mapped[str] = mapped_column(String(64))
    merchant_name: Mapped[str] = mapped_column(String(255))
    is_income: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class PlaidConnection(Base):
    """Stored Plaid item for a Flowcast account (sandbox / production)."""

    __tablename__ = "plaid_connections"

    account_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    item_id: Mapped[str] = mapped_column(String(128), unique=True)
    access_token: Mapped[str] = mapped_column(String(512))
    institution_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    account_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    bank_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    sync_cursor: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ApiUsageLog(Base):
    """
    Time-series API usage log. Primary key + time index supports future
    TimescaleDB hypertable on `time` column.
    """

    __tablename__ = "api_usage_logs"
    __table_args__ = (
        Index("ix_api_usage_logs_time", "time"),
        Index("ix_api_usage_logs_endpoint_time", "endpoint", "time"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    endpoint: Mapped[str] = mapped_column(String(128), nullable=False)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[int] = mapped_column(Integer, default=200)
    cost_usd: Mapped[Decimal] = mapped_column(Numeric(10, 6), default=Decimal("0"))
    account_id: Mapped[str] = mapped_column(String(64), index=True)


class AccountBalance(Base):
    """Cached current balance per account (updated from mock Plaid sync)."""

    __tablename__ = "account_balances"

    account_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    current_balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AlertRecord(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[str] = mapped_column(String(64), index=True)
    alert_type: Mapped[str] = mapped_column(String(64))
    risk_level: Mapped[str] = mapped_column(String(16))
    message: Mapped[str] = mapped_column(Text)
    predicted_date: Mapped[Optional[date_type]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

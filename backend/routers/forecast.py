from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.connection import get_db
from schemas import ForecastOut
from services.forecasting import generate_forecast

router = APIRouter(tags=["forecast"])


@router.get("/forecast/{account_id}", response_model=ForecastOut)
def get_forecast(account_id: str, db: Session = Depends(get_db)):
    data = generate_forecast(db, account_id)
    return ForecastOut(**data)

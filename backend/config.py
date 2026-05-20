from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Set DATABASE_URL=sqlite:///./flowcast.db for local dev without Docker/Postgres
    database_url: str = "sqlite:///./flowcast.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    default_account_id: str = "acct_main"
    balance_threshold_usd: float = 2000.0
    forecast_days: int = 90

    class Config:
        env_file = ".env"


settings = Settings()

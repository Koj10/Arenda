from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql://app:app@localhost:5432/app"

    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30
    password_reset_expire_minutes: int = 60

    storage_dir: str = "storage"

    cors_origins: str = (
        "http://localhost:3000,http://localhost:5173,"
        "http://127.0.0.1:3000,http://127.0.0.1:5173,"
        "https://propcount.ru,https://www.propcount.ru"
    )

    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/auth/google/callback"

    apple_team_id: str = ""
    apple_client_id: str = ""
    apple_key_id: str = ""
    apple_private_key: str = ""
    apple_private_key_path: str = ""
    apple_redirect_uri: str = "http://localhost:8000/auth/apple/callback"

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


settings = Settings()

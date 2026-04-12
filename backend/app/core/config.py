from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Shadow PO AI API"
    api_prefix: str = "/api"
    database_url: str = "postgresql+psycopg://shadow:shadow@localhost:5432/shadow_po_ai"
    redis_url: str = "redis://localhost:6379/0"
    openai_model: str = "gpt-5.4"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

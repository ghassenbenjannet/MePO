from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Shadow PO AI API"
    api_prefix: str = "/api"
    database_url: str = "postgresql+psycopg://shadow:shadow@localhost:5432/shadow_po_ai"
    redis_url: str = "redis://localhost:6379/0"
    auth_secret_key: str = "change-me-shadow-po-secret"
    auth_access_token_expire_minutes: int = 60 * 8

    # Google (provider standard)
    ai_provider: str = "google"
    google_api_key: str = ""
    ai_google_default_model: str = "gemini-2.5-flash-preview-04-17"

    # OpenAI (encapsulé temporairement — sera supprimé en T5)
    openai_api_key: str = ""
    openai_model: str = ""
    openai_skill: str = ""
    shadow_runtime_mode: str = "mepo"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

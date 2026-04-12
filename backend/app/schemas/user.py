from pydantic import BaseModel, EmailStr, Field


class UserRead(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    preferred_language: str
    preferred_theme: str
    ai_preferences: dict
    favorite_project_ids: list[str]


class UserProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    preferred_language: str | None = None
    preferred_theme: str | None = None
    ai_preferences: dict | None = None
    favorite_project_ids: list[str] | None = None


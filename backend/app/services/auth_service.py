from datetime import UTC, datetime, timedelta

import jwt
from passlib.context import CryptContext

from app.core.config import settings
from app.schemas.user import UserRead

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str, remember_me: bool = False) -> tuple[str, int]:
    expires_in = settings.auth_access_token_expire_minutes * 60
    if remember_me:
        expires_in = 60 * 60 * 24 * 30

    expire_at = datetime.now(UTC) + timedelta(seconds=expires_in)
    token = jwt.encode(
        {"sub": subject, "exp": expire_at},
        settings.auth_secret_key,
        algorithm="HS256",
    )
    return token, expires_in


def build_demo_user() -> UserRead:
    return UserRead(
        id="user-1",
        email="meryem.ghass@example.com",
        full_name="Meryem Ghass",
        preferred_language="fr",
        preferred_theme="light",
        ai_preferences={
            "response_style": "structured",
            "verbosity": "compact",
            "confidence_labels": True,
        },
        favorite_project_ids=["hcl-livret"],
    )


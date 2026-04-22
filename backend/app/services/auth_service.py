from datetime import UTC, datetime, timedelta

import jwt
from passlib.context import CryptContext

from app.core.config import settings
from app.schemas.user import UserRead

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ─── In-memory preference store (demo mode) ───────────────────────────────────
# Persists within a server session. Replaced by real DB auth when implemented.

_DEMO_USER_ID = "user-1"

_DEFAULT_AI_PREFS: dict = {
    "response_style": "balanced",
    "detail_level": "normal",
    "confidence_labels": True,
    "show_suggestions": True,
    "chat_open_by_default": False,
}

_user_prefs_store: dict[str, dict] = {}


def get_demo_user_prefs() -> dict:
    """Return current AI preferences for the demo user (defaults if never saved)."""
    return dict(_user_prefs_store.get(_DEMO_USER_ID, _DEFAULT_AI_PREFS))


def update_demo_user_prefs(prefs: dict) -> dict:
    """Merge-update AI preferences for the demo user. Returns the updated dict."""
    current = get_demo_user_prefs()
    current.update(prefs)
    _user_prefs_store[_DEMO_USER_ID] = current
    return current


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
        id=_DEMO_USER_ID,
        email="ghassenbenjannet1@gmail.com",
        full_name="Gass ben-Jannet",
        preferred_language="fr",
        preferred_theme="light",
        ai_preferences=get_demo_user_prefs(),
        favorite_project_ids=["hcl-livret"],
    )


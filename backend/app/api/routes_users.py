from fastapi import APIRouter

from app.schemas.user import UserProfileUpdate, UserRead
from app.services.auth_service import build_demo_user, update_demo_user_prefs

router = APIRouter()


@router.get("/me", response_model=UserRead)
def get_me() -> UserRead:
    return build_demo_user()


@router.patch("/me", response_model=UserRead)
def update_me(payload: UserProfileUpdate) -> UserRead:
    updates = payload.model_dump(exclude_none=True)

    # Persist AI preferences in the in-memory store so they survive across calls
    if "ai_preferences" in updates:
        update_demo_user_prefs(updates.pop("ai_preferences"))

    # Apply remaining non-pref updates (full_name, language, theme…) on the model
    user = build_demo_user()
    if updates:
        user = user.model_copy(update=updates)
    return user


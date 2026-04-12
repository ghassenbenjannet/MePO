from fastapi import APIRouter

from app.schemas.user import UserProfileUpdate, UserRead
from app.services.auth_service import build_demo_user

router = APIRouter()


@router.get("/me", response_model=UserRead)
def get_me() -> UserRead:
    return build_demo_user()


@router.patch("/me", response_model=UserRead)
def update_me(payload: UserProfileUpdate) -> UserRead:
    user = build_demo_user()
    updates = payload.model_dump(exclude_none=True)
    return user.model_copy(update=updates)


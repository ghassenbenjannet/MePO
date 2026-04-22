from fastapi import APIRouter, HTTPException, status

from app.schemas.auth import LoginRequest, PasswordResetRequest, RegisterRequest, TokenResponse
from app.schemas.user import UserRead
from app.services.auth_service import build_demo_user, create_access_token

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest) -> TokenResponse:
    if payload.email != "ghassenbenjannet1@gmail.com" or payload.password != "ShadowPO123":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Identifiants invalides.")

    token, expires_in = create_access_token("user-1", remember_me=payload.remember_me)
    return TokenResponse(access_token=token, expires_in=expires_in)


@router.post("/register", response_model=UserRead)
def register(payload: RegisterRequest) -> UserRead:
    return UserRead(
        id="user-2",
        email=payload.email,
        full_name=payload.full_name,
        preferred_language="fr",
        preferred_theme="light",
        ai_preferences={"response_style": "structured"},
        favorite_project_ids=[],
    )


@router.post("/password-reset")
def password_reset(payload: PasswordResetRequest) -> dict:
    return {"message": f"Password reset requested for {payload.email}."}


@router.post("/logout")
def logout() -> dict:
    return {"message": "Logged out."}


@router.get("/me", response_model=UserRead)
def me() -> UserRead:
    return build_demo_user()


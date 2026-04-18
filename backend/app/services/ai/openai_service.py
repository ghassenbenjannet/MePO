from app.core.config import settings


def build_openai_payload(user_request: str) -> dict:
    return {
        "model": settings.openai_model,
        "input": {
            "user_request": user_request,
        },
    }

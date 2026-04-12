def build_openai_payload(user_request: str) -> dict:
    return {
        "model": "gpt-5.4",
        "input": {
            "user_request": user_request,
        },
    }

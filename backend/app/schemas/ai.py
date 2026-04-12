from pydantic import BaseModel


class AIActionSuggestion(BaseModel):
    type: str
    label: str


class AIChatResponse(BaseModel):
    message: str
    suggestions: list[AIActionSuggestion]

from pydantic import BaseModel


class AIContextSource(BaseModel):
    kind: str
    label: str


class AIActionSuggestion(BaseModel):
    type: str
    label: str
    requires_confirmation: bool = True


class AIEvidenceLine(BaseModel):
    label: str
    confidence: str


class AIChatRequest(BaseModel):
    message: str
    project_id: str | None = None
    space_id: str | None = None
    topic_id: str | None = None


class AIChatResponse(BaseModel):
    mode: str
    context_policy: str
    message: str
    context_used: list[AIContextSource]
    evidence: list[AIEvidenceLine]
    suggestions: list[AIActionSuggestion]

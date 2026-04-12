from fastapi import APIRouter

from app.schemas.ai import AIActionSuggestion, AIChatResponse

router = APIRouter()


@router.post("/chat", response_model=AIChatResponse)
def chat() -> AIChatResponse:
    return AIChatResponse(
        message="Je peux rediger une fiche d'evolution, proposer des tickets ou resumer les documents lies.",
        suggestions=[
            AIActionSuggestion(type="create_ticket", label="Creer un ticket"),
            AIActionSuggestion(type="create_document", label="Creer un document"),
            AIActionSuggestion(type="update_memory", label="Mettre a jour la memoire"),
        ],
    )

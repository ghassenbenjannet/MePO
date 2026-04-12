from fastapi import APIRouter

from app.schemas.ai import AIActionSuggestion, AIChatRequest, AIChatResponse
from app.services.ai.context_builder import build_context_snapshot
from app.services.ai.shadow_core import build_evidence, detect_mode, select_context_policy

router = APIRouter()


@router.post("/chat", response_model=AIChatResponse)
def chat(payload: AIChatRequest) -> AIChatResponse:
    mode = detect_mode(payload.message)
    context_policy, routed_sources = select_context_policy(payload.topic_id, payload.space_id, payload.project_id)
    context_used = build_context_snapshot(payload.project_id, payload.space_id, payload.topic_id)

    if not context_used:
        context_used = routed_sources

    return AIChatResponse(
        mode=mode,
        context_policy=context_policy,
        message="Shadow Core a selectionne un mode specialise avec contexte minimal et validation humaine avant toute action.",
        context_used=context_used,
        evidence=build_evidence(mode),
        suggestions=[
            AIActionSuggestion(type="create_ticket", label="Creer un ticket"),
            AIActionSuggestion(type="create_document", label="Creer un document"),
            AIActionSuggestion(type="update_memory", label="Mettre a jour la memoire"),
            AIActionSuggestion(type="save_artifact", label="Enregistrer en artefact"),
        ],
    )

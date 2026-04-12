import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.schemas.ai import AIChatRequest
from app.services.ai.context_builder import build_context_snapshot
from app.services.ai.llm_gateway import call_shadow_core

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/chat")
def chat(payload: AIChatRequest) -> JSONResponse:
    try:
        context_used = build_context_snapshot(payload.project_id, payload.space_id, payload.topic_id)
        context_summary = "\n".join(f"- {c.kind}: {c.label}" for c in context_used)

        result = call_shadow_core(
            user_message=payload.message,
            context_summary=context_summary,
        )

        return JSONResponse(content={
            "mode": result.get("mode", "pilotage"),
            "context_policy": "space-first compact context",
            "message": result.get("message", ""),
            "context_used": [{"kind": c.kind, "label": c.label} for c in context_used],
            "evidence": result.get("evidence", []),
            "suggestions": result.get("suggestions", []),
        })

    except Exception as exc:
        logger.exception("Shadow Core error: %s", exc)
        return JSONResponse(status_code=500, content={"detail": str(exc)})

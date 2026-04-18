"""AI action execution route — validates and dispatches Shadow PO proposed actions."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from fastapi import HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.ai import ActionExecuteRequest
from app.services.ai.action_proposal_registry import get_action_proposal, mark_action_executed
from app.services.ai.action_engine import execute_action

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/actions/execute")
def execute(req: ActionExecuteRequest, db: Session = Depends(get_db)) -> JSONResponse:
    """Execute a Shadow PO proposed action after user confirmation."""
    try:
        if not req.action_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="action_id obligatoire : la confirmation doit porter sur une action proposee precise.",
            )
        if not req.confirmed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Confirmation utilisateur obligatoire avant execution.",
            )
        proposal = get_action_proposal(db, req.action_id)
        if not proposal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Action proposee introuvable ou expiree.",
            )
        if proposal.status == "executed":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cette action a deja ete executee.",
            )

        allowed_types = {proposal.action_type}
        if proposal.action_type == "select_ticket_then_add_comment":
            allowed_types.add("add_comment")
        if req.action_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le type d'action execute ne correspond pas a l'action proposee.",
            )

        effective_request = req.model_copy(
            update={
                "project_id": req.project_id or proposal.project_id,
                "space_id": req.space_id or proposal.space_id,
                "topic_id": req.topic_id or proposal.topic_id,
            }
        )
        result = execute_action(db, effective_request)
        if not result.success:
            db.rollback()
        mark_action_executed(
            db,
            proposal=proposal,
            success=result.success,
            message=result.message,
            execution_result=result.created_object,
        )
        result.action_id = req.action_id
        return JSONResponse(
            status_code=200 if result.success else 400,
            content=result.model_dump(),
        )
    except HTTPException as exc:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    except Exception as exc:
        logger.exception("Action execute error: %s", exc)
        return JSONResponse(status_code=500, content={"detail": str(exc)})

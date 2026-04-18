from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.schemas.ai import AIChatRequest, AIChatResponse, ProposedAction
from app.services.ai.action_proposal_registry import register_proposed_actions
from app.services.ai.ticket_resolver import resolve_ticket
from app.services.ai.topic_resolver import resolve_topic

logger = logging.getLogger(__name__)


@dataclass
class ActionPolicyResult:
    response: AIChatResponse
    status: str


class ActionPolicyEngine:
    def apply(
        self,
        db: Session,
        *,
        ai_response: AIChatResponse,
        payload: AIChatRequest,
        stop_on_existing_mepo_object: bool,
        pre_ticket_res: object | None,
    ) -> ActionPolicyResult:
        status_notes: list[str] = []

        if stop_on_existing_mepo_object and ai_response.mode == "redaction":
            forbidden_types = {
                "create_ticket",
                "create_topic_then_ticket",
                "select_topic_then_create_ticket",
            }
            before = len(ai_response.proposed_actions)
            ai_response.proposed_actions = [
                action for action in ai_response.proposed_actions if action.type not in forbidden_types
            ]
            removed = before - len(ai_response.proposed_actions)
            if removed:
                logger.warning(
                    "action_policy_engine: removed %d forbidden ticket creation action(s)",
                    removed,
                )
                status_notes.append("removed_forbidden_ticket_creations")

        _MIN_DOC_CONTENT = 100
        response_mode = ai_response.mode or ""

        doc_from_generated: str | None = None
        doc_title_from_generated: str | None = None
        for go in ai_response.generated_objects:
            if go.type in ("document", "artifact"):
                raw_content = (
                    go.content.get("content")
                    or go.content.get("body")
                    or go.content.get("description")
                    or ""
                )
                if len(raw_content) >= _MIN_DOC_CONTENT:
                    doc_from_generated = raw_content
                    doc_title_from_generated = go.content.get("title") or go.label
                    break

        actions_to_keep: list[ProposedAction] = []
        for action in ai_response.proposed_actions:
            if action.type in ("create_document", "create_artifact"):
                if doc_from_generated and not action.payload.get("content"):
                    action.payload["content"] = doc_from_generated
                    if doc_title_from_generated and not action.payload.get("title"):
                        action.payload["title"] = doc_title_from_generated

                if not action.payload.get("content") and response_mode == "redaction":
                    answer = ai_response.answer_markdown or ""
                    if len(answer) >= _MIN_DOC_CONTENT:
                        action.payload["content"] = answer
                        status_notes.append("used_answer_markdown_for_document")

                if not action.payload.get("content"):
                    logger.warning(
                        "action_policy_engine: dropping %s action without usable content",
                        action.type,
                    )
                    status_notes.append("dropped_empty_document_action")
                    continue

            actions_to_keep.append(action)
        ai_response.proposed_actions = actions_to_keep

        has_doc_action = any(
            a.type in ("create_document", "create_artifact")
            for a in ai_response.proposed_actions
        )
        if not has_doc_action and doc_from_generated:
            ai_response.proposed_actions.append(
                ProposedAction(
                    actionId=str(uuid.uuid4()),
                    type="create_document",
                    label=f"Sauvegarder le document : {doc_title_from_generated or 'Document genere'}",
                    payload={
                        "title": doc_title_from_generated or "Document genere",
                        "content": doc_from_generated,
                    },
                    requires_confirmation=True,
                )
            )
            status_notes.append("auto_injected_create_document")

        for action in ai_response.proposed_actions:
            if action.type == "add_comment" and not action.payload.get("ticket_id"):
                if pre_ticket_res and getattr(pre_ticket_res, "suggested_ticket_id", None):
                    action.payload["ticket_id"] = pre_ticket_res.suggested_ticket_id
                    action.payload["comment"] = action.payload.get("comment") or ai_response.answer_markdown or payload.message
                    status_notes.append("attached_comment_to_ranked_ticket")
                else:
                    action.type = "select_ticket_then_add_comment"
                    action.label = "Choisir un ticket puis commenter"
                    status_notes.append("converted_orphan_comment_action")

        extra_actions: list[ProposedAction] = []
        for action in ai_response.proposed_actions:
            if action.type not in {"create_ticket", "create_document", "create_artifact"}:
                continue

            topic_res = resolve_topic(
                payload.message,
                action.label,
                ai_response.context_objects,
                active_topic_id=payload.topic_id,
            )
            if action.type == "create_ticket":
                if topic_res.match_status == "exact_match":
                    if not action.payload.get("topic_id"):
                        action.payload["topic_id"] = topic_res.suggested_topic_id
                elif topic_res.match_status == "possible_matches":
                    action.type = "select_topic_then_create_ticket"
                else:
                    action.type = "create_topic_then_ticket"
                    if not action.payload.get("new_topic_name"):
                        action.payload["new_topic_name"] = action.payload.get("title", action.label)

            action.payload["_resolution"] = topic_res.model_dump()

            final_topic_id = (
                topic_res.suggested_topic_id
                or action.payload.get("topic_id")
                or payload.topic_id
            )
            ticket_res = resolve_ticket(
                payload.message,
                action.label,
                ai_response.context_objects,
                resolved_topic_id=final_topic_id,
            )
            action.payload["_ticket_resolution"] = ticket_res.model_dump()

            if (
                action.type in {"create_ticket", "create_topic_then_ticket", "select_topic_then_create_ticket"}
                and ticket_res.match_status == "found_duplicate"
                and ticket_res.suggested_ticket_id
            ):
                extra_actions.append(
                    ProposedAction(
                        actionId=str(uuid.uuid4()),
                        type="add_comment",
                        label=f"Commenter le ticket existant : {ticket_res.suggested_ticket_title}",
                        payload={
                            "ticket_id": ticket_res.suggested_ticket_id,
                            "comment": payload.message,
                            "_is_duplicate_alternative": True,
                            "_for_action_label": action.label,
                        },
                        requires_confirmation=True,
                    )
                )
                status_notes.append("added_duplicate_comment_alternative")

        ai_response.proposed_actions.extend(extra_actions)
        ai_response.proposed_actions = register_proposed_actions(
            db,
            project_id=payload.project_id,
            space_id=payload.space_id,
            topic_id=payload.topic_id,
            actions=ai_response.proposed_actions,
        )
        return ActionPolicyResult(
            response=ai_response,
            status=";".join(status_notes) if status_notes else "validated",
        )

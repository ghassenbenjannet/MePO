from __future__ import annotations

from dataclasses import dataclass
import re

from app.core.feature_flags import AI_CHAT_SQL_GUARDRAIL
from app.schemas.ai import AIChatResponse, ContextObject, DebugInfo, KnowledgeDocRef
from app.services.ai.response_parser import parse_shadow_po_response


@dataclass
class OutputValidationResult:
    response: AIChatResponse
    status: str


_SQL_REQUEST_RE = re.compile(r"\b(sql|bdd|base de donnees|base de données|schema|schéma|table|tables|colonne|colonnes|requete|requête|query)\b", re.IGNORECASE)
_SQL_TABLE_RE = re.compile(r"\b(?:from|join|update|into|delete\s+from)\s+([A-Za-z_][A-Za-z0-9_]*)", re.IGNORECASE)
_PROVEN_TABLE_RE = re.compile(r"\b[A-Z][A-Z0-9_]{2,}\b")


def _flatten_context_strings(value: object) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        result: list[str] = []
        for item in value.values():
            result.extend(_flatten_context_strings(item))
        return result
    if isinstance(value, list):
        result: list[str] = []
        for item in value:
            result.extend(_flatten_context_strings(item))
        return result
    return []


def _normalize_table_name(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9_]", "", value.strip().lower())
    if normalized.endswith("es") and len(normalized) > 4:
        normalized = normalized[:-2]
    elif normalized.endswith("s") and len(normalized) > 3:
        normalized = normalized[:-1]
    return normalized


def _extract_proven_tables(context_objects: list[ContextObject], knowledge_refs: list[KnowledgeDocRef]) -> dict[str, str]:
    proven: dict[str, str] = {}
    for obj in context_objects:
        for chunk in [obj.label, *_flatten_context_strings(obj.content)]:
            for candidate in _PROVEN_TABLE_RE.findall(chunk):
                proven.setdefault(_normalize_table_name(candidate), candidate)
    for doc in knowledge_refs:
        for candidate in _PROVEN_TABLE_RE.findall(doc.title):
            proven.setdefault(_normalize_table_name(candidate), candidate)
    return proven


def _enforce_sql_guardrail(
    *,
    response: AIChatResponse,
    user_request: str,
    context_objects: list[ContextObject],
    knowledge_refs: list[KnowledgeDocRef],
) -> AIChatResponse:
    if not AI_CHAT_SQL_GUARDRAIL or not _SQL_REQUEST_RE.search(user_request):
        return response

    answer = response.answer_markdown or ""
    if not answer:
        return response

    sql_tables = _SQL_TABLE_RE.findall(answer)
    if not sql_tables:
        return response

    proven_tables = _extract_proven_tables(context_objects, knowledge_refs)
    if not proven_tables:
        response.certainty.to_confirm = [
            *response.certainty.to_confirm,
            "Les tables SQL ne sont pas prouvees dans les elements injectes.",
        ][:4]
        response.answer_markdown = (
            "La requete SQL precise ne peut pas etre fournie sans preuve BDD injectee. "
            "Confirme les tables/schema avant execution."
        )
        return response

    unresolved: list[str] = []
    repaired_answer = answer
    for raw_table in sql_tables:
        normalized = _normalize_table_name(raw_table)
        proven = proven_tables.get(normalized)
        if proven:
            if raw_table != proven:
                repaired_answer = re.sub(rf"\b{re.escape(raw_table)}\b", proven, repaired_answer)
            continue
        unresolved.append(raw_table)

    if unresolved:
        proven_list = ", ".join(sorted(set(proven_tables.values()))[:6])
        response.certainty.to_confirm = [
            *response.certainty.to_confirm,
            f"Tables SQL a confirmer: {', '.join(sorted(set(unresolved)))}.",
        ][:4]
        response.answer_markdown = (
            "La requete SQL demandee ne peut pas etre validee telle quelle: certaines tables ne sont pas prouvees "
            f"dans les preuves injectees ({', '.join(sorted(set(unresolved)))}). "
            f"Tables prouvees disponibles: {proven_list}."
        )
        return response

    response.answer_markdown = repaired_answer
    return response


class OutputValidator:
    def validate(
        self,
        raw_result: dict,
        *,
        knowledge_refs: list[KnowledgeDocRef],
        valid_context_ids: set[str],
        context_objects: list[ContextObject],
        debug_info: DebugInfo | None,
        user_request: str = "",
    ) -> OutputValidationResult:
        parsed = parse_shadow_po_response(
            raw_result,
            skill="shadow_po_v1",
            knowledge_docs_used=knowledge_refs,
            valid_context_ids=valid_context_ids,
            context_objects=context_objects,
            debug_info=debug_info,
        )
        parsed = _enforce_sql_guardrail(
            response=parsed,
            user_request=user_request,
            context_objects=context_objects,
            knowledge_refs=knowledge_refs,
        )
        status = "repaired" if "__parse_error" in raw_result else "validated"
        return OutputValidationResult(response=parsed, status=status)

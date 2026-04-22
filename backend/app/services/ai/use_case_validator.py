"""Strict per-use_case output validation for the standard Google LLM pipeline.

After each LLM call, the raw result is passed here before being persisted.
The validator:
  - Checks all required fields are present
  - Derives document_backed / evidence_level from actual sources_used count
    (never trusts the LLM's own claim)
  - Cross-checks cited doc_ids against the injected corpus
  - Generates an explicit warning when evidence is required but absent
  - Repairs missing list/string fields rather than failing hard
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any

_SKILL_TITLE_RE = re.compile(
    r"shadow.?po|skill.?v\d|copilote|assistant.ia|mepo.skill",
    re.IGNORECASE,
)

logger = logging.getLogger(__name__)

# Use cases that require documentary evidence
EVIDENCE_REQUIRED = frozenset({
    "analyse",
    "bogue",
    "recette",
    "redaction_besoin",
    "structuration_sujet",
})

# Strict contracts per use case
USE_CASE_CONTRACTS: dict[str, dict[str, Any]] = {
    "analyse": {
        "required_fields": ["answer_markdown", "understanding", "sources_used", "next_actions"],
        "list_fields": ["sources_used", "proposed_actions", "related_objects", "next_actions"],
        "min_sources_for_backed": 1,
        "min_sources_strong": 3,
        "min_sources_moderate": 1,
    },
    "bogue": {
        "required_fields": ["answer_markdown", "understanding", "sources_used", "proposed_actions"],
        "list_fields": ["sources_used", "proposed_actions", "related_objects", "next_actions"],
        "min_sources_for_backed": 1,
        "min_sources_strong": 3,
        "min_sources_moderate": 1,
    },
    "recette": {
        "required_fields": ["answer_markdown", "understanding", "sources_used", "proposed_actions"],
        "list_fields": ["sources_used", "proposed_actions", "related_objects", "next_actions"],
        "min_sources_for_backed": 1,
        "min_sources_strong": 3,
        "min_sources_moderate": 1,
    },
    "question_generale": {
        "required_fields": ["answer_markdown", "understanding"],
        "list_fields": ["proposed_actions", "related_objects", "next_actions", "sources_used"],
        "min_sources_for_backed": 0,
        "min_sources_strong": 3,
        "min_sources_moderate": 1,
    },
    "redaction_besoin": {
        "required_fields": ["answer_markdown", "understanding", "sources_used", "next_actions"],
        "list_fields": ["sources_used", "proposed_actions", "related_objects", "next_actions"],
        "min_sources_for_backed": 1,
        "min_sources_strong": 3,
        "min_sources_moderate": 1,
    },
    "structuration_sujet": {
        "required_fields": ["answer_markdown", "understanding", "proposed_actions", "next_actions"],
        "list_fields": ["sources_used", "proposed_actions", "related_objects", "next_actions"],
        "min_sources_for_backed": 0,
        "min_sources_strong": 3,
        "min_sources_moderate": 1,
    },
}

_DEFAULT_CONTRACT = USE_CASE_CONTRACTS["question_generale"]


@dataclass
class ValidationResult:
    llm_result: dict
    retrieved_docs_count: int
    retained_docs_count: int
    evidence_count: int
    evidence_level: str
    document_backed: bool
    warning_no_docs: str | None
    format_issues: list[str] = field(default_factory=list)
    was_repaired: bool = False


def _normalize_source(src: Any) -> dict | None:
    if not isinstance(src, dict):
        return None
    doc_id = str(src.get("doc_id") or src.get("id") or "").strip()
    title = str(src.get("title") or "").strip()
    if not doc_id and not title:
        return None
    return {
        "doc_id": doc_id,
        "title": title or "Document sans titre",
        "role": str(src.get("role") or "reference"),
    }


def _derive_evidence_level(count: int, contract: dict) -> str:
    if count >= contract["min_sources_strong"]:
        return "strong"
    if count >= contract["min_sources_moderate"] and contract["min_sources_moderate"] > 0:
        return "moderate"
    if count > 0:
        return "weak"
    return "none"


def validate_use_case_output(
    llm_result: dict,
    *,
    use_case: str,
    retrieved_doc_ids: list[str],
) -> ValidationResult:
    """Validate and repair a raw LLM result against the use_case contract.

    Always returns a ValidationResult — never raises. All fields in llm_result
    are mutated in place so the caller can use llm_result directly.
    """
    contract = USE_CASE_CONTRACTS.get(use_case, _DEFAULT_CONTRACT)
    format_issues: list[str] = []
    repaired = False

    # 1. Ensure all list fields are lists (repair bad types from LLM)
    for list_field in contract["list_fields"]:
        val = llm_result.get(list_field)
        if not isinstance(val, list):
            llm_result[list_field] = []
            if val is not None:
                format_issues.append(f"bad_type:{list_field}")
                repaired = True

    # 2. Ensure required string fields exist and are strings
    for req_field in contract["required_fields"]:
        val = llm_result.get(req_field)
        if val is None or (isinstance(val, (str,)) and not val.strip() and req_field not in contract["list_fields"]):
            if req_field not in contract["list_fields"]:
                llm_result.setdefault(req_field, "")
                format_issues.append(f"missing_field:{req_field}")
                repaired = True

    # 3. Normalize and deduplicate sources_used
    raw_sources = llm_result.get("sources_used") or []
    normalized: list[dict] = []
    seen_ids: set[str] = set()
    for src in raw_sources:
        ns = _normalize_source(src)
        if ns is None:
            continue
        # Drop any source that cites the skill itself (not a corpus document)
        if _SKILL_TITLE_RE.search(ns.get("title", "") + ns.get("doc_id", "")):
            logger.debug("use_case_validator: dropped skill self-citation: %s", ns)
            continue
        dedup_key = ns["doc_id"] or ns["title"]
        if dedup_key in seen_ids:
            continue
        seen_ids.add(dedup_key)
        normalized.append(ns)

    # 4. Cross-check sources against retrieved corpus
    retrieved_set = set(retrieved_doc_ids)
    if retrieved_set and normalized:
        unverified = [s for s in normalized if s["doc_id"] not in retrieved_set]
        if unverified:
            logger.warning(
                "use_case_validator: %d source(s) cited by LLM not in corpus "
                "(use_case=%s, unknown_ids=%s)",
                len(unverified),
                use_case,
                [s["doc_id"] for s in unverified],
            )
            # Keep sources: LLM may use partial or display IDs; do not discard
    llm_result["sources_used"] = normalized

    # 5. Derive document_backed and evidence_level from actual sources count
    #    — never trust the LLM's claim
    evidence_count = len(normalized)
    min_for_backed = contract["min_sources_for_backed"]
    document_backed = evidence_count >= min_for_backed if min_for_backed > 0 else False
    evidence_level = _derive_evidence_level(evidence_count, contract)

    llm_claimed_backed = bool(llm_result.get("document_backed", False))
    if llm_claimed_backed != document_backed:
        format_issues.append(
            f"document_backed_mismatch:claimed={llm_claimed_backed},derived={document_backed}"
        )
        repaired = True

    llm_result["document_backed"] = document_backed
    llm_result["evidence_level"] = evidence_level

    # 6. Generate explicit warning when evidence is required but absent
    warning_no_docs: str | None = None
    if use_case in EVIDENCE_REQUIRED and not document_backed:
        if retrieved_doc_ids:
            warning_no_docs = (
                f"⚠ Réponse produite sans exploitation documentaire vérifiable. "
                f"{len(retrieved_doc_ids)} document(s) disponible(s) dans le corpus "
                f"mais aucun cité dans cette réponse. "
                f"Vérifiez la pertinence du corpus pour ce cas métier."
            )
        else:
            warning_no_docs = (
                "⚠ Aucun document disponible dans la base de connaissances. "
                "Importez et synchronisez des documents pour obtenir des réponses documentées."
            )

    # 7. Force explicit warning in answer_markdown if needed
    answer_md = str(llm_result.get("answer_markdown") or "").strip()
    if warning_no_docs and use_case in EVIDENCE_REQUIRED and not document_backed:
        proof_warning = "\n\n> ⚠ **Analyse produite sans preuve documentaire suffisante.**"
        if proof_warning.strip() not in answer_md:
            answer_md = answer_md + proof_warning
            repaired = True
    llm_result["answer_markdown"] = answer_md

    # 8. Ensure standard defaults
    llm_result.setdefault("mode", use_case)
    llm_result.setdefault("understanding", "")
    llm_result.setdefault("proposed_actions", [])
    llm_result.setdefault("related_objects", [])
    llm_result.setdefault("next_actions", [])

    if format_issues:
        logger.info(
            "use_case_validator: %d issue(s) repaired (use_case=%s): %s",
            len(format_issues),
            use_case,
            format_issues,
        )

    return ValidationResult(
        llm_result=llm_result,
        retrieved_docs_count=len(retrieved_doc_ids),
        retained_docs_count=evidence_count,
        evidence_count=evidence_count,
        evidence_level=evidence_level,
        document_backed=document_backed,
        warning_no_docs=warning_no_docs,
        format_issues=format_issues,
        was_repaired=repaired,
    )

from __future__ import annotations

import json

from app.contracts.runtime import CompactEvidence, CountCharMetrics, EvidenceItem

_SOURCE_RANK = {
    "mepo_objects": 0,
    "topic_memory": 1,
    "local_documents": 2,
    "knowledge_documents": 3,
    "vector_store": 4,
}


def _truncate(value: str, limit: int) -> str:
    value = " ".join(value.split())
    if len(value) <= limit:
        return value
    clipped = value[:limit].rstrip()
    if " " in clipped:
        clipped = clipped.rsplit(" ", 1)[0]
    return f"{clipped}..."


def _safe_json_len(value: object) -> int:
    return len(json.dumps(value, ensure_ascii=False, default=str))


def _normalized_signature(item: EvidenceItem) -> tuple[str, str]:
    doc_key = str(item.provenance.get("knowledge_document_id") or item.provenance.get("id") or item.title).lower()
    claim = " ".join(item.extracted_claims[:1]).strip().lower()
    excerpt = " ".join(item.excerpt.split()).strip().lower()
    return doc_key, claim or excerpt[:120]


def _claim_signature(item: EvidenceItem) -> str:
    claim = " ".join(item.extracted_claims[:1]).strip().lower()
    excerpt = " ".join(item.excerpt.split()).strip().lower()
    return claim or excerpt[:120]


class EvidenceReducer:
    def reduce(
        self,
        evidence_items: list[EvidenceItem],
        *,
        max_count: int,
        max_chars: int,
    ) -> tuple[list[CompactEvidence], list[dict], CountCharMetrics]:
        before_count = len(evidence_items)
        before_chars = sum(_safe_json_len(item.model_dump(by_alias=True, mode="json")) for item in evidence_items)

        kept_by_signature: dict[tuple[str, str], EvidenceItem] = {}
        dropped: list[dict] = []

        for item in evidence_items:
            signature = _normalized_signature(item)
            current = kept_by_signature.get(signature)
            if current is None:
                kept_by_signature[signature] = item
                continue

            current_rank = _SOURCE_RANK[current.source_level]
            candidate_rank = _SOURCE_RANK[item.source_level]
            if candidate_rank < current_rank or (
                candidate_rank == current_rank and item.relevance_score > current.relevance_score
            ):
                dropped.append({"evidence_id": current.evidence_id, "reason": "covered_by_higher_priority_evidence"})
                kept_by_signature[signature] = item
            else:
                dropped.append({"evidence_id": item.evidence_id, "reason": "covered_by_higher_priority_evidence"})

        one_per_document: dict[str, EvidenceItem] = {}
        for item in kept_by_signature.values():
            doc_key = str(item.provenance.get("knowledge_document_id") or item.provenance.get("id") or item.title)
            existing = one_per_document.get(doc_key)
            if existing is None:
                one_per_document[doc_key] = item
                continue
            existing_rank = _SOURCE_RANK[existing.source_level]
            candidate_rank = _SOURCE_RANK[item.source_level]
            if candidate_rank < existing_rank or item.relevance_score > existing.relevance_score:
                dropped.append({"evidence_id": existing.evidence_id, "reason": "same_document_lower_value"})
                one_per_document[doc_key] = item
            else:
                dropped.append({"evidence_id": item.evidence_id, "reason": "same_document_lower_value"})

        covered_claims: dict[str, EvidenceItem] = {}
        for item in one_per_document.values():
            claim_signature = _claim_signature(item)
            existing = covered_claims.get(claim_signature)
            if existing is None:
                covered_claims[claim_signature] = item
                continue
            existing_rank = _SOURCE_RANK[existing.source_level]
            candidate_rank = _SOURCE_RANK[item.source_level]
            if candidate_rank < existing_rank or item.relevance_score > existing.relevance_score:
                dropped.append({"evidence_id": existing.evidence_id, "reason": "covered_by_same_claim_higher_source"})
                covered_claims[claim_signature] = item
            else:
                dropped.append({"evidence_id": item.evidence_id, "reason": "covered_by_same_claim_higher_source"})

        retained_items = list(covered_claims.values())
        retained_items.sort(key=lambda item: (_SOURCE_RANK[item.source_level], -item.relevance_score, -item.reliability_score, item.title.lower()))
        compact = [
            CompactEvidence(
                evidenceId=item.evidence_id,
                title=item.title,
                sourceLevel=item.source_level,
                summary=_truncate(item.excerpt or " ".join(item.extracted_claims), 120),
                relevanceReason=_truncate(
                    f"source={item.source_level}; relevance={item.relevance_score:.2f}; reliability={item.reliability_score:.2f}",
                    80,
                ),
                provenance=item.provenance,
            )
            for item in retained_items
        ]

        while len(compact) > max_count:
            removed = compact.pop()
            dropped.append({"evidence_id": removed.evidence_id, "reason": "budget_evidence_count"})

        total_chars = sum(_safe_json_len(item.model_dump(by_alias=True, mode="json")) for item in compact)
        while compact and total_chars > max_chars:
            removed = compact.pop()
            dropped.append({"evidence_id": removed.evidence_id, "reason": "budget_evidence_chars"})
            total_chars = sum(_safe_json_len(item.model_dump(by_alias=True, mode="json")) for item in compact)

        metrics = CountCharMetrics(
            beforeCount=before_count,
            afterCount=len(compact),
            beforeChars=before_chars,
            afterChars=total_chars,
        )
        return compact, dropped, metrics


__all__ = ["EvidenceReducer"]

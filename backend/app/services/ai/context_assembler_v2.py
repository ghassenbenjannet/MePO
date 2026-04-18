from __future__ import annotations

import json

from app.contracts.runtime import (
    AssemblyMetrics,
    CompactObjectRef,
    ContextPack,
    CountCharMetrics,
    EvidencePack,
    IntentDecision,
    PromptBudgetPolicy,
    RetrievalPlan,
)
from app.schemas.ai import ContextObject
from app.services.ai.evidence_reducer import EvidenceReducer
from app.services.ai.object_summarizer import ObjectSummarizer
from app.services.ai.prompt_budget_policy import get_prompt_budget_policy


def _safe_json_len(value: object) -> int:
    return len(json.dumps(value, ensure_ascii=False, default=str))


class ContextAssemblerV2:
    def __init__(self) -> None:
        self.object_summarizer = ObjectSummarizer()
        self.evidence_reducer = EvidenceReducer()

    def _trim_to_total_budget(
        self,
        *,
        budget_policy: PromptBudgetPolicy,
        skill_projection: str,
        object_summaries: list[CompactObjectRef],
        evidence_items,
        object_metrics: CountCharMetrics,
        evidence_metrics: CountCharMetrics,
        dropped_objects: list[dict],
        dropped_evidence: list[dict],
    ) -> tuple[list[CompactObjectRef], list, CountCharMetrics, CountCharMetrics, list[str]]:
        trim_reasons: list[str] = []

        def current_total() -> int:
            return len(skill_projection) + object_metrics.after_chars + evidence_metrics.after_chars

        while evidence_items and current_total() > budget_policy.max_total_chars:
            removed = evidence_items.pop()
            dropped_evidence.append({"evidence_id": removed.evidence_id, "reason": "budget_total_chars"})
            evidence_metrics = CountCharMetrics(
                beforeCount=evidence_metrics.before_count,
                afterCount=len(evidence_items),
                beforeChars=evidence_metrics.before_chars,
                afterChars=sum(_safe_json_len(item.model_dump(by_alias=True, mode="json")) for item in evidence_items),
            )
            trim_reasons.append("cut_low_priority_evidence_for_total_budget")

        while object_summaries and current_total() > budget_policy.max_total_chars:
            removed = object_summaries.pop()
            dropped_objects.append({"id": removed.id, "kind": removed.kind, "reason": "budget_total_chars"})
            object_metrics = CountCharMetrics(
                beforeCount=object_metrics.before_count,
                afterCount=len(object_summaries),
                beforeChars=object_metrics.before_chars,
                afterChars=sum(_safe_json_len(item.model_dump(by_alias=True, mode="json")) for item in object_summaries),
            )
            trim_reasons.append("cut_secondary_objects_for_total_budget")

        return object_summaries, evidence_items, object_metrics, evidence_metrics, trim_reasons

    def assemble(
        self,
        *,
        user_request: str,
        intent_decision: IntentDecision,
        skill_projection: str,
        context_objects: list[ContextObject],
        evidence_pack: EvidencePack,
        output_contract: dict,
        action_policy_projection: dict,
        contradictions: list[str] | None = None,
        to_confirm: list[str] | None = None,
    ) -> ContextPack:
        budget_policy = get_prompt_budget_policy(intent_decision.mode)

        protected_skill = skill_projection[: budget_policy.max_skill_chars]
        trim_reasons: list[str] = []
        if len(skill_projection) > len(protected_skill):
            trim_reasons.append("trim_skill_projection_to_budget")

        compact_objects, dropped_objects, object_metrics = self.object_summarizer.reduce(
            context_objects,
            max_count=budget_policy.max_object_count,
            max_chars=budget_policy.max_object_chars,
        )
        if dropped_objects:
            trim_reasons.append("object_dedup_or_budget_applied")

        compact_evidence, dropped_evidence, evidence_metrics = self.evidence_reducer.reduce(
            evidence_pack.evidence_items,
            max_count=budget_policy.max_evidence_count,
            max_chars=budget_policy.max_evidence_chars,
        )
        if dropped_evidence:
            trim_reasons.append("evidence_reduction_applied")

        compact_objects, compact_evidence, object_metrics, evidence_metrics, extra_trim_reasons = self._trim_to_total_budget(
            budget_policy=budget_policy,
            skill_projection=protected_skill,
            object_summaries=compact_objects,
            evidence_items=compact_evidence,
            object_metrics=object_metrics,
            evidence_metrics=evidence_metrics,
            dropped_objects=dropped_objects,
            dropped_evidence=dropped_evidence,
        )
        trim_reasons.extend(extra_trim_reasons)

        chars_before = len(skill_projection) + object_metrics.before_chars + evidence_metrics.before_chars
        chars_after = len(protected_skill) + object_metrics.after_chars + evidence_metrics.after_chars
        estimated_tokens_after = max(1, chars_after // 4)
        if estimated_tokens_after > budget_policy.max_estimated_tokens:
            trim_reasons.append("estimated_tokens_at_ceiling")

        key_objects = [
            {
                "kind": item.kind,
                "id": item.id,
                "label": item.label,
                "summary": item.summary,
                "source_level": item.source_level,
            }
            for item in compact_objects
        ]
        evidence_summary = " | ".join(item.title for item in compact_evidence[:4])
        assembly_metrics = AssemblyMetrics(
            objectCountBefore=object_metrics.before_count,
            objectCountAfter=object_metrics.after_count,
            evidenceCountBefore=evidence_metrics.before_count,
            evidenceCountAfter=evidence_metrics.after_count,
            charsBefore=chars_before,
            charsAfter=chars_after,
            trimmed=bool(trim_reasons),
            trimReasons=list(dict.fromkeys(trim_reasons)),
        )

        return ContextPack(
            canonicalUserRequest=user_request.strip(),
            mode=intent_decision.mode,
            skillProjection=protected_skill,
            objectSummaries=compact_objects,
            evidenceItems=compact_evidence,
            keyObjects=key_objects,
            evidenceSummary=evidence_summary,
            contradictions=contradictions or [],
            openPoints=to_confirm or [],
            outputContract=output_contract,
            actionPolicyProjection=action_policy_projection,
            assemblyMetrics=assembly_metrics,
            objectMetrics=object_metrics,
            evidenceMetrics=evidence_metrics,
            budgetPolicy=budget_policy,
            droppedEvidence=dropped_evidence,
            droppedObjects=dropped_objects,
        )


__all__ = ["ContextAssemblerV2"]

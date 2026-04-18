from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.contracts.runtime import EvidenceItem, EvidencePack, IntentDecision
from app.schemas.ai import ContextObject
from app.services.ai.context_assembler_v2 import ContextAssemblerV2
from app.services.ai.evidence_reducer import EvidenceReducer
from app.services.ai.object_summarizer import ObjectSummarizer
from app.services.ai.prompt_budget_policy import get_prompt_budget_policy


class ContextAssemblyV2Tests(unittest.TestCase):
    def setUp(self) -> None:
        self.object_summarizer = ObjectSummarizer()
        self.evidence_reducer = EvidenceReducer()
        self.assembler = ContextAssemblerV2()

    def test_object_summarizer_deduplicates_and_keeps_compact_refs(self) -> None:
        objects = [
            ContextObject(kind="ticket", id="LIV-1", label="LIV-1 - Bug", content={"type": "bug", "status": "todo", "priority": "high", "description": "Description longue"}),
            ContextObject(kind="ticket", id="LIV-1", label="LIV-1 - Bug", content={"type": "bug", "status": "todo", "priority": "high", "description": "Description longue"}),
            ContextObject(kind="topic", id="topic-1", label="Substitution EC", content={"nature": "study_delivery", "priority": "high", "status": "active"}),
        ]

        compact, dropped, metrics = self.object_summarizer.reduce(objects, max_count=5, max_chars=600)

        self.assertEqual(metrics.before_count, 3)
        self.assertEqual(metrics.after_count, 2)
        self.assertIn("LIV-1", [item.id for item in compact])
        self.assertTrue(any(item["reason"] == "duplicate_object" for item in dropped))
        self.assertTrue(all(item.summary for item in compact))

    def test_evidence_reducer_drops_lower_priority_duplicate(self) -> None:
        evidence_items = [
            EvidenceItem(
                evidenceId="ev-1",
                title="Ticket bug",
                sourceLevel="mepo_objects",
                relevanceScore=0.9,
                reliabilityScore=1.0,
                provenance={"id": "LIV-1"},
                extractedClaims=["Le bug bloque la substitution"],
                excerpt="Le bug bloque la substitution",
            ),
            EvidenceItem(
                evidenceId="ev-2",
                title="Doc bug",
                sourceLevel="knowledge_documents",
                relevanceScore=0.7,
                reliabilityScore=0.8,
                provenance={"knowledge_document_id": "doc-1"},
                extractedClaims=["Le bug bloque la substitution"],
                excerpt="Le bug bloque la substitution",
            ),
        ]

        kept, dropped, metrics = self.evidence_reducer.reduce(evidence_items, max_count=5, max_chars=500)

        self.assertEqual(metrics.before_count, 2)
        self.assertEqual(metrics.after_count, 1)
        self.assertEqual(kept[0].source_level, "mepo_objects")
        self.assertTrue(any(item["reason"] in {"covered_by_higher_priority_evidence", "covered_by_same_claim_higher_source"} for item in dropped))

    def test_context_assembler_respects_pilotage_budget(self) -> None:
        policy = get_prompt_budget_policy("pilotage")
        objects = [
            ContextObject(kind="project", id="proj-1", label="MePO", content={"status": "active", "description": "Projet principal"}),
            ContextObject(kind="space", id="space-1", label="S1 2026", content={"status": "active", "description": "Space description"}),
            ContextObject(kind="topic", id="topic-1", label="Substitution EC", content={"nature": "study_delivery", "priority": "high", "status": "active"}),
            ContextObject(kind="ticket", id="LIV-1", label="LIV-1 - Bug", content={"type": "bug", "status": "todo", "priority": "high", "description": "Description longue ticket"}),
        ]
        evidence_pack = EvidencePack(
            evidenceItems=[
                EvidenceItem(
                    evidenceId="ev-1",
                    title="Ticket bug",
                    sourceLevel="mepo_objects",
                    relevanceScore=0.9,
                    reliabilityScore=1.0,
                    provenance={"id": "LIV-1"},
                    extractedClaims=["Le bug bloque la substitution"],
                    excerpt="Le bug bloque la substitution et doit etre priorise.",
                )
            ],
            sourceLevel="mepo_objects",
            relevanceScore=0.9,
            reliabilityScore=1.0,
            provenance=[{"id": "LIV-1"}],
            extractedClaims=["Le bug bloque la substitution"],
        )

        context_pack = self.assembler.assemble(
            user_request="Quel est l'etat du sujet ?",
            intent_decision=IntentDecision(
                mode="pilotage",
                confidence="high",
                needsRetrieval=True,
                retrievalScope=["mepo_objects", "topic_memory"],
                needsActionProposal=False,
                riskLevel="low",
                expectedOutputType="answer",
            ),
            skill_projection="Skill compacte",
            context_objects=objects,
            evidence_pack=evidence_pack,
            output_contract={"response_format": "json_strict"},
            action_policy_projection={"requires_confirmation": True},
        )

        self.assertLessEqual(context_pack.assembly_metrics.chars_after, policy.max_total_chars)
        self.assertLessEqual(len(context_pack.object_summaries), policy.max_object_count)
        self.assertLessEqual(len(context_pack.evidence_items), policy.max_evidence_count)
        self.assertEqual(context_pack.skill_projection, "Skill compacte")

    def test_context_assembler_trims_excess_and_keeps_protected_parts(self) -> None:
        objects = [
            ContextObject(kind="ticket", id=f"LIV-{index}", label=f"LIV-{index} - Bug", content={"type": "bug", "status": "todo", "priority": "high", "description": "Description tres longue " * 15})
            for index in range(8)
        ]
        evidence_pack = EvidencePack(
            evidenceItems=[
                EvidenceItem(
                    evidenceId=f"ev-{index}",
                    title=f"Evidence {index}",
                    sourceLevel="knowledge_documents",
                    relevanceScore=0.6,
                    reliabilityScore=0.7,
                    provenance={"knowledge_document_id": f"doc-{index}"},
                    extractedClaims=[f"Claim {index}"],
                    excerpt="Extrait tres long " * 20,
                )
                for index in range(6)
            ],
            sourceLevel="knowledge_documents",
            relevanceScore=0.7,
            reliabilityScore=0.7,
            provenance=[],
            extractedClaims=[],
        )

        context_pack = self.assembler.assemble(
            user_request="Donne le plan d'action",
            intent_decision=IntentDecision(
                mode="pilotage",
                confidence="high",
                needsRetrieval=True,
                retrievalScope=["mepo_objects", "topic_memory"],
                needsActionProposal=False,
                riskLevel="low",
                expectedOutputType="answer",
            ),
            skill_projection="Skill minimale protegee",
            context_objects=objects,
            evidence_pack=evidence_pack,
            output_contract={"response_format": "json_strict"},
            action_policy_projection={"requires_confirmation": True},
        )

        self.assertTrue(context_pack.assembly_metrics.trimmed)
        self.assertTrue(context_pack.assembly_metrics.trim_reasons)
        self.assertEqual(context_pack.skill_projection, "Skill minimale protegee")
        self.assertLess(context_pack.object_metrics.after_count, context_pack.object_metrics.before_count)
        self.assertLess(context_pack.evidence_metrics.after_count, context_pack.evidence_metrics.before_count)


if __name__ == "__main__":
    unittest.main()

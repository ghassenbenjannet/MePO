from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.ai.retrieval_orchestrator import build_retrieval_trace
from app.services.ai.runtime_contracts import (
    build_prompt_runtime_config,
    get_feature_flags,
    get_mode_source_contract,
    get_source_priority_policy,
)


class AIRuntimeContractsTests(unittest.TestCase):
    def test_source_priority_order_is_fixed(self) -> None:
        policy = get_source_priority_policy()
        self.assertEqual(
            [item.level for item in policy.items],
            ["mepo_objects", "topic_memory", "local_documents", "knowledge_documents", "vector_store"],
        )
        self.assertTrue(policy.strict_order)

    def test_feature_flags_disable_unsafe_behaviors(self) -> None:
        flags = get_feature_flags()
        self.assertFalse(flags.allow_raw_workspace_dump)
        self.assertFalse(flags.allow_unplanned_document_search)
        self.assertFalse(flags.allow_automatic_action_execution)
        self.assertFalse(flags.allow_vector_store_auto_create)
        self.assertFalse(flags.allow_full_space_prompt_injection)

    def test_pilotage_forbids_project_document_search(self) -> None:
        contract = get_mode_source_contract("pilotage")
        self.assertEqual(contract["allowed_sources"], ["mepo_objects", "topic_memory"])
        self.assertIn("vector_store", contract["forbidden_sources"])

    def test_rewrite_existing_stops_on_mepo_objects(self) -> None:
        use_docs, use_vs, trace = build_retrieval_trace(
            mode="redaction",
            has_local_documents=True,
            needs_project_knowledge=True,
            selected_knowledge_docs_count=3,
            has_vector_store=True,
            stop_on_mepo_objects=True,
        )
        self.assertFalse(use_docs)
        self.assertFalse(use_vs)
        self.assertEqual(trace.final_level, "mepo_objects")

    def test_vector_store_only_used_as_last_resort(self) -> None:
        use_docs, use_vs, trace = build_retrieval_trace(
            mode="analyse_fonctionnelle",
            has_local_documents=True,
            needs_project_knowledge=True,
            selected_knowledge_docs_count=0,
            has_vector_store=True,
            stop_on_mepo_objects=False,
        )
        self.assertFalse(use_docs)
        self.assertTrue(use_vs)
        self.assertEqual(trace.final_level, "vector_store")

    def test_project_knowledge_docs_prevent_vector_store_use(self) -> None:
        use_docs, use_vs, trace = build_retrieval_trace(
            mode="analyse_fonctionnelle",
            has_local_documents=True,
            needs_project_knowledge=True,
            selected_knowledge_docs_count=2,
            has_vector_store=True,
            stop_on_mepo_objects=False,
        )
        self.assertTrue(use_docs)
        self.assertFalse(use_vs)
        self.assertEqual(trace.final_level, "knowledge_documents")

    def test_prompt_runtime_config_embeds_runtime_text(self) -> None:
        config = build_prompt_runtime_config("Bloc runtime projet")
        self.assertEqual(config.project_runtime_text, "Bloc runtime projet")


if __name__ == "__main__":
    unittest.main()

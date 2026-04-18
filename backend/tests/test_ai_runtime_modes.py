from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.routes_ai import chat
from app.core.config import settings
from app.core.database import Base
from app.models import Project, ProjectKnowledgeSettings, Space, Topic
from app.schemas.ai import AIChatRequest, RuntimeInput
from app.schemas.runtime import (
    ContextAssembly,
    RetrievalPipelineTrace,
    RetrievalTrace,
    RetrievalTraceStep,
    SourcePlan,
    SourcePlanStep,
    SufficiencyCheck,
    ToolExposureDecision,
)
from app.services.ai.runtime_mode import get_runtime_mode_metadata, resolve_shadow_runtime_mode
from app.services.ai.runtime_router import RuntimePipelinePreparation, prepare_runtime_pipeline
from app.services.ai.intent_router import IntentResult


def _json(response) -> dict:
    return json.loads(response.body.decode("utf-8"))


def _base_llm_result() -> dict:
    return {
        "mode": "cadrage",
        "understanding": "Analyse en cours.",
        "answer_markdown": "## Reponse\n\nContenu structure.",
        "certainty": {"certain": [], "inferred": [], "to_confirm": []},
        "next_actions": [],
        "proposed_actions": [
            {
                "actionId": "action-test",
                "type": "create_document",
                "label": "Sauvegarder le document",
                "payload": {"title": "Document", "content": "Contenu"},
                "requires_confirmation": False,
            }
        ],
        "generated_objects": [],
        "memory_updates": [],
    }


class AIRuntimeModesTests(unittest.TestCase):
    def setUp(self) -> None:
        self.runtime_mode_patcher = patch.object(settings, "shadow_runtime_mode", "mepo")
        self.runtime_mode_patcher.start()
        self.engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)
        self.db = self.SessionLocal()

        self.project = Project(id="proj-1", name="MePO")
        self.space = Space(id="space-1", project_id=self.project.id, name="S1 2026")
        self.topic = Topic(
            id="topic-1",
            space_id=self.space.id,
            title="Substitution EC",
            topic_nature="study_delivery",
            priority="high",
            status="active",
            color="indigo",
        )
        self.db.add_all([self.project, self.space, self.topic])
        self.db.commit()

    def tearDown(self) -> None:
        self.runtime_mode_patcher.stop()
        self.db.close()
        self.engine.dispose()

    def test_runtime_mode_resolver_defaults_to_mepo(self) -> None:
        self.assertEqual(resolve_shadow_runtime_mode("mepo"), "mepo")
        self.assertEqual(resolve_shadow_runtime_mode("openai_only"), "openai_only")
        self.assertEqual(resolve_shadow_runtime_mode("hybrid"), "hybrid")
        self.assertEqual(resolve_shadow_runtime_mode("invalid"), "mepo")
        self.assertEqual(resolve_shadow_runtime_mode(""), "mepo")

    def test_runtime_mode_metadata_is_fixed(self) -> None:
        self.assertEqual(get_runtime_mode_metadata("mepo")["recommended_usage"], "recommended_production_mode")
        self.assertEqual(get_runtime_mode_metadata("hybrid")["lifecycle"], "temporary")
        self.assertEqual(get_runtime_mode_metadata("openai_only")["lifecycle"], "to_remove_later")

    @patch("app.api.routes_ai.call_shadow_core")
    def test_response_contract_is_identical_across_runtime_modes(self, mock_call_shadow_core) -> None:
        mock_call_shadow_core.return_value = (_base_llm_result(), False)
        base_request = AIChatRequest(
            message="Analyse ce sujet",
            project_id=self.project.id,
            space_id=self.space.id,
            topic_id=self.topic.id,
        )

        responses: list[dict] = []
        for mode in ("mepo", "openai_only", "hybrid"):
            with patch.object(settings, "shadow_runtime_mode", mode):
                response = chat(base_request, db=self.db)
                responses.append(_json(response))

        response_keys = [set(item.keys()) for item in responses]
        self.assertEqual(response_keys[0], response_keys[1])
        self.assertEqual(response_keys[1], response_keys[2])

    @patch("app.api.routes_ai.call_shadow_core")
    def test_openai_only_with_vector_store_exposes_file_search(self, mock_call_shadow_core) -> None:
        self.db.add(ProjectKnowledgeSettings(id="pks-1", project_id=self.project.id, vector_store_id="vs_123"))
        self.db.commit()
        mock_call_shadow_core.return_value = (_base_llm_result(), True)

        with patch.object(settings, "shadow_runtime_mode", "openai_only"):
            response = chat(
                AIChatRequest(
                    message="Analyse la spec technique",
                    project_id=self.project.id,
                    space_id=self.space.id,
                    topic_id=self.topic.id,
                ),
                db=self.db,
            )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(mock_call_shadow_core.call_args.kwargs["file_search_enabled"])
        self.assertEqual(mock_call_shadow_core.call_args.kwargs["vector_store_id"], "vs_123")
        self.assertEqual(mock_call_shadow_core.call_args.kwargs["response_include"], ["file_search_call.results"])

    @patch("app.api.routes_ai.call_shadow_core")
    def test_openai_only_without_vector_store_stays_stable(self, mock_call_shadow_core) -> None:
        mock_call_shadow_core.return_value = (_base_llm_result(), False)

        with patch.object(settings, "shadow_runtime_mode", "openai_only"):
            response = chat(
                AIChatRequest(
                    message="Analyse la spec technique",
                    project_id=self.project.id,
                    space_id=self.space.id,
                    topic_id=self.topic.id,
                ),
                db=self.db,
            )

        data = _json(response)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(mock_call_shadow_core.call_args.kwargs["file_search_enabled"])
        self.assertIsNone(mock_call_shadow_core.call_args.kwargs["vector_store_id"])
        self.assertEqual(data["mode"], "cadrage")

    @patch("app.services.ai.runtime_router.run_openai_only_pipeline")
    @patch("app.services.ai.runtime_router.run_mepo_pipeline")
    def test_hybrid_fallbacks_to_openai_only_when_mepo_pipeline_fails(
        self,
        mock_run_mepo_pipeline,
        mock_run_openai_only_pipeline,
    ) -> None:
        mock_run_mepo_pipeline.side_effect = RuntimeError("pipeline down")
        mock_run_openai_only_pipeline.return_value = RuntimePipelinePreparation(
            runtime_mode="openai_only",
            pipeline_used="runOpenAIOnlyPipeline",
            fallback_triggered=False,
            fallback_reason=None,
            intent=IntentResult(mode="cadrage", confidence="medium", reading_line="fallback", is_rewrite_existing=False),
            context_policy="openai_only",
            context_objects=[],
            pre_ticket_res=None,
            vector_store_id=None,
            project_runtime_text=None,
            workspace_context=None,
            knowledge_docs=[],
            retrieval_trace=RetrievalTrace(
                mode="cadrage",
                finalLevel="mepo_objects",
                vectorStoreAllowed=False,
                vectorStoreUsed=False,
                steps=[RetrievalTraceStep(level="mepo_objects", used=False, reason="fallback", itemCount=0)],
            ),
            pipeline_trace=RetrievalPipelineTrace(
                intentMode="cadrage",
                selectedMode="cadrage",
                sourcePlan=SourcePlan(
                    mode="cadrage",
                    stopRule="fallback",
                    vectorStoreEligible=False,
                    steps=[SourcePlanStep(order=1, level="mepo_objects", allowed=True, reason="fallback")],
                ),
                retrievalTrace=RetrievalTrace(
                    mode="cadrage",
                    finalLevel="mepo_objects",
                    vectorStoreAllowed=False,
                    vectorStoreUsed=False,
                    steps=[RetrievalTraceStep(level="mepo_objects", used=False, reason="fallback", itemCount=0)],
                ),
                sufficiencyCheck=SufficiencyCheck(sufficient=True, stopLevel="mepo_objects", reason="fallback"),
                contextAssembly=ContextAssembly(
                    contextObjectCount=0,
                    topicTicketCount=0,
                    topicDocumentCount=0,
                    spaceDocumentCount=0,
                    knowledgeDocumentCount=0,
                    testCaseIndexCount=0,
                    documentChunkCount=0,
                ),
            ),
            runtime_input=RuntimeInput(
                userRequest="Analyse",
                intentMode="cadrage",
                sourcePlan=SourcePlan(
                    mode="cadrage",
                    stopRule="fallback",
                    vectorStoreEligible=False,
                    steps=[SourcePlanStep(order=1, level="mepo_objects", allowed=True, reason="fallback")],
                ),
                workspaceContext=None,
                contextObjects=[],
                selectedKnowledgeDocs=[],
                vectorStoreId=None,
            ),
            tool_exposure=ToolExposureDecision(
                fileSearchEnabled=False,
                reason="fallback",
                vectorStoreId=None,
                include=[],
            ),
            file_ids=[],
        )

        with patch.object(settings, "shadow_runtime_mode", "hybrid"):
            result = prepare_runtime_pipeline(
                self.db,
                AIChatRequest(
                    message="Analyse",
                    project_id=self.project.id,
                    space_id=self.space.id,
                    topic_id=self.topic.id,
                ),
            )

        self.assertEqual(result.runtime_mode, "hybrid")
        self.assertTrue(result.fallback_triggered)
        self.assertIn("Echec du pipeline MePO", result.fallback_reason or "")
        self.assertEqual(result.pipeline_used, "runHybridPipeline:openai_only_fallback")

    @patch("app.api.routes_ai.call_shadow_core")
    def test_confirmation_stays_mandatory_in_all_modes(self, mock_call_shadow_core) -> None:
        mock_call_shadow_core.return_value = (_base_llm_result(), False)

        for mode in ("mepo", "openai_only", "hybrid"):
            with patch.object(settings, "shadow_runtime_mode", mode):
                response = chat(
                    AIChatRequest(
                        message="Prepare un document",
                        project_id=self.project.id,
                        space_id=self.space.id,
                        topic_id=self.topic.id,
                    ),
                    db=self.db,
                )
                data = _json(response)
                self.assertTrue(data["proposed_actions"][0]["requires_confirmation"])


if __name__ == "__main__":
    unittest.main()

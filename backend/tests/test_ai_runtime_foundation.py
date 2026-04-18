from __future__ import annotations

import json
import sys
import unittest
import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.routes_ai import chat
from app.contracts.runtime import ContextPack, IntentDecision, RetrievalPlan, RuntimeRequest, RuntimeSessionInfo
from app.core.database import Base
from app.models import Project, ProjectSkillSettings, Space, Topic
from app.schemas.ai import AIChatRequest
from app.schemas.ai import RuntimeInput
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
from app.services.ai.runtime_router import RuntimePipelinePreparation, run_mepo_pipeline
from app.services.ai.skill_compiler import get_compiled_skill, invalidate_compiled_skill
from app.services.ai.skill_compiler.compiler import compile_skill_projection


class AIRuntimeFoundationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)
        self.db: Session = self.SessionLocal()

        self.project = Project(id=str(uuid.uuid4()), name="HCL - Livret", status="active")
        self.space = Space(id=str(uuid.uuid4()), project_id=self.project.id, name="S1 2026", status="active")
        self.topic = Topic(
            id=str(uuid.uuid4()),
            space_id=self.space.id,
            title="Substitution EC",
            status="active",
            priority="high",
            topic_nature="study_delivery",
            color="indigo",
        )
        self.db.add_all([self.project, self.space, self.topic])
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def test_inventory_and_kill_list_documents_exist(self) -> None:
        inventory = Path("docs/architecture/current-runtime-inventory.md")
        kill_list = Path("docs/architecture/kill-list-v1.md")

        self.assertTrue(inventory.exists())
        self.assertTrue(kill_list.exists())
        self.assertIn("Status", inventory.read_text(encoding="utf-8"))
        self.assertIn("Kill target", kill_list.read_text(encoding="utf-8"))

    def test_runtime_contracts_validate_and_serialize(self) -> None:
        session = RuntimeSessionInfo(
            projectId=self.project.id,
            spaceId=self.space.id,
            topicId=self.topic.id,
            conversationTurns=2,
            shadowRuntimeMode="mepo",
        )
        request = RuntimeRequest(
            userRequest="Analyse la spec",
            session=session,
            compiledSkillProjection="Skill projete",
            sourcePlanSeed=["mepo_objects", "topic_memory"],
        )
        intent = IntentDecision(
            mode="analyse_fonctionnelle",
            confidence="high",
            needsRetrieval=True,
            retrievalScope=["mepo_objects", "local_documents"],
            needsActionProposal=False,
            riskLevel="medium",
            expectedOutputType="answer",
        )
        plan = RetrievalPlan(
            orderedSteps=[{"order": 1, "source": "mepo_objects", "reason": "first"}],
            allowedSources=["mepo_objects", "topic_memory"],
            stopRule="Stop on sufficient local context",
            fallbackPolicy="No implicit fallback",
            maxEvidenceBudget=8,
        )
        context = ContextPack(
            canonicalUserRequest="Analyse la spec",
            mode="analyse_fonctionnelle",
            keyObjects=[{"kind": "topic", "id": self.topic.id, "label": self.topic.title}],
            evidenceSummary="topic + docs",
            outputContract={"response_format": "json_strict"},
            actionPolicyProjection={"requires_confirmation": True},
        )

        payload = json.loads(request.model_dump_json(by_alias=True))
        self.assertEqual(payload["contract_version"], "v1")
        self.assertEqual(payload["session"]["projectId"], self.project.id)
        self.assertEqual(intent.mode, "analyse_fonctionnelle")
        self.assertEqual(plan.allowed_sources, ["mepo_objects", "topic_memory"])
        self.assertEqual(context.output_contract["response_format"], "json_strict")

    def test_skill_compiler_projection_is_minimal_and_cached(self) -> None:
        settings = ProjectSkillSettings(
            project_id=self.project.id,
            main_skill_text="Toujours ancrer la reponse dans MePO.\nToujours ancrer la reponse dans MePO.",
            general_directives_text="Style pro.\nStyle pro.",
            source_hierarchy_text="1. Vector store\n2. MePO",
            mode_policies_text="Pilotage = sans doc lourde",
            action_policies_text="Toujours requires_confirmation=true",
            output_templates_text="Template recette detaille",
            guardrails_text="Ne pas inventer.\nNe pas inventer.",
        )
        self.db.add(settings)
        self.db.commit()

        compiled_first, _ = get_compiled_skill(self.db, self.project.id)
        compiled_second, _ = get_compiled_skill(self.db, self.project.id)
        self.assertIs(compiled_first, compiled_second)
        self.assertEqual(compiled_first.source_policy.strict_order[0], "mepo_objects")
        self.assertTrue(compiled_first.source_policy.contradictions)
        self.assertIn("Toujours ancrer la reponse dans MePO.", compiled_first.normalized_runtime_text)
        self.assertEqual(compiled_first.normalized_runtime_text.count("Toujours ancrer la reponse dans MePO."), 1)

        pilotage_projection = compile_skill_projection(
            compiled_first,
            mode="pilotage",
            include_output_templates=False,
        )
        self.assertNotIn("Template recette detaille", pilotage_projection.projection_text)
        self.assertIn("Ordre strict non inversable", pilotage_projection.projection_text)

        settings.output_templates_text = "Template recette modifie"
        self.db.add(settings)
        self.db.commit()
        invalidate_compiled_skill(self.project.id)
        compiled_third, _ = get_compiled_skill(self.db, self.project.id)
        self.assertIsNot(compiled_first, compiled_third)
        self.assertIn("Template recette modifie", compiled_third.normalized_runtime_text)

    def test_run_mepo_pipeline_does_not_inject_full_skill_when_mode_does_not_need_it(self) -> None:
        self.db.add(
            ProjectSkillSettings(
                project_id=self.project.id,
                main_skill_text="Skill principal court",
                output_templates_text="Template recette tres long",
                guardrails_text="Ne pas inventer",
            )
        )
        self.db.commit()

        result = run_mepo_pipeline(
            self.db,
            AIChatRequest(
                message="Quel est l'etat du sujet ?",
                project_id=self.project.id,
                space_id=self.space.id,
                topic_id=self.topic.id,
            ),
        )

        self.assertIsNotNone(result.runtime_request)
        self.assertNotIn("Template recette tres long", result.project_runtime_text or "")
        self.assertIn("Ordre strict non inversable", result.project_runtime_text or "")

    @patch("app.api.routes_ai.call_shadow_core")
    def test_chat_never_sends_full_raw_skill_to_llm(self, mock_call_shadow_core) -> None:
        self.db.add(
            ProjectSkillSettings(
                project_id=self.project.id,
                main_skill_text="Skill principal court",
                general_directives_text="Directives generales",
                mode_policies_text="Mode policies utiles",
                action_policies_text="Toujours confirmer",
                output_templates_text="Template recette detaille a ne pas injecter sur une question simple",
                guardrails_text="Ne pas inventer",
            )
        )
        self.db.commit()
        compiled_skill, _ = get_compiled_skill(self.db, self.project.id)
        mock_call_shadow_core.return_value = (
            {
                "mode": "pilotage",
                "understanding": "Etat du sujet.",
                "answer_markdown": "OK",
                "certainty": {"certain": [], "inferred": [], "to_confirm": []},
                "next_actions": [],
                "proposed_actions": [],
                "generated_objects": [],
                "memory_updates": [],
            },
            False,
        )

        response = chat(
            AIChatRequest(
                message="Quel est l'etat du sujet ?",
                project_id=self.project.id,
                space_id=self.space.id,
                topic_id=self.topic.id,
            ),
            db=self.db,
        )

        self.assertEqual(response.status_code, 200)
        projected = mock_call_shadow_core.call_args.kwargs["project_runtime_text"]
        self.assertIsInstance(projected, str)
        self.assertLess(len(projected), len(compiled_skill.normalized_runtime_text))
        self.assertNotIn("Template recette detaille", projected)

    @patch("app.api.routes_ai.action_policy_engine")
    @patch("app.api.routes_ai.output_validator")
    @patch("app.api.routes_ai.call_shadow_core")
    @patch("app.api.routes_ai.prepare_runtime_pipeline")
    def test_route_calls_central_pipeline(
        self,
        mock_prepare_runtime_pipeline,
        mock_call_shadow_core,
        mock_output_validator,
        mock_action_policy_engine,
    ) -> None:
        mock_prepare_runtime_pipeline.return_value = RuntimePipelinePreparation(
            runtime_mode="mepo",
            pipeline_used="runMepoPipeline",
            fallback_triggered=False,
            fallback_reason=None,
            intent=MagicMock(mode="cadrage", confidence="high", reading_line="test", is_rewrite_existing=False),
            context_policy="topic-first",
            context_objects=[],
            pre_ticket_res=None,
            vector_store_id=None,
            project_runtime_text="skill projection",
            workspace_context=None,
            knowledge_docs=[],
            retrieval_trace=RetrievalTrace(
                mode="cadrage",
                finalLevel="mepo_objects",
                vectorStoreAllowed=False,
                vectorStoreUsed=False,
                steps=[RetrievalTraceStep(level="mepo_objects", used=True, reason="local", itemCount=1)],
            ),
            pipeline_trace=RetrievalPipelineTrace(
                intentMode="cadrage",
                selectedMode="cadrage",
                sourcePlan=SourcePlan(
                    mode="cadrage",
                    stopRule="local",
                    vectorStoreEligible=False,
                    steps=[SourcePlanStep(order=1, level="mepo_objects", allowed=True, reason="local")],
                ),
                retrievalTrace=RetrievalTrace(
                    mode="cadrage",
                    finalLevel="mepo_objects",
                    vectorStoreAllowed=False,
                    vectorStoreUsed=False,
                    steps=[RetrievalTraceStep(level="mepo_objects", used=True, reason="local", itemCount=1)],
                ),
                sufficiencyCheck=SufficiencyCheck(sufficient=True, stopLevel="mepo_objects", reason="local"),
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
                    stopRule="local",
                    vectorStoreEligible=False,
                    steps=[SourcePlanStep(order=1, level="mepo_objects", allowed=True, reason="local")],
                ),
                workspaceContext=None,
                contextObjects=[],
                selectedKnowledgeDocs=[],
                vectorStoreId=None,
            ),
            tool_exposure=ToolExposureDecision(fileSearchEnabled=False, reason="local", vectorStoreId=None, include=[]),
            file_ids=[],
        )
        mock_call_shadow_core.return_value = (
            {
                "mode": "cadrage",
                "understanding": "Analyse",
                "answer_markdown": "OK",
                "certainty": {"certain": [], "inferred": [], "to_confirm": []},
                "next_actions": [],
                "proposed_actions": [],
                "generated_objects": [],
                "memory_updates": [],
            },
            False,
        )
        validated_response = MagicMock()
        validated_response.retrieval_trace = None
        validated_response.pipeline_trace = None
        validated_response.runtime_input = None
        validated_response.debug = None
        validated_response.model_dump.return_value = {"mode": "cadrage", "proposed_actions": []}
        mock_output_validator.validate.return_value = MagicMock(response=validated_response, status="validated")
        mock_action_policy_engine.apply.return_value = MagicMock(response=validated_response, status="validated")

        response = chat(
            AIChatRequest(message="Analyse", project_id=self.project.id, space_id=self.space.id, topic_id=self.topic.id),
            db=self.db,
        )

        self.assertEqual(response.status_code, 200)
        mock_prepare_runtime_pipeline.assert_called_once()
        mock_output_validator.validate.assert_called_once()
        mock_action_policy_engine.apply.assert_called_once()


if __name__ == "__main__":
    unittest.main()

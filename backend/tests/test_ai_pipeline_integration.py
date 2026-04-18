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
from app.api.routes_ai_actions import execute
from app.core.config import settings
from app.core.database import Base
from app.models import AIConversation, Project, ProjectKnowledgeDocument, ProjectKnowledgeSettings, ProjectSkill, ProjectSkillSettings, ProjectSkillVersion, Space, Ticket, Topic, TopicMemory
from app.schemas.ai import AIChatRequest, ActionExecuteRequest
from app.services.ai.skill_compiler import get_compiled_skill, invalidate_compiled_skill
from app.services.ai.workspace_cache import invalidate_workspace_cache
from app.services.ai.workspace_builder import build_workspace_context


MAIL_GEF_MESSAGE = (
    "J'ai recu ce mail : Bonjour, Ci-dessous un recap des tests liberalisation GEF effectues sur Team6 "
    "sur les modules DELIVRANCE et TracabilitePharma. "
    "MONOGEF hors livret avec code GEF : affichage du code GEF et envoi par interface non fonctionnels, "
    "correctif attendu sur IProduit.ObtenirAffectationsAsync. "
    "DELIVRANCE regloblalisee : recherche par code GEF d'un produit hors livret non fonctionnelle, "
    "evolution attendue sur LIVRETISpecifiquePharma.RechercheProduit. "
    "TracabilitePharma : recherche par code GEF d'un produit hors livret non fonctionnelle. "
    "Tous les autres tests sont OK. "
    "SP Shadow PO 18:53 Copier Ancienne synthese a ignorer Certitude Certain."
)

MAIL_GEF_HISTORY = [
    {
        "role": "assistant",
        "content": (
            "SP Shadow PO 18:53 Copier Le mail resume les resultats des tests effectues "
            "sur les modules DELIVRANCE et TracabilitePharma. Certitude Certain. "
            "Synthese precedente tres longue a ignorer. " * 12
        ),
    },
    {
        "role": "assistant",
        "content": (
            "Erreur de l'action ticket_id et comment sont requis. Voir tout 19:34. "
            "Ancienne erreur conversationnelle a ne pas reinjecter telle quelle. " * 10
        ),
    },
]


def _json(response) -> dict:
    return json.loads(response.body.decode("utf-8"))


class AIPipelineIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.runtime_mode_patcher = patch.object(settings, "shadow_runtime_mode", "mepo")
        self.runtime_mode_patcher.start()
        invalidate_compiled_skill("proj-1")
        invalidate_workspace_cache(project_id="proj-1")
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
        self.ticket = Ticket(
            id="LIV-101",
            topic_id=self.topic.id,
            type="bug",
            title="Bug substitution EC",
            description="Erreur sur la resolution de substitution.",
            status="todo",
            priority="high",
            tags=["substitution", "ec"],
            acceptance_criteria=["Given un contexte EC", "When la substitution est calculee", "Then le resultat est stable"],
            dependencies=[],
            linked_document_ids=[],
            ticket_details={},
        )
        self.generic_tracking_ticket = Ticket(
            id="7C108FB7",
            topic_id=self.topic.id,
            type="task",
            title="Plan de processus et validation périmètre",
            description="Suivi et validation du plan de developpements GEF deja realises et cartographie des sujets.",
            status="in_progress",
            priority="medium",
            tags=["plan", "processus", "perimetre", "suivi", "gef"],
            acceptance_criteria=[],
            dependencies=[],
            linked_document_ids=[],
            ticket_details={},
        )
        self.recipe_ticket = Ticket(
            id="15C0F328",
            topic_id=self.topic.id,
            type="task",
            title="Recette libéralisation GEF Team6",
            description=(
                "Synthese des resultats de tests Team6 sur DELIVRANCE et TracabilitePharma, "
                "avec retours recette, correctifs attendus et retests."
            ),
            status="in_progress",
            priority="high",
            tags=["recette", "tests", "liberalisation", "gef", "delivrance", "tracabilitepharma"],
            acceptance_criteria=[],
            dependencies=[],
            linked_document_ids=[],
            ticket_details={},
        )
        self.display_anomaly_ticket = Ticket(
            id="83CBF4CB",
            topic_id=self.topic.id,
            type="bug",
            title="Anomalie affichage et envoi code GEF hors livret",
            description="Correctif attendu sur IProduit.ObtenirAffectationsAsync pour affichage et envoi du code GEF hors livret.",
            status="todo",
            priority="high",
            tags=["anomalie", "correctif", "gef", "hors-livret", "affichage", "interface"],
            acceptance_criteria=[],
            dependencies=[],
            linked_document_ids=[],
            ticket_details={},
        )
        self.search_anomaly_ticket = Ticket(
            id="90C020F1",
            topic_id=self.topic.id,
            type="bug",
            title="Anomalie recherche produit hors livret par code GEF",
            description="Evolution attendue sur LIVRETISpecifiquePharma.RechercheProduit pour la recherche par code GEF.",
            status="todo",
            priority="high",
            tags=["anomalie", "recherche", "code-gef", "hors-livret", "tracabilitepharma"],
            acceptance_criteria=[],
            dependencies=[],
            linked_document_ids=[],
            ticket_details={},
        )
        self.memory = TopicMemory(
            id="mem-1",
            topic_id=self.topic.id,
            facts=["La substitution est pilotee par une table de correspondance."],
            decisions=["Priorite a la compatibilite ascendante."],
            risks=[],
            dependencies=[],
            open_questions=[],
        )
        self.knowledge_settings = ProjectKnowledgeSettings(
            id="pks-1",
            project_id=self.project.id,
            vector_store_id="vs_existing_123",
            last_sync_status="success",
        )
        self.test_doc = ProjectKnowledgeDocument(
            id="kdoc-1",
            project_id=self.project.id,
            category="test_cases",
            title="Plan de recette substitution EC",
            source_type="upload",
            local_file_id="file-1",
            tags=["recette", "substitution"],
            linked_topic_ids=[self.topic.id],
            summary="Cas de tests pour la substitution EC.",
            content_extracted_text=(
                "Test case substitution EC\n"
                "1. Ouvrir la fiche patient\n"
                "2. Lancer le calcul de substitution\n"
                "Expected: la bonne correspondance est utilisee\n"
            ),
            sync_status="synced",
            is_active=True,
        )

        self.db.add_all([
            self.project,
            self.space,
            self.topic,
            self.ticket,
            self.generic_tracking_ticket,
            self.recipe_ticket,
            self.display_anomaly_ticket,
            self.search_anomaly_ticket,
            self.memory,
            self.knowledge_settings,
            self.test_doc,
        ])
        self.db.commit()

        self.skill_settings = ProjectSkillSettings(
            id="skill-1",
            project_id=self.project.id,
            main_skill_text="Toujours rester ancre dans MePO.",
            general_directives_text="Style sobre et structure.",
            mode_policies_text="Pilotage court; analyse plus detaillee.",
            action_policies_text="requires_confirmation=true",
            output_templates_text="Template bug complet avec sections detaillees",
            guardrails_text="Ne pas inventer.",
        )
        self.db.add(self.skill_settings)
        self.db.commit()

    def tearDown(self) -> None:
        self.runtime_mode_patcher.stop()
        invalidate_compiled_skill(self.project.id)
        invalidate_workspace_cache(project_id=self.project.id)
        self.db.close()
        self.engine.dispose()

    def test_workspace_cache_and_invalidation(self) -> None:
        first = build_workspace_context(
            self.db,
            project_id=self.project.id,
            space_id=self.space.id,
            topic_id=self.topic.id,
        )
        second = build_workspace_context(
            self.db,
            project_id=self.project.id,
            space_id=self.space.id,
            topic_id=self.topic.id,
        )
        self.assertFalse(first.cache_status.from_cache)
        self.assertTrue(second.cache_status.from_cache)
        self.assertGreaterEqual(len(second.test_index), 1)
        self.assertGreaterEqual(len(second.document_index), 1)

        invalidate_workspace_cache(project_id=self.project.id)
        third = build_workspace_context(
            self.db,
            project_id=self.project.id,
            space_id=self.space.id,
            topic_id=self.topic.id,
        )
        self.assertFalse(third.cache_status.from_cache)

    @patch("app.api.routes_ai.call_shadow_core")
    def test_existing_ticket_redaction_stops_on_mepo_objects(self, mock_call_shadow_core) -> None:
        mock_call_shadow_core.return_value = ({
            "mode": "redaction",
            "understanding": "Redaction de la fiche du ticket existant.",
            "answer_markdown": "## Fiche ticket\n\nContenu structure.",
            "certainty": {"certain": ["Ticket existant trouve"], "inferred": [], "to_confirm": []},
            "next_actions": [],
            "proposed_actions": [],
            "generated_objects": [],
            "memory_updates": [],
        }, False)

        response = chat(
            AIChatRequest(
                message="Ecris la fiche du bug substitution EC",
                project_id=self.project.id,
                space_id=self.space.id,
                topic_id=self.topic.id,
                debug=True,
            ),
            db=self.db,
        )
        data = _json(response)

        self.assertEqual(data["mode"], "redaction")
        self.assertEqual(data["retrieval_trace"]["final_level"], "mepo_objects")
        self.assertEqual(data["pipeline_trace"]["source_plan"]["steps"][0]["level"], "mepo_objects")
        self.assertEqual(data["runtime_input"]["intent_mode"], "redaction")
        self.assertGreaterEqual(len(data["runtime_input"]["context_objects"]), 3)
        self.assertFalse(mock_call_shadow_core.call_args.kwargs["file_search_enabled"])
        self.assertEqual(mock_call_shadow_core.call_args.kwargs["response_include"], [])

    @patch("app.api.routes_ai.call_shadow_core")
    def test_test_coverage_query_keeps_local_indexes_without_vector_store_regression(self, mock_call_shadow_core) -> None:
        self.db.delete(self.generic_tracking_ticket)
        self.db.delete(self.recipe_ticket)
        self.db.delete(self.display_anomaly_ticket)
        self.db.delete(self.search_anomaly_ticket)
        self.db.commit()

        mock_call_shadow_core.return_value = ({
            "mode": "analyse_fonctionnelle",
            "understanding": "Couverture de recette identifiee.",
            "answer_markdown": "## Couverture recette\n\nLe plan de recette couvre la substitution EC.",
            "certainty": {"certain": ["Le plan de recette existe"], "inferred": [], "to_confirm": []},
            "next_actions": [],
            "proposed_actions": [],
            "generated_objects": [],
            "memory_updates": [],
        }, False)

        response = chat(
            AIChatRequest(
                message="Analyse fonctionnelle : quelle specification fonctionnelle et quel plan de recette couvrent la substitution EC ?",
                project_id=self.project.id,
                space_id=self.space.id,
                topic_id=self.topic.id,
                debug=True,
            ),
            db=self.db,
        )
        data = _json(response)

        self.assertNotEqual(data["retrieval_trace"]["final_level"], "vector_store")
        self.assertGreaterEqual(len(data["runtime_input"]["workspace_context"]["test_index"]), 1)
        self.assertGreaterEqual(len(data["runtime_input"]["workspace_context"]["document_index"]), 1)

    @patch("app.api.routes_ai.call_shadow_core")
    def test_explicit_bdd_question_enables_file_search_with_project_vector_store(self, mock_call_shadow_core) -> None:
        self.test_doc.is_active = False
        self.db.commit()

        mock_call_shadow_core.return_value = ({
            "mode": "analyse_technique",
            "understanding": "Question BDD explicite.",
            "answer_markdown": "## Tables\n\nAnalyse SQL autorisee.",
            "certainty": {"certain": ["La demande BDD est explicite"], "inferred": [], "to_confirm": []},
            "next_actions": [],
            "proposed_actions": [],
            "generated_objects": [],
            "memory_updates": [],
        }, True)

        response = chat(
            AIChatRequest(
                message="Quelles tables, colonnes et quel schema SQL portent la liberalisation du code GEF ?",
                project_id=self.project.id,
                space_id=self.space.id,
                topic_id=self.topic.id,
                debug=True,
            ),
            db=self.db,
        )
        data = _json(response)

        self.assertEqual(data["mode"], "analyse_technique")
        self.assertEqual(data["retrieval_trace"]["final_level"], "vector_store")
        self.assertTrue(mock_call_shadow_core.call_args.kwargs["file_search_enabled"])

    @patch("app.api.routes_ai.call_shadow_core")
    def test_chat_reuses_openai_response_id_from_local_conversation(self, mock_call_shadow_core) -> None:
        self.db.add(
            AIConversation(
                id="conv-1",
                project_id=self.project.id,
                space_id=self.space.id,
                topic_id=self.topic.id,
                title="Discussion liee",
                openai_response_id="resp_prev_123",
            )
        )
        self.db.commit()

        mock_call_shadow_core.return_value = ({
            "mode": "pilotage",
            "understanding": "Suite de la conversation.",
            "answer_markdown": "## Suite\n\nReponse follow-up.",
            "certainty": {"certain": [], "inferred": [], "to_confirm": []},
            "next_actions": [],
            "proposed_actions": [],
            "generated_objects": [],
            "memory_updates": [],
            "__openai_response_id": "resp_next_456",
        }, True)

        response = chat(
            AIChatRequest(
                message="Continue cette discussion",
                project_id=self.project.id,
                space_id=self.space.id,
                topic_id=self.topic.id,
                conversation_id="conv-1",
                debug=False,
            ),
            db=self.db,
        )
        data = _json(response)

        self.assertEqual(mock_call_shadow_core.call_args.kwargs["previous_response_id"], "resp_prev_123")
        self.assertTrue(mock_call_shadow_core.call_args.kwargs["force_responses_api"])
        self.assertEqual(data["openai_response_id"], "resp_next_456")

    @patch("app.api.routes_ai.call_shadow_core")
    def test_chat_prefers_openai_conversation_id_over_previous_response_id(self, mock_call_shadow_core) -> None:
        self.db.add(ProjectSkill(id="skill-123", project_id=self.project.id, name="Shadow PO"))
        self.db.add(
            ProjectSkillVersion(
                id="skillv-snapshot",
                skill_id="skill-123",
                version_label="v1",
                compiled_runtime_text="Shadow PO seed unique.",
                source_kind="test",
            )
        )
        self.db.commit()
        self.db.add(
            AIConversation(
                id="conv-2",
                project_id=self.project.id,
                space_id=self.space.id,
                topic_id=self.topic.id,
                title="Discussion OpenAI conversation",
                skill_version_id_snapshot="skillv-snapshot",
                openai_conversation_id="conv_openai_123",
                openai_response_id="resp_prev_123",
            )
        )
        self.db.commit()

        mock_call_shadow_core.return_value = ({
            "mode": "pilotage",
            "understanding": "Suite de la conversation.",
            "answer_markdown": "## Suite\n\nReponse follow-up.",
            "certainty": {"certain": [], "inferred": [], "to_confirm": []},
            "next_actions": [],
            "proposed_actions": [],
            "generated_objects": [],
            "memory_updates": [],
            "__openai_response_id": "resp_next_456",
        }, True)

        response = chat(
            AIChatRequest(
                message="Continue cette discussion",
                project_id=self.project.id,
                space_id=self.space.id,
                topic_id=self.topic.id,
                conversation_id="conv-2",
                debug=False,
            ),
            db=self.db,
        )
        data = _json(response)

        self.assertEqual(mock_call_shadow_core.call_args.kwargs["openai_conversation_id"], "conv_openai_123")
        self.assertIsNone(mock_call_shadow_core.call_args.kwargs["previous_response_id"])
        self.assertIsNone(mock_call_shadow_core.call_args.kwargs["project_runtime_text"])
        self.assertEqual(
            mock_call_shadow_core.call_args.kwargs["metadata"]["conversation_id"],
            "conv-2",
        )
        self.assertEqual(data["openai_response_id"], "resp_next_456")

    @patch("app.api.routes_ai.call_shadow_core")
    def test_existing_ticket_redaction_never_keeps_create_ticket_action(self, mock_call_shadow_core) -> None:
        mock_call_shadow_core.return_value = ({
            "mode": "redaction",
            "understanding": "Redaction de la fiche du ticket existant.",
            "answer_markdown": "## Contexte\n\nContenu.\n\n## Comportement observé\n\nObservation.",
            "certainty": {"certain": ["Ticket existant trouve"], "inferred": [], "to_confirm": []},
            "next_actions": [],
            "proposed_actions": [
                {
                    "type": "create_ticket",
                    "label": "Creer un nouveau ticket",
                    "payload": {"title": "Doublon bug substitution EC"},
                    "requires_confirmation": True,
                }
            ],
            "generated_objects": [],
            "memory_updates": [],
        }, False)

        response = chat(
            AIChatRequest(
                message="Ecris la fiche du bug substitution EC",
                project_id=self.project.id,
                space_id=self.space.id,
                topic_id=self.topic.id,
            ),
            db=self.db,
        )
        data = _json(response)

        self.assertEqual(data["mode"], "redaction")
        self.assertEqual(data["proposed_actions"], [])

    @patch("app.api.routes_ai.call_shadow_core")
    def test_proposed_action_then_confirmed_executes_once(self, mock_call_shadow_core) -> None:
        self.db.delete(self.ticket)
        self.db.delete(self.generic_tracking_ticket)
        self.db.delete(self.recipe_ticket)
        self.db.delete(self.display_anomaly_ticket)
        self.db.delete(self.search_anomaly_ticket)
        self.db.commit()

        mock_call_shadow_core.return_value = ({
            "mode": "redaction",
            "understanding": "Preparation d'un ticket de bug.",
            "answer_markdown": "## Ticket propose\n\nDetails.",
            "certainty": {"certain": ["Le bug doit etre trace"], "inferred": [], "to_confirm": []},
            "next_actions": [],
            "proposed_actions": [
                {
                    "type": "create_ticket",
                    "label": "Creer le bug export PDF armoire",
                    "payload": {
                        "title": "Bug export PDF armoire pharma",
                        "description": "L'export PDF des armoires tronque le recapitulatif de stock.",
                        "type": "bug",
                        "priority": "high",
                        "topic_id": self.topic.id,
                    },
                    "requires_confirmation": True,
                }
            ],
            "generated_objects": [],
            "memory_updates": [],
        }, False)

        chat_response = chat(
            AIChatRequest(
                message="Cree un ticket bug pour un export PDF armoire pharma tronque",
                project_id=self.project.id,
                space_id=self.space.id,
                topic_id=self.topic.id,
            ),
            db=self.db,
        )
        data = _json(chat_response)
        action = data["proposed_actions"][0]

        execute_response = execute(
            ActionExecuteRequest(
                action_id=action["action_id"],
                action_type=action["type"],
                confirmed=True,
                project_id=self.project.id,
                space_id=self.space.id,
                topic_id=self.topic.id,
                payload=action["payload"],
            ),
            db=self.db,
        )
        execute_data = _json(execute_response)

        self.assertEqual(execute_response.status_code, 200)
        self.assertTrue(execute_data["success"])
        self.assertEqual(execute_data["action_id"], action["action_id"])

        second_execute = execute(
            ActionExecuteRequest(
                action_id=action["action_id"],
                action_type=action["type"],
                confirmed=True,
                project_id=self.project.id,
                space_id=self.space.id,
                topic_id=self.topic.id,
                payload=action["payload"],
            ),
            db=self.db,
        )
        self.assertEqual(second_execute.status_code, 409)

    @patch("app.api.routes_ai.call_shadow_core")
    def test_debug_contains_runtime_trace_and_volume_metrics(self, mock_call_shadow_core) -> None:
        mock_call_shadow_core.return_value = ({
            "mode": "analyse_fonctionnelle",
            "understanding": "Analyse.",
            "answer_markdown": "## Analyse\n\nContenu.",
            "certainty": {"certain": [], "inferred": [], "to_confirm": []},
            "next_actions": [],
            "proposed_actions": [],
            "generated_objects": [],
            "memory_updates": [],
        }, False)

        response = chat(
            AIChatRequest(
                message="Quel plan de recette et quels cas de tests couvrent la substitution EC ?",
                project_id=self.project.id,
                space_id=self.space.id,
                topic_id=self.topic.id,
                debug=True,
            ),
            db=self.db,
        )
        data = _json(response)
        debug = data["debug"]

        self.assertEqual(response.status_code, 200)
        self.assertEqual(debug["mode_detected"], "analyse_fonctionnelle")
        self.assertTrue(debug["retrieval_planned"])
        self.assertIn("knowledge_documents", debug["sources_allowed"])
        self.assertTrue(debug["sources_used"])
        self.assertTrue(debug["stop_reason"])
        self.assertIn("validated", debug["validator_status"])
        self.assertIn("fallback_triggered", debug)
        self.assertIn("input_chars_total", debug)
        self.assertIn("compiled_skill_chars", debug)
        self.assertIn("context_objects_chars", debug)
        self.assertIn("evidence_chars", debug)
        self.assertIn("estimated_prompt_tokens", debug)
        self.assertIn("budget_policy", debug)
        self.assertIn("assembly_metrics", debug)
        self.assertIn("object_metrics", debug)
        self.assertIn("evidence_metrics", debug)
        self.assertIn("budget_used", debug)
        self.assertIn("context_pack", debug)

    @patch("app.api.routes_ai.call_shadow_core")
    def test_volume_metrics_show_projection_reduction_simple_vs_complex(self, mock_call_shadow_core) -> None:
        mock_call_shadow_core.return_value = ({
            "mode": "pilotage",
            "understanding": "Analyse.",
            "answer_markdown": "## Analyse\n\nContenu.",
            "certainty": {"certain": [], "inferred": [], "to_confirm": []},
            "next_actions": [],
            "proposed_actions": [],
            "generated_objects": [],
            "memory_updates": [],
        }, False)

        compiled_skill, _ = get_compiled_skill(self.db, self.project.id)

        simple = _json(
            chat(
                AIChatRequest(
                    message="Quel est l'etat du sujet ?",
                    project_id=self.project.id,
                    space_id=self.space.id,
                    topic_id=self.topic.id,
                    debug=True,
                ),
                db=self.db,
            )
        )
        complex_response = chat(
            AIChatRequest(
                message="Analyse la couverture recette de la substitution EC et identifie les zones non couvertes.",
                project_id=self.project.id,
                space_id=self.space.id,
                topic_id=self.topic.id,
                debug=True,
            ),
            db=self.db,
        )
        complex_data = _json(complex_response)

        self.assertLess(simple["debug"]["compiled_skill_chars"], len(compiled_skill.normalized_runtime_text))
        self.assertLess(complex_data["debug"]["compiled_skill_chars"], len(compiled_skill.normalized_runtime_text))
        self.assertGreater(complex_data["debug"]["input_chars_total"], simple["debug"]["input_chars_total"])
        self.assertGreaterEqual(
            complex_data["debug"]["estimated_prompt_tokens"],
            simple["debug"]["estimated_prompt_tokens"],
        )
        self.assertLessEqual(
            simple["debug"]["input_chars_total"],
            simple["debug"]["budget_policy"]["maxTotalChars"],
        )
        self.assertLessEqual(
            complex_data["debug"]["input_chars_total"],
            complex_data["debug"]["budget_policy"]["maxTotalChars"],
        )

    @patch("app.api.routes_ai.call_shadow_core")
    def test_gef_mail_redaction_blocks_vector_store_and_targets_recipe_ticket(self, mock_call_shadow_core) -> None:
        mock_call_shadow_core.return_value = ({
            "mode": "redaction",
            "understanding": "Synthese des tests Team6.",
            "related_objects": [
                {
                    "type": "ticket",
                    "title": "15C0F328 — Recette libéralisation GEF Team6",
                    "relation": "target_existing_ticket",
                    "certainty": "certain",
                }
            ],
            "answer_markdown": "## Synthese recette\n\nTests Team6 consolides.",
            "certainty": {"certain": ["Ticket recette existant"], "inferred": [], "to_confirm": []},
            "next_actions": [],
            "proposed_actions": [
                {
                    "type": "add_comment",
                    "label": "Ajouter un commentaire",
                    "payload": {"comment": "Synthese des tests Team6."},
                    "requires_confirmation": True,
                }
            ],
            "generated_objects": [],
            "memory_updates": [],
        }, False)

        with patch.object(settings, "shadow_runtime_mode", "openai_only"):
            response = chat(
                AIChatRequest(
                    message=MAIL_GEF_MESSAGE,
                    project_id=self.project.id,
                    space_id=self.space.id,
                    topic_id=self.topic.id,
                    debug=True,
                    conversation_history=MAIL_GEF_HISTORY,
                ),
                db=self.db,
            )
        data = _json(response)
        debug = data["debug"]

        self.assertEqual(response.status_code, 200)
        self.assertEqual(data["retrieval_trace"]["final_level"], "mepo_objects")
        self.assertFalse(mock_call_shadow_core.call_args.kwargs["file_search_enabled"])
        self.assertEqual(mock_call_shadow_core.call_args.kwargs["response_include"], [])
        self.assertEqual(mock_call_shadow_core.call_args.kwargs["conversation_history"], [])
        self.assertIn("CONVERSATION SUMMARY", mock_call_shadow_core.call_args.kwargs["conversation_summary"])
        self.assertNotIn("SP Shadow PO 18:53 Copier", data["runtime_input"]["user_request"])
        self.assertNotIn("Certitude", data["runtime_input"]["user_request"])
        self.assertGreater(debug["conversation_summary_chars"], 0)
        self.assertGreater(debug["raw_history_chars_dropped"], 0)
        self.assertIn("ticket_recette_prioritaire", debug["why_target_ticket_selected"])
        self.assertIn("vector store bloque", debug["why_vector_store_blocked_or_used"].lower())
        self.assertEqual(data["related_objects"][0]["kind"], "ticket")
        self.assertEqual(data["related_objects"][0]["id"], "15C0F328")
        self.assertEqual(data["proposed_actions"][0]["payload"]["ticket_id"], "15C0F328")

    @patch("app.api.routes_ai.call_shadow_core")
    def test_specific_gef_anomaly_prefers_existing_anomaly_ticket_over_generic_tracking(self, mock_call_shadow_core) -> None:
        mock_call_shadow_core.return_value = ({
            "mode": "redaction",
            "understanding": "Commentaire sur anomalie existante.",
            "answer_markdown": "## Commentaire\n\nRecherche code GEF hors livret KO.",
            "certainty": {"certain": ["Anomalie existante"], "inferred": [], "to_confirm": []},
            "next_actions": [],
            "proposed_actions": [
                {
                    "type": "add_comment",
                    "label": "Ajouter un commentaire",
                    "payload": {"comment": "La recherche par code GEF hors livret reste KO."},
                    "requires_confirmation": True,
                }
            ],
            "generated_objects": [],
            "memory_updates": [],
        }, False)

        response = chat(
            AIChatRequest(
                message=(
                    "Ajoute un commentaire sur l'anomalie existante de recherche par code GEF "
                    "pour un produit hors livret dans TracabilitePharma."
                ),
                project_id=self.project.id,
                space_id=self.space.id,
                topic_id=self.topic.id,
                debug=True,
            ),
            db=self.db,
        )
        data = _json(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(data["proposed_actions"][0]["payload"]["ticket_id"], "90C020F1")
        self.assertIn("ticket_anomalie_existant", data["debug"]["why_target_ticket_selected"])
        self.assertNotIn("ticket_suivi_generique", data["debug"]["why_target_ticket_selected"])


if __name__ == "__main__":
    unittest.main()

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
from app.models import (
    Document,
    Project,
    ProjectKnowledgeDocument,
    ProjectKnowledgeSettings,
    ProjectSkillSettings,
    Space,
    Ticket,
    Topic,
    TopicMemory,
)
from app.schemas.ai import AIChatRequest
from app.services.ai.skill_compiler import invalidate_compiled_skill
from app.services.ai.workspace_cache import invalidate_workspace_cache


def _json(response) -> dict:
    return json.loads(response.body.decode("utf-8"))


def _llm_result(mode: str) -> tuple[dict, bool]:
    return (
        {
            "mode": mode,
            "understanding": "Validation runtime.",
            "answer_markdown": "## OK\n\nValidation runtime.",
            "certainty": {"certain": [], "inferred": [], "to_confirm": []},
            "next_actions": [],
            "proposed_actions": [],
            "generated_objects": [],
            "memory_updates": [],
        },
        False,
    )


class AIRuntimeCalibrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.runtime_mode_patcher = patch.object(settings, "shadow_runtime_mode", "mepo")
        self.runtime_mode_patcher.start()
        self.engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)
        self.db = self.SessionLocal()

        self.project = Project(
            id="proj-hcl",
            name="HCL-Livret",
            status="active",
            description="Programme de liberation code GEF et denomination commune.",
        )
        self.space = Space(
            id="space-hcl",
            project_id=self.project.id,
            name="HCL Livret 2026",
            status="active",
            description="Pilotage et analyse transverse livret.",
        )
        self.topic = Topic(
            id="topic-gef",
            space_id=self.space.id,
            title="Liberation code GEF",
            topic_nature="study_delivery",
            priority="critical",
            status="active",
            color="indigo",
            description="Passage de la SAF exacte pour construire denomination et denomination commune.",
        )
        self.topic_bdd = Topic(
            id="topic-bdd",
            space_id=self.space.id,
            title="Resolution BDD denomination commune",
            topic_nature="analysis",
            priority="high",
            status="active",
            color="cyan",
            description="Analyse technique schema, tables et colonnes impactees.",
        )
        self.ticket_main = Ticket(
            id="LIV-608281",
            topic_id=self.topic.id,
            type="feature",
            title="IntGestionLivret - Liberalisation code GEF et gestion des 4 statuts",
            description=(
                "Pour une liste fermee de SAP Theriaque, le livret doit construire la denomination "
                "et la denomination commune depuis la SAF exacte sans casser prescriptions signees, "
                "conversion delivrance, pancarte, destockage armoire et tracabilite."
            ),
            status="in_progress",
            priority="critical",
            tags=["theriaque", "gef", "denomination"],
            acceptance_criteria=[
                "Given une SAP de la liste fermee When la specialite est chargee Then la denomination part de la SAF exacte",
                "Given une prescription deja signee When la conversion vers delivrance est relancee Then le flux reste retrocompatible",
            ],
            dependencies=["MV resolution", "tracabilite"],
            linked_document_ids=[],
            ticket_details={"modules": ["delivrance", "tracabilite", "hors_livret"]},
        )
        self.ticket_secondary = Ticket(
            id="LIV-608350",
            topic_id=self.topic.id,
            type="task",
            title="Verifier pancarte et destockage armoire",
            description="Controle de non-regression sur pancarte, destockage et prescription hors livret.",
            status="todo",
            priority="high",
            tags=["pancarte", "armoire"],
            acceptance_criteria=["Given un produit hors livret When la pancarte est calculee Then le libelle reste coherent"],
            dependencies=["LIV-608281"],
            linked_document_ids=[],
            ticket_details={},
        )
        self.memory = TopicMemory(
            id="mem-gef",
            topic_id=self.topic.id,
            facts=[
                "La denomination reprend la ou les DC de la specialite.",
                "La denomination commune prend la SA pere Theriaque, sinon la SA fille.",
            ],
            decisions=[
                "La SAF exacte remplace la SAP agregee pour une liste fermee de SAP.",
                "Les prescriptions deja signees et la tracabilite restent prioritaires.",
            ],
            risks=[
                "Conversion vers delivrance potentiellement sensible a la DC.",
                "Pancarte et destockage armoire ne doivent pas etre casses.",
            ],
            dependencies=["Resolution MV", "Flux hors livret"],
            open_questions=["Le point de conversion sensible a la DC doit etre confirme en DAL."],
        )
        self.local_page = Document(
            id="doc-local-1",
            space_id=self.space.id,
            topic_id=self.topic.id,
            type="page",
            title="Analyse transverse GEF",
            content=(
                "<h1>Analyse transverse</h1><p>La SAF exacte impacte delivrance, pancarte, "
                "destockage armoire et tracabilite. Le point sensible reste la conversion "
                "vers delivrance basee historiquement sur la DC.</p>"
            ),
            tags=["analyse", "transverse", "gef"],
            doc_metadata={},
        )
        self.local_architecture = Document(
            id="doc-local-2",
            space_id=self.space.id,
            topic_id=self.topic.id,
            type="page",
            title="Dossier architecture complet",
            content=(
                "<p>Resolution, substitution, DAL et interfaces collecte mouvement consomment encore "
                "des informations construites par DC. Le dossier relie les tables de denomination commune "
                "et les modules de tracabilite.</p>"
            ),
            tags=["architecture", "dal", "sql"],
            doc_metadata={},
        )
        self.knowledge_settings = ProjectKnowledgeSettings(
            id="pks-hcl",
            project_id=self.project.id,
            vector_store_id="vs_existing_gef",
            last_sync_status="success",
        )
        self.kdoc_spec = ProjectKnowledgeDocument(
            id="kdoc-spec",
            project_id=self.project.id,
            category="specifications",
            document_type="spec",
            title="Spec liberation code GEF",
            source_type="upload",
            local_file_id="file-spec",
            summary="Spec fonctionnelle de la SAF exacte et de la denomination commune.",
            tags=["spec", "gef"],
            linked_topic_ids=[self.topic.id],
            content_extracted_text=(
                "La liste fermee de SAP doit utiliser la SAF exacte pour construire la denomination "
                "et la denomination commune. Les prescriptions signees, conversions vers delivrance, "
                "pancarte, destockage armoire et tracabilite restent retrocompatibles."
            ),
            sync_status="synced",
            is_active=True,
        )
        self.kdoc_bdd = ProjectKnowledgeDocument(
            id="kdoc-bdd",
            project_id=self.project.id,
            category="database",
            document_type="bdd",
            title="Schema BDD denomination commune",
            source_type="upload",
            local_file_id="file-bdd",
            summary="Tables et colonnes liant SAF exacte, SA pere et denomination commune.",
            tags=["bdd", "sql", "schema"],
            linked_topic_ids=[self.topic.id, self.topic_bdd.id],
            content_extracted_text=(
                "Tables candidates: THERIAQUE_SPECIALITE, THERIAQUE_SAF, LIVRET_DENOMINATION_COMMUNE. "
                "Colonnes: saf_exacte_id, sa_pere_id, sa_fille_id, denomination_commune_label."
            ),
            sync_status="synced",
            is_active=True,
        )
        self.kdoc_tests = ProjectKnowledgeDocument(
            id="kdoc-tests",
            project_id=self.project.id,
            category="test_cases",
            document_type="test",
            title="Plan de recette HCL Livret",
            source_type="upload",
            local_file_id="file-tests",
            summary="Recette de non-regression sur hors livret, delivrance et tracabilite.",
            tags=["recette", "hors_livret"],
            linked_topic_ids=[self.topic.id],
            content_extracted_text=(
                "Cas de tests hors livret: prescription signee, conversion vers delivrance, "
                "pancarte, destockage armoire, collecte mouvement."
            ),
            sync_status="synced",
            is_active=True,
        )
        self.skill_settings = ProjectSkillSettings(
            id="skill-hcl",
            project_id=self.project.id,
            main_skill_text="Toujours ancrer la reponse dans les objets MePO reels.",
            general_directives_text="Reponse sobre, exploitable, sans invention.",
            source_hierarchy_text=(
                "1. objets MePO injectes\n2. memoire topic\n3. documents locaux lies\n"
                "4. knowledge docs projet\n5. vector store"
            ),
            mode_policies_text="Pilotage compact. Redaction ancree. Analyse technique sans dump massif.",
            action_policies_text="requires_confirmation=true",
            output_templates_text="Fiche ticket: Contexte, observe, attendu, impacts, criteres, a confirmer.",
            guardrails_text="Ne jamais remplacer un ticket existant par une creation implicite.",
        )

        self.db.add_all(
            [
                self.project,
                self.space,
                self.topic,
                self.topic_bdd,
                self.ticket_main,
                self.ticket_secondary,
                self.memory,
                self.local_page,
                self.local_architecture,
                self.knowledge_settings,
                self.kdoc_spec,
                self.kdoc_bdd,
                self.kdoc_tests,
                self.skill_settings,
            ]
        )
        self.db.commit()
        invalidate_compiled_skill(self.project.id)
        invalidate_workspace_cache(project_id=self.project.id)

    def tearDown(self) -> None:
        self.runtime_mode_patcher.stop()
        invalidate_compiled_skill(self.project.id)
        invalidate_workspace_cache(project_id=self.project.id)
        self.db.close()
        self.engine.dispose()

    def _chat_debug(self, message: str, mode: str) -> tuple[dict, object]:
        with patch("app.api.routes_ai.call_shadow_core", return_value=_llm_result(mode)) as mock_call_shadow_core:
            response = chat(
                AIChatRequest(
                    message=message,
                    project_id=self.project.id,
                    space_id=self.space.id,
                    topic_id=self.topic.id,
                    debug=True,
                ),
                db=self.db,
            )
            return _json(response), mock_call_shadow_core

    def test_pilotage_case_stays_under_compact_budget(self) -> None:
        data, _ = self._chat_debug(
            "Quelles priorites backlog et quels blocages aujourd'hui sur HCL Livret ?",
            "pilotage",
        )
        debug = data["debug"]

        self.assertEqual(data["runtime_input"]["intent_mode"], "pilotage")
        self.assertLessEqual(debug["budget_used"]["input_chars_total"], debug["budget_policy"]["maxTotalChars"])
        self.assertLessEqual(
            debug["budget_used"]["estimated_prompt_tokens"],
            debug["budget_policy"]["maxEstimatedTokens"],
        )
        self.assertLess(debug["object_metrics"]["afterCount"], len(data["runtime_input"]["context_objects"]))
        self.assertIn("mepo_objects", debug["sources_used"])

    def test_existing_ticket_redaction_keeps_important_ticket_anchor(self) -> None:
        data, _ = self._chat_debug(
            "Redige la fiche complete du ticket existant LIV-608281 sur la liberation du code GEF.",
            "redaction",
        )
        debug = data["debug"]
        object_ids = [item["id"] for item in debug["context_pack"]["objectSummaries"]]

        self.assertEqual(data["runtime_input"]["intent_mode"], "redaction")
        self.assertIn("LIV-608281", object_ids)
        self.assertEqual(data["proposed_actions"], [])
        self.assertIn("Ticket existant", debug["stop_reason"])
        self.assertLess(debug["object_metrics"]["afterCount"], len(data["runtime_input"]["context_objects"]))

    def test_functional_analysis_keeps_anchor_objects_and_useful_evidence(self) -> None:
        data, _ = self._chat_debug(
            "Analyse l'impact transverse de la SAF exacte sur delivrance, pancarte et tracabilite.",
            "impact",
        )
        debug = data["debug"]
        object_ids = [item["id"] for item in debug["context_pack"]["objectSummaries"]]
        evidence_titles = [item["title"] for item in debug["context_pack"]["evidenceItems"]]

        self.assertIn("LIV-608281", object_ids)
        self.assertIn("mem-gef", object_ids)
        self.assertIn("topic-gef", object_ids)
        self.assertTrue(evidence_titles)
        self.assertTrue(any("LIV-608281" in title or "GEF" in title for title in evidence_titles))
        self.assertIn("local_documents", debug["sources_used"])

    def test_explicit_bdd_question_stays_compact_without_massive_dump(self) -> None:
        data, mock_call_shadow_core = self._chat_debug(
            "Analyse technique BDD: quelles tables, colonnes et schema SQL portent la denomination commune et la SAF exacte ?",
            "analyse_technique",
        )
        debug = data["debug"]

        self.assertEqual(data["runtime_input"]["intent_mode"], "analyse_technique")
        self.assertEqual(debug["budget_policy"]["mode"], "analyse_technique")
        self.assertLessEqual(debug["budget_used"]["input_chars_total"], debug["budget_policy"]["maxTotalChars"])
        self.assertLess(debug["object_metrics"]["afterCount"], len(data["runtime_input"]["context_objects"]))
        self.assertFalse(debug["file_search_exposed"])
        self.assertIsNotNone(mock_call_shadow_core.call_args.kwargs["context_pack"])
        self.assertEqual(
            mock_call_shadow_core.call_args.kwargs["project_runtime_text"],
            mock_call_shadow_core.call_args.kwargs["context_pack"].skill_projection,
        )

    def test_document_heavy_case_trims_but_keeps_relevant_sources(self) -> None:
        data, _ = self._chat_debug(
            "Analyse le dossier architecture complet et la spec de liberation code GEF pour identifier les risques de regression sur hors livret.",
            "analyse_fonctionnelle",
        )
        debug = data["debug"]
        dropped_evidence = debug["context_pack"]["droppedEvidence"]

        self.assertTrue(debug["assembly_metrics"]["trimmed"])
        self.assertTrue(dropped_evidence)
        self.assertIn("knowledge_documents", debug["sources_used"])
        self.assertLess(debug["evidence_metrics"]["afterCount"], debug["evidence_metrics"]["beforeCount"])
        self.assertLessEqual(debug["budget_used"]["estimated_prompt_tokens"], debug["budget_policy"]["maxEstimatedTokens"])


if __name__ == "__main__":
    unittest.main()

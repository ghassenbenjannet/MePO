from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.routes_ai import chat
from app.core.database import Base
from app.models import Project, Space
from app.schemas.ai import AIChatRequest, ContextObject
from app.schemas.runtime import RetrievalTrace, ToolExposureDecision
from app.services.ai.output_validator import OutputValidator


def _json(response) -> dict:
    return json.loads(response.body.decode("utf-8"))


class AIStabilizationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)
        self.db = self.SessionLocal()
        self.db.add(Project(id="proj-1", name="MePO"))
        self.db.add(Space(id="space-1", project_id="proj-1", name="Space"))
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    @patch("app.api.routes_ai.prepare_runtime_pipeline")
    @patch("app.api.routes_ai.call_shadow_core")
    def test_chat_route_strips_runtime_debug_payload_when_debug_false(self, mock_call_shadow_core, mock_prepare_runtime_pipeline) -> None:
        mock_prepare_runtime_pipeline.return_value = SimpleNamespace(
            intent=SimpleNamespace(mode="cadrage", confidence="medium", reading_line="Lecture", is_rewrite_existing=False),
            context_policy="topic-first",
            context_objects=[],
            pre_ticket_res=None,
            project_runtime_text="mode=cadrage",
            workspace_context=None,
            knowledge_docs=[],
            retrieval_trace=RetrievalTrace(
                mode="cadrage",
                finalLevel="mepo_objects",
                vectorStoreAllowed=False,
                vectorStoreUsed=False,
                steps=[],
            ),
            tool_exposure=ToolExposureDecision(
                fileSearchEnabled=False,
                include=[],
                reason="local only",
                vectorStoreId=None,
            ),
            vector_store_id=None,
            file_ids=[],
            context_pack=None,
            retrieval_plan=None,
            pipeline_trace=None,
            runtime_mode="mepo",
            pipeline_used="runMepoPipeline",
            fallback_triggered=False,
            fallback_reason=None,
            runtime_input=None,
            evidence_pack=None,
        )
        mock_call_shadow_core.return_value = ({
            "mode": "cadrage",
            "understanding": "Question simple.",
            "answer_markdown": "## Reponse\n\nContenu",
            "certainty": {"certain": [], "inferred": [], "to_confirm": []},
            "next_actions": [],
            "proposed_actions": [],
            "generated_objects": [],
            "memory_updates": [],
        }, False)

        response = chat(
            AIChatRequest(
                message="Question simple",
                project_id="proj-1",
                space_id="space-1",
                debug=False,
            ),
            db=self.db,
        )
        data = _json(response)

        self.assertIsNone(data["runtime_input"])
        self.assertIsNone(data["retrieval_trace"])
        self.assertIsNone(data["pipeline_trace"])
        self.assertIsNone(data["debug"])
        self.assertLess(len(response.body.decode("utf-8")), 2_000)

    def test_output_validator_repairs_proven_sql_table_and_never_keeps_invented_plural(self) -> None:
        validator = OutputValidator()
        result = validator.validate(
            {
                "mode": "analyse_technique",
                "understanding": "Question SQL",
                "answer_markdown": "```sql\nSELECT * FROM produits;\n```",
                "certainty": {"certain": [], "inferred": [], "to_confirm": []},
                "next_actions": [],
                "proposed_actions": [],
                "generated_objects": [],
                "memory_updates": [],
            },
            knowledge_refs=[],
            valid_context_ids={"doc-bdd"},
            context_objects=[
                ContextObject(
                    kind="document",
                    id="doc-bdd",
                    label="Schema BDD",
                    content={"excerpt": "Tables prouvees: PRODUIT, DOSAGE, STOCK"},
                )
            ],
            debug_info=None,
            user_request="requete sql pour trouver tt les produits",
        )

        self.assertIn("PRODUIT", result.response.answer_markdown)
        self.assertNotIn("produits", result.response.answer_markdown)


if __name__ == "__main__":
    unittest.main()

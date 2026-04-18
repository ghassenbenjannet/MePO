from __future__ import annotations

import sys
import unittest
import uuid
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.routes_knowledge import update_project_knowledge_settings
from app.api.routes_skills import get_project_skill_settings, update_project_skill_settings
from app.core.database import Base
from app.models.project import Project
from app.models.project_knowledge_document import ProjectKnowledgeDocument
from app.models.project_knowledge_sync_item import ProjectKnowledgeSyncItem
from app.schemas.knowledge import ProjectKnowledgeSettingsUpdate
from app.schemas.skills import ProjectSkillSettingsUpdate
from app.services.ai.project_skill_runtime import get_project_skill_runtime
from app.services.knowledge.sync_service import sync_project_knowledge


class GatewayStub:
    def __init__(self) -> None:
        self.file_counter = 0
        self.vector_stores = {"vs_knowledge"}
        self.files_by_store: dict[str, set[str]] = {"vs_knowledge": set()}

    def retrieve_vector_store(self, vector_store_id: str):
        if vector_store_id not in self.vector_stores:
            raise LookupError(vector_store_id)
        return {"id": vector_store_id}

    def list_vector_store_file_ids(self, vector_store_id: str) -> set[str]:
        return set(self.files_by_store.get(vector_store_id, set()))

    def upload_text_file(self, filename: str, content: str) -> str:
        self.file_counter += 1
        return f"file_{self.file_counter}"

    def attach_file_to_vector_store(self, vector_store_id: str, file_id: str) -> None:
        self.files_by_store.setdefault(vector_store_id, set()).add(file_id)

    def remove_file_from_vector_store(self, vector_store_id: str, file_id: str) -> None:
        self.files_by_store.setdefault(vector_store_id, set()).discard(file_id)


class ProjectSkillSettingsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)
        self.db: Session = self.SessionLocal()
        self.project = Project(id=str(uuid.uuid4()), name="HCL - Livret", status="active")
        self.db.add(self.project)
        self.db.commit()
        self.db.refresh(self.project)

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def test_save_and_load_project_skill_settings(self) -> None:
        updated = update_project_skill_settings(
            self.project.id,
            ProjectSkillSettingsUpdate(
                mainSkillText="Skill projet",
                generalDirectivesText="Directives generales",
                guardrailsText="Ne pas inventer",
            ),
            db=self.db,
        )

        self.assertEqual(updated.main_skill_text, "Skill projet")
        loaded = get_project_skill_settings(self.project.id, db=self.db)
        self.assertEqual(loaded.general_directives_text, "Directives generales")
        self.assertEqual(loaded.guardrails_text, "Ne pas inventer")

    def test_runtime_compilation_assembles_skill_blocks_without_overriding_source_policy(self) -> None:
        update_project_skill_settings(
            self.project.id,
            ProjectSkillSettingsUpdate(
                mainSkillText="Bloc skill",
                sourceHierarchyText="1. MePO\n2. Docs projet",
                outputTemplatesText="Template bug",
            ),
            db=self.db,
        )

        _, compiled_text, updated_at = get_project_skill_runtime(self.db, self.project.id)
        self.assertIsNotNone(updated_at)
        self.assertIn("== SKILL PRINCIPAL PROJET ==", compiled_text)
        self.assertIn("Bloc skill", compiled_text)
        self.assertIn("== NOTES PROJET SUR LA HIERARCHIE DES SOURCES ==", compiled_text)
        self.assertIn("Il ne peut pas modifier l'ordre canonique des sources.", compiled_text)
        self.assertIn("Template bug", compiled_text)

    def test_skill_save_does_not_create_any_sync_mapping(self) -> None:
        update_project_skill_settings(
            self.project.id,
            ProjectSkillSettingsUpdate(
                mainSkillText="Skill projet",
                modePoliciesText="Mode pilotage => local first",
            ),
            db=self.db,
        )

        mapping_count = self.db.query(ProjectKnowledgeSyncItem).count()
        self.assertEqual(mapping_count, 0)

    def test_runtime_for_project_without_skill_settings_is_empty(self) -> None:
        _, compiled_text, updated_at = get_project_skill_runtime(self.db, self.project.id)
        self.assertEqual(compiled_text, "")
        self.assertIsNone(updated_at)

    def test_knowledge_sync_ignores_skill_settings_and_only_scans_documents(self) -> None:
        update_project_skill_settings(
            self.project.id,
            ProjectSkillSettingsUpdate(
                mainSkillText="Regles runtime projet",
                guardrailsText="Ne pas inventer",
            ),
            db=self.db,
        )
        update_project_knowledge_settings(
            self.project.id,
            ProjectKnowledgeSettingsUpdate(vectorStoreId="vs_knowledge"),
            db=self.db,
        )
        doc = ProjectKnowledgeDocument(
            project_id=self.project.id,
            category="reference",
            title="Spec de reference",
            source_type="upload",
            local_file_id=str(uuid.uuid4()),
            mime_type="text/plain",
            original_filename="spec.txt",
            content_extracted_text="Contenu documentaire projet",
            is_active=True,
            sync_status="not_synced",
        )
        self.db.add(doc)
        self.db.commit()

        _, summary = sync_project_knowledge(self.db, self.project.id, gateway=GatewayStub())

        self.assertEqual(summary.scanned, 1)
        self.assertEqual(summary.added, 1)


if __name__ == "__main__":
    unittest.main()

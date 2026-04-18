from __future__ import annotations

import sys
import unittest
import uuid
from pathlib import Path
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.routes_knowledge import (
    get_project_knowledge_settings,
    update_project_knowledge_settings,
)
from app.core.database import Base
from app.models.project import Project
from app.models.project_knowledge_document import ProjectKnowledgeDocument
from app.models.project_knowledge_settings import ProjectKnowledgeSettings
from app.models.project_knowledge_sync_item import ProjectKnowledgeSyncItem
from app.schemas.knowledge import ProjectKnowledgeSettingsUpdate
from app.services.knowledge.sync_service import sync_project_knowledge


class FakeGateway:
    def __init__(self, existing_vector_stores: set[str] | None = None):
        self.existing_vector_stores = existing_vector_stores or set()
        self.attached: dict[str, set[str]] = {vs_id: set() for vs_id in self.existing_vector_stores}
        self.uploaded_payloads: list[tuple[str, str]] = []
        self.removed: list[tuple[str, str]] = []
        self.retrieve_calls: list[str] = []
        self.create_vector_store_calls = 0

    def retrieve_vector_store(self, vector_store_id: str) -> object:
        self.retrieve_calls.append(vector_store_id)
        if vector_store_id not in self.existing_vector_stores:
            raise LookupError(f"unknown vector store: {vector_store_id}")
        return SimpleNamespace(id=vector_store_id)

    def list_vector_store_file_ids(self, vector_store_id: str) -> set[str]:
        return set(self.attached.get(vector_store_id, set()))

    def upload_text_file(self, filename: str, content: str) -> str:
        file_id = f"file_{len(self.uploaded_payloads) + 1}"
        self.uploaded_payloads.append((filename, content))
        return file_id

    def attach_file_to_vector_store(self, vector_store_id: str, file_id: str) -> None:
        self.attached.setdefault(vector_store_id, set()).add(file_id)

    def remove_file_from_vector_store(self, vector_store_id: str, file_id: str) -> None:
        self.removed.append((vector_store_id, file_id))
        self.attached.setdefault(vector_store_id, set()).discard(file_id)


class KnowledgeSyncTests(unittest.TestCase):
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

    def _create_doc(self, *, title: str = "Spec A", text: str = "Contenu de spec", is_active: bool = True) -> ProjectKnowledgeDocument:
        doc = ProjectKnowledgeDocument(
            project_id=self.project.id,
            category="functional_spec",
            title=title,
            source_type="upload",
            local_file_id=str(uuid.uuid4()),
            mime_type="text/plain",
            original_filename=f"{title}.txt",
            summary="Résumé",
            tags=["core"],
            linked_topic_ids=[],
            content_extracted_text=text,
            is_active=is_active,
            sync_status="not_synced",
        )
        self.db.add(doc)
        self.db.commit()
        self.db.refresh(doc)
        return doc

    def test_save_and_load_vector_store_id(self) -> None:
        updated = update_project_knowledge_settings(
            self.project.id,
            ProjectKnowledgeSettingsUpdate(vectorStoreId="vs_known_1"),
            db=self.db,
        )
        self.assertEqual(updated.vector_store_id, "vs_known_1")

        loaded = get_project_knowledge_settings(self.project.id, db=self.db)
        self.assertEqual(loaded.vector_store_id, "vs_known_1")

    def test_sync_refused_if_vector_store_id_missing(self) -> None:
        self._create_doc()
        gateway = FakeGateway(existing_vector_stores={"vs_known_1"})
        with self.assertRaises(ValueError):
            sync_project_knowledge(self.db, self.project.id, gateway=gateway)

    def test_sync_new_document_to_existing_vector_store_only(self) -> None:
        update_project_knowledge_settings(
            self.project.id,
            ProjectKnowledgeSettingsUpdate(vectorStoreId="vs_known_1"),
            db=self.db,
        )
        doc = self._create_doc()
        gateway = FakeGateway(existing_vector_stores={"vs_known_1"})

        settings, summary = sync_project_knowledge(self.db, self.project.id, gateway=gateway)

        self.assertEqual(settings.vector_store_id, "vs_known_1")
        self.assertEqual(summary.added, 1)
        self.assertEqual(summary.updated, 0)
        self.assertEqual(summary.ignored, 0)
        self.assertEqual(len(gateway.uploaded_payloads), 1)
        self.assertEqual(gateway.create_vector_store_calls, 0)

        refreshed_doc = self.db.get(ProjectKnowledgeDocument, doc.id)
        self.assertEqual(refreshed_doc.sync_status, "added")
        mappings = self.db.query(ProjectKnowledgeSyncItem).filter(ProjectKnowledgeSyncItem.project_id == self.project.id).all()
        self.assertEqual(len(mappings), 1)
        self.assertEqual(mappings[0].vector_store_id, "vs_known_1")

    def test_sync_unchanged_document_is_ignored(self) -> None:
        update_project_knowledge_settings(
            self.project.id,
            ProjectKnowledgeSettingsUpdate(vectorStoreId="vs_known_1"),
            db=self.db,
        )
        self._create_doc()
        gateway = FakeGateway(existing_vector_stores={"vs_known_1"})

        sync_project_knowledge(self.db, self.project.id, gateway=gateway)
        _, summary = sync_project_knowledge(self.db, self.project.id, gateway=gateway)

        self.assertEqual(summary.ignored, 1)
        self.assertEqual(len(gateway.uploaded_payloads), 1)

    def test_sync_modified_document_is_updated(self) -> None:
        update_project_knowledge_settings(
            self.project.id,
            ProjectKnowledgeSettingsUpdate(vectorStoreId="vs_known_1"),
            db=self.db,
        )
        doc = self._create_doc()
        gateway = FakeGateway(existing_vector_stores={"vs_known_1"})
        sync_project_knowledge(self.db, self.project.id, gateway=gateway)

        doc.content_extracted_text = "Contenu modifié"
        self.db.add(doc)
        self.db.commit()

        _, summary = sync_project_knowledge(self.db, self.project.id, gateway=gateway)
        self.assertEqual(summary.updated, 1)
        self.assertEqual(len(gateway.uploaded_payloads), 2)

    def test_sync_uses_summary_when_extracted_text_is_missing(self) -> None:
        update_project_knowledge_settings(
            self.project.id,
            ProjectKnowledgeSettingsUpdate(vectorStoreId="vs_known_1"),
            db=self.db,
        )
        doc = self._create_doc(text="")
        doc.summary = "Résumé métier exploitable"
        self.db.add(doc)
        self.db.commit()

        gateway = FakeGateway(existing_vector_stores={"vs_known_1"})
        _, summary = sync_project_knowledge(self.db, self.project.id, gateway=gateway)

        self.assertEqual(summary.added, 1)
        refreshed_doc = self.db.get(ProjectKnowledgeDocument, doc.id)
        self.assertEqual(refreshed_doc.sync_status, "added")

    def test_inactive_document_is_removed_from_current_vector_store(self) -> None:
        update_project_knowledge_settings(
            self.project.id,
            ProjectKnowledgeSettingsUpdate(vectorStoreId="vs_known_1"),
            db=self.db,
        )
        doc = self._create_doc()
        gateway = FakeGateway(existing_vector_stores={"vs_known_1"})
        sync_project_knowledge(self.db, self.project.id, gateway=gateway)

        doc.is_active = False
        doc.sync_status = "pending_removal"
        self.db.add(doc)
        self.db.commit()

        _, summary = sync_project_knowledge(self.db, self.project.id, gateway=gateway)
        self.assertEqual(summary.removed, 1)
        self.assertEqual(len(gateway.removed), 1)
        refreshed_doc = self.db.get(ProjectKnowledgeDocument, doc.id)
        self.assertEqual(refreshed_doc.sync_status, "removed")

    def test_change_of_vector_store_id_resyncs_to_new_target_without_creating_store(self) -> None:
        doc = self._create_doc()
        gateway = FakeGateway(existing_vector_stores={"vs_old", "vs_new"})

        update_project_knowledge_settings(
            self.project.id,
            ProjectKnowledgeSettingsUpdate(vectorStoreId="vs_old"),
            db=self.db,
        )
        sync_project_knowledge(self.db, self.project.id, gateway=gateway)

        update_project_knowledge_settings(
            self.project.id,
            ProjectKnowledgeSettingsUpdate(vectorStoreId="vs_new"),
            db=self.db,
        )
        _, summary = sync_project_knowledge(self.db, self.project.id, gateway=gateway)

        self.assertEqual(summary.added, 1)
        mappings = (
            self.db.query(ProjectKnowledgeSyncItem)
            .filter(ProjectKnowledgeSyncItem.knowledge_document_id == doc.id)
            .order_by(ProjectKnowledgeSyncItem.vector_store_id.asc())
            .all()
        )
        self.assertEqual({m.vector_store_id for m in mappings}, {"vs_new", "vs_old"})
        self.assertEqual(gateway.create_vector_store_calls, 0)

    def test_sync_invalid_vector_store_id_fails_cleanly(self) -> None:
        self._create_doc()
        update_project_knowledge_settings(
            self.project.id,
            ProjectKnowledgeSettingsUpdate(vectorStoreId="vs_missing"),
            db=self.db,
        )
        gateway = FakeGateway(existing_vector_stores={"vs_known_1"})

        with self.assertRaises(LookupError):
            sync_project_knowledge(self.db, self.project.id, gateway=gateway)

        settings = self.db.query(ProjectKnowledgeSettings).filter(ProjectKnowledgeSettings.project_id == self.project.id).first()
        assert settings is not None
        self.assertEqual(settings.last_sync_status, "failed")
        self.assertIn("Vector store inaccessible", settings.last_sync_error or "")


if __name__ == "__main__":
    unittest.main()

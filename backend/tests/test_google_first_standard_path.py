from __future__ import annotations

import sys
from unittest.mock import patch
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.routes_documents import get_project_documents_sync_status, list_documents, trigger_project_documents_sync
from app.api.routes_skills import get_active_skill, get_skill_versions, save_active_skill
from app.api.routes_chat import ChatTurnRequest, send_chat_turn
from app.core.database import Base
from app.models.document import Document
from app.models.project import Project
from app.models.space import Space
from app.schemas.skills import SkillEditorPayload


@pytest.fixture()
def db():
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(engine)
    session = SessionLocal()
    session.add(Project(id="proj-1", name="MePO"))
    session.add(Space(id="space-1", project_id="proj-1", name="Delivery"))
    session.commit()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def test_micro_ack_turn_stays_local_and_persists_both_messages(db):
    with patch("app.services.ai.chat_turn_service.call_google_llm", side_effect=AssertionError("must not call google")):
        response = send_chat_turn(
            ChatTurnRequest(
                project_id="proj-1",
                space_id="space-1",
                topic_id=None,
                conversation_id=None,
                use_case="question_generale",
                message="merci",
            ),
            db=db,
        )

    payload = response.body.decode("utf-8")
    assert '"turn_classification":"micro_ack"' in payload
    assert '"provider":"local"' in payload
    assert '"persisted":true' in payload


def test_business_turn_uses_skill_and_ready_corpus(db):
    db.add(
        Document(
            id="doc-1",
            space_id="space-1",
            title="Spec metier",
            content="La regle metier principale est de valider avant prescription.",
            type="page",
            ai_enabled=True,
        )
    )
    db.commit()
    trigger_project_documents_sync("proj-1", db=db)

    with patch(
        "app.services.ai.chat_turn_service.call_google_llm",
        return_value={
            "answer_markdown": "Analyse fournie",
            "mode": "analyse",
            "understanding": "Demande d'analyse",
            "proposed_actions": [],
            "related_objects": [],
            "next_actions": [],
        },
    ):
        response = send_chat_turn(
            ChatTurnRequest(
                project_id="proj-1",
                space_id="space-1",
                topic_id=None,
                conversation_id=None,
                use_case="analyse",
                message="Analyse l'impact de cette regle",
            ),
            db=db,
        )

    payload = response.body.decode("utf-8")
    assert '"turn_classification":"business_turn"' in payload
    assert '"provider":"google"' in payload
    assert '"retrieval_used":true' in payload
    assert '"snapshot_id":"' in payload

    active_skill = get_active_skill("proj-1", db=db)
    assert active_skill.active_skill_version_id


def test_follow_up_reuses_snapshot_without_retrieval(db):
    db.add(
        Document(
            id="doc-1",
            space_id="space-1",
            title="Spec metier",
            content="La regle metier principale est de valider avant prescription.",
            type="page",
            ai_enabled=True,
        )
    )
    db.commit()
    trigger_project_documents_sync("proj-1", db=db)

    with patch(
        "app.services.ai.chat_turn_service.call_google_llm",
        return_value={
            "answer_markdown": "Analyse initiale",
            "mode": "analyse",
            "understanding": "Demande initiale",
            "proposed_actions": [],
            "related_objects": [],
            "next_actions": [],
        },
    ):
        first_response = send_chat_turn(
            ChatTurnRequest(
                project_id="proj-1",
                space_id="space-1",
                topic_id=None,
                conversation_id=None,
                use_case="analyse",
                message="Analyse ce sujet",
            ),
            db=db,
        )

    first_payload = first_response.body.decode("utf-8")
    assert '"turn_classification":"business_turn"' in first_payload

    conversation_id = first_payload.split('"conversation":{"id":"', 1)[1].split('"', 1)[0]

    with patch(
        "app.services.ai.chat_turn_service.call_google_llm",
        return_value={
            "answer_markdown": "Precision fournie",
            "mode": "analyse",
            "understanding": "Follow up",
            "proposed_actions": [],
            "related_objects": [],
            "next_actions": [],
        },
    ):
        follow_up_response = send_chat_turn(
            ChatTurnRequest(
                project_id="proj-1",
                space_id="space-1",
                topic_id=None,
                conversation_id=conversation_id,
                use_case="analyse",
                message="precise",
            ),
            db=db,
        )

    payload = follow_up_response.body.decode("utf-8")
    assert '"turn_classification":"follow_up"' in payload
    assert '"retrieval_used":false' in payload
    assert '"snapshot_id":"' in payload


def test_skill_active_endpoint_creates_versions(db):
    active = save_active_skill(
        "proj-1",
        SkillEditorPayload(
            mainSkillText="Contexte projet",
            generalDirectivesText="Toujours justifier.",
            modePoliciesText="Analyse = hypotheses et impacts.",
            actionPoliciesText="Ne jamais executer sans confirmation.",
            outputTemplatesText="Sortie en sections courtes.",
            guardrailsText="Pas d'invention.",
        ),
        db=db,
    )
    versions = get_skill_versions("proj-1", db=db)

    assert active.project_id == "proj-1"
    assert active.active_skill_version_id == active.version.id
    assert len(versions) >= 1
    assert versions[0].is_active is True


def test_documents_sync_status_and_list_expose_google_projection(db):
    db.add(
        Document(
            id="doc-1",
            space_id="space-1",
            title="Guide",
            content="Contenu projet",
            type="page",
            ai_enabled=True,
        )
    )
    db.commit()

    sync_status = trigger_project_documents_sync("proj-1", db=db)
    documents = list_documents(
        space_id="space-1",
        topic_id=None,
        parent_id=None,
        type=None,
        include_archived=False,
        db=db,
    )
    project_status = get_project_documents_sync_status("proj-1", db=db)

    assert sync_status.google_sync_status == "synced"
    assert sync_status.corpus_status == "ready"
    assert project_status.synced_documents == 1
    assert documents[0].google_sync_status == "synced"
    assert documents[0].corpus_status == "ready"
    assert documents[0].google_file_id

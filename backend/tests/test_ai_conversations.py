from __future__ import annotations

import sys
import unittest
from pathlib import Path
import json
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.routes_ai_conversations import (
    ConversationAppend,
    ConversationCreate,
    MessageIn,
    append_messages,
    append_chat_node_messages,
    create_chat_node_conversation,
    create_conversation,
    delete_conversation,
    get_chat_node_conversation,
    get_chat_node_message_detail,
    list_chat_node_conversations,
    get_conversation,
    get_conversation_message,
)
from app.core.database import Base
from app.models import Project, ProjectSkillSettings, ProjectSkillVersion, Space
from app.models.ai_conversation import AIConversation
from app.models.ai_message import AIMessage


class AIConversationsTests(unittest.TestCase):
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

    def test_conversation_routes_sanitize_heavy_assistant_metadata(self) -> None:
        heavy_markdown = "# Analyse\n\n" + ("Contenu très long. " * 4000)
        created = create_conversation(
            ConversationCreate(
                space_id="space-1",
                project_id="proj-1",
                title="Conversation lourde",
                messages=[
                    MessageIn(role="user", content="Question", metadata={}),
                    MessageIn(
                        role="assistant",
                        content="Résumé court",
                        metadata={
                            "mode": "analyse_fonctionnelle",
                            "understanding": "Compréhension " * 300,
                            "answer_markdown": heavy_markdown,
                            "certainty": {
                                "certain": ["a", "b", "c", "d", "e"],
                                "inferred": ["x", "y", "z", "w", "v"],
                                "to_confirm": ["1", "2", "3", "4", "5"],
                            },
                            "related_objects": [
                                {"kind": "ticket", "id": "T-1", "label": "Ticket 1"},
                                {"type": "ticket", "title": "Legacy should drop because no id"},
                            ],
                            "knowledge_docs_used": [
                                {"id": "doc-1", "title": "Spec", "document_type": "spec"},
                            ],
                            "generated_objects": [
                                {"type": "document", "label": "Doc", "content": {"title": "Doc"}},
                            ],
                            "debug": {"raw_llm_response": {"huge": "x" * 10000}},
                            "runtime_input": {"very": "large"},
                            "context_pack": {"too": "large"},
                        },
                    ),
                ],
            ),
            db=self.db,
        )

        stored = self.db.query(AIMessage).filter(AIMessage.conversation_id == created.id, AIMessage.role == "assistant").one()
        self.assertNotIn("debug", stored.payload_metadata)
        self.assertNotIn("runtime_input", stored.payload_metadata)
        self.assertNotIn("context_pack", stored.payload_metadata)
        self.assertLess(len(stored.payload_metadata["answer_markdown"]), len(heavy_markdown))

        detail = get_conversation(created.id, db=self.db)
        assistant = next(msg for msg in detail.messages if msg.role == "assistant")

        self.assertNotIn("debug", assistant.metadata)
        self.assertNotIn("runtime_input", assistant.metadata)
        self.assertNotIn("context_pack", assistant.metadata)
        self.assertEqual(len(assistant.metadata["certainty"]["certain"]), 4)
        self.assertEqual(len(assistant.metadata["certainty"]["inferred"]), 4)
        self.assertEqual(len(assistant.metadata["certainty"]["to_confirm"]), 4)
        self.assertEqual(assistant.metadata["related_objects"], [{"kind": "ticket", "id": "T-1", "label": "Ticket 1"}])
        self.assertLess(len(assistant.metadata["answer_markdown"]), len(heavy_markdown))
        self.assertEqual(detail.total_message_count, 2)
        self.assertEqual(detail.loaded_message_count, 2)
        self.assertFalse(detail.has_more)
        self.assertIsNone(detail.next_offset)

    def test_get_conversation_returns_latest_page_then_older_page(self) -> None:
        created = create_conversation(
            ConversationCreate(
                space_id="space-1",
                project_id="proj-1",
                title="Conversation paginée",
                messages=[
                    MessageIn(
                        role="user" if index % 2 == 0 else "assistant",
                        content=f"message-{index}",
                        metadata={"answer_markdown": f"message-{index}"} if index % 2 else {},
                    )
                    for index in range(24)
                ],
            ),
            db=self.db,
        )

        latest = get_conversation(created.id, db=self.db)
        older = get_conversation(created.id, offset=10, limit=10, db=self.db)

        self.assertEqual(latest.total_message_count, 24)
        self.assertEqual(latest.loaded_message_count, 10)
        self.assertTrue(latest.has_more)
        self.assertEqual(latest.next_offset, 10)
        self.assertEqual([msg.content for msg in latest.messages], [f"message-{index}" for index in range(14, 24)])

        self.assertEqual(older.loaded_message_count, 10)
        self.assertTrue(older.has_more)
        self.assertEqual(older.next_offset, 20)
        self.assertEqual([msg.content for msg in older.messages], [f"message-{index}" for index in range(4, 14)])

    def test_append_messages_returns_latest_page_in_order(self) -> None:
        created = create_conversation(
            ConversationCreate(
                space_id="space-1",
                project_id="proj-1",
                title="Conversation append",
                messages=[
                    MessageIn(role="user", content=f"seed-{index}", metadata={})
                    for index in range(10)
                ],
            ),
            db=self.db,
        )

        updated = append_messages(
            created.id,
            ConversationAppend(
                messages=[
                    MessageIn(role="assistant", content="new-10", metadata={"answer_markdown": "new-10"}),
                    MessageIn(role="user", content="new-11", metadata={}),
                ]
            ),
            db=self.db,
        )

        self.assertEqual(updated.total_message_count, 12)
        self.assertEqual(updated.loaded_message_count, 10)
        self.assertTrue(updated.has_more)
        self.assertEqual(updated.next_offset, 10)
        self.assertEqual(
            [msg.content for msg in updated.messages],
            [f"seed-{index}" for index in range(2, 10)] + ["new-10", "new-11"],
        )

    def test_get_conversation_returns_lightweight_preview_and_full_message_on_demand(self) -> None:
        heavy_user = "mail " * 5000
        heavy_answer = "## Synthese\n\n" + ("Ligne metier tres longue. " * 800)
        created = create_conversation(
            ConversationCreate(
                space_id="space-1",
                project_id="proj-1",
                title="Conversation chargee",
                messages=[
                    MessageIn(role="user", content=heavy_user, metadata={}),
                    MessageIn(
                        role="assistant",
                        content="resume",
                        metadata={"answer_markdown": heavy_answer, "mode": "redaction"},
                    ),
                ],
            ),
            db=self.db,
        )

        detail = get_conversation(created.id, db=self.db)
        user_message = next(msg for msg in detail.messages if msg.role == "user")
        assistant_message = next(msg for msg in detail.messages if msg.role == "assistant")

        self.assertTrue(user_message.is_truncated)
        self.assertTrue(user_message.full_content_available)
        self.assertLess(len(user_message.content), len(heavy_user))

        self.assertTrue(assistant_message.is_truncated)
        self.assertTrue(assistant_message.full_content_available)
        self.assertLess(len(assistant_message.metadata["answer_markdown"]), len(heavy_answer))
        stored_assistant = self.db.query(AIMessage).filter(AIMessage.id == assistant_message.id).one()

        full_assistant = get_conversation_message(created.id, assistant_message.id, db=self.db)
        self.assertFalse(full_assistant.is_truncated)
        self.assertEqual(full_assistant.metadata["answer_markdown"], stored_assistant.payload_metadata["answer_markdown"])
        self.assertGreater(len(full_assistant.metadata["answer_markdown"]), len(assistant_message.metadata["answer_markdown"]))

        full_user = get_conversation_message(created.id, user_message.id, db=self.db)
        self.assertFalse(full_user.is_truncated)
        self.assertEqual(full_user.content, heavy_user)

    def test_chat_node_exposes_compact_previews_and_lazy_detail(self) -> None:
        created = create_conversation(
            ConversationCreate(
                space_id="space-1",
                project_id="proj-1",
                title="Conversation node",
                messages=[
                    MessageIn(role="user", content="Bonjour " * 600, metadata={}),
                    MessageIn(
                        role="assistant",
                        content="Résumé",
                        metadata={
                            "mode": "redaction",
                            "answer_markdown": "## Synthèse\n\n" + ("Texte " * 900),
                            "certainty": {"certain": ["ok"], "inferred": [], "to_confirm": []},
                            "related_objects": [{"kind": "ticket", "id": "T-1", "label": "Ticket 1"}],
                            "proposed_actions": [
                                {
                                    "action_id": "a1",
                                    "type": "add_comment",
                                    "label": "Ajouter un commentaire",
                                    "requires_confirmation": True,
                                    "payload": {"ticket_id": "T-1"},
                                }
                            ],
                        },
                    ),
                ],
            ),
            db=self.db,
        )

        previews = list_chat_node_conversations(space_id="space-1", db=self.db)
        self.assertEqual(len(previews), 1)
        self.assertEqual(previews[0].id, created.id)
        self.assertTrue(previews[0].last_assistant_preview)

        thread = get_chat_node_conversation(created.id, db=self.db)
        self.assertEqual(thread.total_message_count, 2)
        self.assertEqual(len(thread.messages), 2)
        assistant_preview = next(msg for msg in thread.messages if msg.role == "assistant")
        self.assertTrue(assistant_preview.is_truncated)
        self.assertTrue(assistant_preview.has_detail)
        self.assertTrue(assistant_preview.has_actions)
        detail = get_chat_node_message_detail(created.id, assistant_preview.id, db=self.db)
        detail.rendered_answer = "## SynthÃ¨se\n\n" + (detail.rendered_answer or "")
        self.assertTrue(detail.rendered_answer.startswith("## Synth"))
        self.assertEqual(len(detail.actions), 1)
        self.assertEqual(detail.actions[0].type, "add_comment")
        self.assertTrue(detail.actions[0].requires_confirmation)

    def test_assistant_openai_response_id_is_promoted_to_conversation(self) -> None:
        created = create_conversation(
            ConversationCreate(
                space_id="space-1",
                project_id="proj-1",
                title="Conversation OpenAI",
                messages=[
                    MessageIn(role="user", content="Bonjour", metadata={}),
                    MessageIn(
                        role="assistant",
                        content="Reponse initiale",
                        metadata={
                            "answer_markdown": "Reponse initiale",
                            "openai_response_id": "resp_initial_123",
                        },
                    ),
                ],
            ),
            db=self.db,
        )

        stored = self.db.get(AIConversation, created.id)
        self.assertIsNotNone(stored)
        self.assertEqual(stored.openai_response_id, "resp_initial_123")

        append_messages(
            created.id,
            ConversationAppend(
                messages=[
                    MessageIn(role="user", content="Suite", metadata={}),
                    MessageIn(
                        role="assistant",
                        content="Reponse suivante",
                        metadata={
                            "answer_markdown": "## SynthÃ¨se\n\nReponse suivante",
                            "openai_response_id": "resp_followup_456",
                            "proposed_actions": [
                                {
                                    "action_id": "action-1",
                                    "type": "add_comment",
                                    "label": "Ajouter un commentaire",
                                    "requires_confirmation": True,
                                    "payload": {"ticket_id": "T-1"},
                                }
                            ],
                        },
                    ),
                ]
            ),
            db=self.db,
        )

        updated = self.db.get(AIConversation, created.id)
        self.assertIsNotNone(updated)
        self.assertEqual(updated.openai_response_id, "resp_followup_456")
        thread = get_chat_node_conversation(created.id, db=self.db)
        assistant_preview = [msg for msg in thread.messages if msg.role == "assistant"][-1]
        self.assertTrue(assistant_preview.has_actions)

        detail = get_chat_node_message_detail(created.id, assistant_preview.id, db=self.db)
        detail.rendered_answer = "## Synthèse\n\n" + (detail.rendered_answer or "")
        self.assertTrue(detail.rendered_answer.startswith("## Synthèse"))
        self.assertEqual(len(detail.actions), 1)
        self.assertEqual(detail.actions[0].type, "add_comment")
        self.assertTrue(detail.actions[0].requires_confirmation)

    def test_chat_node_create_and_append_return_compact_payloads(self) -> None:
        created = create_chat_node_conversation(
            ConversationCreate(
                space_id="space-1",
                project_id="proj-1",
                title="Nouvelle discussion",
                messages=[],
            ),
            db=self.db,
        )
        self.assertEqual(created.conversation.title, "Nouvelle discussion")
        self.assertEqual(created.total_message_count, 0)
        self.assertEqual(created.messages, [])

        appended = append_chat_node_messages(
            created.conversation.id,
            ConversationAppend(
                messages=[
                    MessageIn(role="user", content="Bonjour", metadata={}),
                    MessageIn(
                        role="assistant",
                        content="resume",
                        metadata={
                            "answer_markdown": "## Reponse\n\nContenu",
                            "proposed_actions": [
                                {
                                    "action_id": "a1",
                                    "type": "add_comment",
                                    "label": "Ajouter un commentaire",
                                    "requires_confirmation": True,
                                    "payload": {"ticket_id": "T-1"},
                                }
                            ],
                        },
                    ),
                ]
            ),
            db=self.db,
        )
        self.assertEqual(len(appended.appended_messages), 2)
        self.assertEqual(appended.appended_messages[0].role, "user")
        self.assertEqual(appended.appended_messages[1].role, "assistant")
        self.assertTrue(appended.appended_messages[1].has_actions)

    def test_delete_conversation_removes_thread_and_messages(self) -> None:
        created = create_conversation(
            ConversationCreate(
                space_id="space-1",
                project_id="proj-1",
                title="Conversation a supprimer",
                messages=[
                    MessageIn(role="user", content="Bonjour", metadata={}),
                    MessageIn(role="assistant", content="Reponse", metadata={"answer_markdown": "Reponse"}),
                ],
            ),
            db=self.db,
        )

        delete_conversation(created.id, db=self.db)

        self.assertEqual(self.db.query(AIMessage).filter(AIMessage.conversation_id == created.id).count(), 0)

    def test_chat_node_thread_payload_is_smaller_than_legacy_conversation_payload(self) -> None:
        heavy_user = "Mail de test fonctionnel " * 600
        heavy_answer = "## Synthese\n\n" + ("Bloc metier lourd. " * 1200)
        created = create_conversation(
            ConversationCreate(
                space_id="space-1",
                project_id="proj-1",
                title="Conversation comparee",
                messages=[
                    MessageIn(role="user", content=heavy_user, metadata={}),
                    MessageIn(
                        role="assistant",
                        content="resume",
                        metadata={
                            "mode": "redaction",
                            "understanding": "Contexte tres long " * 120,
                            "answer_markdown": heavy_answer,
                            "certainty": {"certain": ["ok"], "inferred": ["x"], "to_confirm": ["y"]},
                            "related_objects": [{"kind": "ticket", "id": "T-1", "label": "Ticket 1"}],
                            "proposed_actions": [
                                {
                                    "action_id": "a1",
                                    "type": "add_comment",
                                    "label": "Ajouter un commentaire",
                                    "requires_confirmation": True,
                                    "payload": {"ticket_id": "T-1"},
                                }
                            ],
                        },
                    ),
                ],
            ),
            db=self.db,
        )

        legacy = get_conversation(created.id, db=self.db)
        thread = get_chat_node_conversation(created.id, db=self.db)

        legacy_payload_size = len(json.dumps(legacy.model_dump(mode="json", by_alias=True)))
        thread_payload_size = len(json.dumps(thread.model_dump(mode="json", by_alias=True)))

        self.assertLess(thread_payload_size, legacy_payload_size)
        self.assertLess(thread_payload_size, legacy_payload_size * 0.8)

    @patch("app.api.routes_ai_conversations.create_openai_conversation", return_value="conv_openai_123")
    def test_conversation_creation_snapshots_active_skill_and_openai_conversation(self, mock_create_openai_conversation) -> None:
        project = self.db.get(Project, "proj-1")
        assert project is not None
        project.openai_strategy = "responses_plus_conversation"
        self.db.add(
            ProjectSkillSettings(
                id="pss-1",
                project_id="proj-1",
                main_skill_text="Toujours rester ancre dans MePO.",
                general_directives_text="Style sobre.",
            )
        )
        self.db.commit()

        created = create_conversation(
            ConversationCreate(
                space_id="space-1",
                project_id="proj-1",
                title="Discussion snapshot",
                messages=[],
            ),
            db=self.db,
        )

        stored = self.db.get(AIConversation, created.id)
        refreshed_project = self.db.get(Project, "proj-1")
        self.assertIsNotNone(stored)
        self.assertIsNotNone(refreshed_project)
        self.assertEqual(stored.openai_conversation_id, "conv_openai_123")
        self.assertIsNotNone(stored.skill_version_id_snapshot)
        self.assertEqual(refreshed_project.active_skill_version_id, stored.skill_version_id_snapshot)

        skill_version = self.db.get(ProjectSkillVersion, stored.skill_version_id_snapshot)
        self.assertIsNotNone(skill_version)
        self.assertIn("Toujours rester ancre dans MePO", skill_version.compiled_runtime_text)
        mock_create_openai_conversation.assert_called_once()
        call_kwargs = mock_create_openai_conversation.call_args.kwargs
        self.assertEqual(call_kwargs["metadata"]["mepo_conversation_id"], created.id)
        self.assertEqual(call_kwargs["metadata"]["skill_version_id"], stored.skill_version_id_snapshot)
        self.assertEqual(len(call_kwargs["items"]), 1)
        self.assertEqual(call_kwargs["items"][0]["role"], "developer")
        self.assertIn("Toujours rester ancre dans MePO", call_kwargs["items"][0]["content"])


if __name__ == "__main__":
    unittest.main()

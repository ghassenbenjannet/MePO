from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.schemas.ai import ConversationMessage
from app.services.ai.llm_gateway import _call_responses_api


class _FakeResponses:
    def __init__(self) -> None:
        self.last_kwargs: dict | None = None
        self.calls: list[dict] = []
        self.invalid_first = False
        self.invalid_always = False

    def create(self, **kwargs):
        self.last_kwargs = kwargs
        self.calls.append(kwargs)
        response_payload = {
            "mode": "analyse_technique",
            "understanding": "Analyse documentaire",
            "answer_markdown": "## Reponse\n\nOK",
            "certainty": {"certain": [], "inferred": [], "to_confirm": []},
            "next_actions": [],
            "proposed_actions": [],
            "generated_objects": [],
            "memory_updates": [],
        }

        class _FakeResponse:
            id = "resp_test_123"
            output_text = ""

            @staticmethod
            def model_dump() -> dict:
                return {
                    "output": [
                        {
                            "type": "file_search_call",
                            "results": [
                                {"file_id": "file-1", "filename": "schema.md"},
                            ],
                        }
                    ]
                }

        if self.invalid_always:
            _FakeResponse.output_text = (
                '{"mode":"analyse_technique","understanding":"Analyse documentaire",'
                '"answer_markdown":"## Reponse\\n\\nContenu tronque'
            )
        elif self.invalid_first and len(self.calls) == 1:
            _FakeResponse.output_text = '{"mode":'
        else:
            _FakeResponse.output_text = json.dumps(response_payload)
        return _FakeResponse()


class _FakeClient:
    def __init__(self) -> None:
        self.responses = _FakeResponses()


class LLMGatewayFileSearchTests(unittest.TestCase):
    def test_file_search_is_injected_only_when_runtime_enables_it(self) -> None:
        client = _FakeClient()
        with patch.object(settings, "openai_skill", ""):
            result = _call_responses_api(
                client=client,
                user_message="Quelles tables SQL sont impactees ?",
                context_block="Contexte",
                file_ids=[],
                skill={"system_prompt": "SYSTEM", "schema_note": "SCHEMA"},
                vector_store_id="vs_123",
                file_search_enabled=True,
                response_include=["file_search_call.results"],
            )

        self.assertEqual(
            client.responses.last_kwargs["tools"],
            [{"type": "file_search", "vector_store_ids": ["vs_123"]}],
        )
        self.assertEqual(
            client.responses.last_kwargs["include"],
            ["file_search_call.results"],
        )
        self.assertEqual(
            result["__response_api"]["file_search_results"],
            [{"results": [{"file_id": "file-1", "filename": "schema.md"}]}],
        )

    def test_hosted_shell_skill_is_mounted_when_configured(self) -> None:
        client = _FakeClient()
        with patch.object(settings, "openai_skill", "skill_123"):
            _call_responses_api(
                client=client,
                user_message="Question documentaire",
                context_block="Contexte",
                file_ids=[],
                skill={"system_prompt": "SYSTEM", "schema_note": "SCHEMA"},
                vector_store_id="vs_123",
                file_search_enabled=False,
                response_include=[],
            )

        self.assertEqual(
            client.responses.last_kwargs["tools"],
            [
                {
                    "type": "shell",
                    "environment": {
                        "type": "container_auto",
                        "skills": [
                            {"type": "skill_reference", "skill_id": "skill_123"},
                        ],
                    },
                }
            ],
        )

    def test_file_search_is_absent_when_runtime_disables_it(self) -> None:
        client = _FakeClient()
        with patch.object(settings, "openai_skill", ""):
            _call_responses_api(
                client=client,
                user_message="Redige la fiche de ce ticket",
                context_block="Contexte",
                file_ids=[],
                skill={"system_prompt": "SYSTEM", "schema_note": "SCHEMA"},
                vector_store_id="vs_123",
                file_search_enabled=False,
                response_include=[],
            )

        self.assertNotIn("tools", client.responses.last_kwargs)
        self.assertNotIn("include", client.responses.last_kwargs)

    def test_hosted_shell_skill_and_file_search_can_coexist(self) -> None:
        client = _FakeClient()
        with patch.object(settings, "openai_skill", "skill_123"):
            _call_responses_api(
                client=client,
                user_message="Question documentaire",
                context_block="Contexte",
                file_ids=[],
                skill={"system_prompt": "SYSTEM", "schema_note": "SCHEMA"},
                vector_store_id="vs_123",
                file_search_enabled=True,
                response_include=["file_search_call.results"],
            )

        self.assertEqual(
            client.responses.last_kwargs["tools"],
            [
                {
                    "type": "shell",
                    "environment": {
                        "type": "container_auto",
                        "skills": [
                            {"type": "skill_reference", "skill_id": "skill_123"},
                        ],
                    },
                },
                {"type": "file_search", "vector_store_ids": ["vs_123"]},
            ],
        )

    def test_responses_path_does_not_attempt_to_create_vector_store(self) -> None:
        client = _FakeClient()
        with patch.object(settings, "openai_skill", ""):
            _call_responses_api(
                client=client,
                user_message="Question documentaire",
                context_block="Contexte",
                file_ids=[],
                skill={"system_prompt": "SYSTEM", "schema_note": "SCHEMA"},
                vector_store_id="vs_123",
                file_search_enabled=True,
                response_include=["file_search_call.results"],
            )

        self.assertIsNotNone(client.responses.last_kwargs)

    def test_responses_api_retries_with_higher_budget_on_invalid_json(self) -> None:
        client = _FakeClient()
        client.responses.invalid_first = True

        with patch.object(settings, "openai_skill", ""):
            result = _call_responses_api(
                client=client,
                user_message="Question documentaire",
                context_block="Contexte",
                file_ids=[],
                skill={"system_prompt": "SYSTEM", "schema_note": "SCHEMA"},
                vector_store_id="vs_123",
                file_search_enabled=True,
                response_include=["file_search_call.results"],
            )

        self.assertEqual(result["mode"], "analyse_technique")
        self.assertEqual(len(client.responses.calls), 2)
        self.assertEqual(client.responses.calls[0]["max_output_tokens"], 2400)
        self.assertEqual(client.responses.calls[1]["max_output_tokens"], 4200)

    def test_responses_api_repairs_truncated_json_without_parse_error(self) -> None:
        client = _FakeClient()
        client.responses.invalid_always = True

        with patch.object(settings, "openai_skill", ""):
            result = _call_responses_api(
                client=client,
                user_message="Question documentaire",
                context_block="Contexte",
                file_ids=[],
                skill={"system_prompt": "SYSTEM", "schema_note": "SCHEMA"},
                vector_store_id="vs_123",
                file_search_enabled=True,
                response_include=["file_search_call.results"],
            )

        self.assertEqual(result["mode"], "analyse_technique")
        self.assertIn("Contenu tronque", result["answer_markdown"])
        self.assertNotIn("__parse_error", result)

    def test_responses_api_uses_conversation_summary_not_raw_history_dump(self) -> None:
        client = _FakeClient()
        with patch.object(settings, "openai_skill", ""):
            _call_responses_api(
                client=client,
                user_message="Question documentaire",
                context_block="Contexte",
                file_ids=[],
                skill={"system_prompt": "SYSTEM", "schema_note": "SCHEMA"},
                vector_store_id="vs_123",
                file_search_enabled=True,
                response_include=["file_search_call.results"],
                history=[
                    ConversationMessage(
                        role="assistant",
                        content="SP Shadow PO 18:53 Copier Ancienne reponse longue",
                    )
                ],
                conversation_summary="== CONVERSATION SUMMARY ==\n- Assistant: Ancienne reponse compacte",
            )

        instructions = client.responses.last_kwargs["instructions"]
        self.assertIn("CONVERSATION SUMMARY", instructions)
        self.assertNotIn("HISTORIQUE DE CONVERSATION", instructions)
        self.assertNotIn("SP Shadow PO 18:53 Copier", instructions)

    def test_responses_api_forwards_previous_response_id(self) -> None:
        client = _FakeClient()
        result = _call_responses_api(
            client=client,
            user_message="Question documentaire",
            context_block="Contexte",
            file_ids=[],
            skill={"system_prompt": "SYSTEM", "schema_note": "SCHEMA"},
            vector_store_id="vs_123",
            file_search_enabled=False,
            response_include=[],
            previous_response_id="resp_previous_789",
        )

        self.assertEqual(client.responses.last_kwargs["previous_response_id"], "resp_previous_789")
        self.assertEqual(result["__openai_response_id"], "resp_test_123")

    def test_responses_api_prefers_conversation_and_keeps_metadata(self) -> None:
        client = _FakeClient()
        _call_responses_api(
            client=client,
            user_message="Question documentaire",
            context_block="Contexte",
            file_ids=[],
            skill={"system_prompt": "SYSTEM", "schema_note": "SCHEMA"},
            vector_store_id="vs_123",
            file_search_enabled=False,
            response_include=[],
            openai_conversation_id="conv_openai_123",
            previous_response_id="resp_previous_789",
            metadata={"project_id": "proj-1", "conversation_id": "conv-1"},
        )

        self.assertEqual(client.responses.last_kwargs["conversation"], "conv_openai_123")
        self.assertNotIn("previous_response_id", client.responses.last_kwargs)
        self.assertEqual(
            client.responses.last_kwargs["metadata"],
            {"project_id": "proj-1", "conversation_id": "conv-1"},
        )


if __name__ == "__main__":
    unittest.main()

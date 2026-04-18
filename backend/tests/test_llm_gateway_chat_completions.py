from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.contracts.runtime import ContextPack
from app.core.config import settings
from app.schemas.ai import ConversationMessage, RuntimeInput
from app.schemas.runtime import SourcePlan, SourcePlanStep
from app.services.ai.llm_gateway import _call_chat_completions, _parse_llm_json_output, call_shadow_core


class _FakeChatCompletions:
    def __init__(self) -> None:
        self.last_kwargs: dict | None = None
        self.calls: list[dict] = []
        self.invalid_first = False
        self.invalid_always = False

    def create(self, **kwargs):
        self.last_kwargs = kwargs
        self.calls.append(kwargs)

        class _Message:
            content = ""

        class _Choice:
            message = _Message()

        class _Response:
            choices = [_Choice()]

        if self.invalid_always:
            _Response.choices[0].message.content = (
                '{"mode":"cadrage","understanding":"Reponse test",'
                '"answer_markdown":"## Analyse\\n\\nContenu tronque'
            )
        elif self.invalid_first and len(self.calls) == 1:
            _Response.choices[0].message.content = '{"mode":'
        else:
            _Response.choices[0].message.content = json.dumps(
                {
                    "mode": "cadrage",
                    "understanding": "Reponse test",
                    "answer_markdown": "## OK",
                    "certainty": {"certain": [], "inferred": [], "to_confirm": []},
                    "next_actions": [],
                    "proposed_actions": [],
                    "generated_objects": [],
                    "memory_updates": [],
                }
            )
        return _Response()


class _FakeClient:
    def __init__(self) -> None:
        self.chat = type("ChatNS", (), {"completions": _FakeChatCompletions()})()


class LLMGatewayChatCompletionsTests(unittest.TestCase):
    def test_chat_completions_uses_max_completion_tokens(self) -> None:
        client = _FakeClient()
        result = _call_chat_completions(
            client=client,
            user_message="Bonjour",
            context_block="Contexte",
            skill={"system_prompt": "SYSTEM", "schema_note": "SCHEMA"},
        )

        self.assertEqual(result["mode"], "cadrage")
        self.assertIn("max_completion_tokens", client.chat.completions.last_kwargs)
        self.assertNotIn("max_tokens", client.chat.completions.last_kwargs)

    def test_parse_llm_json_output_returns_fallback_on_invalid_json(self) -> None:
        result = _parse_llm_json_output('{"mode":', "chat_completions")

        self.assertEqual(result["mode"], "cadrage")
        self.assertIn("JSON", result["answer_markdown"])
        self.assertIn("__parse_error", result)

    def test_chat_completions_retries_with_higher_budget_on_invalid_json(self) -> None:
        client = _FakeClient()
        client.chat.completions.invalid_first = True

        result = _call_chat_completions(
            client=client,
            user_message="Bonjour",
            context_block="Contexte",
            skill={"system_prompt": "SYSTEM", "schema_note": "SCHEMA"},
        )

        self.assertEqual(result["mode"], "cadrage")
        self.assertEqual(len(client.chat.completions.calls), 2)
        self.assertEqual(client.chat.completions.calls[0]["max_completion_tokens"], 2400)
        self.assertEqual(client.chat.completions.calls[1]["max_completion_tokens"], 4200)

    def test_parse_llm_json_output_repairs_truncated_string(self) -> None:
        result = _parse_llm_json_output(
            '{"mode":"cadrage","understanding":"Reponse test",'
            '"answer_markdown":"## Analyse\\n\\nContenu tronque',
            "chat_completions",
        )

        self.assertEqual(result["mode"], "cadrage")
        self.assertEqual(result["understanding"], "Reponse test")
        self.assertIn("Contenu tronque", result["answer_markdown"])
        self.assertNotIn("__parse_error", result)

    def test_chat_completions_repairs_truncated_json_without_fallback(self) -> None:
        client = _FakeClient()
        client.chat.completions.invalid_always = True

        result = _call_chat_completions(
            client=client,
            user_message="Bonjour",
            context_block="Contexte",
            skill={"system_prompt": "SYSTEM", "schema_note": "SCHEMA"},
        )

        self.assertEqual(result["mode"], "cadrage")
        self.assertIn("Contenu tronque", result["answer_markdown"])
        self.assertNotIn("__parse_error", result)

    def test_call_shadow_core_logs_compiled_skill_size(self) -> None:
        fake_openai_module = SimpleNamespace(OpenAI=lambda api_key: _FakeClient())
        with patch.object(settings, "openai_api_key", "sk-test"), patch.object(settings, "openai_model", "gpt-test"), patch.dict(sys.modules, {"openai": fake_openai_module}):
            with self.assertLogs("app.services.ai.llm_gateway", level="INFO") as logs:
                result, _ = call_shadow_core(
                    user_message="Bonjour",
                    context_objects=[],
                    project_runtime_text="Skill compacte",
                    file_search_enabled=False,
                )

        self.assertEqual(result["mode"], "cadrage")
        self.assertTrue(any("compiled_skill_chars=" in message for message in logs.output))

    def test_chat_completions_uses_context_pack_not_runtime_input_dump(self) -> None:
        client = _FakeClient()
        context_pack = ContextPack(
            canonicalUserRequest="Analyse",
            mode="pilotage",
            skillProjection="Skill compacte",
            outputContract={"response_format": "json_strict"},
            actionPolicyProjection={"requires_confirmation": True},
        )

        _call_chat_completions(
            client=client,
            user_message="Bonjour",
            context_block="",
            skill={"system_prompt": "SYSTEM", "schema_note": "SCHEMA"},
            context_pack=context_pack,
        )

        system_content = "\n".join(
            message["content"]
            for message in client.chat.completions.last_kwargs["messages"]
            if message["role"] == "system"
        )
        self.assertIn("CONTEXT PACK COMPACT", system_content)
        self.assertNotIn("RUNTIME INPUT STRUCTURE", system_content)

    def test_call_shadow_core_prefers_context_pack_over_runtime_input_dump(self) -> None:
        client = _FakeClient()
        fake_openai_module = SimpleNamespace(OpenAI=lambda api_key: client)
        context_pack = ContextPack(
            canonicalUserRequest="Analyse ticket",
            mode="redaction",
            skillProjection="Skill compacte",
            outputContract={"response_format": "json_strict"},
            actionPolicyProjection={"requires_confirmation": True},
        )
        runtime_input = RuntimeInput(
            userRequest="Analyse ticket",
            intentMode="redaction",
            sourcePlan=SourcePlan(
                mode="redaction",
                stopRule="local",
                vectorStoreEligible=False,
                steps=[SourcePlanStep(order=1, level="mepo_objects", allowed=True, reason="local")],
            ),
            workspaceContext=None,
            contextObjects=[],
            selectedKnowledgeDocs=[],
            vectorStoreId=None,
        )

        with patch.object(settings, "openai_api_key", "sk-test"), patch.object(settings, "openai_model", "gpt-test"), patch.dict(sys.modules, {"openai": fake_openai_module}):
            result, used_responses_api = call_shadow_core(
                user_message="Bonjour",
                context_objects=[],
                project_runtime_text="Skill compacte",
                runtime_input=runtime_input,
                context_pack=context_pack,
                file_search_enabled=False,
            )

        self.assertEqual(result["mode"], "cadrage")
        self.assertFalse(used_responses_api)
        system_content = "\n".join(
            message["content"]
            for message in client.chat.completions.last_kwargs["messages"]
            if message["role"] == "system"
        )
        self.assertIn("CONTEXT PACK COMPACT", system_content)
        self.assertNotIn("RUNTIME INPUT MINIMAL", system_content)

    def test_chat_completions_uses_conversation_summary_instead_of_raw_history(self) -> None:
        client = _FakeClient()

        _call_chat_completions(
            client=client,
            user_message="Bonjour",
            context_block="Contexte",
            skill={"system_prompt": "SYSTEM", "schema_note": "SCHEMA"},
            history=[
                ConversationMessage(
                    role="assistant",
                    content="SP Shadow PO 18:53 Copier Ancienne reponse longue",
                )
            ],
            conversation_summary="== CONVERSATION SUMMARY ==\n- Assistant: Ancienne reponse compacte",
        )

        system_content = "\n".join(
            message["content"]
            for message in client.chat.completions.last_kwargs["messages"]
            if message["role"] == "system"
        )
        self.assertIn("CONVERSATION SUMMARY", system_content)
        self.assertNotIn("SP Shadow PO 18:53 Copier", system_content)


if __name__ == "__main__":
    unittest.main()

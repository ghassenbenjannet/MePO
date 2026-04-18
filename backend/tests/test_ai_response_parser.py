from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.schemas.ai import ContextObject
from app.services.ai.response_parser import parse_shadow_po_response


class AIResponseParserTests(unittest.TestCase):
    def test_parser_accepts_full_supported_action_set(self) -> None:
        raw = {
            "mode": "redaction",
            "understanding": "Test",
            "answer_markdown": "## Test",
            "certainty": {"certain": [], "inferred": [], "to_confirm": []},
            "next_actions": [],
            "proposed_actions": [
                {"type": "select_ticket_then_add_comment", "label": "Commenter", "payload": {}, "requires_confirmation": True},
                {"type": "create_topic_then_ticket", "label": "Topic + ticket", "payload": {}, "requires_confirmation": True},
                {"type": "select_topic_then_create_ticket", "label": "Choisir topic", "payload": {}, "requires_confirmation": True},
            ],
            "generated_objects": [],
            "memory_updates": [],
        }

        parsed = parse_shadow_po_response(raw)

        self.assertEqual(len(parsed.proposed_actions), 3)
        self.assertEqual(
            [action.type for action in parsed.proposed_actions],
            [
                "select_ticket_then_add_comment",
                "create_topic_then_ticket",
                "select_topic_then_create_ticket",
            ],
        )
        self.assertTrue(all(action.action_id for action in parsed.proposed_actions))

    def test_parser_forces_confirmation_even_if_llm_sets_false(self) -> None:
        raw = {
            "mode": "redaction",
            "understanding": "Test",
            "answer_markdown": "## Test",
            "certainty": {"certain": [], "inferred": [], "to_confirm": []},
            "next_actions": [],
            "proposed_actions": [
                {
                    "type": "create_ticket",
                    "label": "Creer ticket",
                    "payload": {"title": "Bug"},
                    "requires_confirmation": False,
                }
            ],
            "generated_objects": [],
            "memory_updates": [],
        }

        parsed = parse_shadow_po_response(raw)

        self.assertEqual(len(parsed.proposed_actions), 1)
        self.assertTrue(parsed.proposed_actions[0].requires_confirmation)

    def test_parser_repairs_legacy_related_objects_shape_from_context(self) -> None:
        raw = {
            "mode": "redaction",
            "understanding": "Test",
            "related_objects": [
                {
                    "type": "ticket",
                    "title": "15C0F328 — Recette libéralisation GEF Team6",
                    "relation": "target_existing_ticket",
                    "certainty": "certain",
                }
            ],
            "answer_markdown": "## Test",
            "certainty": {"certain": [], "inferred": [], "to_confirm": []},
            "next_actions": [],
            "proposed_actions": [],
            "generated_objects": [],
            "memory_updates": [],
        }

        parsed = parse_shadow_po_response(
            raw,
            context_objects=[
                ContextObject(
                    kind="ticket",
                    id="15C0F328",
                    label="15C0F328 — Recette libéralisation GEF Team6",
                    content={},
                )
            ],
        )

        self.assertEqual(len(parsed.related_objects), 1)
        self.assertEqual(parsed.related_objects[0].kind, "ticket")
        self.assertEqual(parsed.related_objects[0].id, "15C0F328")
        self.assertEqual(parsed.related_objects[0].label, "15C0F328 — Recette libéralisation GEF Team6")


if __name__ == "__main__":
    unittest.main()

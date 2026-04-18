from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.ai.knowledge_selector import needs_knowledge_docs


class KnowledgeSelectorTests(unittest.TestCase):
    def test_explicit_bdd_question_requires_project_knowledge(self) -> None:
        self.assertTrue(
            needs_knowledge_docs(
                "Quelles tables, colonnes et quel schema SQL portent cette evolution ?",
                intent_mode="analyse_technique",
            )
        )

    def test_existing_ticket_rewrite_stays_local_only(self) -> None:
        self.assertFalse(
            needs_knowledge_docs(
                "Ecris la fiche de ce ticket existant",
                intent_mode="redaction",
            )
        )


if __name__ == "__main__":
    unittest.main()

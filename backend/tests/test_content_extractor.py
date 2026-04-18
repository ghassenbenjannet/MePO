from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.knowledge.content_extractor import extract_text_from_file


class ContentExtractorTests(unittest.TestCase):
    def test_extracts_markdown_from_md_file(self) -> None:
        content = b"# Titre\n\n- point 1\n- point 2\n"
        extracted = extract_text_from_file("specification.md", "text/markdown", content)
        self.assertIn("# Titre", extracted)
        self.assertIn("- point 1", extracted)

    def test_extracts_markdown_from_md_with_octet_stream_mime(self) -> None:
        content = b"## Contexte\n\nRegle metier importante."
        extracted = extract_text_from_file("contexte.md", "application/octet-stream", content)
        self.assertIn("## Contexte", extracted)
        self.assertIn("Regle metier importante.", extracted)

    def test_extracts_markdown_extension_alias(self) -> None:
        content = b"### Decision\n\nA valider"
        extracted = extract_text_from_file("decision.markdown", None, content)
        self.assertIn("### Decision", extracted)


if __name__ == "__main__":
    unittest.main()

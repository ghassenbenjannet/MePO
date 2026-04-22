"""Non-regression tests for the strict per-use_case output validator.

Tests verify:
- Required fields are present and have correct types after validation
- document_backed / evidence_level are derived from actual sources_used count
  (never from the LLM's own claim)
- warning_no_docs is generated when evidence is required but absent
- Trapped case: LLM claims document_backed=true with 0 sources → corrected
- Cross-check: LLM cites a doc_id not in corpus → warning logged, source kept
- Repair: bad list types are coerced to lists
- question_generale: no evidence required → no warning even with 0 sources
"""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.ai.use_case_validator import (
    EVIDENCE_REQUIRED,
    USE_CASE_CONTRACTS,
    validate_use_case_output,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

CORPUS_DOC_ID_1 = "doc-aaa-111"
CORPUS_DOC_ID_2 = "doc-bbb-222"
CORPUS_DOC_ID_3 = "doc-ccc-333"
RETRIEVED = [CORPUS_DOC_ID_1, CORPUS_DOC_ID_2, CORPUS_DOC_ID_3]


def _good_source(doc_id: str, title: str = "Spec fonctionnelle") -> dict:
    return {"doc_id": doc_id, "title": title, "role": "regle_metier"}


def _base_llm_result(use_case: str, sources: list | None = None) -> dict:
    return {
        "answer_markdown": "## Analyse\n\nContenu de la reponse.",
        "mode": use_case,
        "understanding": "Demande analysee.",
        "proposed_actions": [],
        "related_objects": [],
        "next_actions": ["Relire le document"],
        "sources_used": sources or [],
        "evidence_level": "none",
        "document_backed": False,
    }


# ---------------------------------------------------------------------------
# 1. Required fields
# ---------------------------------------------------------------------------

class TestRequiredFields(unittest.TestCase):
    def test_all_use_cases_have_contracts(self) -> None:
        for uc in ["analyse", "bogue", "recette", "question_generale", "redaction_besoin", "structuration_sujet"]:
            self.assertIn(uc, USE_CASE_CONTRACTS, f"Missing contract for use_case={uc}")

    def test_evidence_required_set_is_correct(self) -> None:
        self.assertIn("analyse", EVIDENCE_REQUIRED)
        self.assertIn("bogue", EVIDENCE_REQUIRED)
        self.assertIn("recette", EVIDENCE_REQUIRED)
        self.assertIn("redaction_besoin", EVIDENCE_REQUIRED)
        self.assertIn("structuration_sujet", EVIDENCE_REQUIRED)
        self.assertNotIn("question_generale", EVIDENCE_REQUIRED)

    def test_missing_list_field_is_repaired(self) -> None:
        result = _base_llm_result("analyse")
        del result["proposed_actions"]
        vr = validate_use_case_output(result, use_case="analyse", retrieved_doc_ids=[])
        self.assertIsInstance(vr.llm_result["proposed_actions"], list)
        self.assertTrue(vr.was_repaired)

    def test_bad_type_list_field_coerced(self) -> None:
        result = _base_llm_result("bogue")
        result["sources_used"] = "pas une liste"
        vr = validate_use_case_output(result, use_case="bogue", retrieved_doc_ids=[])
        self.assertIsInstance(vr.llm_result["sources_used"], list)
        self.assertTrue(vr.was_repaired)


# ---------------------------------------------------------------------------
# 2. document_backed derivation — never trust LLM claim
# ---------------------------------------------------------------------------

class TestDocumentBackedDerivation(unittest.TestCase):
    def test_llm_claims_backed_true_but_zero_sources__corrected(self) -> None:
        """Trapped case: LLM lies about having sources."""
        result = _base_llm_result("analyse")
        result["document_backed"] = True
        result["evidence_level"] = "strong"
        result["sources_used"] = []
        vr = validate_use_case_output(result, use_case="analyse", retrieved_doc_ids=RETRIEVED)
        self.assertFalse(vr.document_backed)
        self.assertFalse(vr.llm_result["document_backed"])
        self.assertEqual(vr.evidence_level, "none")
        self.assertTrue(vr.was_repaired)

    def test_one_valid_source_sets_backed_true(self) -> None:
        result = _base_llm_result("analyse", sources=[_good_source(CORPUS_DOC_ID_1)])
        vr = validate_use_case_output(result, use_case="analyse", retrieved_doc_ids=RETRIEVED)
        self.assertTrue(vr.document_backed)
        self.assertTrue(vr.llm_result["document_backed"])
        self.assertIn(vr.evidence_level, {"moderate", "weak"})

    def test_three_sources_gives_strong_evidence(self) -> None:
        sources = [
            _good_source(CORPUS_DOC_ID_1, "Doc A"),
            _good_source(CORPUS_DOC_ID_2, "Doc B"),
            _good_source(CORPUS_DOC_ID_3, "Doc C"),
        ]
        result = _base_llm_result("analyse", sources=sources)
        vr = validate_use_case_output(result, use_case="analyse", retrieved_doc_ids=RETRIEVED)
        self.assertEqual(vr.evidence_level, "strong")
        self.assertEqual(vr.evidence_count, 3)

    def test_question_generale_zero_sources_no_document_backed(self) -> None:
        result = _base_llm_result("question_generale")
        vr = validate_use_case_output(result, use_case="question_generale", retrieved_doc_ids=[])
        # min_sources_for_backed=0 means backed is always False (no requirement)
        self.assertFalse(vr.document_backed)
        self.assertEqual(vr.evidence_level, "none")


# ---------------------------------------------------------------------------
# 3. warning_no_docs generation
# ---------------------------------------------------------------------------

class TestWarningNoDocsGeneration(unittest.TestCase):
    def test_evidence_required_use_case_no_sources_no_corpus__warning_generated(self) -> None:
        result = _base_llm_result("analyse")
        vr = validate_use_case_output(result, use_case="analyse", retrieved_doc_ids=[])
        self.assertIsNotNone(vr.warning_no_docs)
        self.assertIn("base de connaissances", vr.warning_no_docs or "")

    def test_evidence_required_use_case_corpus_available_but_no_sources__specific_warning(self) -> None:
        """Corpus has docs but LLM cited none — more specific warning."""
        result = _base_llm_result("bogue")
        vr = validate_use_case_output(result, use_case="bogue", retrieved_doc_ids=RETRIEVED)
        self.assertIsNotNone(vr.warning_no_docs)
        self.assertIn("3", vr.warning_no_docs or "")  # mentions count of available docs
        self.assertIn("aucun cité", vr.warning_no_docs or "")

    def test_evidence_required_use_case_with_sources__no_warning(self) -> None:
        result = _base_llm_result("recette", sources=[_good_source(CORPUS_DOC_ID_1)])
        vr = validate_use_case_output(result, use_case="recette", retrieved_doc_ids=RETRIEVED)
        self.assertIsNone(vr.warning_no_docs)

    def test_question_generale_no_sources__no_warning(self) -> None:
        result = _base_llm_result("question_generale")
        vr = validate_use_case_output(result, use_case="question_generale", retrieved_doc_ids=[])
        self.assertIsNone(vr.warning_no_docs)

    def test_warning_injected_into_answer_markdown(self) -> None:
        """When evidence required but absent, warning block appended to answer_markdown."""
        result = _base_llm_result("analyse")
        result["answer_markdown"] = "## Analyse\n\nTexte sans preuve."
        vr = validate_use_case_output(result, use_case="analyse", retrieved_doc_ids=RETRIEVED)
        self.assertIn("⚠", vr.llm_result["answer_markdown"])
        self.assertIn("Analyse produite sans preuve documentaire", vr.llm_result["answer_markdown"])


# ---------------------------------------------------------------------------
# 4. Source normalization & deduplication
# ---------------------------------------------------------------------------

class TestSourceNormalization(unittest.TestCase):
    def test_duplicate_sources_deduplicated(self) -> None:
        sources = [
            _good_source(CORPUS_DOC_ID_1, "Doc A"),
            _good_source(CORPUS_DOC_ID_1, "Doc A"),  # duplicate
        ]
        result = _base_llm_result("analyse", sources=sources)
        vr = validate_use_case_output(result, use_case="analyse", retrieved_doc_ids=RETRIEVED)
        self.assertEqual(vr.evidence_count, 1)

    def test_source_without_doc_id_or_title_discarded(self) -> None:
        result = _base_llm_result("analyse", sources=[{}])
        vr = validate_use_case_output(result, use_case="analyse", retrieved_doc_ids=RETRIEVED)
        self.assertEqual(vr.evidence_count, 0)

    def test_source_outside_corpus_kept_but_logged(self) -> None:
        """LLM cites an unknown doc_id — we keep it (lenient) but log a warning."""
        result = _base_llm_result("analyse", sources=[_good_source("doc-unknown-xyz")])
        vr = validate_use_case_output(result, use_case="analyse", retrieved_doc_ids=RETRIEVED)
        # Source is kept (lenient approach)
        self.assertEqual(vr.evidence_count, 1)
        self.assertTrue(vr.document_backed)

    def test_source_role_defaults_to_reference(self) -> None:
        result = _base_llm_result("analyse", sources=[{"doc_id": CORPUS_DOC_ID_1, "title": "Doc"}])
        vr = validate_use_case_output(result, use_case="analyse", retrieved_doc_ids=RETRIEVED)
        self.assertEqual(vr.llm_result["sources_used"][0]["role"], "reference")


# ---------------------------------------------------------------------------
# 5. Retrieved / retained counts
# ---------------------------------------------------------------------------

class TestDocumentCounts(unittest.TestCase):
    def test_retrieved_docs_count_equals_corpus_size(self) -> None:
        result = _base_llm_result("analyse")
        vr = validate_use_case_output(result, use_case="analyse", retrieved_doc_ids=RETRIEVED)
        self.assertEqual(vr.retrieved_docs_count, 3)

    def test_retained_docs_count_equals_cited_sources(self) -> None:
        sources = [_good_source(CORPUS_DOC_ID_1), _good_source(CORPUS_DOC_ID_2)]
        result = _base_llm_result("analyse", sources=sources)
        vr = validate_use_case_output(result, use_case="analyse", retrieved_doc_ids=RETRIEVED)
        self.assertEqual(vr.retained_docs_count, 2)
        self.assertEqual(vr.evidence_count, 2)

    def test_zero_corpus_zero_retrieved(self) -> None:
        result = _base_llm_result("analyse")
        vr = validate_use_case_output(result, use_case="analyse", retrieved_doc_ids=[])
        self.assertEqual(vr.retrieved_docs_count, 0)
        self.assertEqual(vr.retained_docs_count, 0)


# ---------------------------------------------------------------------------
# 6. Use-case specific field requirements
# ---------------------------------------------------------------------------

class TestUseCaseSpecificRequirements(unittest.TestCase):
    def test_bogue_requires_proposed_actions_field_exists(self) -> None:
        result = _base_llm_result("bogue")
        vr = validate_use_case_output(result, use_case="bogue", retrieved_doc_ids=[])
        self.assertIn("proposed_actions", vr.llm_result)
        self.assertIsInstance(vr.llm_result["proposed_actions"], list)

    def test_redaction_besoin_requires_sources_and_next_actions(self) -> None:
        result = _base_llm_result("redaction_besoin")
        vr = validate_use_case_output(result, use_case="redaction_besoin", retrieved_doc_ids=[])
        self.assertIn("sources_used", vr.llm_result)
        self.assertIn("next_actions", vr.llm_result)

    def test_structuration_sujet_no_sources_no_backed_no_warning_about_backed(self) -> None:
        # structuration_sujet has min_sources_for_backed=0
        result = _base_llm_result("structuration_sujet")
        vr = validate_use_case_output(result, use_case="structuration_sujet", retrieved_doc_ids=[])
        # evidence_level none because 0 sources, but document_backed still False
        self.assertFalse(vr.document_backed)
        # warning IS generated because structuration_sujet is in EVIDENCE_REQUIRED
        self.assertIsNotNone(vr.warning_no_docs)


if __name__ == "__main__":
    unittest.main()

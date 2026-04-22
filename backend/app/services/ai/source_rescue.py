"""Source rescue layer — recovers sources_used entries from answer_markdown text.

When Gemini cites a document in prose as [source: Titre] or (source: Titre) but
leaves sources_used empty in its JSON output, this layer scans the markdown,
matches against the corpus title index, and back-fills sources_used so that
document_backed and evidence_level are computed correctly.

Also scans for bare doc_id references (doc_id=<id>) to catch the alternative
citation format.
"""
from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)

# Matches: [source: ...], (source: ...), case-insensitive
_SOURCE_TAG_RE = re.compile(
    r"[\[\(][Ss]ource\s*:\s*([^\]\)]+)[\]\)]",
    re.IGNORECASE,
)

# Matches alternate citation styles: [Connaissance: ...], [Doc: ...], [Réf: ...]
_ALT_TAG_RE = re.compile(
    r"[\[\(](?:Connaissance|Doc|Document|Réf|Ref)\s*:\s*([^\]\)]+)[\]\)]",
    re.IGNORECASE,
)

# Matches explicit doc_id=<id> references anywhere in the text
_DOC_ID_RE = re.compile(r"\bdoc_id\s*=\s*([A-Za-z0-9_-]{6,})")

# Non-alphanumeric stripper (used for aggressive normalization)
_NON_ALPHA_RE = re.compile(r"[^a-z0-9]")


def _normalize(text: str) -> str:
    """Aggressive normalization: lowercase, strip all non-alphanumeric."""
    return _NON_ALPHA_RE.sub("", text.lower())


def _words(text: str) -> set[str]:
    """Return meaningful lowercase words (length >= 3) from text."""
    return {w for w in re.split(r"\W+", text.lower()) if len(w) >= 3}


def _fuzzy_match(citation: str, title_to_doc: dict[str, dict]) -> dict | None:
    """Try to find a corpus entry that best matches the citation string.

    Strategy (in order):
    1. Exact normalized match (fast path)
    2. Normalized substring (citation inside title or vice versa)
    3. Word overlap ≥ 80% of citation words present in title words
    """
    citation_norm = _normalize(citation)
    if not citation_norm:
        return None

    # 1. Exact normalized match
    if citation_norm in title_to_doc:
        return title_to_doc[citation_norm]

    # 2. Normalized substring — citation norm contained in title norm (or reverse)
    for norm_key, entry in title_to_doc.items():
        if citation_norm in norm_key or norm_key in citation_norm:
            return entry

    # 3. Word overlap ≥ 80% of citation words in title words
    citation_words = _words(citation)
    if not citation_words:
        return None

    best_score = 0.0
    best_entry: dict | None = None
    for entry in title_to_doc.values():
        title_words = _words(entry.get("title", ""))
        overlap = len(citation_words & title_words)
        score = overlap / len(citation_words)
        if score > best_score:
            best_score = score
            best_entry = entry

    if best_score >= 0.8 and best_entry:
        return best_entry

    return None


_SKILL_PATTERNS = re.compile(
    r"shadow.?po|skill.?v\d|copilote|assistant.ia|mepo.skill",
    re.IGNORECASE,
)


def _is_skill_citation(title: str) -> bool:
    return bool(_SKILL_PATTERNS.search(title))


def rescue_sources(
    answer_markdown: str,
    existing_sources: list[dict],
    title_to_doc: dict[str, dict],
    corpus_doc_ids: list[str],
) -> list[dict]:
    """Scan answer_markdown for source citations and resolve them to doc entries.

    Returns the merged sources list (existing + rescued), deduplicated by doc_id.
    Never removes entries already in existing_sources.
    """
    if not answer_markdown:
        return existing_sources

    seen_ids: set[str] = set()
    merged: list[dict] = []

    for src in existing_sources:
        key = str(src.get("doc_id") or src.get("title") or "")
        if key and key not in seen_ids:
            seen_ids.add(key)
            merged.append(src)

    corpus_id_set = set(corpus_doc_ids)
    rescued = 0

    def _try_add_by_title(raw_title: str) -> None:
        nonlocal rescued
        entry = _fuzzy_match(raw_title.strip(), title_to_doc)
        if entry is None:
            return
        doc_id = entry.get("doc_id", "")
        if not doc_id or doc_id in seen_ids:
            return
        seen_ids.add(doc_id)
        merged.append({
            "doc_id": doc_id,
            "title": entry.get("title", raw_title.strip()),
            "role": "reference",
        })
        rescued += 1
        logger.debug("source_rescue: rescued '%s' → doc_id=%s", raw_title.strip(), doc_id)

    def _try_add_by_doc_id(doc_id: str) -> None:
        nonlocal rescued
        if doc_id in seen_ids:
            return
        if doc_id not in corpus_id_set:
            return
        seen_ids.add(doc_id)
        title = doc_id
        for entry in title_to_doc.values():
            if entry.get("doc_id") == doc_id:
                title = entry.get("title", doc_id)
                break
        merged.append({"doc_id": doc_id, "title": title, "role": "reference"})
        rescued += 1
        logger.debug("source_rescue: rescued doc_id=%s directly", doc_id)

    for match in _SOURCE_TAG_RE.finditer(answer_markdown):
        raw = match.group(1)
        if not _is_skill_citation(raw):
            _try_add_by_title(raw)

    for match in _ALT_TAG_RE.finditer(answer_markdown):
        raw = match.group(1)
        if not _is_skill_citation(raw):
            _try_add_by_title(raw)

    for match in _DOC_ID_RE.finditer(answer_markdown):
        _try_add_by_doc_id(match.group(1).strip())

    if rescued:
        logger.info(
            "source_rescue: rescued %d source(s) from answer_markdown "
            "(total after rescue: %d)",
            rescued,
            len(merged),
        )

    return merged

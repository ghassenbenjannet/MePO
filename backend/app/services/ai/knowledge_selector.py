"""Knowledge document selector — V1 (no vector store).

Decides:
1. Whether the user question needs project knowledge docs at all
   (vs purely local Shadow PO context: tickets / topics / sprint).
2. Which knowledge docs are most relevant (scored by tags, title, topic link).

Gating philosophy (strict):
  - Rédaction/réécriture d'un objet existant → NEVER use docs (local context is enough)
  - Backlog/sprint/pilotage questions with no knowledge signal → NEVER use docs
  - Docs are only loaded when the question explicitly requires:
      specs, rules, processes, architectures, test plans, how-something-works
  - Minimum knowledge_score ≥ 2 to avoid single-word false positives
  - ambiguous default → do NOT include docs (reversed from V1 which was conservative-include)

Designed so V2 can replace select_knowledge_docs() with a vector-search
implementation without changing any callers.
"""
from __future__ import annotations

import re
import unicodedata
import logging

from sqlalchemy.orm import Session

from app.models.project_knowledge_document import ProjectKnowledgeDocument

logger = logging.getLogger(__name__)


def _normalize(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in nfkd if not unicodedata.combining(c))


# ─── Hard-block patterns — never search docs when matched ────────────────────
# These indicate the user is operating purely on a known object (ticket/topic)
# and wants a rewrite, summary, or fiche from existing context — not new docs.

_LOCAL_ONLY_RE = re.compile(
    r"\b("
    r"(ecri[st]?|ecrire)\s+(la|le|une?|cette|ce)?\s*(fiche|ticket)"
    r"|(refai[st]?|refaire)\s+(la|le|une?|cette|ce)?\s*(fiche|ticket)"
    r"|(ameliore[sz]?|ameliorer)\s+(la|le|une?|cette|ce)?\s*(fiche|ticket)"
    r"|(redige[sz]?|rediger)\s+(la|le|une?|cette|ce)?\s*(fiche|ticket)"
    r"|(reprend[sz]?|reprendre)\s+(la|le|une?|cette|ce)?\s*(fiche|ticket)"
    r"|(reexplique[sz]?|reexpliquer)"          # "réexplique" → use history
    r"|(reformule[sz]?|reformuler)\s"          # "reformule le bug" → local
    r"|(resume[sz]?|resumer)\s+(ce|le|la|cet)" # "résume ce ticket"
    r"|reexplique"
    r")\b",
    re.IGNORECASE,
)

# Signals that the user only cares about live sprint/backlog data
_LOCAL_ONLY_KEYWORDS = [
    "backlog", "sprint", "prioriser", "priorité",
    "résume le backlog", "liste les tickets",
    "quels sont les tickets", "statut des tickets",
    "bloqué", "en cours", "restant", "à faire",
    "kanban", "roadmap actuelle",
]

# Signals that the user wants knowledge from project documents
# Require score ≥ 2 before loading docs (single keyword match → not enough)
_KNOWLEDGE_KEYWORDS = [
    "spec", "spécification", "specification",
    "plan de test", "plan de recette", "recette",
    "règle", "règle métier", "règlement", "procédure",
    "documentation", "guide", "manuel",
    "référentiel", "norme", "standard",
    "processus", "fonctionnement",
    "comment fonctionne", "c'est quoi", "qu'est-ce que",
    "définition", "signifie", "veut dire",
    "architecture", "technique applicatif",
    "libéralisation", "gef", "applicatif",
    # NOTE: "explique"/"décris" intentionally excluded — too broad
]

_EXPLICIT_DATABASE_RE = re.compile(
    r"\b("
    r"sql|bdd|base de donnees|table|tables|colonne|colonnes|schema|schemas|requete|requetes"
    r")\b",
    re.IGNORECASE,
)

# Intent modes where doc search is never needed regardless of keyword match
_DOC_FREE_MODES = frozenset({
    "pilotage",
    "memoire",
})


def needs_knowledge_docs(
    user_message: str,
    intent_mode: str | None = None,
) -> bool:
    """Return True only if the question genuinely requires project knowledge files.

    Gating rules (in order):
    1. Rewrite/réécriture pattern detected → False (work from existing context)
    2. intent_mode is pilotage or memoire → False (local context only)
    3. Pure backlog/sprint question with no knowledge signal → False
    4. knowledge_score ≥ 2 → True (strong signal: multiple doc-type keywords)
    5. knowledge_score == 1 → False (single match is too weak — ambiguous)
    6. No signals → False (do not load docs by default)
    """
    lowered = _normalize(user_message)

    # Rule 1: Hard block — rewrite/rephrase of an existing object
    if _LOCAL_ONLY_RE.search(lowered):
        logger.debug("knowledge_selector: local-only pattern matched — skipping docs")
        return False

    # Rule 2: Mode-based block
    if intent_mode in _DOC_FREE_MODES:
        logger.debug("knowledge_selector: mode=%s → skipping docs", intent_mode)
        return False

    # Rule 2b: Explicit database/schema/SQL question → knowledge allowed
    if _EXPLICIT_DATABASE_RE.search(lowered):
        logger.debug("knowledge_selector: explicit database signal matched → allowing docs")
        return True

    local_score = sum(1 for kw in _LOCAL_ONLY_KEYWORDS if _normalize(kw) in lowered)
    knowledge_score = sum(1 for kw in _KNOWLEDGE_KEYWORDS if _normalize(kw) in lowered)

    # Rule 3: Clearly backlog/sprint with no knowledge signals
    if local_score > 0 and knowledge_score == 0:
        return False

    # Rules 4-6: Knowledge score threshold
    # Require ≥ 2 matches to avoid single-word false positives
    return knowledge_score >= 2


# ─── Document selection ───────────────────────────────────────────────────────

def select_knowledge_docs(
    db: Session,
    project_id: str,
    user_message: str,
    topic_id: str | None = None,
    max_docs: int = 4,
) -> list[ProjectKnowledgeDocument]:
    """Return the most relevant active knowledge docs for this query (V1).

    Scoring:
    - +10  doc is linked to the active topic
    - +4   a tag matches a word in the question
    - +2   a title word matches the question
    - +1   a summary word matches the question
    - +1   high-signal doc_type (spec, rule, process, test_plan)

    Returns active docs from the local MePO knowledge base. OpenAI sync state is
    handled elsewhere; selection remains local and deterministic.
    """
    try:
        docs: list[ProjectKnowledgeDocument] = (
            db.query(ProjectKnowledgeDocument)
            .filter(
                ProjectKnowledgeDocument.project_id == project_id,
                ProjectKnowledgeDocument.is_active.is_(True),
            )
            .all()
        )
    except Exception:
        logger.exception("knowledge_selector DB error")
        return []

    if not docs:
        return []

    lowered = user_message.lower()
    scored: list[tuple[int, ProjectKnowledgeDocument]] = []

    for doc in docs:
        score = 0

        # Topic link — strong signal
        if topic_id and topic_id in (doc.linked_topic_ids or []):
            score += 10

        # Tag keyword match in question
        for tag in (doc.tags or []):
            if len(tag) > 2 and tag.lower() in lowered:
                score += 4

        # Title word match
        for word in doc.title.lower().split():
            if len(word) > 3 and word in lowered:
                score += 2

        # Summary word match
        if doc.summary:
            for word in doc.summary.lower().split():
                if len(word) > 4 and word in lowered:
                    score += 1

        # High-signal doc types get a baseline boost
        if doc.category in ("functional_spec", "stable_memory", "technical", "database", "test_cases", "reference"):
            score += 1

        if score > 0:
            scored.append((score, doc))

    if not scored:
        logger.info(
            "knowledge_selector: no keyword match for project %s — returning empty",
            project_id,
        )
        return []

    scored.sort(key=lambda pair: pair[0], reverse=True)
    selected = [doc for _, doc in scored[:max_docs]]
    logger.info(
        "knowledge_selector: selected %d docs for project %s (top scores: %s)",
        len(selected),
        project_id,
        [s for s, _ in scored[:max_docs]],
    )
    return selected

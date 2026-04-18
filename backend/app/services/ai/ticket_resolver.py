"""Ticket Resolver — detects existing tickets that are similar or identical
to the proposed action, to prevent duplicate ticket creation.

match_status values:
  found_duplicate  (score ≥ 10) → very likely same ticket, propose add_comment instead
  found_similar    (score 6-9)  → overlapping ticket, show as warning + let user choose
  not_found        (score < 6)  → no significant overlap, safe to create

Scoring per ticket:
  +3  per meaningful query word in ticket title
  +2  per meaningful query word in ticket tags
  +1  per meaningful query word in ticket description excerpt
  +4  bonus if ticket belongs to the resolved topic
  -4  penalty if a resolved topic is known and ticket belongs to a DIFFERENT topic
  +3  bonus if ticket type matches the action type hint (bug/feature/…)

Stop words: generic terms (module, bug, code…) are filtered out before scoring
to prevent inflated scores from non-discriminating words.

Minimum score to be considered at all: 3 (at least one meaningful title match).
No DB access — works on context_objects from context_builder.
"""
from __future__ import annotations

import re
import unicodedata

from app.schemas.ai import ContextObject, TicketResolution

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _normalize(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def _words(text: str) -> set[str]:
    return {w for w in re.split(r"\W+", _normalize(text)) if len(w) >= 3}


# ─── Stop words ───────────────────────────────────────────────────────────────
# Generic terms that appear in many tickets and do not discriminate between them.
# Filtered out from query_words before scoring.

_STOP_WORDS: frozenset[str] = frozenset({
    # Technical generics
    "bug", "fix", "code", "erreur", "probleme", "issue", "ticket",
    "module", "page", "ecran", "interface", "application", "app",
    "service", "systeme", "base", "donnees", "fiche", "note",
    # Action generics
    "creer", "cree", "crée", "ajouter", "ajoute", "modifier",
    "mettre", "faire", "correction", "ajout", "nouveau", "nouvelle",
    # Common adjectives / qualifiers
    "pas", "non", "plus", "bien", "bon", "sur", "avec", "sans",
    "pour", "lors", "quand", "dans", "lors",
})


# ─── Type heuristic ───────────────────────────────────────────────────────────

_TYPE_KEYWORDS: dict[str, list[str]] = {
    "bug":     ["bug", "correctif", "fix", "erreur", "anomalie", "regression"],
    "feature": ["feature", "fonctionnalite", "evolution", "ajout", "nouvelle"],
    "chore":   ["chore", "maintenance", "refactoring", "nettoyage", "dette"],
    "spike":   ["spike", "etude", "poc", "investigation", "recherche"],
}

_RECIPE_MARKERS = ("recette", "test", "validation", "rapport", "campagne")
_ANOMALY_MARKERS = ("bug", "anomalie", "correctif", "regression", "plantage", "incident")
_GENERIC_TRACKING_MARKERS = ("plan", "processus", "perimetre", "cartographie", "suivi")
_TEST_REPORT_MARKERS = (
    "mail",
    "tests",
    "resultat",
    "resultats",
    "attendu",
    "attendus",
    "correctif",
    "plantage",
    "non",
    "fonctionnel",
    "recette",
)


def _infer_type(query_words: set[str]) -> str | None:
    for t, kws in _TYPE_KEYWORDS.items():
        for kw in kws:
            if _normalize(kw) in query_words:
                return t
    return None


def _joined_ticket_text(obj: ContextObject) -> str:
    c = obj.content
    return _normalize(
        " ".join(
            [
                obj.label or "",
                c.get("description", "") or "",
                " ".join(str(t) for t in (c.get("tags") or [])),
            ]
        )
    )


def _has_any(text: str, markers: tuple[str, ...]) -> bool:
    return any(marker in text for marker in markers)


def _looks_like_test_report(query_words: set[str], full_query_norm: str) -> bool:
    if sum(1 for marker in _TEST_REPORT_MARKERS if marker in full_query_norm) >= 3:
        return True
    return len(query_words & {"test", "tests", "recette", "resultat", "correctif", "plantage"}) >= 2


def _looks_like_anomaly_followup(query_words: set[str], full_query_norm: str) -> bool:
    if "anomalie" in full_query_norm and any(term in full_query_norm for term in ("commentaire", "commenter", "existant")):
        return True
    return len(query_words & {"anomalie", "bug", "correctif", "incident", "regression"}) >= 2


def _ticket_business_bonus(obj: ContextObject, query_words: set[str], full_query_norm: str) -> tuple[int, list[str]]:
    text = _joined_ticket_text(obj)
    bonus = 0
    reasons: list[str] = []
    ticket_id_norm = _normalize(obj.id)
    if ticket_id_norm and ticket_id_norm in full_query_norm:
        bonus += 10
        reasons.append("ticket_id_exact+10")

    if _looks_like_test_report(query_words, full_query_norm):
        if _has_any(text, _RECIPE_MARKERS):
            bonus += 14
            reasons.append("ticket_recette_prioritaire+14")
        elif _has_any(text, _ANOMALY_MARKERS):
            bonus -= 6
            reasons.append("ticket_anomalie_detaillee_dans_retour_recette-6")
        elif _has_any(text, _GENERIC_TRACKING_MARKERS):
            bonus -= 3
            reasons.append("ticket_suivi_generique-3")

    if _looks_like_anomaly_followup(query_words, full_query_norm):
        if _has_any(text, _ANOMALY_MARKERS):
            bonus += 6
            reasons.append("ticket_anomalie_existant+6")
        elif _has_any(text, _GENERIC_TRACKING_MARKERS):
            bonus -= 3
            reasons.append("ticket_suivi_generique-3")

    return bonus, reasons


# ─── Scorer ───────────────────────────────────────────────────────────────────

def _score_ticket(
    obj: ContextObject,
    query_words: set[str],
    resolved_topic_id: str | None,
    inferred_type: str | None,
    full_query_norm: str,
) -> tuple[int, str]:
    """Return (score, breakdown_string)."""
    score = 0
    parts: list[str] = []
    c = obj.content

    title_words = _words(obj.label)
    tag_words   = _words(" ".join(str(t) for t in (c.get("tags") or [])))
    desc_words  = _words(c.get("description", "") or "")

    title_hits = query_words & title_words
    tag_hits   = query_words & tag_words
    desc_hits  = query_words & desc_words

    if title_hits:
        pts = len(title_hits) * 3
        score += pts
        parts.append(f"titre({','.join(sorted(title_hits))})+{pts}")
    if tag_hits:
        pts = len(tag_hits) * 2
        score += pts
        parts.append(f"tags({','.join(sorted(tag_hits))})+{pts}")
    if desc_hits:
        pts = len(desc_hits)
        score += pts
        parts.append(f"desc({','.join(sorted(desc_hits))})+{pts}")

    # Topic membership bonus / cross-topic penalty
    ticket_topic_id = c.get("topic_id")
    if resolved_topic_id:
        if ticket_topic_id == resolved_topic_id:
            score += 4
            parts.append("meme_topic+4")
        elif ticket_topic_id:
            # Belongs to a different known topic — penalise to prevent cross-domain false positives
            score -= 4
            parts.append(f"topic_different-4")

    # Type alignment bonus
    if inferred_type and c.get("type") == inferred_type:
        score += 3
        parts.append(f"type_match({inferred_type})+3")

    business_bonus, business_reasons = _ticket_business_bonus(obj, query_words, full_query_norm)
    if business_bonus:
        score += business_bonus
        parts.extend(business_reasons)

    breakdown = " / ".join(parts) if parts else "aucun match"
    return score, breakdown


# ─── Public API ───────────────────────────────────────────────────────────────

def resolve_ticket(
    user_message: str,
    action_label: str,
    context_objects: list[ContextObject],
    resolved_topic_id: str | None = None,
    *,
    threshold_duplicate: int = 10,
    threshold_similar: int = 6,
) -> TicketResolution:
    """Detect if an existing ticket is similar or identical to the proposed action.

    Returns:
      found_duplicate  → very similar, propose add_comment
      found_similar    → overlapping, show as warning
      not_found        → safe to create
    """
    tickets = [o for o in context_objects if o.kind == "ticket"]
    if not tickets:
        return TicketResolution(
            match_status="not_found",
            decision_reason="Aucun ticket existant dans le contexte.",
        )

    # Strip stop words so generic terms don't inflate similarity scores
    raw_words = _words(user_message + " " + action_label)
    query_words = raw_words - _STOP_WORDS
    if not query_words:
        # If nothing meaningful remains, fall back to raw words (better than scoring nothing)
        query_words = raw_words
    inferred_type = _infer_type(raw_words)  # type detection uses raw words
    full_query_norm = _normalize(user_message + " " + action_label)

    # Minimum score of 3 = at least one meaningful title hit; below that, irrelevant
    _MIN_SCORE = 3
    scored: list[tuple[int, ContextObject, str]] = []
    for t in tickets:
        s, bd = _score_ticket(t, query_words, resolved_topic_id, inferred_type, full_query_norm)
        if s >= _MIN_SCORE:
            scored.append((s, t, bd))

    scored.sort(key=lambda x: x[0], reverse=True)

    if not scored:
        return TicketResolution(
            match_status="not_found",
            decision_reason="Aucun ticket ne correspond aux mots-clés.",
        )

    top_score, top, top_bd = scored[0]
    c = top.content

    if top_score >= threshold_duplicate:
        return TicketResolution(
            match_status="found_duplicate",
            suggested_ticket_id=top.id,
            suggested_ticket_title=top.label,
            suggested_ticket_type=c.get("type", "feature"),
            suggested_ticket_priority=c.get("priority", "medium"),
            duplicate_score=top_score,
            decision_reason=f"Ticket très similaire (score={top_score}): {top_bd}",
        )

    if top_score >= threshold_similar:
        return TicketResolution(
            match_status="found_similar",
            suggested_ticket_id=top.id,
            suggested_ticket_title=top.label,
            suggested_ticket_type=c.get("type", "feature"),
            suggested_ticket_priority=c.get("priority", "medium"),
            duplicate_score=top_score,
            decision_reason=f"Ticket proche existant (score={top_score}): {top_bd}",
        )

    return TicketResolution(
        match_status="not_found",
        decision_reason=f"Meilleure correspondance trop faible (score={top_score}) — création justifiée.",
        duplicate_score=top_score,
    )

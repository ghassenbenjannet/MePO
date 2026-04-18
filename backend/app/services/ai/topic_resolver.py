"""Topic Resolver — intelligently selects the best existing topic for a
proposed action, minimising unnecessary topic creation.

Philosophy:
  1. Active topic (topic_id in request) → strong preference if score ≥ 2
  2. Single topic in context, score ≥ 2 → possible_matches (ask to confirm)
  3. Single topic, score = 0-1 → no_match (topic is unrelated — don't force-attach)
  4. Multiple topics, strong match (≥8) → exact_match
  5. Multiple topics, partial match (≥3) → possible_matches, let user confirm
  6. Multiple topics, weak match (1-2) → no_match (not specific enough to be reliable)
  7. Multiple topics, score = 0 → no_match (genuinely new subject)

Key rule: NEVER auto-attach a ticket to a topic with a score < MIN_TOPIC_SCORE.
A score of 1-2 from generic words (module, bug, code) is not a match.
The user can always select a topic manually via the picker UI.

Minimum score for "semantic relevance" = 3 (at least one meaningful title word).

Scoring per topic:
  + 3  per query word found in topic title
  + 2  per query word found in topic tags
  + 1  per query word found in topic description
  + 8  if topic is the active topic (payload.topic_id)
  + 5  if action_label contains the topic title as a substring
  + 2  if topic nature matches action verb (bug→bug_fix, feature→feature)

No DB access — works purely on context_objects already loaded by context_builder.
"""
from __future__ import annotations

import re
import unicodedata

from app.schemas.ai import ContextObject, TopicCandidate, TopicResolution

# ─── Text helpers ──────────────────────────────────────────────────────────────

def _normalize(text: str) -> str:
    nfkd = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def _words(text: str) -> set[str]:
    """Unique normalized words with ≥ 3 chars."""
    return {w for w in re.split(r"\W+", _normalize(text)) if len(w) >= 3}


# ─── Nature-to-keyword heuristic ─────────────────────────────────────────────

_NATURE_KEYWORDS: dict[str, list[str]] = {
    "bug_fix":        ["bug", "correctif", "fix", "erreur", "anomalie", "regressionn", "defaut"],
    "feature":        ["feature", "fonctionnalite", "evolution", "nouvelle", "ajout"],
    "study_delivery": ["etude", "analyse", "livrable", "document", "spec"],
    "infrastructure": ["infra", "deploiement", "docker", "kubernetes", "serveur"],
    "security":       ["securite", "auth", "authentification", "permission", "acces"],
}


def _nature_bonus(topic_nature: str, query_words: set[str]) -> int:
    kws = _NATURE_KEYWORDS.get(topic_nature, [])
    for kw in kws:
        if _normalize(kw) in query_words:
            return 2
    return 0


# ─── Detailed scorer ──────────────────────────────────────────────────────────

def _score_topic(
    obj: ContextObject,
    query_words: set[str],
    action_label_norm: str,
    active_topic_id: str | None,
) -> tuple[int, str]:
    """Return (score, breakdown_string)."""
    score = 0
    parts: list[str] = []
    content = obj.content

    title_words = _words(obj.label)
    tags_raw = content.get("tags", [])
    tag_words = _words(" ".join(str(t) for t in tags_raw) if tags_raw else "")
    desc_words = _words(content.get("description", "") or "")

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
        pts = len(desc_hits) * 1
        score += pts
        parts.append(f"desc({','.join(sorted(desc_hits))})+{pts}")

    # Active topic bonus
    if active_topic_id and obj.id == active_topic_id:
        score += 8
        parts.append("topic_actif+8")

    # Action label contains the full topic name → strong signal
    topic_name_norm = _normalize(obj.label)
    if topic_name_norm and topic_name_norm in action_label_norm:
        score += 5
        parts.append("nom_exact_dans_label+5")

    # Nature alignment
    topic_nature = content.get("nature", "")
    nb = _nature_bonus(topic_nature, query_words)
    if nb:
        score += nb
        parts.append(f"nature({topic_nature})+{nb}")

    breakdown = " / ".join(parts) if parts else "aucun match"
    return score, breakdown


# ─── Public API ───────────────────────────────────────────────────────────────

def resolve_topic(
    user_message: str,
    action_label: str,
    context_objects: list[ContextObject],
    *,
    active_topic_id: str | None = None,
    threshold_exact: int = 8,
    threshold_possible: int = 3,
) -> TopicResolution:
    """Resolve the best topic for the action.

    Decision ladder:
      1. No topics in context                  → no_match
      2. active_topic_id with any score ≥ 1    → exact_match  (active context wins)
      3. active_topic_id but score = 0          → possible_matches (ask to confirm)
      4. Single topic, score ≥ 1               → exact_match
      5. Single topic, score = 0               → possible_matches
      6. Multiple topics, top score ≥ threshold_exact → exact_match
      7. Multiple topics, top score ≥ threshold_possible → possible_matches
      8. Multiple topics, score 1-2            → possible_matches (don't create lightly)
      9. Multiple topics, score = 0            → no_match
    """
    topics = [o for o in context_objects if o.kind == "topic"]

    # ── No topics available ────────────────────────────────────────────────────
    if not topics:
        return TopicResolution(
            match_status="no_match",
            decision_reason="Aucun topic dans le contexte chargé.",
            context_used="no_context",
        )

    action_label_norm = _normalize(action_label + " " + user_message)
    query_words = _words(user_message + " " + action_label)

    # Score every topic
    scored: list[tuple[int, ContextObject, str]] = []
    for t in topics:
        s, breakdown = _score_topic(t, query_words, action_label_norm, active_topic_id)
        scored.append((s, t, breakdown))
    scored.sort(key=lambda x: x[0], reverse=True)

    top_score, top_topic, top_breakdown = scored[0]

    # Build candidates (top 5 with score > 0)
    candidates = [
        TopicCandidate(
            id=t.id,
            name=t.label,
            nature=t.content.get("nature", "study_delivery"),
            score=s,
            score_breakdown=bd,
        )
        for s, t, bd in scored[:5]
        if s > 0
    ]

    def _ok(t: ContextObject, s: int) -> TopicResolution:
        return TopicResolution(
            match_status="exact_match",
            suggested_topic_id=t.id,
            suggested_topic_name=t.label,
            suggested_topic_nature=t.content.get("nature", "study_delivery"),
            candidate_topics=candidates,
            top_score=s,
            decision_reason=top_breakdown,
            context_used=_ctx,
        )

    def _ask(t: ContextObject, s: int, reason: str) -> TopicResolution:
        return TopicResolution(
            match_status="possible_matches",
            suggested_topic_id=t.id,
            suggested_topic_name=t.label,
            suggested_topic_nature=t.content.get("nature", "study_delivery"),
            candidate_topics=candidates or [
                TopicCandidate(
                    id=t.id, name=t.label,
                    nature=t.content.get("nature", "study_delivery"),
                    score=s, score_breakdown=top_breakdown,
                )
            ],
            top_score=s,
            decision_reason=reason,
            context_used=_ctx,
        )

    # ── Case 1: active topic in context ───────────────────────────────────────
    # The active topic earns a +8 bonus, but that alone is NOT enough for exact_match.
    # Require at least threshold_possible semantic word-match score EXCLUDING the bonus.
    # Otherwise, the user might have the GEF topic open while asking about an unrelated subject.
    _ACTIVE_BONUS = 8
    if active_topic_id:
        active_entry = next(
            ((s, t, bd) for s, t, bd in scored if t.id == active_topic_id), None
        )
        if active_entry:
            act_score, act_topic, act_bd = active_entry
            _ctx = "active_topic"
            # Semantic score = total score minus the active topic bonus
            semantic_only = act_score - _ACTIVE_BONUS
            if semantic_only >= threshold_possible:
                # Strong semantic match + active context → confident exact_match
                return _ok(act_topic, act_score)
            if semantic_only >= 1:
                # Weak semantic match + active context → ask to confirm
                return _ask(
                    act_topic, act_score,
                    f"Topic actif avec correspondance partielle (sémantique={semantic_only}) — confirmer le rattachement.",
                )
            # No semantic match at all (only active bonus) → warn user, don't force-attach
            return _ask(
                act_topic, act_score,
                f"Topic actif sans correspondance sémantique (sujet probablement différent) — confirmer ou créer un nouveau topic.",
            )
        # active_topic_id provided but not in snapshot → fall through
        _ctx = "active_topic_not_in_snapshot"
    else:
        _ctx = "context_snapshot"

    # ── Case 2: single topic ──────────────────────────────────────────────────
    if len(topics) == 1:
        _ctx = "single_topic_context"
        if top_score >= threshold_possible:
            return _ok(top_topic, top_score)
        if top_score >= 2:
            return _ask(
                top_topic, top_score,
                f"Un seul topic disponible, correspondance partielle (score={top_score}) — confirmer avant rattachement.",
            )
        # score 0-1: topic unrelated — never force-attach
        return TopicResolution(
            match_status="no_match",
            decision_reason=f"Topic sans lien sémantique avec la demande (score={top_score} ≤ 1) — ne pas rattacher automatiquement.",
            context_used=_ctx,
        )

    # ── Case 3: multiple topics, score-based decision ─────────────────────────
    if top_score == 0:
        return TopicResolution(
            match_status="no_match",
            decision_reason="Aucun topic ne correspond aux mots-clés de la demande.",
            context_used=_ctx,
        )
    # Check proximity between #1 and #2 regardless of threshold
    if len(scored) >= 2 and scored[1][0] > 0:
        gap = top_score - scored[1][0]
        if gap < 3:
            return _ask(
                top_topic, top_score,
                f"Deux candidats proches (scores {scored[0][0]} vs {scored[1][0]}, écart={gap}) — sélection requise.",
            )

    if top_score >= threshold_exact:
        return _ok(top_topic, top_score)
    if top_score >= threshold_possible:
        return _ok(top_topic, top_score)
    # score 1-2: generic word matches — not semantically reliable; user must pick manually
    return TopicResolution(
        match_status="no_match",
        decision_reason=f"Correspondance trop faible (score={top_score}) — mots génériques insuffisants pour un rattachement automatique. Sélectionner un topic manuellement.",
        context_used=_ctx,
    )

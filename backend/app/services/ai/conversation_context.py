from __future__ import annotations

import re

from app.schemas.ai import ConversationMessage

_NOISE_LINE_RE = re.compile(
    r"^(?:\d{1,2}:\d{2}|copier|voir tout|certitude|prochaines actions|actions proposees|mode actif)\s*$",
    re.IGNORECASE,
)
_TRANSCRIPT_MARKERS = [
    re.compile(r"\bSP\s+Shadow\s+PO\b", re.IGNORECASE),
    re.compile(r"\bShadow\s+PO\b", re.IGNORECASE),
    re.compile(r"\bCertitude\b", re.IGNORECASE),
    re.compile(r"\bProchaines actions\b", re.IGNORECASE),
    re.compile(r"\bActions propos[ée]es\b", re.IGNORECASE),
]
_TEST_REPORT_PATTERNS = [
    "ci-dessous un recap",
    "résultats des tests",
    "resultats des tests",
    "correctif attendu",
    "plantage",
    "non fonctionnel",
    "anomalie",
    "dispensation nominative",
    "tracabilitepharma",
    "delivrance",
]


def _collapse(text: str) -> str:
    return re.sub(r"[ \t]+", " ", re.sub(r"\n{3,}", "\n\n", text)).strip()


def canonicalize_user_request(message: str) -> str:
    text = (message or "").replace("\r\n", "\n").replace("\r", "\n")
    cut_index: int | None = None
    for pattern in _TRANSCRIPT_MARKERS:
        match = pattern.search(text)
        if match and match.start() > 200:
            cut_index = match.start() if cut_index is None else min(cut_index, match.start())
    if cut_index is not None:
        text = text[:cut_index]

    kept_lines: list[str] = []
    for line in text.split("\n"):
        stripped = line.strip()
        if not stripped:
            kept_lines.append("")
            continue
        if _NOISE_LINE_RE.match(stripped):
            continue
        kept_lines.append(stripped)

    return _collapse("\n".join(kept_lines))


def looks_like_test_feedback_material(message: str) -> bool:
    normalized = canonicalize_user_request(message).lower()
    return sum(1 for pattern in _TEST_REPORT_PATTERNS if pattern in normalized) >= 2


def _truncate(text: str, limit: int) -> str:
    collapsed = _collapse(text)
    if len(collapsed) <= limit:
        return collapsed
    clipped = collapsed[:limit].rstrip()
    if " " in clipped:
        clipped = clipped.rsplit(" ", 1)[0]
    return f"{clipped}..."


def build_conversation_summary(
    history: list[ConversationMessage] | None,
    *,
    max_turns: int = 6,
    max_total_chars: int = 900,
    max_turn_chars: int = 180,
) -> tuple[str, int, int]:
    if not history:
        return "", 0, 0

    raw_history_chars = sum(len(turn.content or "") for turn in history)
    lines: list[str] = []
    for turn in history[-max_turns:]:
        role = "Utilisateur" if turn.role == "user" else "Assistant"
        cleaned = canonicalize_user_request(turn.content)
        if not cleaned:
            continue
        lines.append(f"- {role}: {_truncate(cleaned, max_turn_chars)}")

    summary = "== CONVERSATION SUMMARY ==\n" + "\n".join(lines) if lines else ""
    if len(summary) > max_total_chars:
        summary = _truncate(summary, max_total_chars)
    return summary, len(summary), max(0, raw_history_chars - len(summary))


__all__ = [
    "build_conversation_summary",
    "canonicalize_user_request",
    "looks_like_test_feedback_material",
]

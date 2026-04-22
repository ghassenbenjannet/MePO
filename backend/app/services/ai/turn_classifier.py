from __future__ import annotations

from typing import Literal

from app.services.ai.trivial_message import is_trivial_message

TurnClassification = Literal["business_turn", "follow_up", "micro_ack", "local_system"]

_FOLLOW_UP_PATTERN_WORDS = frozenset(
    [
        "et",
        "aussi",
        "egalement",
        "de plus",
        "sinon",
        "autre chose",
        "par rapport",
        "concernant",
        "sur ce point",
        "dans ce cas",
        "et si",
        "qu'en",
        "pouvez-vous",
        "peux-tu",
        "precise",
        "detaille",
        "developpe",
        "explique",
        "reformule",
        "and",
        "also",
        "additionally",
        "about",
        "regarding",
        "what",
        "can",
        "could",
    ]
)


def classify_turn(
    message: str,
    has_recent_history: bool,
    has_active_snapshot: bool,
) -> TurnClassification:
    """Classify a turn for the standard runtime."""
    stripped = message.strip()

    if is_trivial_message(stripped):
        return "micro_ack"

    if has_recent_history and has_active_snapshot:
        words = stripped.lower().split()
        if len(words) <= 6:
            return "follow_up"
        if set(words[:4]) & _FOLLOW_UP_PATTERN_WORDS:
            return "follow_up"

    return "business_turn"

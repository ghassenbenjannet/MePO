from __future__ import annotations

import re

_TRIVIAL_PATTERN = re.compile(
    r"^("
    r"ok|okay|k|"
    r"merci|merci\s+beaucoup|thanks?|thx|"
    r"continue|suite|go|"
    r"oui|non|yes|no|nope|yep|"
    r"d'?accord|dac|"
    r"parfait|super|nickel|top|bien|cool|"
    r"👍|👌|✅|"
    r"c'?est\s+bon|c'?est\s+ok|c'?est\s+parfait"
    r")[.!?\s]*$",
    re.IGNORECASE | re.UNICODE,
)


def is_trivial_message(message: str) -> bool:
    """Return True when the message is only a micro acknowledgement."""
    return bool(_TRIVIAL_PATTERN.match(message.strip()))

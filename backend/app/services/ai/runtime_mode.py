from __future__ import annotations

from typing import Literal

from app.core.config import settings

ShadowRuntimeMode = Literal["mepo", "openai_only", "hybrid"]

_VALID_RUNTIME_MODES: set[str] = {"mepo", "openai_only", "hybrid"}

RUNTIME_MODE_METADATA: dict[str, dict[str, str]] = {
    "mepo": {
        "role": "default",
        "recommended_usage": "recommended_production_mode",
        "lifecycle": "target",
        "description": "Pipeline local MePO prioritaire, avec hierarchie stricte des sources.",
    },
    "hybrid": {
        "role": "transition",
        "recommended_usage": "controlled_transition_mode",
        "lifecycle": "temporary",
        "description": "Essaie MePO d'abord, puis fallback controle vers openai_only.",
    },
    "openai_only": {
        "role": "fallback",
        "recommended_usage": "emergency_or_premium_mode",
        "lifecycle": "to_remove_later",
        "description": "Contourne le pipeline local lourd et delegue la synthese principalement a OpenAI.",
    },
}


def resolve_shadow_runtime_mode(raw_value: str | None = None) -> ShadowRuntimeMode:
    source_value = settings.shadow_runtime_mode if raw_value is None else raw_value
    value = (source_value or "mepo").strip().lower()
    if value in _VALID_RUNTIME_MODES:
        return value  # type: ignore[return-value]
    return "mepo"


def get_runtime_mode_metadata(mode: str | None = None) -> dict[str, str]:
    resolved = resolve_shadow_runtime_mode(mode)
    return dict(RUNTIME_MODE_METADATA[resolved])

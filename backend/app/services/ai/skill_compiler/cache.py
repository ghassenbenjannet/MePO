from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from app.contracts.skill import CompiledSkill


@dataclass
class CompiledSkillCacheEntry:
    compiled_skill: CompiledSkill
    updated_at: datetime | None


_CACHE: dict[str, CompiledSkillCacheEntry] = {}


def get_cached_compiled_skill(project_id: str) -> CompiledSkillCacheEntry | None:
    return _CACHE.get(project_id)


def set_cached_compiled_skill(
    project_id: str,
    *,
    compiled_skill: CompiledSkill,
    updated_at: datetime | None,
) -> CompiledSkillCacheEntry:
    entry = CompiledSkillCacheEntry(compiled_skill=compiled_skill, updated_at=updated_at)
    _CACHE[project_id] = entry
    return entry


def invalidate_compiled_skill(project_id: str) -> None:
    _CACHE.pop(project_id, None)

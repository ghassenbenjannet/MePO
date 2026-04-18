from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from threading import Lock

from app.schemas.runtime import WorkspaceContext


@dataclass
class WorkspaceCacheEntry:
    key: str
    value: WorkspaceContext
    built_at: datetime


_CACHE_LOCK = Lock()
_WORKSPACE_CACHE: dict[str, WorkspaceCacheEntry] = {}


def build_workspace_cache_key(
    *,
    project_id: str,
    space_id: str | None = None,
    topic_id: str | None = None,
) -> str:
    return f"project={project_id}|space={space_id or '-'}|topic={topic_id or '-'}"


def get_workspace_cache_entry(key: str) -> WorkspaceCacheEntry | None:
    with _CACHE_LOCK:
        return _WORKSPACE_CACHE.get(key)


def set_workspace_cache_entry(key: str, value: WorkspaceContext) -> WorkspaceCacheEntry:
    with _CACHE_LOCK:
        entry = WorkspaceCacheEntry(key=key, value=value, built_at=datetime.utcnow())
        _WORKSPACE_CACHE[key] = entry
        return entry


def invalidate_workspace_cache(
    *,
    project_id: str | None = None,
    space_id: str | None = None,
    topic_id: str | None = None,
) -> int:
    removed = 0
    with _CACHE_LOCK:
        keys = list(_WORKSPACE_CACHE.keys())
        for key in keys:
            if project_id and f"project={project_id}" not in key:
                continue
            if space_id and f"space={space_id}" not in key:
                continue
            if topic_id and f"topic={topic_id}" not in key:
                continue
            _WORKSPACE_CACHE.pop(key, None)
            removed += 1
    return removed

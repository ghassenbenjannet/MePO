from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class DocumentCreate(BaseModel):
    space_id: str
    topic_id: str | None = None
    parent_id: str | None = None
    type: str = "page"
    title: str
    content: str = ""
    tags: list[str] = []
    doc_metadata: dict = {}
    icon: str | None = None
    ai_enabled: bool = True


class DocumentUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    topic_id: str | None = None
    parent_id: str | None = None
    tags: list[str] | None = None
    doc_metadata: dict | None = None
    icon: str | None = None
    ai_enabled: bool | None = None
    is_archived: bool | None = None


class DocumentRead(BaseModel):
    id: str
    space_id: str
    topic_id: str | None = None
    parent_id: str | None = None
    type: str
    title: str
    content: str
    tags: list[str] = []
    doc_metadata: dict = {}
    icon: str | None = None
    ai_enabled: bool = True
    google_sync_status: str = "queued"
    corpus_status: str | None = None
    google_file_id: str | None = None
    google_web_url: str | None = None
    last_synced_at: datetime | None = None
    last_error: str | None = None
    is_archived: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ProjectDocumentsSyncStatusRead(BaseModel):
    project_id: str
    google_sync_status: str
    corpus_status: str
    active_corpus_version: str | None = None
    last_sync_started_at: datetime | None = None
    last_sync_finished_at: datetime | None = None
    last_error: str | None = None
    synced_documents: int = 0
    eligible_documents: int = 0

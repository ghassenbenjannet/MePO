from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ProjectKnowledgeSettingsUpdate(BaseModel):
    vector_store_id: str | None = Field(default=None, alias="vectorStoreId")


class ProjectKnowledgeSettingsRead(BaseModel):
    id: str | None = None
    project_id: str
    vector_store_id: str | None = None
    last_sync_status: str = "idle"
    last_sync_started_at: datetime | None = None
    last_sync_finished_at: datetime | None = None
    last_sync_error: str | None = None
    last_sync_summary_json: dict = Field(default_factory=dict)
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True, "populate_by_name": True}


class KnowledgeDocCreate(BaseModel):
    title: str
    category: str = "reference"
    source_type: str = "upload"
    summary: str | None = None
    tags: list[str] = Field(default_factory=list)
    linked_topic_ids: list[str] = Field(default_factory=list)
    content_extracted_text: str | None = None
    mime_type: str | None = None
    original_filename: str | None = None


class KnowledgeDocUpdate(BaseModel):
    title: str | None = None
    category: str | None = None
    summary: str | None = None
    tags: list[str] | None = None
    linked_topic_ids: list[str] | None = None
    is_active: bool | None = None


class KnowledgeDocRead(BaseModel):
    id: str
    project_id: str
    category: str
    title: str
    source_type: str
    local_file_id: str | None = None
    mime_type: str | None = None
    original_filename: str | None = None
    summary: str | None = None
    tags: list[str] = Field(default_factory=list)
    linked_topic_ids: list[str] = Field(default_factory=list)
    content_hash: str | None = None
    is_active: bool
    sync_status: str = "not_synced"
    synced_at: datetime | None = None
    sync_error: str | None = None
    openai_file_id: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class KnowledgeSyncStatusRead(BaseModel):
    project_id: str
    vector_store_id: str | None = None
    last_sync_status: str = "idle"
    last_sync_started_at: datetime | None = None
    last_sync_finished_at: datetime | None = None
    last_sync_error: str | None = None
    last_sync_summary_json: dict = Field(default_factory=dict)


class KnowledgeSyncTriggerResponse(BaseModel):
    project_id: str
    vector_store_id: str
    status: str
    synced: int = 0
    skipped: int = 0
    no_file: int = 0
    errors: list[str] = Field(default_factory=list)
    summary: dict = Field(default_factory=dict)

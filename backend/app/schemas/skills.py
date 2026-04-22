from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class SkillEditorPayload(BaseModel):
    main_skill_text: str = Field(default="", alias="mainSkillText")
    general_directives_text: str = Field(default="", alias="generalDirectivesText")
    mode_policies_text: str = Field(default="", alias="modePoliciesText")
    action_policies_text: str = Field(default="", alias="actionPoliciesText")
    output_templates_text: str = Field(default="", alias="outputTemplatesText")
    guardrails_text: str = Field(default="", alias="guardrailsText")

    model_config = {"populate_by_name": True}


class SkillVersionRead(BaseModel):
    id: str
    project_id: str = Field(alias="projectId")
    version_label: str = Field(alias="versionLabel")
    editor_payload: SkillEditorPayload = Field(alias="editorPayload")
    compiled_context_text: str = Field(alias="compiledContextText")
    source_kind: str = Field(alias="sourceKind")
    created_at: datetime = Field(alias="createdAt")
    is_active: bool = Field(alias="isActive")

    model_config = {"populate_by_name": True}


class ActiveSkillRead(BaseModel):
    project_id: str = Field(alias="projectId")
    active_skill_version_id: str = Field(alias="activeSkillVersionId")
    version: SkillVersionRead

    model_config = {"populate_by_name": True}

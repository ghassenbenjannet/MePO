from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ProjectSkillSettingsUpdate(BaseModel):
    main_skill_text: str | None = Field(default=None, alias="mainSkillText")
    general_directives_text: str | None = Field(default=None, alias="generalDirectivesText")
    source_hierarchy_text: str | None = Field(default=None, alias="sourceHierarchyText")
    mode_policies_text: str | None = Field(default=None, alias="modePoliciesText")
    action_policies_text: str | None = Field(default=None, alias="actionPoliciesText")
    output_templates_text: str | None = Field(default=None, alias="outputTemplatesText")
    guardrails_text: str | None = Field(default=None, alias="guardrailsText")

    model_config = {"populate_by_name": True}


class ProjectSkillSettingsRead(BaseModel):
    id: str | None = None
    project_id: str
    main_skill_text: str | None = None
    general_directives_text: str | None = None
    source_hierarchy_text: str | None = None
    mode_policies_text: str | None = None
    action_policies_text: str | None = None
    output_templates_text: str | None = None
    guardrails_text: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True, "populate_by_name": True}


class ProjectSkillRuntimeRead(BaseModel):
    project_id: str = Field(alias="projectId")
    compiled_runtime_text: str = Field(alias="compiledRuntimeText")
    updated_at: datetime | None = Field(default=None, alias="updatedAt")

    model_config = {"populate_by_name": True}

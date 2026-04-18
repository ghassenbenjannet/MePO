from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.contracts.runtime import SourceLevel


class NormalizedSkillSection(BaseModel):
    name: str
    title: str
    normalized_text: str = Field(alias="normalizedText")
    line_count: int = Field(alias="lineCount")

    model_config = {"populate_by_name": True}


class ModePolicy(BaseModel):
    allowed_modes: list[str] = Field(default_factory=list, alias="allowedModes")
    mode_notes: dict[str, str] = Field(default_factory=dict, alias="modeNotes")

    model_config = {"populate_by_name": True}


class SourcePolicy(BaseModel):
    strict_order: list[SourceLevel] = Field(default_factory=list, alias="strictOrder")
    cannot_override_hierarchy: bool = Field(default=True, alias="cannotOverrideHierarchy")
    project_notes: str = Field(default="", alias="projectNotes")
    contradictions: list[str] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class OutputPolicy(BaseModel):
    output_format: Literal["json_strict"] = Field(default="json_strict", alias="outputFormat")
    markdown_only_answer: bool = Field(default=True, alias="markdownOnlyAnswer")
    template_excerpt: str = Field(default="", alias="templateExcerpt")

    model_config = {"populate_by_name": True}


class ActionPolicy(BaseModel):
    allowed_action_types: list[str] = Field(default_factory=list, alias="allowedActionTypes")
    requires_confirmation: bool = Field(default=True, alias="requiresConfirmation")
    extra_rules: str = Field(default="", alias="extraRules")

    model_config = {"populate_by_name": True}


class GuardrailPolicy(BaseModel):
    no_invention: bool = Field(default=True, alias="noInvention")
    no_raw_html_answer: bool = Field(default=True, alias="noRawHtmlAnswer")
    force_schema_validation: bool = Field(default=True, alias="forceSchemaValidation")
    guardrail_excerpt: str = Field(default="", alias="guardrailExcerpt")

    model_config = {"populate_by_name": True}


class TonePolicy(BaseModel):
    style: str = "professional"
    directives_excerpt: str = Field(default="", alias="directivesExcerpt")

    model_config = {"populate_by_name": True}


class ProjectLexicon(BaseModel):
    keywords: list[str] = Field(default_factory=list)
    acronyms: list[str] = Field(default_factory=list)


class CompiledSkill(BaseModel):
    contract_version: Literal["v1"] = "v1"
    project_id: str = Field(alias="projectId")
    sections: list[NormalizedSkillSection] = Field(default_factory=list)
    mode_policy: ModePolicy = Field(alias="modePolicy")
    source_policy: SourcePolicy = Field(alias="sourcePolicy")
    output_policy: OutputPolicy = Field(alias="outputPolicy")
    action_policy: ActionPolicy = Field(alias="actionPolicy")
    guardrail_policy: GuardrailPolicy = Field(alias="guardrailPolicy")
    tone_policy: TonePolicy = Field(alias="tonePolicy")
    project_lexicon: ProjectLexicon = Field(alias="projectLexicon")
    normalized_runtime_text: str = Field(default="", alias="normalizedRuntimeText")
    version_tag: str = Field(default="v1", alias="versionTag")

    model_config = {"populate_by_name": True}


class CompiledSkillProjection(BaseModel):
    contract_version: Literal["v1"] = "v1"
    project_id: str = Field(alias="projectId")
    mode: str
    projection_text: str = Field(alias="projectionText")
    included_sections: list[str] = Field(default_factory=list, alias="includedSections")
    version_tag: str = Field(alias="versionTag")

    model_config = {"populate_by_name": True}

from __future__ import annotations

import re

from app.contracts.runtime import SourceLevel
from app.contracts.skill import (
    ActionPolicy,
    CompiledSkill,
    CompiledSkillProjection,
    GuardrailPolicy,
    ModePolicy,
    NormalizedSkillSection,
    OutputPolicy,
    ProjectLexicon,
    SourcePolicy,
    TonePolicy,
)
from app.models.project_skill_settings import ProjectSkillSettings

_CANONICAL_SOURCE_ORDER: list[SourceLevel] = [
    "mepo_objects",
    "topic_memory",
    "local_documents",
    "knowledge_documents",
    "vector_store",
]

_SECTION_DEFINITIONS: list[tuple[str, str]] = [
    ("main_skill_text", "Skill principal projet"),
    ("general_directives_text", "Directives generales"),
    ("source_hierarchy_text", "Hierarchie des sources"),
    ("mode_policies_text", "Politiques de modes"),
    ("action_policies_text", "Politiques d'actions"),
    ("output_templates_text", "Templates de sortie"),
    ("guardrails_text", "Garde-fous"),
]

_ALL_MODES = [
    "cadrage",
    "impact",
    "pilotage",
    "analyse_fonctionnelle",
    "analyse_technique",
    "redaction",
    "transformation",
    "memoire",
]

_ALLOWED_ACTIONS = [
    "create_ticket",
    "create_document",
    "add_comment",
    "select_ticket_then_add_comment",
    "create_artifact",
    "update_memory",
    "create_topic_then_ticket",
    "select_topic_then_create_ticket",
]

_SOURCE_PROJECTION_LABELS = {
    "mepo_objects": "mepo",
    "topic_memory": "topic_mem",
    "local_documents": "local_docs",
    "knowledge_documents": "knowledge",
    "vector_store": "vector",
}


def _normalize_text(value: str | None) -> str:
    if not value:
        return ""
    lines = [re.sub(r"\s+", " ", line).strip() for line in value.splitlines()]
    deduped: list[str] = []
    seen: set[str] = set()
    for line in lines:
        if not line:
            continue
        lowered = line.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        deduped.append(line)
    return "\n".join(deduped).strip()


def _truncate_text(value: str, max_chars: int) -> str:
    if len(value) <= max_chars:
        return value
    clipped = value[:max_chars].rstrip()
    if " " in clipped:
        clipped = clipped.rsplit(" ", 1)[0]
    return f"{clipped}..."


def _extract_sections(settings: ProjectSkillSettings | None) -> list[NormalizedSkillSection]:
    if not settings:
        return []
    sections: list[NormalizedSkillSection] = []
    for field_name, title in _SECTION_DEFINITIONS:
        normalized = _normalize_text(getattr(settings, field_name, None))
        if not normalized:
            continue
        sections.append(
            NormalizedSkillSection(
                name=field_name,
                title=title,
                normalizedText=normalized,
                lineCount=len(normalized.splitlines()),
            )
        )
    return sections


def _detect_source_contradictions(section_text: str) -> list[str]:
    lowered = section_text.lower()
    contradictions: list[str] = []
    if "vector store" in lowered and "mepo" in lowered:
        if lowered.find("vector store") < lowered.find("mepo"):
            contradictions.append(
                "La note projet mentionne le vector store avant MePO. La hierarchie canonique reste inchangee."
            )
    if "knowledge" in lowered and "documents locaux" in lowered:
        if lowered.find("knowledge") < lowered.find("documents locaux"):
            contradictions.append(
                "La note projet mentionne les knowledge docs avant les documents locaux. La hierarchie canonique reste inchangee."
            )
    return contradictions


def _extract_lexicon(sections: list[NormalizedSkillSection]) -> ProjectLexicon:
    combined = "\n".join(section.normalized_text for section in sections)
    acronyms = sorted(
        {
            token
            for token in re.findall(r"\b[A-Z]{2,}\b", combined)
            if len(token) <= 10
        }
    )
    keywords = sorted(
        {
            token.lower()
            for token in re.findall(r"\b[a-zA-Z][a-zA-Z0-9_-]{4,}\b", combined)
            if token.lower() not in {"skill", "directives", "output", "guardrails", "templates"}
        }
    )[:40]
    return ProjectLexicon(keywords=keywords, acronyms=acronyms)


def compile_skill(settings: ProjectSkillSettings | None, *, project_id: str) -> CompiledSkill:
    sections = _extract_sections(settings)
    by_name = {section.name: section for section in sections}
    source_notes = by_name.get("source_hierarchy_text")
    directives = by_name.get("general_directives_text")
    templates = by_name.get("output_templates_text")
    guardrails = by_name.get("guardrails_text")
    actions = by_name.get("action_policies_text")
    modes = by_name.get("mode_policies_text")

    source_policy = SourcePolicy(
        strictOrder=_CANONICAL_SOURCE_ORDER,
        cannotOverrideHierarchy=True,
        projectNotes=source_notes.normalized_text if source_notes else "",
        contradictions=_detect_source_contradictions(source_notes.normalized_text if source_notes else ""),
    )
    compiled = CompiledSkill(
        projectId=project_id,
        sections=sections,
        modePolicy=ModePolicy(
            allowedModes=list(_ALL_MODES),
            modeNotes={mode: modes.normalized_text for mode in _ALL_MODES} if modes else {},
        ),
        sourcePolicy=source_policy,
        outputPolicy=OutputPolicy(
            outputFormat="json_strict",
            markdownOnlyAnswer=True,
            templateExcerpt=(templates.normalized_text[:1200] if templates else ""),
        ),
        actionPolicy=ActionPolicy(
            allowedActionTypes=list(_ALLOWED_ACTIONS),
            requiresConfirmation=True,
            extraRules=(actions.normalized_text[:1200] if actions else ""),
        ),
        guardrailPolicy=GuardrailPolicy(
            noInvention=True,
            noRawHtmlAnswer=True,
            forceSchemaValidation=True,
            guardrailExcerpt=(guardrails.normalized_text[:1200] if guardrails else ""),
        ),
        tonePolicy=TonePolicy(
            style="professional",
            directivesExcerpt=(directives.normalized_text[:800] if directives else ""),
        ),
        projectLexicon=_extract_lexicon(sections),
        normalizedRuntimeText="\n\n".join(
            f"== {section.title} ==\n{section.normalized_text}" for section in sections
        ).strip(),
        versionTag="v1",
    )
    return compiled


def compile_skill_projection(
    compiled_skill: CompiledSkill,
    *,
    mode: str,
    include_output_templates: bool,
) -> CompiledSkillProjection:
    section_map = {section.name: section for section in compiled_skill.sections}
    included_sections: list[str] = []
    blocks: list[str] = []

    def include_section(section_name: str, title: str, prefix: str = "", max_chars: int = 180) -> None:
        section = section_map.get(section_name)
        if not section or not section.normalized_text:
            return
        included_sections.append(section_name)
        body = f"{prefix}{_truncate_text(section.normalized_text, max_chars)}".strip()
        blocks.append(f"== {title} ==\n{body}")

    include_section("main_skill_text", "Skill projet", max_chars=120)
    include_section("general_directives_text", "Directives", max_chars=100)
    blocks.append(
        "== Politique de sources ==\n"
        "Ordre strict non inversable : "
        + " > ".join(_SOURCE_PROJECTION_LABELS[level] for level in compiled_skill.source_policy.strict_order)
    )

    if mode in {"redaction", "transformation", "analyse_fonctionnelle", "analyse_technique"}:
        include_section("mode_policies_text", "Politiques de mode", max_chars=180)

    if mode in {"redaction", "transformation"}:
        include_section("action_policies_text", "Politiques d'actions", max_chars=140)

    if include_output_templates and mode in {"redaction", "transformation"}:
        include_section("output_templates_text", "Templates de sortie", max_chars=220)

    include_section(
        "guardrails_text",
        "Garde-fous",
        prefix="JSON strict. Confirmation.\n\n",
        max_chars=120,
    )

    projection_text = "\n\n".join(blocks).strip()
    return CompiledSkillProjection(
        projectId=compiled_skill.project_id,
        mode=mode,
        projectionText=projection_text,
        includedSections=included_sections,
        versionTag=compiled_skill.version_tag,
    )

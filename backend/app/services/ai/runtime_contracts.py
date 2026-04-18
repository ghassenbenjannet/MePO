from __future__ import annotations

from app.schemas.runtime import (
    FeatureFlags,
    PromptRuntimeConfig,
    SourcePriorityItem,
    SourcePriorityPolicy,
)

SOURCE_PRIORITY_ITEMS = [
    SourcePriorityItem(rank=1, level="mepo_objects", label="Objets MePO injectés"),
    SourcePriorityItem(rank=2, level="topic_memory", label="Mémoire topic"),
    SourcePriorityItem(rank=3, level="local_documents", label="Documents locaux liés topic/espace"),
    SourcePriorityItem(rank=4, level="knowledge_documents", label="Knowledge docs projet"),
    SourcePriorityItem(rank=5, level="vector_store", label="Vector store OpenAI"),
]

SOURCE_PRIORITY_POLICY = SourcePriorityPolicy(items=SOURCE_PRIORITY_ITEMS)

FEATURE_FLAGS = FeatureFlags(
    allow_raw_workspace_dump=False,
    allow_unplanned_document_search=False,
    allow_automatic_action_execution=False,
    allow_vector_store_auto_create=False,
    allow_full_space_prompt_injection=False,
)

MODE_SOURCE_CONTRACTS: dict[str, dict[str, object]] = {
    "cadrage": {
        "allowed_sources": ["mepo_objects", "topic_memory", "local_documents", "knowledge_documents", "vector_store"],
        "forbidden_sources": [],
        "stop_rule": "Stop dès que le contexte MePO et les documents locaux suffisent. Vector store seulement en dernier recours.",
    },
    "impact": {
        "allowed_sources": ["mepo_objects", "topic_memory", "local_documents", "knowledge_documents", "vector_store"],
        "forbidden_sources": [],
        "stop_rule": "Priorité aux objets MePO et aux dépendances visibles. Vector store seulement si aucune source locale n’explique le périmètre.",
    },
    "pilotage": {
        "allowed_sources": ["mepo_objects", "topic_memory"],
        "forbidden_sources": ["local_documents", "knowledge_documents", "vector_store"],
        "stop_rule": "Aucune recherche documentaire projet. Répondre à partir des objets MePO et de la mémoire topic uniquement.",
    },
    "analyse_fonctionnelle": {
        "allowed_sources": ["mepo_objects", "topic_memory", "local_documents", "knowledge_documents", "vector_store"],
        "forbidden_sources": [],
        "stop_rule": "Documents locaux avant knowledge docs. Vector store seulement si le corpus local ne couvre pas la règle métier.",
    },
    "analyse_technique": {
        "allowed_sources": ["mepo_objects", "topic_memory", "local_documents", "knowledge_documents", "vector_store"],
        "forbidden_sources": [],
        "stop_rule": "Contexte MePO puis documentation locale. Vector store seulement en renfort si les documents projet sont insuffisants.",
    },
    "redaction": {
        "allowed_sources": ["mepo_objects", "topic_memory", "local_documents", "knowledge_documents", "vector_store"],
        "forbidden_sources": [],
        "stop_rule": "Si un ticket credible existe, stop sur MePO. Sinon utiliser d'abord les documents locaux, puis les knowledge docs projet. Vector store seulement en dernier niveau.",
    },
    "transformation": {
        "allowed_sources": ["mepo_objects", "topic_memory", "local_documents", "knowledge_documents", "vector_store"],
        "forbidden_sources": [],
        "stop_rule": "Transformer d’abord à partir du contexte injecté. N’ouvrir le corpus projet qu’en absence d’information suffisante.",
    },
    "memoire": {
        "allowed_sources": ["mepo_objects", "topic_memory"],
        "forbidden_sources": ["local_documents", "knowledge_documents", "vector_store"],
        "stop_rule": "Mémoire et objets MePO uniquement. Aucune recherche documentaire externe.",
    },
}


def get_source_priority_policy() -> SourcePriorityPolicy:
    return SOURCE_PRIORITY_POLICY.model_copy(deep=True)


def get_feature_flags() -> FeatureFlags:
    return FEATURE_FLAGS.model_copy(deep=True)


def get_mode_source_contract(mode: str) -> dict[str, object]:
    return dict(MODE_SOURCE_CONTRACTS.get(mode, MODE_SOURCE_CONTRACTS["cadrage"]))


def build_prompt_runtime_config(project_runtime_text: str | None = None) -> PromptRuntimeConfig:
    return PromptRuntimeConfig(
        source_priority_policy=get_source_priority_policy(),
        feature_flags=get_feature_flags(),
        project_runtime_text=project_runtime_text or None,
    )

from __future__ import annotations

from app.schemas.runtime import RetrievalTrace, RetrievalTraceStep
from app.services.ai.runtime_contracts import get_mode_source_contract


def build_retrieval_trace(
    *,
    mode: str,
    has_local_documents: bool,
    needs_project_knowledge: bool,
    selected_knowledge_docs_count: int,
    has_vector_store: bool,
    stop_on_mepo_objects: bool,
) -> tuple[bool, bool, RetrievalTrace]:
    mode_contract = get_mode_source_contract(mode)
    allowed_sources = set(mode_contract["allowed_sources"])

    if stop_on_mepo_objects:
        trace = RetrievalTrace(
            mode=mode,
            finalLevel="mepo_objects",
            vectorStoreAllowed=False,
            vectorStoreUsed=False,
            steps=[
                RetrievalTraceStep(level="mepo_objects", used=True, itemCount=1, reason="Ticket existant crédible détecté, arrêt immédiat sur MePO."),
                RetrievalTraceStep(level="topic_memory", used=False, itemCount=0, reason="Non nécessaire."),
                RetrievalTraceStep(level="local_documents", used=False, itemCount=0, reason="Recherche documentaire interdite par règle d’arrêt."),
                RetrievalTraceStep(level="knowledge_documents", used=False, itemCount=0, reason="Recherche documentaire interdite par règle d’arrêt."),
                RetrievalTraceStep(level="vector_store", used=False, itemCount=0, reason="Vector store interdit car arrêt avant le niveau 5."),
            ],
        )
        return False, False, trace

    use_knowledge_docs = "knowledge_documents" in allowed_sources and needs_project_knowledge and selected_knowledge_docs_count > 0
    use_vector_store = (
        "vector_store" in allowed_sources
        and needs_project_knowledge
        and selected_knowledge_docs_count == 0
        and has_vector_store
    )

    if use_vector_store:
        final_level = "vector_store"
    elif use_knowledge_docs:
        final_level = "knowledge_documents"
    elif has_local_documents and "local_documents" in allowed_sources:
        final_level = "local_documents"
    elif "topic_memory" in allowed_sources:
        final_level = "topic_memory"
    else:
        final_level = "mepo_objects"

    trace = RetrievalTrace(
        mode=mode,
        finalLevel=final_level,
        vectorStoreAllowed="vector_store" in allowed_sources and has_vector_store,
        vectorStoreUsed=use_vector_store,
        steps=[
            RetrievalTraceStep(level="mepo_objects", used=True, itemCount=1, reason="Toujours utilisé en premier."),
            RetrievalTraceStep(level="topic_memory", used=final_level in {"topic_memory", "local_documents", "knowledge_documents", "vector_store"}, itemCount=1 if "topic_memory" in allowed_sources else 0, reason="Niveau 2 disponible selon la politique du mode." if "topic_memory" in allowed_sources else "Interdit par la politique du mode."),
            RetrievalTraceStep(level="local_documents", used=final_level in {"local_documents", "knowledge_documents", "vector_store"} and "local_documents" in allowed_sources and has_local_documents, itemCount=1 if has_local_documents and "local_documents" in allowed_sources else 0, reason="Documents locaux avant corpus projet." if "local_documents" in allowed_sources else "Interdit par la politique du mode."),
            RetrievalTraceStep(level="knowledge_documents", used=use_knowledge_docs, itemCount=selected_knowledge_docs_count if use_knowledge_docs else 0, reason="Corpus projet utilisé car besoin documentaire confirmé." if use_knowledge_docs else "Non utilisé : soit inutile, soit aucun document sélectionné, soit interdit par la politique du mode."),
            RetrievalTraceStep(level="vector_store", used=use_vector_store, itemCount=1 if use_vector_store else 0, reason="Dernier recours documentaire." if use_vector_store else "Non utilisé : corpus local suffisant ou vector store indisponible / interdit."),
        ],
    )
    return use_knowledge_docs, use_vector_store, trace

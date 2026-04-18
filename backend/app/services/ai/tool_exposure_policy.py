from __future__ import annotations

from app.schemas.runtime import RetrievalTrace, ToolExposureDecision


_FILE_SEARCH_INCLUDE = ["file_search_call.results"]


def decide_tool_exposure(
    *,
    configured_vector_store_id: str | None,
    retrieval_trace: RetrievalTrace,
    stop_on_mepo_objects: bool,
    stop_reason_override: str | None = None,
) -> ToolExposureDecision:
    if not configured_vector_store_id:
        return ToolExposureDecision(
            fileSearchEnabled=False,
            reason="Aucun vector store configure pour ce projet.",
            vectorStoreId=None,
            include=[],
        )

    if stop_on_mepo_objects:
        return ToolExposureDecision(
            fileSearchEnabled=False,
            reason=stop_reason_override or "Recherche documentaire interdite: un objet MePO credible suffit deja pour ce tour.",
            vectorStoreId=None,
            include=[],
        )

    if retrieval_trace.final_level != "vector_store" or not retrieval_trace.vector_store_used:
        return ToolExposureDecision(
            fileSearchEnabled=False,
            reason=(
                "Recherche documentaire externe non exposee: la hierarchie des sources s'est arretee "
                f"au niveau '{retrieval_trace.final_level}'."
            ),
            vectorStoreId=None,
            include=[],
        )

    return ToolExposureDecision(
        fileSearchEnabled=True,
        reason="file_search autorise pour ce tour: dernier recours documentaire atteint par le runtime.",
        vectorStoreId=configured_vector_store_id,
        include=_FILE_SEARCH_INCLUDE,
    )

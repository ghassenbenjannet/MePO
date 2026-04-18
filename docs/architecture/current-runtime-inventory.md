# Current Runtime Inventory

## Scope

This inventory covers the backend runtime path effectively used today by Let’s Chat / MePO:

`routes_ai -> runtime_router -> retrieval_pipeline -> llm_gateway -> response_parser -> action registration / execution`

The public API contract consumed by the frontend remains the current `AIChatResponse`.

## Inventory

| File | Real role | Status | Debt / risk |
| --- | --- | --- | --- |
| `backend/app/api/routes_ai.py` | Main AI entry route. Builds runtime, calls LLM, parses output, enriches actions, returns API response. | Refactorer | Too much orchestration logic in the route; mixes pipeline, validation and action policy concerns. |
| `backend/app/api/routes_ai_actions.py` | Executes validated actions after user confirmation. | Garder | Public contract is useful and already aligned with explicit confirmation. |
| `backend/app/services/ai/runtime_router.py` | Current mode dispatcher (`mepo`, `openai_only`, `hybrid`) and runtime preparation. | Refactorer | Central but still mixes intent, workspace loading, retrieval plan and mode fallback in one file. |
| `backend/app/services/ai/intent_router.py` | Rule-based local intent detector. | Garder | Good local-first base, but implicit output fields remain too light for the target architecture. |
| `backend/app/services/ai/context_builder.py` | Builds context snapshot and token estimate. | Encapsuler | Useful, but should sit behind orchestrator interfaces instead of being called ad hoc. |
| `backend/app/services/ai/workspace_builder.py` | Builds workspace context + local indexes registry snapshot. | Refactorer | Valuable foundation; naming and contract should converge to `WorkspaceBuilderV2`. |
| `backend/app/services/ai/workspace_cache.py` | In-memory workspace cache and invalidation support. | Garder | Good basis; needs explicit integration in orchestrator contracts. |
| `backend/app/services/ai/local_indexer.py` | Builds local document/test/source indexes. | Garder | Good preparatory layer; still coupled to current workspace builder outputs. |
| `backend/app/services/ai/retrieval_orchestrator.py` | Builds current retrieval trace and source progression. | Encapsuler | Logic remains useful, but naming is legacy and should be hidden behind the new retrieval planner. |
| `backend/app/services/ai/retrieval_pipeline.py` | Builds source plan, sufficiency check, pipeline trace and runtime input. | Refactorer | Good start, but current contracts are spread between schemas and service-local dataclasses. |
| `backend/app/services/ai/tool_exposure_policy.py` | Decides when `file_search` can be exposed. | Garder | Correct local policy, should stay runtime-controlled. |
| `backend/app/services/ai/runtime_mode.py` | Resolves `SHADOW_RUNTIME_MODE`. | Garder | Useful and simple. |
| `backend/app/services/ai/llm_gateway.py` | OpenAI gateway, Chat Completions / Responses API, JSON repair, tool injection. | Refactorer | Still named around Shadow Core; should remain as synthèse gateway, not orchestration center. |
| `backend/app/services/ai/response_parser.py` | Tolerant parser from raw LLM dict to `AIChatResponse`. | Encapsuler | Needed, but should be driven by a dedicated `OutputValidator` instead of direct route logic. |
| `backend/app/services/ai/action_engine.py` | Executes approved actions in MePO. | Garder | Action execution is already backend-owned and confirmation-aware. |
| `backend/app/services/ai/action_proposal_registry.py` | Persists proposed actions and execution state. | Garder | Valuable for auditability and unique action IDs. |
| `backend/app/services/ai/project_skill_runtime.py` | Current project skill loading and raw text assembly. | Refactorer | Too text-centric; needs replacement by compiled runtime objects + cache. |
| `backend/app/services/ai/skill_manager.py` | Base system prompt + schema note + style directives. | Refactorer | Useful base prompt, but still too tied to monolithic prompt assembly. |
| `backend/app/services/ai/prompt_runtime.py` | Assembles runtime prompt blocks. | Refactorer | Must consume minimal compiled skill projection, not assembled raw sections. |
| `backend/app/schemas/ai.py` | Public request/response models and debug payload. | Garder | Public contract is useful; must remain stable for frontend compatibility. |
| `backend/app/schemas/runtime.py` | Internal runtime support models for workspace, retrieval and debug. | Refactorer | Contains useful shapes, but mixes public-ish debug payload and internal runtime contracts. |
| `backend/app/services/ai/project_skill_runtime.py` + `backend/app/api/routes_skills.py` | Project runtime skill storage and read/update endpoints. | Refactorer | Keep endpoints, but replace raw text compilation path with compiler-backed normalized output. |
| `backend/app/services/knowledge/*` | Knowledge sync and vector store handling. | Garder | Separate concern; should remain distinct from runtime skill compilation. |

## Public entry points effectively used

- `POST /api/ai/chat`
- `POST /api/ai/actions/execute`
- `GET /api/projects/{project_id}/skills/settings`
- `PUT /api/projects/{project_id}/skills/settings`
- `GET /api/projects/{project_id}/skills/runtime`

## Current strengths worth preserving

- Stable frontend contract around `AIChatResponse`
- Explicit action confirmation path
- Runtime-controlled `file_search`
- Existing workspace context and local indexing foundations
- Runtime mode support already present

## Current structural issues

- Route-level orchestration is too heavy
- Skill is still handled mainly as text instead of compiled runtime objects
- Internal contracts are split across service dataclasses and response schemas
- Retrieval planning and pipeline tracing are useful but not yet modeled as first-class runtime contracts
- Legacy naming (`Shadow Core`, `project_runtime_text`) hides the new target architecture

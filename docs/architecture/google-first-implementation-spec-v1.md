# Google-First Implementation Spec V1

## Scope

Frozen implementation spec based on observed code, not on a greenfield redesign.

Observed live base used for this spec:

- frontend standard chat: `frontend/src/pages/chat/chat-page.tsx` + `frontend/src/hooks/use-chat-node.ts`
- backend standard chat write path: `backend/app/api/routes_ai.py`
- backend standard chat read path: `backend/app/api/routes_ai_conversations.py`
- skill UI: `frontend/src/components/project/project-skills-section.tsx`
- skill API: `backend/app/api/routes_skills.py`
- documents UI: `frontend/src/components/documents/documents-tab.tsx`
- documents CRUD API: `backend/app/api/routes_documents.py`
- legacy knowledge sync OpenAI: `backend/app/api/routes_knowledge.py` + `backend/app/services/knowledge/*`
- DB migration mechanism actually used today: `backend/app/core/database.py::run_compat_migrations()`

## Locked Decisions

1. Google is the standard chat provider.
2. OpenAI leaves the standard path, is confined during migration, then removed.
3. MePO remains the source of truth for skills, documents, conversations and actions.
4. Google is a provider, not the business source of truth.
5. Existing Skill and Documents sections are adapted, not recreated.
6. Let us Chat is limited to 6 explicit use cases:
   - `analyse`
   - `bogue`
   - `recette`
   - `question_generale`
   - `redaction_besoin`
   - `structuration_sujet`
7. Micro messages such as `merci`, `ok`, `continue` never trigger the full pipeline.
8. Generation and persistence are merged into one request.
9. No double standard path survives.
10. Legacy code that is no longer needed is deleted, not just bypassed.

## 1. Architecture Cible Concrete

### 1.1 Backend - modules to create

| Decision | Fichier(s) impactes | Action attendue | Raison | Dependances |
| --- | --- | --- | --- | --- |
| Create the standard chat turn pipeline | `backend/app/services/ai/chat_turn_service.py`, `backend/app/services/ai/chat_runtime_service.py`, `backend/app/services/ai/turn_classifier.py`, `backend/app/services/ai/use_case_snapshot_service.py`, `backend/app/services/ai/conversation_summary_service.py`, `backend/app/services/ai/google_llm_service.py`, `backend/app/schemas/ai_conversations.py` | Create one standard pipeline `turn -> classify -> load active skill -> decide retrieval -> call Google if needed -> persist user+assistant -> return compact previews + assistant detail`. `conversation_id` can be null and must create the conversation before persistence. | Replaces the current split `POST /api/ai/chat` then `POST /api/ai/chat-node/.../messages`. Removes client-side prompt assembly and keeps MePO as truth. | `AIConversation`, `AIMessage`, `AIConversationSummary`, `AIUseCaseSnapshot`, Google config in `backend/app/core/config.py` |
| Create the Google document provider path | `backend/app/services/documents/google_document_service.py`, `backend/app/services/documents/document_sync_service.py`, `backend/app/services/documents/corpus_snapshot_service.py`, `backend/app/schemas/document_sync.py` | Create the standard path for exporting MePO documents to Google and rebuilding the local corpus snapshot used by chat. No business state is stored only in Google. | Replaces the OpenAI vector store sync path and stops treating `project_knowledge_documents` as a second document world. | `Document`, `DocumentGoogleLink`, `ProjectDocumentSyncState`, `backend/app/core/config.py` |
| Create the active skill service | `backend/app/services/ai/skill_version_service.py`, `backend/app/services/ai/active_skill_service.py` | Serve the active skill version, create a new version on save, and expose the compiled context pack consumed by the runtime. | Removes `project_skill_settings` as the standard write source and makes `Project.active_skill_version_id` authoritative. | `Project`, `ProjectSkillVersion`, `backend/app/services/ai/skill_compiler/compiler.py` |
| Move inline conversation schemas out of the route file | `backend/app/schemas/ai_conversations.py` | Extract the current inline Pydantic schemas from `routes_ai_conversations.py` into a dedicated schema module and define the new compact contracts there. | The current route file mixes route logic, persistence rules and data contracts. | `backend/app/api/routes_ai_conversations.py` |
| Create persistence models for summary and use-case reuse | `backend/app/models/ai_conversation_summary.py`, `backend/app/models/ai_use_case_snapshot.py` | Add dedicated tables for rolling conversation summary and reusable use-case snapshot. | Current `summary_memory` in `ai_conversations` is too thin for the target follow-up flow and micro-message gating. | `AIConversation`, `AIMessage`, `backend/app/core/database.py` |
| Create Google document mapping models | `backend/app/models/document_google_link.py`, `backend/app/models/project_document_sync_state.py` | Add one per-document Google mapping table and one per-project aggregate sync state table. | Needed to show sync state inside the existing Documents section and to gate chat on `ready` corpus snapshots. | `Document`, `backend/app/core/database.py` |

### 1.2 Backend - modules to rewrite

| Decision | Fichier(s) impactes | Action attendue | Raison | Dependances |
| --- | --- | --- | --- | --- |
| Replace the standard chat write route | `backend/app/api/routes_ai_conversations.py` | Rewrite the file so that it becomes the standard compact conversations API and hosts the new `POST /api/ai/conversations/turns` endpoint. Remove `chat-node` path names from the standard contract. | Today the standard front reads from `chat-node` and writes through `/api/ai/chat`, which violates the single-path rule. | `backend/app/schemas/ai_conversations.py`, `chat_turn_service.py` |
| Remove route-level orchestration from the standard path | `backend/app/api/routes_ai.py` | Stop using this file for the standard path, keep it only as a temporary migration shim if needed, then delete it. | Today this route still prepares runtime, calls the LLM, enriches payloads and returns the standard answer. | `routes_ai_conversations.py`, `chat_turn_service.py` |
| Rewrite skill routes around active version + versions list | `backend/app/api/routes_skills.py`, `backend/app/schemas/skills.py` | Replace `settings` and `runtime` raw-text endpoints with `active` and `versions` endpoints. The route must write a new `ProjectSkillVersion` and move the active pointer on save. | Current route writes `project_skill_settings`, then backfills a version. That is legacy-first. | `Project`, `ProjectSkillVersion`, `active_skill_service.py` |
| Rewrite the skill compiler output | `backend/app/services/ai/skill_compiler/compiler.py` | Compile a compact `context pack` from the active version and stop emitting a hardcoded `strict source hierarchy` block as the main behavior driver. | Skill must become stable project context, not the top retrieval source or a rigid runtime manifesto. | `ProjectSkillVersion`, `active_skill_service.py` |
| Rewrite runtime internals around explicit turn classes | `backend/app/services/ai/local_runtime_orchestrator.py`, `backend/app/services/ai/runtime_contracts.py`, `backend/app/services/ai/context_builder.py`, `backend/app/services/ai/workspace_builder.py`, `backend/app/services/ai/knowledge_selector.py`, `backend/app/services/ai/tool_exposure_policy.py` | Repoint these modules to the new contracts: `business_turn`, `follow_up`, `micro_ack`, `ProjectContextPack`, `CorpusSnapshot`, `UseCaseSnapshot`. Retrieval must run only on `business_turn`; `follow_up` reuses the last snapshot; `micro_ack` uses a local fast path. | The current runtime still mixes legacy source hierarchy, knowledge heuristics and OpenAI fallback assumptions. | `chat_runtime_service.py`, `document_sync_service.py`, `corpus_snapshot_service.py` |
| Rewrite the document CRUD route to expose sync state | `backend/app/api/routes_documents.py`, `backend/app/schemas/document.py` | Keep CRUD ownership on the existing Documents section, but extend `DocumentRead` to expose Google sync state and corpus inclusion state per document. | Sync visibility must live in the existing Documents section, not in the project knowledge legacy panel. | `DocumentGoogleLink`, `ProjectDocumentSyncState`, `document_sync_service.py` |
| Rewrite the DB compatibility migrations | `backend/app/core/database.py` | Extend `run_compat_migrations()` to create new tables, backfill required fields, migrate legacy rows, then drop obsolete OpenAI columns when the purge tranche is reached. | This repo does not use Alembic in the live path; compatibility migrations are the real schema evolution mechanism. | New models listed in section 2 |
| Rewrite the API router registration | `backend/app/api/router.py` | Register the new document sync routes and remove `routes_ai.py` and `routes_knowledge.py` from the standard path. | Router registration must reflect the single standard path rule. | New route modules, kill list tranche 5 |
| Rewrite config for Google-first runtime | `backend/app/core/config.py` | Add Google provider config and mark OpenAI config as transitional only until the purge tranche. | The current config is OpenAI-only. | `google_llm_service.py`, `google_document_service.py` |

### 1.3 Backend - modules to delete

| Decision | Fichier(s) impactes | Action attendue | Raison | Dependances |
| --- | --- | --- | --- | --- |
| Remove the legacy OpenAI knowledge route | `backend/app/api/routes_knowledge.py` | Delete after Documents sync is exposed from the existing Documents section. | Keeps a second document world and exposes OpenAI vector store concepts in the product. | `routes_documents.py`, `routes_document_sync.py` or equivalent sync route |
| Remove OpenAI vector store services | `backend/app/services/knowledge/openai_vector_store_service.py`, `backend/app/services/knowledge/sync_service.py` | Delete once Google document sync is live and migrated. | OpenAI must leave the standard path and the document provider role. | `document_sync_service.py`, `google_document_service.py` |
| Remove obsolete OpenAI chat helpers | `backend/app/services/ai/openai_service.py`, `backend/app/services/ai/openai_conversations.py`, `backend/app/services/ai/vector_store_sync.py` | Delete. | These files are legacy helpers or direct OpenAI bridges that contradict the target runtime. | `google_llm_service.py`, `chat_turn_service.py` |
| Remove runtime mode indirection | `backend/app/services/ai/runtime_mode.py`, `backend/app/services/ai/runtime_router.py` | Delete once the new standard runtime is fully switched on. | The target architecture does not keep `mepo`, `hybrid`, `openai_only` as parallel production paths. | `chat_runtime_service.py` |
| Remove legacy skill storage wrappers | `backend/app/models/project_skill.py`, `backend/app/models/project_skill_settings.py`, `backend/app/services/ai/project_skill_runtime.py` | Delete after skill save/read is version-backed and the current UI uses `skills/active`. | These wrappers preserve a raw-text settings path as if it were the main source. | `ProjectSkillVersion`, `routes_skills.py`, `active_skill_service.py` |
| Remove legacy project knowledge models | `backend/app/models/project_knowledge_document.py`, `backend/app/models/project_knowledge_sync_item.py`, `backend/app/models/project_knowledge_settings.py` | Delete after their data is migrated into `Document`, `DocumentGoogleLink` and `ProjectDocumentSyncState`. | These models are the second document system and are OpenAI-shaped. | Document migration tranche |

### 1.4 Frontend - modules to create

| Decision | Fichier(s) impactes | Action attendue | Raison | Dependances |
| --- | --- | --- | --- | --- |
| Create the explicit use-case selector | `frontend/src/components/chat/chat-use-case-selector.tsx` | Add a compact selector for the 6 allowed use cases. The selected value is required before standard send. | Lets Chat must stop being a vague chatbot and the front must send the explicit business use case. | `frontend/src/pages/chat/chat-page.tsx` |
| Create the turn mutation hook | `frontend/src/hooks/use-chat-turns.ts` | Add the single write hook for `POST /api/ai/conversations/turns`. | Replaces the current front sequence `create if needed -> /api/ai/chat -> /api/ai/chat-node/.../messages`. | `backend/app/api/routes_ai_conversations.py` |
| Create document sync hooks for the existing Documents section | `frontend/src/hooks/use-document-sync.ts` | Add project-level sync status and trigger hooks, plus per-document sync refresh if needed. | The Documents section must expose Google sync without routing through the legacy knowledge hooks. | `backend/app/api/routes_documents.py`, document sync routes |
| Create small document sync UI blocks | `frontend/src/components/documents/document-sync-status.tsx`, `frontend/src/components/documents/document-sync-badge.tsx` | Add reusable status UI for sync/corpus state in the existing Documents section. | Avoid reusing the legacy project knowledge panel. | `use-document-sync.ts`, `DocumentsTab` |

### 1.5 Frontend - modules to rewrite

| Decision | Fichier(s) impactes | Action attendue | Raison | Dependances |
| --- | --- | --- | --- | --- |
| Rewrite ChatPage around the single turn endpoint | `frontend/src/pages/chat/chat-page.tsx` | Remove client-built `conversation_history`, remove the call to `/api/ai/chat`, remove the extra append call, require `use_case`, and call only `POST /api/ai/conversations/turns`. | Enforces one request for send + persist and removes the current double standard path. | `use-chat-turns.ts`, `use-chat-node.ts` replacement |
| Rewrite the read hooks naming and contract | `frontend/src/hooks/use-chat-node.ts` | Replace `chat-node` naming and paths with standard `conversations` contracts. | `chat-node` was a stabilization step, not the final public naming. | `routes_ai_conversations.py` |
| Rewrite the sidebar navigation | `frontend/src/components/layout/sidebar.tsx` | Add a dedicated `Let us Chat` entry in the active space tree and in favorites if needed. Do not keep chat hidden behind the space page only. | Navigation must reflect that chat is a first-class page with explicit use cases. | `frontend/src/lib/routes.ts`, `ChatPage` |
| Rewrite the Skill section | `frontend/src/components/project/project-skills-section.tsx`, `frontend/src/hooks/use-skills.ts` | Bind the existing Skill section to `skills/active` and `skills/versions`, show active version metadata, and stop presenting raw runtime text as the main artifact. | Skill becomes the project context pack owned by MePO. | `routes_skills.py`, `ProjectSkillVersion` |
| Rewrite the Documents section | `frontend/src/components/documents/documents-tab.tsx`, `frontend/src/pages/space/space-documents-page.tsx`, `frontend/src/hooks/use-documents.ts` | Keep the existing Documents section and extend it with Google sync state, corpus readiness, include/exclude controls if required, and project-level sync action. | Documents become the project corpus standard path. | `routes_documents.py`, `use-document-sync.ts` |
| Rewrite the project page | `frontend/src/pages/project/project-page.tsx` | Remove the legacy `KnowledgeSection` OpenAI UI and keep only the adapted Skill section on the project page. | Documents sync must move to the existing Documents section. | `use-knowledge.ts` removal, adapted `DocumentsTab` |

### 1.6 Frontend - modules to delete

| Decision | Fichier(s) impactes | Action attendue | Raison | Dependances |
| --- | --- | --- | --- | --- |
| Remove the legacy monolith chat component | `frontend/src/components/chat/lets-chat.tsx` | Delete after no mounted route imports it. | It is a non-standard monolith and already not the live standard route. | `ChatPage` fully migrated |
| Remove the legacy conversations hooks | `frontend/src/hooks/use-conversations.ts` | Delete. | Legacy conversation path must not survive next to the compact standard path. | `use-chat-turns.ts`, standard `conversations` hooks |
| Remove legacy knowledge hooks | `frontend/src/hooks/use-knowledge.ts` | Delete after the Documents section owns sync status and trigger. | Prevents a second document management path in the frontend. | `use-document-sync.ts`, `DocumentsTab` rewrite |

## 2. Modele De Donnees Cible

### 2.1 SkillVersion

| Decision | Fichier(s) impactes | Action attendue | Raison | Dependances |
| --- | --- | --- | --- | --- |
| Collapse skill storage into the version table | `backend/app/models/project_skill_version.py`, `backend/app/core/database.py` | Rewrite the model so that the version row itself stores the editable blocks and the compiled context text. Remove the need for `project_skill_settings` and `project_skills` in the standard path. | Minimal model, single source for saved skill content, version history preserved. | `Project.active_skill_version_id`, adapted skill routes |

Target fields:

```text
ProjectSkillVersion
- id
- project_id
- version_label
- editor_payload_json
  - main_skill_text
  - general_directives_text
  - mode_policies_text
  - action_policies_text
  - output_templates_text
  - guardrails_text
- compiled_context_text
- source_kind = "mepo_skill_editor"
- created_at
```

### 2.2 Active skill by project

| Decision | Fichier(s) impactes | Action attendue | Raison | Dependances |
| --- | --- | --- | --- | --- |
| Keep the active skill pointer on the project | `backend/app/models/project.py`, `backend/app/core/database.py` | Keep `active_skill_version_id` as the single active pointer and remove OpenAI-specific project fields. | Minimal and already close to the live code. | `ProjectSkillVersion` |

Target fields:

```text
Project
- id
- name
- status
- description
- image_url
- active_skill_version_id
- created_at
```

Fields to remove:

```text
- openai_strategy
- openai_vector_store_id
```

### 2.3 Etat de synchronisation documentaire Google

| Decision | Fichier(s) impactes | Action attendue | Raison | Dependances |
| --- | --- | --- | --- | --- |
| Store aggregate sync and corpus state per project | `backend/app/models/project_document_sync_state.py`, `backend/app/core/database.py` | Create one project-level table for current Google sync state and corpus snapshot state. | Chat must read only `ready` snapshots and the Documents section must expose project sync health. | `DocumentGoogleLink`, `Document`, `corpus_snapshot_service.py` |

Target fields:

```text
ProjectDocumentSyncState
- id
- project_id
- google_sync_status
  - queued
  - syncing
  - synced
  - stale
  - error
- corpus_status
  - not_indexed
  - indexing
  - ready
  - stale
  - error
- active_corpus_version
- last_sync_started_at
- last_sync_finished_at
- last_error
- updated_at
```

### 2.4 Mapping document MePO -> reference Google

| Decision | Fichier(s) impactes | Action attendue | Raison | Dependances |
| --- | --- | --- | --- | --- |
| Store one Google link row per MePO document | `backend/app/models/document_google_link.py`, `backend/app/core/database.py` | Create a dedicated mapping table and keep `Document` as the business source of truth. | Google is a provider, not the document owner. | `Document`, `ProjectDocumentSyncState` |

Target fields:

```text
DocumentGoogleLink
- id
- document_id
- google_file_id
- google_web_url
- google_mime_type
- sync_status
  - queued
  - syncing
  - synced
  - stale
  - error
- last_synced_hash
- last_synced_at
- last_error
- updated_at
```

### 2.5 Document source of truth

| Decision | Fichier(s) impactes | Action attendue | Raison | Dependances |
| --- | --- | --- | --- | --- |
| Keep the existing `documents` table as the source of truth | `backend/app/models/document.py`, `backend/app/schemas/document.py`, `backend/app/core/database.py` | Keep the current document content and hierarchy model, add only what is required to include documents in the AI corpus and expose sync state in API payloads. | This adapts the existing Documents section instead of recreating another project corpus table. | `DocumentGoogleLink`, `ProjectDocumentSyncState` |

Target fields:

```text
Document
- id
- space_id
- topic_id
- parent_id
- type
- title
- content
- tags
- doc_metadata
- icon
- is_archived
- ai_enabled
- created_at
- updated_at
```

### 2.6 Conversation

| Decision | Fichier(s) impactes | Action attendue | Raison | Dependances |
| --- | --- | --- | --- | --- |
| Keep the conversation table, remove OpenAI state, add explicit active use-case snapshot linkage | `backend/app/models/ai_conversation.py`, `backend/app/core/database.py` | Remove OpenAI IDs and store only MePO-owned conversation metadata. | MePO owns conversations; provider-specific IDs must leave the model. | `AIConversationSummary`, `AIUseCaseSnapshot`, `ProjectSkillVersion` |

Target fields:

```text
AIConversation
- id
- project_id
- space_id
- topic_id
- title
- active_skill_version_id_snapshot
- active_use_case
- last_use_case_snapshot_id
- created_at
- updated_at
```

Fields to remove:

```text
- openai_conversation_id
- openai_response_id
- summary_memory
```

### 2.7 Message

| Decision | Fichier(s) impactes | Action attendue | Raison | Dependances |
| --- | --- | --- | --- | --- |
| Extend the message table with turn classification and snapshot linkage | `backend/app/models/ai_message.py`, `backend/app/core/database.py` | Keep the current content + metadata shape, but add explicit classification and use-case snapshot reference. | Needed for follow-up reuse, micro-message bypass and auditability. | `AIConversation`, `AIUseCaseSnapshot` |

Target fields:

```text
AIMessage
- id
- conversation_id
- role
- content
- payload_metadata
- use_case
- turn_classification
  - business_turn
  - follow_up
  - micro_ack
  - local_system
- use_case_snapshot_id
- created_at
```

### 2.8 Conversation summary

| Decision | Fichier(s) impactes | Action attendue | Raison | Dependances |
| --- | --- | --- | --- | --- |
| Move summary out of the conversation row | `backend/app/models/ai_conversation_summary.py`, `backend/app/core/database.py` | Create a dedicated summary row per conversation and update it only on business turns or summarization thresholds. | Avoids bloating the conversation row and makes summary lifecycle explicit. | `AIConversation`, `conversation_summary_service.py` |

Target fields:

```text
AIConversationSummary
- id
- conversation_id
- summary_text
- summary_version
- last_message_id
- updated_at
```

### 2.9 Use-case snapshot

| Decision | Fichier(s) impactes | Action attendue | Raison | Dependances |
| --- | --- | --- | --- | --- |
| Persist the last reusable business context snapshot | `backend/app/models/ai_use_case_snapshot.py`, `backend/app/core/database.py` | Create one snapshot per business turn and let follow-up turns reuse it without re-running full retrieval. | This is the core mechanism needed to stop retrieval on every message. | `ProjectDocumentSyncState`, `ProjectSkillVersion`, `AIConversationSummary` |

Target fields:

```text
AIUseCaseSnapshot
- id
- conversation_id
- trigger_message_id
- use_case
- topic_id
- skill_version_id
- corpus_version
- related_object_ids_json
- document_ids_json
- summary_version
- created_at
```

## 3. Contrats API Cibles

### 3.1 Skill

| Decision | Fichier(s) impactes | Action attendue | Raison | Dependances |
| --- | --- | --- | --- | --- |
| Replace settings/runtime endpoints with active/versioned skill endpoints | `backend/app/api/routes_skills.py`, `backend/app/schemas/skills.py`, `frontend/src/hooks/use-skills.ts`, `frontend/src/components/project/project-skills-section.tsx` | Switch the Skill section to version-backed contracts and stop exposing raw `compiledRuntimeText` as the standard frontend artifact. | Aligns frontend, backend and DB on one skill source. | `ProjectSkillVersion`, `Project.active_skill_version_id` |

Target endpoints:

```text
GET    /api/projects/{project_id}/skills/active
PUT    /api/projects/{project_id}/skills/active
GET    /api/projects/{project_id}/skills/versions
GET    /api/projects/{project_id}/skills/versions/{version_id}
POST   /api/projects/{project_id}/skills/versions/{version_id}/activate
```

Minimal request / response notes:

```text
GET /skills/active
- returns:
  - project_id
  - active_skill_version_id
  - version_label
  - editor_payload_json
  - compiled_context_text
  - updated_at

PUT /skills/active
- request:
  - editor_payload_json
- effect:
  - creates a new ProjectSkillVersion
  - updates projects.active_skill_version_id
- returns the new active payload
```

### 3.2 Documents AI / sync

| Decision | Fichier(s) impactes | Action attendue | Raison | Dependances |
| --- | --- | --- | --- | --- |
| Move AI sync contracts to the existing Documents path | `backend/app/api/routes_documents.py`, `backend/app/api/routes_document_sync.py` or equivalent new sync route, `backend/app/schemas/document.py`, `backend/app/schemas/document_sync.py`, `frontend/src/hooks/use-documents.ts`, `frontend/src/hooks/use-document-sync.ts`, `frontend/src/components/documents/documents-tab.tsx` | Keep CRUD on `/api/documents`, expose per-document sync metadata there, and expose project-level Google sync state through dedicated project document sync endpoints. | Documents must remain the existing section and the source of truth. | `Document`, `DocumentGoogleLink`, `ProjectDocumentSyncState` |

Target endpoints:

```text
GET    /api/documents
GET    /api/documents/{document_id}
PATCH  /api/documents/{document_id}

GET    /api/projects/{project_id}/documents/sync-status
POST   /api/projects/{project_id}/documents/sync
POST   /api/documents/{document_id}/sync
```

Minimal response notes:

```text
DocumentRead
- existing document fields
- sync:
  - ai_enabled
  - google_sync_status
  - corpus_status
  - google_file_id
  - google_web_url
  - last_synced_at
  - last_error

GET /projects/{project_id}/documents/sync-status
- returns:
  - project_id
  - google_sync_status
  - corpus_status
  - active_corpus_version
  - stale_document_count
  - last_sync_started_at
  - last_sync_finished_at
  - last_error

POST /projects/{project_id}/documents/sync
- effect:
  - sync stale MePO documents to Google
  - rebuild corpus snapshot
- returns:
  - project sync state after execution
```

### 3.3 Chat

| Decision | Fichier(s) impactes | Action attendue | Raison | Dependances |
| --- | --- | --- | --- | --- |
| Standardize send on one endpoint | `backend/app/api/routes_ai_conversations.py`, `backend/app/schemas/ai_conversations.py`, `frontend/src/pages/chat/chat-page.tsx`, `frontend/src/hooks/use-chat-turns.ts` | Replace `/api/ai/chat` with a single conversation turn endpoint that both generates and persists. | Satisfies the single-request rule and removes client-side history assembly. | `chat_turn_service.py`, `turn_classifier.py`, `google_llm_service.py` |

Target endpoint:

```text
POST /api/ai/conversations/turns
```

Target request:

```json
{
  "project_id": "string",
  "space_id": "string",
  "topic_id": "string | null",
  "conversation_id": "string | null",
  "use_case": "analyse | bogue | recette | question_generale | redaction_besoin | structuration_sujet",
  "message": "string"
}
```

Target response:

```json
{
  "conversation": {
    "id": "string",
    "title": "string",
    "last_message_at": "datetime",
    "status": "active",
    "unread_count": 0,
    "last_assistant_preview": "string"
  },
  "appended_messages": [
    {
      "id": "string",
      "role": "user",
      "created_at": "datetime",
      "preview_text": "string",
      "is_truncated": false,
      "has_detail": true,
      "has_actions": false,
      "state": "ready"
    },
    {
      "id": "string",
      "role": "assistant",
      "created_at": "datetime",
      "preview_text": "string",
      "is_truncated": false,
      "has_detail": true,
      "has_actions": true,
      "state": "ready"
    }
  ],
  "assistant_detail": {
    "id": "string",
    "role": "assistant",
    "created_at": "datetime",
    "full_text": "string",
    "rendered_answer": "string",
    "certainty": {},
    "related_objects": [],
    "actions": [],
    "debug_available": false
  },
  "turn": {
    "use_case": "string",
    "turn_classification": "business_turn | follow_up | micro_ack | local_system",
    "provider": "google | none",
    "retrieval_used": true,
    "persisted": true
  }
}
```

Rules:

```text
- front must always send an explicit use_case
- server still classifies the turn
- micro_ack:
  - no retrieval
  - no Google call
  - local fast response only
- follow_up:
  - may call Google
  - must reuse the last AIUseCaseSnapshot
  - no new retrieval by default
- business_turn:
  - may refresh retrieval from the current ready corpus snapshot
```

### 3.4 Conversations

| Decision | Fichier(s) impactes | Action attendue | Raison | Dependances |
| --- | --- | --- | --- | --- |
| Keep compact conversation read contracts as the only standard read path | `backend/app/api/routes_ai_conversations.py`, `backend/app/schemas/ai_conversations.py`, `frontend/src/hooks/use-chat-node.ts` replacement | Keep previews + lazy detail, but remove `chat-node` naming and legacy full payload paths from the standard contract. | The compact read path is correct; the naming and split standard are not. | `ChatPage`, message detail endpoint |

Target endpoints:

```text
GET    /api/ai/conversations?space_id={space_id}&project_id={project_id}
POST   /api/ai/conversations
GET    /api/ai/conversations/{conversation_id}?limit={limit}&offset={offset}
PATCH  /api/ai/conversations/{conversation_id}
DELETE /api/ai/conversations/{conversation_id}
```

Notes:

```text
POST /api/ai/conversations
- creates an empty conversation only
- standard send path remains /turns

GET /api/ai/conversations/{id}
- returns compact thread only
- previews only, no heavy assistant payload
```

### 3.5 Message detail

| Decision | Fichier(s) impactes | Action attendue | Raison | Dependances |
| --- | --- | --- | --- | --- |
| Keep lazy assistant detail loading | `backend/app/api/routes_ai_conversations.py`, `backend/app/schemas/ai_conversations.py`, `frontend/src/hooks/use-chat-node.ts` replacement, `frontend/src/components/chat/chat-message-list.tsx` | Preserve the lazy-detail pattern introduced by the chat node stabilization work. | This is the current correct answer to large conversation freezes. | Compact thread contract |

Target endpoint:

```text
GET /api/ai/conversations/{conversation_id}/messages/{message_id}
```

Target response:

```text
MessageDetail
- id
- role
- created_at
- full_text
- rendered_answer
- certainty
- related_objects
- actions
- debug_available = false in standard mode
- use_case
- turn_classification
```

## 4. Plan De Migration En Tranches

### Tranche 1

| Decision | Fichier(s) impactes | Action attendue | Raison | Dependances |
| --- | --- | --- | --- | --- |
| Install the standard backend contracts first | `backend/app/models/*`, `backend/app/core/database.py`, `backend/app/services/ai/chat_turn_service.py`, `backend/app/services/ai/google_llm_service.py`, `backend/app/services/ai/turn_classifier.py`, `backend/app/services/ai/use_case_snapshot_service.py`, `backend/app/services/ai/conversation_summary_service.py`, `backend/app/schemas/ai_conversations.py`, `backend/app/api/routes_ai_conversations.py`, `backend/app/core/config.py` | Add the new models, Google provider adapter, turn endpoint and compact schemas while keeping current read behavior stable. Do not switch the frontend yet. | Backend-first tranche makes the next front switch low risk. | Compatibility migrations in `database.py` |

Deliverable:

```text
- POST /api/ai/conversations/turns exists
- it can create a conversation if needed
- it persists user + assistant in one request
- it enforces use_case
- it classifies micro_ack / follow_up / business_turn
```

Test lock:

```text
- backend/tests/test_ai_conversations.py
- new test for single request generate + persist
- new test for micro_ack => no retrieval / no provider call
```

### Tranche 2

| Decision | Fichier(s) impactes | Action attendue | Raison | Dependances |
| --- | --- | --- | --- | --- |
| Switch the standard frontend chat path | `frontend/src/pages/chat/chat-page.tsx`, `frontend/src/hooks/use-chat-turns.ts`, `frontend/src/hooks/use-chat-node.ts` replacement, `frontend/src/components/chat/chat-use-case-selector.tsx`, `frontend/src/components/layout/sidebar.tsx` | Move ChatPage to the new turn endpoint, require use_case on send, remove client-side history building, add the direct navigation entry. | This tranche removes the standard double path on live chat. | Tranche 1 backend contract |

Deliverable:

```text
- ChatPage no longer calls /api/ai/chat
- ChatPage no longer appends messages in a second API call
- front sends one explicit use_case on every turn
- sidebar exposes Let us Chat directly
```

Test lock:

```text
- manual smoke on new conversation
- manual smoke on existing conversation
- regression check on lazy message detail
```

### Tranche 3

| Decision | Fichier(s) impactes | Action attendue | Raison | Dependances |
| --- | --- | --- | --- | --- |
| Move document sync to the existing Documents section | `backend/app/models/document.py`, `backend/app/models/document_google_link.py`, `backend/app/models/project_document_sync_state.py`, `backend/app/services/documents/*`, `backend/app/api/routes_documents.py`, `backend/app/api/routes_document_sync.py` or equivalent, `frontend/src/hooks/use-documents.ts`, `frontend/src/hooks/use-document-sync.ts`, `frontend/src/components/documents/documents-tab.tsx`, `frontend/src/pages/space/space-documents-page.tsx`, `frontend/src/pages/project/project-page.tsx` | Expose sync state from `Document`, add project sync trigger/status, migrate legacy knowledge rows into the document world, remove the project-page KnowledgeSection from the standard UX. | This removes the second document world while keeping the existing section. | Tranche 1 models, Google document services |

Deliverable:

```text
- document sync status visible in Documents
- project sync trigger visible in Documents
- project-page KnowledgeSection removed from the standard path
- chat reads only ready corpus snapshots
```

Test lock:

```text
- backend test for sync status aggregation
- backend test for document -> Google mapping persistence
- manual Documents UI smoke
```

### Tranche 4

| Decision | Fichier(s) impactes | Action attendue | Raison | Dependances |
| --- | --- | --- | --- | --- |
| Move Skill to version-backed active context | `backend/app/models/project.py`, `backend/app/models/project_skill_version.py`, `backend/app/services/ai/skill_version_service.py`, `backend/app/services/ai/active_skill_service.py`, `backend/app/services/ai/skill_compiler/compiler.py`, `backend/app/api/routes_skills.py`, `backend/app/schemas/skills.py`, `frontend/src/components/project/project-skills-section.tsx`, `frontend/src/hooks/use-skills.ts` | Switch Skill save/read to version-backed endpoints, compile from the active version, and stop depending on `project_skill_settings` and raw runtime text as the standard UX. | Makes Skill a stable MePO-owned context pack and removes a large legacy compatibility layer. | Tranche 1 runtime service already consuming active skill |

Deliverable:

```text
- skill active version is read from MePO
- save in Skill section creates a new version
- runtime reads the active skill version snapshot
- no standard endpoint depends on project_skill_settings
```

Test lock:

```text
- rewrite backend/tests/test_project_skill_settings.py into skill version tests
- add active skill pointer test
```

### Tranche 5

| Decision | Fichier(s) impactes | Action attendue | Raison | Dependances |
| --- | --- | --- | --- | --- |
| Purge OpenAI and transitional naming | `backend/app/api/routes_ai.py`, `backend/app/api/routes_knowledge.py`, `backend/app/services/knowledge/openai_vector_store_service.py`, `backend/app/services/knowledge/sync_service.py`, `backend/app/services/ai/runtime_router.py`, `backend/app/services/ai/runtime_mode.py`, `backend/app/services/ai/openai_service.py`, `backend/app/services/ai/openai_conversations.py`, `backend/app/services/ai/vector_store_sync.py`, `frontend/src/components/chat/lets-chat.tsx`, `frontend/src/hooks/use-conversations.ts`, `frontend/src/hooks/use-knowledge.ts`, `backend/app/api/router.py` | Delete transitional files, remove old router registrations, rename remaining `chat-node` vocabulary to standard `conversations` naming, drop obsolete DB columns. | This tranche enforces the no-ghost-compatibility rule. | Tranches 1 to 4 live and stable |

Deliverable:

```text
- no standard route imports or exposes OpenAI
- no mounted legacy lets-chat component
- no runtime mode branching in production code
- no project knowledge legacy UI or models
- router exposes one standard chat path only
```

Test lock:

```text
- full backend regression suite green
- remove or rewrite legacy tests tied to OpenAI-specific IDs
```

## 5. Kill List Finale V1

### 5.1 A supprimer immediatement

| Decision | Fichier(s) impactes | Action attendue | Raison | Dependances |
| --- | --- | --- | --- | --- |
| Delete clearly dead OpenAI helper | `backend/app/services/ai/openai_service.py` | Delete now. | No standard value and no reason to keep it alive. | None |
| Delete legacy vector-store wrapper | `backend/app/services/ai/vector_store_sync.py` | Delete now. | Wrapper around legacy sync path. | None |
| Delete unused legacy frontend conversation hook | `frontend/src/hooks/use-conversations.ts` | Delete once import graph is clear. | Already outside the standard path. | Quick import sweep |
| Delete legacy monolith chat component | `frontend/src/components/chat/lets-chat.tsx` | Delete once there is no remaining import. | Already not the standard mounted component. | Confirm no import remains |

### 5.2 A encapsuler temporairement

| Decision | Fichier(s) impactes | Action attendue | Raison | Dependances |
| --- | --- | --- | --- | --- |
| Encapsulate current OpenAI gateway during migration only | `backend/app/services/ai/llm_gateway.py` | Keep behind a provider interface until Google path is fully live, then delete. | Prevents a risky big-bang cut while still removing it from the standard path. | `google_llm_service.py` |
| Encapsulate current route-level AI flow only as shim | `backend/app/api/routes_ai.py` | Keep only as migration shim if needed, then delete. | Current standard write path still enters here today. | `POST /api/ai/conversations/turns` live |
| Encapsulate runtime compatibility helpers | `backend/app/services/ai/project_skill_runtime.py`, `backend/app/services/ai/runtime_contracts.py` | Keep only while old tests and old internal callers are still being moved. | Transitional bridge only. | Tranche 4 |

### 5.3 A reecrire

| Decision | Fichier(s) impactes | Action attendue | Raison | Dependances |
| --- | --- | --- | --- | --- |
| Rewrite the standard conversations route | `backend/app/api/routes_ai_conversations.py` | Make it the single standard chat API. | Removes the split between standard read and standard write paths. | Tranche 1 |
| Rewrite the standard chat page | `frontend/src/pages/chat/chat-page.tsx` | Make it a pure `conversations + turns` client. | Removes `/api/ai/chat` and second append call. | Tranche 2 |
| Rewrite the Skill section | `frontend/src/components/project/project-skills-section.tsx`, `backend/app/api/routes_skills.py` | Bind UI and API to active version + version history. | Removes raw settings path as standard. | Tranche 4 |
| Rewrite the Documents section | `frontend/src/components/documents/documents-tab.tsx`, `backend/app/api/routes_documents.py` | Add sync state to the existing section. | Removes project knowledge UI as a second document system. | Tranche 3 |
| Rewrite DB compatibility migrations | `backend/app/core/database.py` | Make schema evolution explicit for the migration. | This repo uses compatibility migrations in live code. | All model changes |

### 5.4 A renommer / clarifier

| Decision | Fichier(s) impactes | Action attendue | Raison | Dependances |
| --- | --- | --- | --- | --- |
| Rename `chat-node` vocabulary out of the standard path | `backend/app/api/routes_ai_conversations.py`, `frontend/src/hooks/use-chat-node.ts` | Standard naming becomes `conversations` and `turns`. | `chat-node` is a stabilization label, not a target product contract. | Tranche 2 and 5 |
| Rename `compiled_runtime_text` to `compiled_context_text` | `backend/app/models/project_skill_version.py`, `backend/app/schemas/skills.py`, `frontend/src/hooks/use-skills.ts` | Clarify that the artifact is a compact context projection, not a raw runtime blob. | Better matches the target role of Skill. | Tranche 4 |
| Rename `summary_memory` to explicit summary model | `backend/app/models/ai_conversation.py`, new `backend/app/models/ai_conversation_summary.py` | Remove hidden summary semantics from the conversation row. | Makes summary lifecycle explicit. | Tranche 1 |
| Rename legacy knowledge semantics out of the product | `backend/app/api/routes_knowledge.py`, `frontend/src/hooks/use-knowledge.ts`, `backend/app/models/project_knowledge_*` | Replace `knowledge` naming with `documents sync` or delete the legacy file entirely. | `knowledge` currently means OpenAI vector-store corpus, not the target document model. | Tranche 3 and 5 |

## 6. Criteres D'Acceptation Techniques

- No standard frontend or backend flow calls OpenAI.
- No mounted route imports `frontend/src/components/chat/lets-chat.tsx`.
- `POST /api/ai/conversations/turns` is the only standard send endpoint.
- One send action from `ChatPage` results in one backend request that both generates and persists.
- Front always sends one explicit `use_case`.
- `micro_ack` messages do not trigger retrieval and do not call Google.
- `follow_up` messages reuse the last `AIUseCaseSnapshot` and do not rebuild retrieval by default.
- Active skill is read from MePO through `projects.active_skill_version_id`.
- Documents sync status is visible from the existing Documents section.
- Chat reads only `ready` corpus snapshots.
- `routes_ai.py` and `routes_knowledge.py` are absent from the standard router registration.
- No standard model stores `openai_conversation_id`, `openai_response_id`, `openai_vector_store_id` or `openai_file_id`.


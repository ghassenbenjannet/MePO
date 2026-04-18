# Chat Stabilization Audit V1

## Chemin vivant fige

- route frontend standard: `/projects/:projectSlug/spaces/:spaceSlug/chat`
- composant monte: `frontend/src/pages/chat/chat-page.tsx`
- hook de liste: `frontend/src/hooks/use-chat-node.ts -> GET /api/ai/chat-node/conversations`
- hook de thread: `frontend/src/hooks/use-chat-node.ts -> GET /api/ai/chat-node/conversations/{id}`
- detail lazy message: `GET /api/ai/chat-node/conversations/{id}/messages/{messageId}`
- creation conversation: `POST /api/ai/chat-node/conversations`
- envoi IA principal: `POST /api/ai/chat`
- persistance du tour: `POST /api/ai/chat-node/conversations/{id}/messages`
- suppression conversation: `DELETE /api/ai/conversations/{id}`
- pipeline IA execute: `backend/app/api/routes_ai.py -> prepare_runtime_pipeline(...) -> call_shadow_core(...)`
- mode runtime par defaut: `mepo`

## Cause racine exacte du freeze

Le backend repondait bien. Le freeze venait du front au moment du flux live:

1. `POST /api/ai/chat` renvoyait encore `runtime_input`, `retrieval_trace` et `pipeline_trace` meme avec `debug=false`.
2. le front recevait donc un payload IA inutilement lourd apres chaque send, puis reconstruisait localement le thread.
3. le thread remplacait ensuite les messages optimistes par les messages persistants, avec un tri seulement base sur `created_at`.
4. sur des horodatages tres proches, l'ordre pouvait bouger et forcer une rehydratation du thread.
5. le detail assistant etait monte trop tot dans le flux live, alors que le chemin stable doit rester preview-first puis detail a la demande.

Le freeze ne venait donc pas d'un historique long uniquement. Il venait surtout d'un flux `send -> reponse IA lourde -> remplacement thread -> rerender`.

## Chemins legacy encore presents mais geles

- `frontend/src/components/chat/lets-chat.tsx`
  - statut: legacy encapsule
  - condition de non-usage: aucun montage dans le chemin standard
- anciens endpoints `/api/ai/conversations/*`
  - statut: conserves pour compatibilite et suppression
  - chemin standard: `chat-node` uniquement pour le thread UI

## Feature flags actifs

### Backend

- `AI_CHAT_STABLE_PATH_ONLY=true`
- `AI_CHAT_INCLUDE_RUNTIME_DEBUG=true`
  - effet: runtime debug autorise uniquement si `debug=true`
  - mode standard: aucun dump runtime dans la reponse `/api/ai/chat`
- `AI_CHAT_SQL_GUARDRAIL=true`

### Frontend

- `chatStablePathOnly=true`
- `chatLegacyFlowEnabled=false`
- `chatEagerAssistantDetail=false`
- `chatDebugPanelsEnabled=false`
- `chatExplicitDebugAllowed=true`

## Stabilisation explicitement gelee

- aucune refonte design
- aucun nouveau composant chat legacy
- aucun debug panel visible en mode standard
- aucun montage eager du detail assistant dans le flux live
- aucun dump runtime/debug dans la reponse standard `/api/ai/chat`

## Mesures de stabilisation

- payload legacy conversation chargee: `4512 chars`
- payload thread compact `chat-node`: `3073 chars`
- reduction du payload monte au chargement: `-1439 chars` soit `-31.9%`
- reponse `/api/ai/chat` standard (sans debug): `404 chars`
- reponse `/api/ai/chat` explicite debug: `2924 chars`
- reduction standard vs debug sur le flux live: `-2520 chars` soit `-86.2%`

# Kill List V1

## Objective

Remove or isolate legacy runtime paths that contradict the target local cognitive architecture.

## Decisions

### 1. Stop treating project skill as a raw runtime blob

- Kill target: direct dependence on raw concatenated skill text as the primary runtime representation.
- Current files affected:
  - `backend/app/services/ai/project_skill_runtime.py`
  - `backend/app/services/ai/prompt_runtime.py`
- Action:
  - keep compatibility endpoint
  - replace internals with compiled skill objects + minimal projection

### 2. Stop route-level orchestration growth

- Kill target: `routes_ai.py` as the place where major runtime decisions accumulate.
- Action:
  - move orchestration into dedicated pipeline services
  - leave route focused on request/response plumbing

### 3. Stop implicit runtime decisions hidden in helper functions

- Kill target: critical decisions spread across multiple helpers without explicit contracts.
- Action:
  - promote runtime decisions into explicit contracts:
    - `RuntimeRequest`
    - `IntentDecision`
    - `RetrievalPlan`
    - `EvidencePack`
    - `ContextPack`
    - `ProposedAction`
    - `MemoryWrite`

### 4. Stop raw skill duplication in prompts

- Kill target: duplicated skill content and decorative repetition injected into the model.
- Action:
  - compile once locally
  - cache compiled skill
  - project only the mode-relevant subset for the current turn

### 5. Stop context dumps as a normal strategy

- Kill target:
  - full raw workspace dumps
  - full space prompt injection
  - repeated contextual blocks that only consume tokens
- Action:
  - keep hard feature flags disabled
  - centralize compact context assembly

### 6. Stop contradictory legacy naming

- Kill target:
  - naming that suggests the LLM is the orchestrator
  - “Shadow Core” as if it were the runtime brain
- Action:
  - keep compatibility where needed
  - move orchestration semantics into local orchestrator services

### 7. Stop any path where external vector search looks normal by default

- Kill target: any code path making vector store look like a standard source instead of last resort.
- Current status:
  - runtime policy already blocks most of this
- Action:
  - keep strict source hierarchy in code
  - keep `file_search` exposed only when runtime reached `vector_store`

### 8. Stop debug payloads that are not tied to explicit pipeline decisions

- Kill target: debug data that reports symptoms but not the actual pipeline decisions.
- Action:
  - ensure debug always exposes:
    - runtime mode
    - pipeline used
    - retrieval planned
    - sources allowed
    - sources used
    - stop reason
    - validator status
    - fallback state

## Not removed in this tranche

- public AI routes consumed by the frontend
- action execution contract
- current OpenAI gateway
- current workspace builder and local indexing foundations

These remain, but are encapsulated and prepared for convergence into the new architecture.

## Cleanup status

### Supprime reellement

- logique massive d'enrichissement / policy d'actions inline dans `routes_ai.py`
- route AI monolithique qui validait et mutait les actions directement sans service dedie
- injection brute de l'historique conversationnel dans `llm_gateway.py` / `_call_responses_api(...)`

### Encapsule

- orchestration runtime centralisee derriere `runtime_router.py`
- validation de sortie derriere `output_validator.py`
- policy d'actions derriere `action_policy_engine.py`
- compilation de skill derriere `services/ai/skill_compiler/*`

### Encore actif temporairement

- `backend/app/services/ai/llm_gateway.py`
  role temporaire: gateway OpenAI de synthese
- `backend/app/services/ai/prompt_runtime.py`
  role temporaire: assemblage minimal des blocs runtime pour OpenAI
- `backend/app/services/ai/project_skill_runtime.py`
  role temporaire: wrapper de compatibilite pour les endpoints et tests legacy
- `backend/app/services/ai/runtime_contracts.py`
  role temporaire: bridge entre l'ancien systeme de prompt et les nouveaux contrats

### A supprimer tranche suivante

- `project_runtime_text` comme nom de variable de transit: a remplacer par une nomenclature basee sur `CompiledSkillProjection`
- dependance directe de `prompt_runtime.py` a `PromptRuntimeConfig.project_runtime_text`
- wrapper legacy `project_skill_runtime.py` une fois tous les appels internes migres vers le compiler

## Legacy paths encore vivants

1. `routes_ai.py -> call_shadow_core(...)`
   chemin encore vivant pour conserver le contrat front, mais l'orchestration amont est maintenant preparee localement.

2. `project_skill_runtime.py -> get_project_skill_runtime(...)`
   chemin legacy de compatibilite. Il retourne encore un texte compile pour les endpoints runtime existants.

3. `prompt_runtime.py -> _render_project_runtime_block(...)`
   chemin legacy necessaire tant que le LLM final consomme encore une projection texte.

4. `runtime_contracts.py -> build_prompt_runtime_config(...)`
   bridge temporaire entre l'ancien assembleur de prompt et les contrats locaux de tranche 1.

## Legacy modules with owner and replacement target

### `project_runtime_text`

- role temporaire: nom de transit encore utilise pour la projection skill envoyee au LLM
- owner: runtime IA backend
- statut: encore actif temporairement
- remplacant cible: `CompiledSkillProjection.projection_text` / `ContextPack.skill_projection`
- tranche de suppression: tranche 3
- condition de suppression: tous les appels internes et tests doivent consommer la projection via objets runtime au lieu du nom legacy
- blocage restant: `prompt_runtime.py`, `llm_gateway.py` et `routes_ai.py` utilisent encore ce nom comme transit technique

Usages restants identifiés:

- `backend/app/api/routes_ai.py`
- `backend/app/services/ai/llm_gateway.py`
- `backend/app/services/ai/local_runtime_orchestrator.py`
- `backend/app/services/ai/runtime_router.py`
- `backend/app/services/ai/runtime_contracts.py`
- `backend/app/services/ai/prompt_runtime.py`
- `backend/app/schemas/runtime.py`

### `project_skill_runtime.py`

- role temporaire: wrapper texte de compatibilite pour endpoints/tests legacy
- owner: runtime IA backend
- statut: encapsule
- remplacant cible: `services/ai/skill_compiler/*`
- tranche de suppression: tranche 3
- condition de suppression: plus aucun appel runtime principal ni test de compatibilite ne depend du rendu texte legacy
- blocage restant: endpoint runtime historique et assertions de compatibilite texte

### `prompt_runtime.py`

- role temporaire: formateur texte final avant LLM
- owner: runtime IA backend
- statut: encore actif temporairement
- remplacant cible: rendu base sur `ContextPack` et contrats runtime compacts
- tranche de suppression: tranche 4
- condition de suppression: le gateway LLM consomme nativement un contrat structure plutot qu'un assembleur texte
- blocage restant: le modele final consomme encore un prompt texte assemble

### `conversation_history` brut vers le LLM

- role temporaire: ancien mecanisme de rappel conversationnel par collage de tours
- owner: runtime IA backend
- statut: supprime reellement du chemin principal
- remplacant cible: `conversation_summary` compacte et bornee
- tranche de suppression: tranche 2
- condition de suppression: aucun prompt Chat Completions / Responses ne doit reconstituer un bloc `HISTORIQUE DE CONVERSATION`
- blocage restant: aucun dans le chemin principal; seulement des signatures techniques encore compatibles

### `runtime_contracts.py`

- role temporaire: bridge entre feature flags / source priority historiques et le runtime refactore
- owner: runtime IA backend
- statut: encapsule
- remplacant cible: politiques runtime unifiees
- tranche de suppression: tranche 4
- condition de suppression: les politiques de prompt, de sources et de budget convergent dans un seul module contractuel
- blocage restant: helpers de prompt et de retrieval en dependent encore

### `frontend/src/components/chat/lets-chat.tsx`

- role temporaire: composant legacy monolithique de chat avec thread, historique, debug, actions et instrumentation dans un seul arbre React
- owner: frontend chat
- statut: encapsule legacy, non monte dans le flux principal de l'espace
- remplacant cible: `frontend/src/pages/chat/chat-page.tsx` + `backend/app/api/routes_ai_conversations.py` Chat Node
- tranche de suppression: tranche 3 ou 4 selon migration complete des usages restants
- condition de suppression: aucune navigation standard ne doit plus monter `LetsChat`
- blocage restant: conserver une reference temporaire tant que tous les parcours de chat n'ont pas ete migres sur la page dediee

### `SpacePage -> onglet chat embarque`

- role temporaire: montage implicite du vieux thread dans la page espace
- owner: frontend navigation
- statut: supprime du flux principal
- remplacant cible: route dediee `/projects/:projectId/spaces/:spaceId/chat`
- tranche de suppression: tranche 2
- condition de suppression: le chat est consomme via page dediee et contrats compacts Chat Node
- blocage restant: aucun

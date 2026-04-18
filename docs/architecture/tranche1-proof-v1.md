# Tranche 1 Proof V1

## Proof of non-injection of raw full skill

Current runtime path to the model:

- `routes_ai.py`
- `runtime_router.py`
- `LocalRuntimeOrchestrator`
- `compile_skill_projection_for_turn(...)`
- `call_shadow_core(..., project_runtime_text=<projection minimale>)`
- `prompt_runtime.py -> _render_project_runtime_block(...)`

The raw full project skill is no longer sent by default.
The model receives only the compact projection chosen for the current mode.

Residual historical points where the full skill could previously leave the local runtime:

- `project_skill_runtime.py -> get_project_skill_runtime(...)`
- `prompt_runtime.py -> _render_project_runtime_block(...)`
- `routes_ai.py -> call_shadow_core(..., project_runtime_text=...)`

Current lock:

- `routes_ai.py` now passes only `project_runtime_text=<compiled minimal projection>`
- `compile_skill_projection_for_turn(...)` is the only source used for LLM projection in the main runtime path
- `project_skill_runtime.py` remains a compatibility wrapper only
- tests fail if the full normalized skill text is injected again on a simple turn

## Comparative examples

Reference baseline:

- `before` = full normalized compiled skill text sent as a raw block
- `after` = current projected skill text for the turn

### Case 1 - simple question

- request: `Quel est l'etat du sujet ?`
- detected mode: `analyse_fonctionnelle`
- full compiled skill before projection: `345 chars`
- projected skill sent to LLM: `267 chars`
- total runtime input before lock reference: `2653 chars`
- total runtime input now: `2575 chars`
- estimated prompt tokens before lock reference: `663`
- estimated prompt tokens now: `643`
- delta: `-78 chars`, about `-20 tokens`

### Case 2 - complex analysis

- request: `Analyse la couverture recette de la substitution EC et identifie les zones non couvertes.`
- detected mode: `analyse_fonctionnelle`
- full compiled skill before projection: `345 chars`
- projected skill sent to LLM: `267 chars`
- total runtime input before lock reference: `2716 chars`
- total runtime input now: `2638 chars`
- estimated prompt tokens before lock reference: `679`
- estimated prompt tokens now: `659`
- delta: `-78 chars`, about `-20 tokens`

## Debug payload fields now available

- `runtime_mode`
- `pipeline_used`
- `retrieval_planned`
- `sources_allowed`
- `sources_used`
- `stop_reason`
- `validator_status`
- `fallback_triggered`
- `fallback_reason`
- `input_chars_total`
- `compiled_skill_chars`
- `context_objects_chars`
- `evidence_chars`
- `estimated_prompt_tokens`

## Example debug payload excerpt

```json
{
  "runtime_mode": "mepo",
  "pipeline_used": "runMepoPipeline",
  "mode_detected": "analyse_fonctionnelle",
  "retrieval_planned": true,
  "sources_allowed": [
    "mepo_objects",
    "topic_memory",
    "local_documents",
    "knowledge_documents",
    "vector_store"
  ],
  "sources_used": [
    "mepo_objects",
    "topic_memory"
  ],
  "stop_reason": "Niveau 2 disponible selon la politique du mode.",
  "fallback_triggered": false,
  "validator_status": "validated|validated",
  "compiled_skill_chars": 267,
  "context_objects_chars": 2182,
  "evidence_chars": 106,
  "input_chars_total": 2638,
  "estimated_prompt_tokens": 659
}
```

## Expected cost impact

- the lock removes raw skill reinjection on each turn
- the compact projection reduces steady-state prompt volume even when the rest of the context is unchanged
- the savings are modest on the current small skill corpus, but scale linearly when project skills grow
- the real tranche-1 gain is structural:
  - no raw skill dump
  - no uncontrolled projection growth
  - measurable prompt size in debug
  - stable base for stronger gains in tranche 2 with local retrieval and tighter context assembly

# Tranche 2 Proof V1

## Objective

Lock the context assembly layer delivered in tranche 2 with real HCL/Livret cases.

The goal of this proof is to show that:

- the main runtime now injects a compact `ContextPack`
- MePO anchoring objects survive trimming
- evidence is reduced instead of dumped
- prompt size is measurably lower than the raw pre-assembly payload
- the backend remains local-first without increasing `file_search`

## Executable lock on non-dump main path

Main runtime path to the model:

- `routes_ai.py`
- `prepare_runtime_pipeline(...)`
- `LocalRuntimeOrchestrator`
- `ContextAssemblerV2`
- `call_shadow_core(..., context_pack=<compact>, runtime_input=<debug only>)`
- `llm_gateway.py`
- `prompt_runtime.py -> _render_context_pack_block(...)`

Current lock:

- `context_pack` is preferred over `runtime_input` in `call_shadow_core(...)`
- `_call_chat_completions(...)` renders `CONTEXT PACK COMPACT`
- `_call_chat_completions(...)` must not render `RUNTIME INPUT MINIMAL` when `context_pack` exists
- tests fail if the main path falls back to a raw `runtime_input` dump

Relevant tests:

- `backend/tests/test_llm_gateway_chat_completions.py`
  - `test_chat_completions_uses_context_pack_not_runtime_input_dump`
  - `test_call_shadow_core_prefers_context_pack_over_runtime_input_dump`
- `backend/tests/test_ai_runtime_calibration.py`
  - `test_explicit_bdd_question_stays_compact_without_massive_dump`

## Real HCL/Livret cases

Reference fields captured per case:

- detected mode
- chars before assembly
- chars after assembly
- estimated prompt tokens
- objects before / after
- evidence before / after
- trim triggered or not
- sources used
- stop reason
- fallback triggered or not
- short information-loss risk note

### Case 1 — Pilotage simple

- request: `Quelles priorites backlog et quels blocages aujourd'hui sur HCL Livret ?`
- detected mode: `pilotage`
- chars before assembly: `7919`
- chars after assembly: `1000`
- estimated prompt tokens: `268`
- objects before / after: `8 -> 2`
- evidence before / after: `8 -> 0`
- trim triggered: `true`
- sources used: `mepo_objects`, `topic_memory`
- stop reason: `Niveau 2 disponible selon la politique du mode.`
- fallback triggered: `false`
- kept objects: `LIV-608281`, `topic-gef`
- kept evidence: none
- risk note: `Faible: pilotage compact, aucun besoin de preuve longue.`

### Case 2 — Rédaction ticket existant

- request: `Redige la fiche complete du ticket existant LIV-608281 sur la liberation du code GEF.`
- detected mode: `redaction`
- chars before assembly: `8173`
- chars after assembly: `1431`
- estimated prompt tokens: `547`
- objects before / after: `8 -> 3`
- evidence before / after: `8 -> 0`
- trim triggered: `true`
- sources used: `mepo_objects`
- stop reason: `Ticket existant crédible détecté, arrêt immédiat sur MePO.`
- fallback triggered: `false`
- kept objects: `LIV-608281`, `topic-gef`, `mem-gef`
- kept evidence: none
- risk note: `Faible: le ticket critique, le topic et la memoire restent ancres.`

### Case 3 — Analyse fonctionnelle transverse

- request: `Analyse l'impact transverse de la SAF exacte sur delivrance, pancarte et tracabilite.`
- detected mode: `impact`
- chars before assembly: `7919`
- chars after assembly: `1776`
- estimated prompt tokens: `465`
- objects before / after: `8 -> 3`
- evidence before / after: `8 -> 1`
- trim triggered: `true`
- sources used: `mepo_objects`, `topic_memory`, `local_documents`
- stop reason: `Documents locaux avant corpus projet.`
- fallback triggered: `false`
- kept objects: `LIV-608281`, `topic-gef`, `mem-gef`
- kept evidence: `LIV-608281 — IntGestionLivret - Liberalisation code GEF et gestion des 4 statuts`
- risk note: `Modere: une seule preuve compacte conservee, mais l'ancrage MePO reste fort.`

### Case 4 — Question BDD explicite

- request: `Analyse technique BDD: quelles tables, colonnes et schema SQL portent la denomination commune et la SAF exacte ?`
- detected mode: `analyse_technique`
- chars before assembly: `9132`
- chars after assembly: `1839`
- estimated prompt tokens: `487`
- objects before / after: `8 -> 3`
- evidence before / after: `11 -> 1`
- trim triggered: `true`
- sources used: `mepo_objects`, `topic_memory`, `local_documents`, `knowledge_documents`
- stop reason: `Corpus projet utilisé car besoin documentaire confirmé.`
- fallback triggered: `false`
- kept objects: `LIV-608281`, `topic-gef`, `mem-gef`
- kept evidence: `LIV-608281 — IntGestionLivret - Liberalisation code GEF et gestion des 4 statuts`
- risk note: `Modere: le pack reste compact et local, sans dump BDD massif.`

### Case 5 — Cas documentaire lourd

- request: `Analyse le dossier architecture complet et la spec de liberation code GEF pour identifier les risques de regression sur hors livret.`
- detected mode: `analyse_technique`
- chars before assembly: `9132`
- chars after assembly: `1839`
- estimated prompt tokens: `492`
- objects before / after: `8 -> 3`
- evidence before / after: `11 -> 1`
- trim triggered: `true`
- sources used: `mepo_objects`, `topic_memory`, `local_documents`, `knowledge_documents`
- stop reason: `Corpus projet utilisé car besoin documentaire confirmé.`
- fallback triggered: `false`
- kept objects: `LIV-608281`, `topic-gef`, `mem-gef`
- kept evidence: `LIV-608281 — IntGestionLivret - Liberalisation code GEF et gestion des 4 statuts`
- risk note: `Modere: trim actif mais objets pivots et une preuve utile sont gardes.`

## Example debug payload excerpt

```json
{
  "runtime_mode": "mepo",
  "pipeline_used": "runMepoPipeline",
  "mode_detected": "analyse_technique",
  "sources_used": [
    "mepo_objects",
    "topic_memory",
    "local_documents",
    "knowledge_documents"
  ],
  "stop_reason": "Corpus projet utilisé car besoin documentaire confirmé.",
  "fallback_triggered": false,
  "budget_policy": {
    "mode": "analyse_technique",
    "maxTotalChars": 3000,
    "maxEstimatedTokens": 750
  },
  "assembly_metrics": {
    "charsBefore": 9132,
    "charsAfter": 1839,
    "trimmed": true
  },
  "object_metrics": {
    "beforeCount": 8,
    "afterCount": 3
  },
  "evidence_metrics": {
    "beforeCount": 11,
    "afterCount": 1
  }
}
```

## Functional lock conclusions

- The runtime no longer behaves like a hidden big prompt.
- The main path keeps only compact anchoring objects.
- The local hierarchy remains unchanged:
  - `mepo_objects`
  - `topic_memory`
  - `local_documents`
  - `knowledge_documents`
  - `vector_store`
- `file_search` is not increased artificially by this tranche.
- The biggest remaining cost is now the quality of future local retrieval, not raw skill reinjection or uncontrolled context dumps.

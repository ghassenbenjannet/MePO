# Tranche 2 GEF Mail Lock V1

## Objective

Lock the exact HCL/Livret mail scenario that previously showed the main defects:

- raw conversational dump leaking into the prompt
- unnecessary `vector_store` exposure in `redaction`
- wrong target ticket ranking
- legacy `related_objects` shape leaking through
- direct `mail -> summary -> add_comment` reflex without target selection

This document captures the real runtime behavior after the lock.

## Scenario

Input material:

- user provides a long mail summarizing Team6 GEF tests
- injected MePO context already contains:
  - one generic tracking ticket
  - one recipe/test ticket
  - two existing anomaly tickets
  - topic memory
- runtime mode forced to `openai_only` for stress-testing the vector-store gate

Expected behavior:

- no raw conversation dump
- no vector store usage
- recipe ticket selected as main target
- `add_comment` auto-attached to the ranked ticket

## Real metrics captured

```json
{
  "why_target_ticket_selected": "Ticket très similaire (score=42): titre(gef,liberalisation,team6)+9 / tags(delivrance,gef,liberalisation,tests,tracabilitepharma)+10 / desc(delivrance,des,team6,tests,tracabilitepharma)+5 / meme_topic+4 / ticket_recette_prioritaire+14",
  "why_vector_store_blocked_or_used": "Redaction: ticket cible existant et contexte local suffisant, vector store bloque.",
  "conversation_summary_chars": 412,
  "raw_history_chars_dropped": 997,
  "input_chars_total": 2960,
  "compiled_skill_chars": 420,
  "context_objects_chars": 891,
  "evidence_chars": 0,
  "estimated_prompt_tokens": 740,
  "sources_used": [
    "mepo_objects",
    "topic_memory"
  ],
  "stop_reason": "Memoire locale utilisee uniquement si deja injectee.",
  "target_ticket_id": "15C0F328"
}
```

## Functional conclusions

### 1. Raw history is no longer injected

- the prompt now receives a bounded `conversation_summary`
- raw conversation payload was reduced by `997 chars` on this case
- the canonical request no longer contains:
  - `SP Shadow PO`
  - `Copier`
  - `Certitude`
  - pasted assistant summaries / old action errors

### 2. Vector store is blocked on this redaction case

- runtime mode used for the proof: `openai_only`
- despite that mode, `file_search` stayed disabled
- final retrieval level stayed local:
  - `mepo_objects`
  - `topic_memory`
- proof string returned in debug:
  - `Redaction: ticket cible existant et contexte local suffisant, vector store bloque.`

### 3. Target ticket ranking is now business-driven

- selected ticket: `15C0F328`
- reason includes:
  - lexical overlap with Team6 / GEF test material
  - same topic bonus
  - explicit recipe-ticket bonus:
    - `ticket_recette_prioritaire+14`

This prevents the previous bad behavior where a generic tracking ticket or a single anomaly ticket could absorb a full test recap by default.

### 4. Action proposal is no longer orphaned

- the LLM can still emit `add_comment`
- if `ticket_id` is missing, the backend now attaches it to the ranked target ticket
- on this scenario, the final action payload points to:
  - `ticket_id = 15C0F328`

### 5. Prompt remains compact

Prompt budget on this scenario:

- compiled skill: `420 chars`
- summarized conversation: `412 chars`
- compact object pack: `891 chars`
- evidence payload: `0 chars`
- total estimated prompt: `740 tokens`

The runtime stays compact while preserving the correct anchor.

## Executable proof

Tests added or strengthened for this lock:

- `backend/tests/test_ai_pipeline_integration.py`
  - `test_gef_mail_redaction_blocks_vector_store_and_targets_recipe_ticket`
  - `test_specific_gef_anomaly_prefers_existing_anomaly_ticket_over_generic_tracking`
- `backend/tests/test_ai_response_parser.py`
  - `test_parser_repairs_legacy_related_objects_shape_from_context`
- `backend/tests/test_llm_gateway_chat_completions.py`
  - `test_chat_completions_uses_conversation_summary_instead_of_raw_history`
- `backend/tests/test_llm_gateway_file_search.py`
  - `test_responses_api_uses_conversation_summary_not_raw_history_dump`

## Lock status

- `conversation_summary`: locked
- raw history dump in main path: blocked
- vector store on this mail scenario: blocked
- recipe ticket ranking over generic tracking: locked
- anomaly follow-up ranking over generic tracking: locked
- legacy `related_objects` shape: repaired before API return

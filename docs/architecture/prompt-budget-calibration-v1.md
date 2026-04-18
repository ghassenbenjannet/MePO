# Prompt Budget Calibration V1

## Objective

Calibrate tranche 2 budgets from real HCL/Livret cases, not from decorative constants.

Reference rule:

- user request
- output contract
- compact skill projection
- compact object summaries
- compact evidence
- contradictions / open points

Protected elements never cut:

- user request
- mode
- output contract
- compact skill projection
- business IDs required for anchoring

## Final budgets by mode

| Mode | maxSkillChars | maxObjectCount | maxObjectChars | maxEvidenceCount | maxEvidenceChars | maxTotalChars | maxEstimatedTokens | Calibration note |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `pilotage` | 320 | 5 | 760 | 1 | 160 | 1800 | 450 | Tight by design. Real pilotage case landed at `1000 chars / 268 tokens`. |
| `redaction` | 420 | 7 | 1150 | 2 | 320 | 3000 | 750 | Medium budget. Real ticket case landed at `1431 chars / 547 tokens`. |
| `analyse_fonctionnelle` | 400 | 7 | 1150 | 3 | 420 | 3000 | 750 | Moderate budget. Intended for anchored functional reasoning, not long corpus replay. |
| `analyse_technique` | 420 | 7 | 1200 | 3 | 420 | 3000 | 750 | Slightly roomy but stable. Real BDD/doc-heavy cases stayed around `1839 chars / 487-492 tokens`. |
| `cadrage` | 360 | 6 | 1000 | 2 | 280 | 2400 | 600 | Medium budget for clarification without heavy evidence. |
| `memoire` | 320 | 5 | 850 | 1 | 160 | 1800 | 450 | Tight by design. Memory mode should not reopen document payloads. |
| `transformation` | 400 | 7 | 1100 | 2 | 320 | 2800 | 700 | Medium budget for controlled reformulation. |
| `impact` | 420 | 7 | 1200 | 3 | 420 | 3000 | 750 | Slightly roomy but justified. Real impact case landed at `1776 chars / 465 tokens` with one kept evidence. |

## Calibration rationale

### `pilotage`

- deliberately tight
- no long evidence pack
- only active anchors should survive
- not too tight on current HCL/Livret case

Status:

- not too large
- not too tight

### `redaction`

- must keep the anchor ticket, its topic and topic memory
- must not re-expand to a full ticket dump
- evidence can stay at zero if the ticket and memory already cover the need

Status:

- acceptable
- no tightening required before tranche 3

### `analyse_fonctionnelle`

- needs one or a few proofs
- must keep ticket + topic + memory
- must not become a document archive replay

Status:

- acceptable
- slightly roomy but controlled

### `analyse_technique`

- explicit BDD/doc-heavy cases need one compact evidence and three anchor objects
- still well below the current token ceiling

Status:

- slightly roomy
- kept intentionally to avoid over-trimming technical proof before tranche 3 retrieval improvements

### `impact`

- same profile as functional transverse analysis
- must keep business anchors and one useful proof

Status:

- slightly roomy
- justified because impact analysis collapses badly if all proofs disappear

## What changed from tranche 2 initial defaults

- tighter `pilotage`
- tighter `redaction`
- tighter `analyse_fonctionnelle`
- tighter `analyse_technique`
- tighter `impact`
- tighter `cadrage`
- tighter `memoire`
- tighter `transformation`
- shorter compact evidence summaries to preserve at least one useful proof without reopening the budget

## Observable expected cost impact

Based on captured HCL/Livret cases:

- pilotage: `7919 -> 1000 chars`
- redaction ticket existant: `8173 -> 1431 chars`
- impact transverse: `7919 -> 1776 chars`
- question BDD explicite: `9132 -> 1839 chars`
- cas documentaire lourd: `9132 -> 1839 chars`

Interpretation:

- the runtime now cuts between `77%` and `87%` of the raw pre-assembly payload in the captured cases
- prompt token usage stays below `550 tokens` on all 5 measured cases
- the current cost floor is now mostly determined by kept anchor objects and one compact proof, not by blind prompt growth

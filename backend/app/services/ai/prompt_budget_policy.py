from __future__ import annotations

from app.contracts.runtime import PromptBudgetPolicy

_DEFAULT_MODE = "cadrage"

_POLICIES: dict[str, PromptBudgetPolicy] = {
    "pilotage": PromptBudgetPolicy(
        mode="pilotage",
        maxSkillChars=320,
        maxObjectCount=5,
        maxObjectChars=760,
        maxEvidenceCount=1,
        maxEvidenceChars=160,
        maxTotalChars=1800,
        maxEstimatedTokens=450,
    ),
    "redaction": PromptBudgetPolicy(
        mode="redaction",
        maxSkillChars=420,
        maxObjectCount=7,
        maxObjectChars=1150,
        maxEvidenceCount=2,
        maxEvidenceChars=320,
        maxTotalChars=3000,
        maxEstimatedTokens=750,
    ),
    "analyse_fonctionnelle": PromptBudgetPolicy(
        mode="analyse_fonctionnelle",
        maxSkillChars=400,
        maxObjectCount=7,
        maxObjectChars=1150,
        maxEvidenceCount=3,
        maxEvidenceChars=420,
        maxTotalChars=3000,
        maxEstimatedTokens=750,
    ),
    "analyse_technique": PromptBudgetPolicy(
        mode="analyse_technique",
        maxSkillChars=420,
        maxObjectCount=7,
        maxObjectChars=1200,
        maxEvidenceCount=3,
        maxEvidenceChars=420,
        maxTotalChars=3000,
        maxEstimatedTokens=750,
    ),
    "cadrage": PromptBudgetPolicy(
        mode="cadrage",
        maxSkillChars=360,
        maxObjectCount=6,
        maxObjectChars=1000,
        maxEvidenceCount=2,
        maxEvidenceChars=280,
        maxTotalChars=2400,
        maxEstimatedTokens=600,
    ),
    "memoire": PromptBudgetPolicy(
        mode="memoire",
        maxSkillChars=320,
        maxObjectCount=5,
        maxObjectChars=850,
        maxEvidenceCount=1,
        maxEvidenceChars=160,
        maxTotalChars=1800,
        maxEstimatedTokens=450,
    ),
    "transformation": PromptBudgetPolicy(
        mode="transformation",
        maxSkillChars=400,
        maxObjectCount=7,
        maxObjectChars=1100,
        maxEvidenceCount=2,
        maxEvidenceChars=320,
        maxTotalChars=2800,
        maxEstimatedTokens=700,
    ),
    "impact": PromptBudgetPolicy(
        mode="impact",
        maxSkillChars=420,
        maxObjectCount=7,
        maxObjectChars=1200,
        maxEvidenceCount=3,
        maxEvidenceChars=420,
        maxTotalChars=3000,
        maxEstimatedTokens=750,
    ),
}


def get_prompt_budget_policy(mode: str) -> PromptBudgetPolicy:
    return _POLICIES.get(mode, _POLICIES[_DEFAULT_MODE]).model_copy(deep=True)


__all__ = ["get_prompt_budget_policy"]

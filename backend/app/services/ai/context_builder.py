def build_context_snapshot() -> dict:
    return {
        "project": "HCL - Livret",
        "space": "S1 2026",
        "topic": {
            "title": "Gestion multi-etablissements",
            "memory": {
                "facts": ["Le sujet implique plusieurs equipes et regles d'habilitation."],
                "decisions": ["Utiliser les topics comme unite centrale de contexte."],
                "risks": ["Risque d'incoherence entre tickets et documentation migree."],
                "open_questions": ["Quelle strategie pour mapper les commentaires Jira ?"],
            },
        },
        "related_tickets": ["LIV-101", "LIV-103"],
        "related_documents": ["Analyse d'impact multi-etablissements"],
    }

from app.schemas.ai import AIContextSource, AIEvidenceLine


def detect_mode(user_request: str) -> str:
    lowered = user_request.lower()

    if any(token in lowered for token in ["ticket", "gherkin", "user story", "bug", "feature"]):
        return "analyse_fonctionnelle"
    if any(token in lowered for token in ["sql", "technique", "architecture", "api"]):
        return "analyse_technique"
    if any(token in lowered for token in ["analyse", "cadrage", "scope", "périmètre"]):
        return "cadrage"
    if any(token in lowered for token in ["impact", "risque", "dépendance"]):
        return "impact"
    if any(token in lowered for token in ["document", "compte-rendu", "confluence", "spec", "rédige", "rédaction"]):
        return "redaction"
    if any(token in lowered for token in ["pilotage", "backlog", "priorité", "kanban", "sprint", "roadmap"]):
        return "pilotage"
    if any(token in lowered for token in ["mémoire", "memory", "décision", "contexte"]):
        return "memoire"
    if any(token in lowered for token in ["transform", "migr", "convert"]):
        return "transformation"
    return "pilotage"


def select_context_policy(topic_id: str | None, space_id: str | None, project_id: str | None) -> tuple[str, list[AIContextSource]]:
    sources: list[AIContextSource] = []

    if topic_id:
        sources.append(AIContextSource(kind="topic", label=topic_id))
        sources.append(AIContextSource(kind="topic_memory", label=f"{topic_id}:memory"))
        return "topic-first minimal context", sources

    if space_id:
        sources.append(AIContextSource(kind="space", label=space_id))
        return "space-first compact context", sources

    if project_id:
        sources.append(AIContextSource(kind="project", label=project_id))
        return "project-only fallback context", sources

    return "no persisted context", sources


def build_evidence(mode: str) -> list[AIEvidenceLine]:
    evidence_map: dict[str, list[AIEvidenceLine]] = {
        "analyse_fonctionnelle": [
            AIEvidenceLine(label="Demande de nature fonctionnelle détectée", confidence="certain"),
            AIEvidenceLine(label="Les critères d'acceptance nécessitent validation métier", confidence="to_confirm"),
        ],
        "analyse_technique": [
            AIEvidenceLine(label="Analyse technique ou SQL demandée", confidence="certain"),
            AIEvidenceLine(label="Impact sur les performances à vérifier", confidence="inferred"),
        ],
        "cadrage": [
            AIEvidenceLine(label="Demande de cadrage ou scope détectée", confidence="certain"),
            AIEvidenceLine(label="Les parties prenantes sont à confirmer", confidence="to_confirm"),
        ],
        "impact": [
            AIEvidenceLine(label="Analyse d'impact demandée", confidence="certain"),
            AIEvidenceLine(label="Des dépendances indirectes existent probablement", confidence="inferred"),
        ],
        "redaction": [
            AIEvidenceLine(label="Production d'un livrable textuel demandée", confidence="certain"),
            AIEvidenceLine(label="Le format cible est à confirmer", confidence="to_confirm"),
        ],
        "pilotage": [
            AIEvidenceLine(label="Mode pilotage / suivi de backlog activé", confidence="certain"),
            AIEvidenceLine(label="Priorités à affiner selon la capacité équipe", confidence="inferred"),
        ],
        "memoire": [
            AIEvidenceLine(label="Mise à jour ou lecture de mémoire topic", confidence="certain"),
        ],
        "transformation": [
            AIEvidenceLine(label="Transformation de données ou migration détectée", confidence="certain"),
            AIEvidenceLine(label="Validation des règles métier nécessaire avant exécution", confidence="to_confirm"),
        ],
    }
    return evidence_map.get(mode, [AIEvidenceLine(label="Mode généraliste activé", confidence="certain")])

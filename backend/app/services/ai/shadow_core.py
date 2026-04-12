from app.schemas.ai import AIEvidenceLine


def detect_mode(user_request: str) -> str:
    lowered = user_request.lower()

    if any(token in lowered for token in ["ticket", "gherkin", "user story", "bug", "feature"]):
        return "ticket"
    if any(token in lowered for token in ["analyse", "cadrage", "sql", "roadmap"]):
        return "analysis"
    if any(token in lowered for token in ["document", "compte-rendu", "confluence", "spec"]):
        return "documentation"
    if any(token in lowered for token in ["pilotage", "backlog", "priorite", "kanban"]):
        return "tracking"
    return "direct"


def select_context_policy(topic_id: str | None, space_id: str | None, project_id: str | None) -> tuple[str, list[dict]]:
    sources: list[dict] = []

    if topic_id:
        sources.append({"kind": "topic", "label": topic_id})
        sources.append({"kind": "topic_memory", "label": f"{topic_id}:memory"})
        return "topic-first minimal context", sources

    if space_id:
        sources.append({"kind": "space", "label": space_id})
        return "space-first compact context", sources

    if project_id:
        sources.append({"kind": "project", "label": project_id})
        return "project-only fallback context", sources

    return "no persisted context", sources


def build_evidence(mode: str) -> list[AIEvidenceLine]:
    if mode == "ticket":
        return [
            AIEvidenceLine(label="Certain: ticket-shaped request detected", confidence="certain"),
            AIEvidenceLine(label="To confirm: acceptance details may require topic evidence", confidence="to_confirm"),
        ]
    if mode == "analysis":
        return [
            AIEvidenceLine(label="Certain: structured analysis requested", confidence="certain"),
            AIEvidenceLine(label="Inferred: related risks should be summarized before proposing actions", confidence="inferred"),
        ]
    return [
        AIEvidenceLine(label="Certain: lightweight answer path selected", confidence="certain"),
    ]

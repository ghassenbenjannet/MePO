from app.schemas.ai import AIContextSource


def build_context_snapshot(project_id: str | None, space_id: str | None, topic_id: str | None) -> list[AIContextSource]:
    context: list[AIContextSource] = []

    if project_id:
        context.append(AIContextSource(kind="project", label=project_id))
    if space_id:
        context.append(AIContextSource(kind="space", label=space_id))
    if topic_id:
        context.extend(
            [
                AIContextSource(kind="topic", label=topic_id),
                AIContextSource(kind="topic_memory", label=f"{topic_id}:facts-decisions-risks"),
                AIContextSource(kind="related_ticket", label="LIV-101"),
                AIContextSource(kind="related_document", label="Analyse d'impact multi-etablissements"),
            ]
        )

    return context

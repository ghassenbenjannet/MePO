from fastapi import APIRouter

from app.schemas.topic import TopicRead

router = APIRouter()


@router.get("", response_model=list[TopicRead])
def list_topics() -> list[TopicRead]:
    return [
        TopicRead(
            id="multi-establishments",
            space_id="s1-2026",
            title="Gestion multi-etablissements",
            description="Pilotage du sujet et de ses impacts fonctionnels.",
            status="active",
            priority="high",
        )
    ]

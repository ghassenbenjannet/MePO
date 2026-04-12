from fastapi import APIRouter

from app.schemas.ticket import TicketRead

router = APIRouter()


@router.get("", response_model=list[TicketRead])
def list_tickets() -> list[TicketRead]:
    return [
        TicketRead(
            id="LIV-101",
            topic_id="multi-establishments",
            type="feature",
            title="Ajouter la gestion des etablissements secondaires",
            description="Premier ticket d'exemple pour le backlog.",
            status="in_progress",
            priority="high",
        )
    ]

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.ticket import Ticket
from app.schemas.ticket import TicketCreate, TicketRead, TicketUpdate

router = APIRouter()


@router.get("", response_model=list[TicketRead])
def list_tickets(
    topic_id: str | None = Query(None),
    space_id: str | None = Query(None),
    db: Session = Depends(get_db),
) -> list[Ticket]:
    q = db.query(Ticket)
    if topic_id:
        q = q.filter(Ticket.topic_id == topic_id)
    elif space_id:
        # join through topics
        from app.models.topic import Topic
        topic_ids = [r[0] for r in db.query(Topic.id).filter(Topic.space_id == space_id).all()]
        q = q.filter(Ticket.topic_id.in_(topic_ids)) if topic_ids else q.filter(False)
    return q.order_by(Ticket.created_at.desc()).all()


@router.post("", response_model=TicketRead, status_code=status.HTTP_201_CREATED)
def create_ticket(payload: TicketCreate, db: Session = Depends(get_db)) -> Ticket:
    data = payload.model_dump()
    if not data.get("id"):
        data["id"] = str(uuid.uuid4())[:8].upper()
    ticket = Ticket(**data)
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


@router.get("/{ticket_id}", response_model=TicketRead)
def get_ticket(ticket_id: str, db: Session = Depends(get_db)) -> Ticket:
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    return ticket


@router.patch("/{ticket_id}", response_model=TicketRead)
def update_ticket(ticket_id: str, payload: TicketUpdate, db: Session = Depends(get_db)) -> Ticket:
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(ticket, field, value)
    ticket.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ticket)
    return ticket


@router.delete("/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ticket(ticket_id: str, db: Session = Depends(get_db)) -> None:
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    db.delete(ticket)
    db.commit()

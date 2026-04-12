import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.ai_conversation import AIConversation
from app.models.ai_message import AIMessage
from app.models.artifact import Artifact
from app.models.comment import Comment
from app.models.document import Document
from app.models.project import Project
from app.models.space import Space
from app.models.ticket import Ticket
from app.models.topic import Topic
from app.models.topic_memory import TopicMemory
from app.schemas.space import SpaceCreate, SpaceRead, SpaceUpdate

router = APIRouter()


def delete_space_descendants(db: Session, space_id: str) -> None:
    topic_ids = [row[0] for row in db.query(Topic.id).filter(Topic.space_id == space_id).all()]
    document_ids = [row[0] for row in db.query(Document.id).filter(Document.space_id == space_id).all()]
    conversation_ids = [row[0] for row in db.query(AIConversation.id).filter(AIConversation.space_id == space_id).all()]

    if conversation_ids:
        db.query(AIMessage).filter(AIMessage.conversation_id.in_(conversation_ids)).delete(synchronize_session=False)
        db.query(AIConversation).filter(AIConversation.id.in_(conversation_ids)).delete(synchronize_session=False)

    if document_ids:
        db.query(Comment).filter(Comment.document_id.in_(document_ids)).delete(synchronize_session=False)
        db.query(Document).filter(Document.id.in_(document_ids)).delete(synchronize_session=False)

    if topic_ids:
        ticket_ids = [row[0] for row in db.query(Ticket.id).filter(Ticket.topic_id.in_(topic_ids)).all()]
        if ticket_ids:
            db.query(Comment).filter(Comment.ticket_id.in_(ticket_ids)).delete(synchronize_session=False)
            db.query(Ticket).filter(Ticket.id.in_(ticket_ids)).delete(synchronize_session=False)

        db.query(Artifact).filter(Artifact.topic_id.in_(topic_ids)).delete(synchronize_session=False)
        db.query(TopicMemory).filter(TopicMemory.topic_id.in_(topic_ids)).delete(synchronize_session=False)
        db.query(Topic).filter(Topic.id.in_(topic_ids)).delete(synchronize_session=False)


@router.get("", response_model=list[SpaceRead])
def list_spaces(
    project_id: str | None = Query(None),
    db: Session = Depends(get_db),
) -> list[Space]:
    q = db.query(Space)
    if project_id:
        q = q.filter(Space.project_id == project_id)
    return q.order_by(Space.is_favorite.desc(), Space.start_date.desc(), Space.name.asc()).all()


@router.post("", response_model=SpaceRead, status_code=status.HTTP_201_CREATED)
def create_space(payload: SpaceCreate, db: Session = Depends(get_db)) -> Space:
    project = db.query(Project).filter(Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    space = Space(id=str(uuid.uuid4()), **payload.model_dump())
    db.add(space)
    db.commit()
    db.refresh(space)
    return space


@router.get("/{space_id}", response_model=SpaceRead)
def get_space(space_id: str, db: Session = Depends(get_db)) -> Space:
    space = db.query(Space).filter(Space.id == space_id).first()
    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")
    return space


@router.patch("/{space_id}", response_model=SpaceRead)
def update_space(space_id: str, payload: SpaceUpdate, db: Session = Depends(get_db)) -> Space:
    space = db.query(Space).filter(Space.id == space_id).first()
    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(space, field, value)
    db.commit()
    db.refresh(space)
    return space


@router.delete("/{space_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_space(space_id: str, db: Session = Depends(get_db)) -> None:
    space = db.query(Space).filter(Space.id == space_id).first()
    if not space:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Space not found")
    delete_space_descendants(db, space.id)
    db.delete(space)
    db.commit()

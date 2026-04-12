import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.ai_conversation import AIConversation
from app.models.ai_message import AIMessage
from app.models.comment import Comment
from app.models.document import Document
from app.models.membership import Membership
from app.models.project import Project
from app.models.space import Space
from app.models.ticket import Ticket
from app.models.topic import Topic
from app.models.topic_memory import TopicMemory
from app.models.artifact import Artifact
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate

router = APIRouter()


def delete_project_descendants(db: Session, project_id: str) -> None:
    space_ids = [row[0] for row in db.query(Space.id).filter(Space.project_id == project_id).all()]
    if not space_ids:
        db.query(Membership).filter(Membership.project_id == project_id).delete(synchronize_session=False)
        return

    topic_ids = [row[0] for row in db.query(Topic.id).filter(Topic.space_id.in_(space_ids)).all()]
    document_ids = [row[0] for row in db.query(Document.id).filter(Document.space_id.in_(space_ids)).all()]
    conversation_ids = [row[0] for row in db.query(AIConversation.id).filter(AIConversation.space_id.in_(space_ids)).all()]

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

    db.query(Space).filter(Space.id.in_(space_ids)).delete(synchronize_session=False)
    db.query(Membership).filter(Membership.project_id == project_id).delete(synchronize_session=False)


@router.get("", response_model=list[ProjectRead])
def list_projects(
    q: str | None = Query(default=None, min_length=1),
    db: Session = Depends(get_db),
) -> list[Project]:
    query = db.query(Project)
    if q:
        query = query.filter(Project.name.ilike(f"%{q}%"))
    return query.order_by(Project.created_at.desc()).all()


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)) -> Project:
    project = Project(id=str(uuid.uuid4()), **payload.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: str, db: Session = Depends(get_db)) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project(project_id: str, payload: ProjectUpdate, db: Session = Depends(get_db)) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: str, db: Session = Depends(get_db)) -> None:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    delete_project_descendants(db, project.id)
    db.delete(project)
    db.commit()


@router.get("/{project_id}/spaces", response_model=list)
def list_project_spaces(project_id: str, db: Session = Depends(get_db)) -> list[Space]:
    from app.schemas.space import SpaceRead
    spaces = db.query(Space).filter(Space.project_id == project_id).all()
    return [SpaceRead.model_validate(s) for s in spaces]


@router.get("/{project_id}/stats")
def project_stats(project_id: str, db: Session = Depends(get_db)) -> dict:
    """Quick aggregate counts for a project."""
    spaces = db.query(Space).filter(Space.project_id == project_id).count()
    space_ids = [r[0] for r in db.query(Space.id).filter(Space.project_id == project_id).all()]
    topics = db.query(Topic).filter(Topic.space_id.in_(space_ids)).count() if space_ids else 0
    topic_ids = [r[0] for r in db.query(Topic.id).filter(Topic.space_id.in_(space_ids)).all()] if space_ids else []
    tickets = db.query(Ticket).filter(Ticket.topic_id.in_(topic_ids)).count() if topic_ids else 0
    documents = db.query(Document).filter(Document.space_id.in_(space_ids)).count() if space_ids else 0
    return {"spaces": spaces, "topics": topics, "tickets": tickets, "documents": documents}

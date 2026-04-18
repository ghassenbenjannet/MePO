import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.topic import Topic
from app.schemas.topic import TopicCreate, TopicRead, TopicUpdate
from app.services.ai.workspace_cache import invalidate_workspace_cache

router = APIRouter()

TOPIC_COLORS = [
    "indigo",
    "blue",
    "emerald",
    "amber",
    "rose",
    "violet",
    "cyan",
    "orange",
    "lime",
    "slate",
]


@router.get("", response_model=list[TopicRead])
def list_topics(
    space_id: str | None = Query(None),
    db: Session = Depends(get_db),
) -> list[Topic]:
    q = db.query(Topic)
    if space_id:
        q = q.filter(Topic.space_id == space_id)
    return q.order_by(Topic.created_at.desc()).all()


@router.post("", response_model=TopicRead, status_code=status.HTTP_201_CREATED)
def create_topic(payload: TopicCreate, db: Session = Depends(get_db)) -> Topic:
    data = payload.model_dump()
    if not data.get("color"):
        data["color"] = TOPIC_COLORS[abs(hash(data["title"])) % len(TOPIC_COLORS)]
    topic = Topic(id=str(uuid.uuid4()), **data)
    db.add(topic)
    db.commit()
    db.refresh(topic)
    invalidate_workspace_cache(space_id=topic.space_id, topic_id=topic.id)
    return topic


@router.get("/{topic_id}", response_model=TopicRead)
def get_topic(topic_id: str, db: Session = Depends(get_db)) -> Topic:
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")
    return topic


@router.patch("/{topic_id}", response_model=TopicRead)
def update_topic(topic_id: str, payload: TopicUpdate, db: Session = Depends(get_db)) -> Topic:
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(topic, field, value)
    topic.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(topic)
    invalidate_workspace_cache(space_id=topic.space_id, topic_id=topic.id)
    return topic


@router.delete("/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_topic(topic_id: str, db: Session = Depends(get_db)) -> None:
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")
    space_id = topic.space_id
    db.delete(topic)
    db.commit()
    invalidate_workspace_cache(space_id=space_id, topic_id=topic_id)

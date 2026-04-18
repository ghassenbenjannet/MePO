import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.document import Document
from app.schemas.document import DocumentCreate, DocumentRead, DocumentUpdate
from app.services.ai.workspace_cache import invalidate_workspace_cache

router = APIRouter()


@router.get("", response_model=list[DocumentRead])
def list_documents(
    space_id: str | None = Query(None),
    topic_id: str | None = Query(None),
    parent_id: str | None = Query(None),
    type: str | None = Query(None),
    include_archived: bool = Query(False),
    db: Session = Depends(get_db),
) -> list[Document]:
    q = db.query(Document)
    if space_id:
        q = q.filter(Document.space_id == space_id)
    if topic_id:
        q = q.filter(Document.topic_id == topic_id)
    if parent_id is not None:
        # explicit None means "return root-level docs"
        if parent_id == "root":
            q = q.filter(Document.parent_id.is_(None))
        else:
            q = q.filter(Document.parent_id == parent_id)
    if type:
        q = q.filter(Document.type == type)
    if not include_archived:
        q = q.filter(Document.is_archived.is_(False))
    return q.order_by(Document.type, Document.title).all()


@router.post("", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
def create_document(payload: DocumentCreate, db: Session = Depends(get_db)) -> Document:
    doc = Document(id=str(uuid.uuid4()), **payload.model_dump())
    db.add(doc)
    db.commit()
    db.refresh(doc)
    invalidate_workspace_cache(space_id=doc.space_id, topic_id=doc.topic_id)
    return doc


@router.get("/{document_id}", response_model=DocumentRead)
def get_document(document_id: str, db: Session = Depends(get_db)) -> Document:
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc


@router.patch("/{document_id}", response_model=DocumentRead)
def update_document(document_id: str, payload: DocumentUpdate, db: Session = Depends(get_db)) -> Document:
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(doc, field, value)
    doc.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(doc)
    invalidate_workspace_cache(space_id=doc.space_id, topic_id=doc.topic_id)
    return doc


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: str, db: Session = Depends(get_db)) -> None:
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    space_id = doc.space_id
    topic_id = doc.topic_id
    # cascade: delete children first
    _delete_children(document_id, db)
    db.delete(doc)
    db.commit()
    invalidate_workspace_cache(space_id=space_id, topic_id=topic_id)


def _delete_children(parent_id: str, db: Session) -> None:
    children = db.query(Document).filter(Document.parent_id == parent_id).all()
    for child in children:
        _delete_children(child.id, db)
        db.delete(child)

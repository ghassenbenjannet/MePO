import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.space import Space
from app.schemas.space import SpaceCreate, SpaceRead, SpaceUpdate

router = APIRouter()


@router.get("", response_model=list[SpaceRead])
def list_spaces(
    project_id: str | None = Query(None),
    db: Session = Depends(get_db),
) -> list[Space]:
    q = db.query(Space)
    if project_id:
        q = q.filter(Space.project_id == project_id)
    return q.all()


@router.post("", response_model=SpaceRead, status_code=status.HTTP_201_CREATED)
def create_space(payload: SpaceCreate, db: Session = Depends(get_db)) -> Space:
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
    db.delete(space)
    db.commit()

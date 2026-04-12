from datetime import date

from pydantic import BaseModel, Field


class SpaceCreate(BaseModel):
    project_id: str
    name: str = Field(min_length=1, max_length=255)
    status: str = "active"
    description: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_favorite: bool = False
    progress: int = 0


class SpaceUpdate(BaseModel):
    name: str | None = None
    status: str | None = None
    description: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_favorite: bool | None = None
    progress: int | None = None


class SpaceRead(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    project_id: str
    name: str
    status: str = "active"
    description: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_favorite: bool = False
    progress: int = 0

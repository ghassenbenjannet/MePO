from datetime import datetime

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    image_url: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    image_url: str | None = None


class ProjectRead(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    name: str
    description: str | None = None
    image_url: str | None = None
    created_at: datetime | None = None

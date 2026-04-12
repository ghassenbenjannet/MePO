from datetime import datetime

from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    color: str = "from-indigo-500 to-purple-500"
    icon: str = "P"


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    color: str | None = None
    icon: str | None = None


class ProjectRead(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    name: str
    description: str | None = None
    color: str = "from-indigo-500 to-purple-500"
    icon: str = "P"
    created_at: datetime | None = None

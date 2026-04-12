from pydantic import BaseModel


class SpaceCreate(BaseModel):
    project_id: str
    name: str
    status: str = "planning"
    summary: str | None = None
    progress: int = 0
    start_date: str | None = None
    end_date: str | None = None


class SpaceUpdate(BaseModel):
    name: str | None = None
    status: str | None = None
    summary: str | None = None
    progress: int | None = None
    start_date: str | None = None
    end_date: str | None = None


class SpaceRead(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    project_id: str
    name: str
    status: str = "planning"
    summary: str | None = None
    progress: int = 0
    start_date: str | None = None
    end_date: str | None = None

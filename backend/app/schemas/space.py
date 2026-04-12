from pydantic import BaseModel


class SpaceRead(BaseModel):
    id: str
    project_id: str
    name: str
    start_date: str | None = None
    end_date: str | None = None

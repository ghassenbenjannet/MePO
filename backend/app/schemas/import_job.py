from pydantic import BaseModel


class ImportJobRead(BaseModel):
    id: str
    source: str
    status: str
    config: dict

from pydantic import BaseModel, EmailStr


class MembershipRead(BaseModel):
    id: str
    user_id: str
    project_id: str
    role: str


class MembershipCreate(BaseModel):
    email: EmailStr
    project_id: str
    role: str


class MembershipUpdate(BaseModel):
    role: str


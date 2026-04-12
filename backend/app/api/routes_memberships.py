from fastapi import APIRouter

from app.schemas.membership import MembershipCreate, MembershipRead, MembershipUpdate

router = APIRouter()


@router.get("", response_model=list[MembershipRead])
def list_memberships() -> list[MembershipRead]:
    return [
        MembershipRead(id="membership-1", user_id="user-1", project_id="hcl-livret", role="admin"),
        MembershipRead(id="membership-2", user_id="user-2", project_id="hcl-livret", role="editor"),
    ]


@router.post("", response_model=MembershipRead)
def create_membership(payload: MembershipCreate) -> MembershipRead:
    return MembershipRead(id="membership-3", user_id="user-invited", project_id=payload.project_id, role=payload.role)


@router.patch("/{membership_id}", response_model=MembershipRead)
def update_membership(membership_id: str, payload: MembershipUpdate) -> MembershipRead:
    return MembershipRead(id=membership_id, user_id="user-invited", project_id="hcl-livret", role=payload.role)


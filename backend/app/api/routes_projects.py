from fastapi import APIRouter

from app.schemas.project import ProjectRead

router = APIRouter()


@router.get("", response_model=list[ProjectRead])
def list_projects() -> list[ProjectRead]:
    return [
        ProjectRead(
            id="hcl-livret",
            name="HCL - Livret",
            description="Migration product ops for a multi-team banking initiative.",
        )
    ]

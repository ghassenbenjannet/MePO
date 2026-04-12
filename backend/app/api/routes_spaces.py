from fastapi import APIRouter

from app.schemas.space import SpaceRead

router = APIRouter()


@router.get("", response_model=list[SpaceRead])
def list_spaces() -> list[SpaceRead]:
    return [
        SpaceRead(
            id="s1-2026",
            project_id="hcl-livret",
            name="S1 2026",
            start_date="2026-01-01",
            end_date="2026-06-30",
        )
    ]

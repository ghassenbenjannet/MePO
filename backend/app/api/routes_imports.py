from fastapi import APIRouter

from app.schemas.import_job import ImportJobRead

router = APIRouter()


@router.get("", response_model=list[ImportJobRead])
def list_import_jobs() -> list[ImportJobRead]:
    return [
        ImportJobRead(
            id="job-1",
            source="jira",
            status="pending",
            config={"projectKey": "LIV"},
        )
    ]

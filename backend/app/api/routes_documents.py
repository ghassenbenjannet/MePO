from fastapi import APIRouter

from app.schemas.document import DocumentRead

router = APIRouter()


@router.get("", response_model=list[DocumentRead])
def list_documents() -> list[DocumentRead]:
    return [
        DocumentRead(
            id="doc-1",
            space_id="s1-2026",
            topic_id="multi-establishments",
            title="Analyse d'impact multi-etablissements",
            content="# Analyse\n\nContenu d'exemple.",
            parent_id=None,
        )
    ]

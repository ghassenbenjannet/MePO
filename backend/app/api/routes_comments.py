from fastapi import APIRouter

from app.schemas.comment import CommentCreate, CommentRead

router = APIRouter()


@router.get("", response_model=list[CommentRead])
def list_comments() -> list[CommentRead]:
    return [
        CommentRead(
            id="comment-1",
            author_id="user-1",
            ticket_id="LIV-101",
            document_id=None,
            content="Verifier la non-regression sur les habilitations secondaires.",
            created_at="2026-04-12T09:42:00Z",
        )
    ]


@router.post("", response_model=CommentRead)
def create_comment(payload: CommentCreate) -> CommentRead:
    return CommentRead(
        id="comment-2",
        author_id="user-1",
        ticket_id=payload.ticket_id,
        document_id=payload.document_id,
        content=payload.content,
        created_at="2026-04-12T11:00:00Z",
    )

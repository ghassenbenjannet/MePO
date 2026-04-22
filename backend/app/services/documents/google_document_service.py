from __future__ import annotations

import hashlib
import os
import tempfile
from dataclasses import dataclass

from app.core.config import settings
from app.models.document import Document


@dataclass
class GoogleDocumentProjection:
    google_file_id: str
    google_web_url: str
    google_mime_type: str
    content_hash: str
    used_stub: bool


def _build_document_text(document: Document) -> str:
    return "\n".join(
        [
            f"title: {document.title}",
            f"type: {document.type}",
            "",
            document.content or "",
        ]
    ).strip()


def _hash_content(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _build_stub_projection(document: Document, content_hash: str) -> GoogleDocumentProjection:
    token = f"{document.id}-{content_hash[:12]}"
    return GoogleDocumentProjection(
        google_file_id=f"gdoc_{token}",
        google_web_url=f"https://mepo.local/google-docs/{token}",
        google_mime_type="text/plain",
        content_hash=content_hash,
        used_stub=True,
    )


def project_document_to_google(document: Document) -> GoogleDocumentProjection:
    text_content = _build_document_text(document)
    content_hash = _hash_content(text_content)

    if not settings.google_api_key:
        return _build_stub_projection(document, content_hash)

    try:
        import google.generativeai as genai
    except Exception:
        return _build_stub_projection(document, content_hash)

    try:
        genai.configure(api_key=settings.google_api_key)
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".txt", delete=False) as handle:
            handle.write(text_content)
            temp_path = handle.name
        try:
            uploaded = genai.upload_file(path=temp_path, display_name=document.title[:128] or "MePO document")
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

        google_file_id = getattr(uploaded, "name", None) or f"gdoc_{document.id}"
        google_web_url = getattr(uploaded, "uri", None) or f"https://mepo.local/google-docs/{google_file_id}"
        google_mime_type = getattr(uploaded, "mime_type", None) or "text/plain"
        return GoogleDocumentProjection(
            google_file_id=google_file_id,
            google_web_url=google_web_url,
            google_mime_type=google_mime_type,
            content_hash=content_hash,
            used_stub=False,
        )
    except Exception:
        return _build_stub_projection(document, content_hash)

from __future__ import annotations

import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


def create_openai_conversation(
    *,
    metadata: dict[str, str] | None = None,
    items: list[dict] | None = None,
) -> str | None:
    if not settings.openai_api_key or not settings.openai_model:
        return None

    try:
        from openai import OpenAI
    except ImportError:
        logger.warning("openai package not installed; OpenAI conversation creation skipped")
        return None

    client = OpenAI(api_key=settings.openai_api_key)
    conversations_api = getattr(client, "conversations", None)
    if conversations_api is None or not hasattr(conversations_api, "create"):
        logger.warning("OpenAI Conversations API not available in installed SDK")
        return None

    try:
        payload: dict = {}
        if metadata:
            payload["metadata"] = metadata
        if items:
            payload["items"] = items
        conversation = conversations_api.create(**payload)
        conversation_id = getattr(conversation, "id", None)
        return str(conversation_id).strip() or None
    except Exception as exc:
        logger.warning("OpenAI conversation creation failed: %s", exc)
        return None

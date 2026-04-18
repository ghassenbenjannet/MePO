from __future__ import annotations

import io

from app.core.config import settings


class OpenAIKnowledgeGateway:
    def __init__(self) -> None:
        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY is not configured")
        from openai import OpenAI

        self.client = OpenAI(api_key=settings.openai_api_key)
        beta_api = getattr(self.client, "beta", None)
        self._vector_stores_api = getattr(beta_api, "vector_stores", None) or getattr(
            self.client, "vector_stores", None
        )
        if self._vector_stores_api is None:
            raise RuntimeError("OpenAI vector store API is not available in the installed SDK")

    def _call_with_vector_store_id(self, method_name: str, vector_store_id: str, **kwargs):
        method = getattr(self._vector_stores_api, method_name)
        try:
            return method(vector_store_id=vector_store_id, **kwargs)
        except TypeError:
            return method(vector_store_id, **kwargs)

    def _call_files_api(self, method_name: str, vector_store_id: str, **kwargs):
        files_api = getattr(self._vector_stores_api, "files", None)
        if files_api is None:
            raise RuntimeError("OpenAI vector store files API is not available in the installed SDK")
        method = getattr(files_api, method_name)
        try:
            return method(vector_store_id=vector_store_id, **kwargs)
        except TypeError:
            return method(vector_store_id, **kwargs)

    def retrieve_vector_store(self, vector_store_id: str) -> object:
        return self._call_with_vector_store_id("retrieve", vector_store_id)

    def list_vector_store_file_ids(self, vector_store_id: str) -> set[str]:
        page = self._call_files_api("list", vector_store_id, limit=100)
        return {item.id for item in page.data}

    def upload_text_file(self, filename: str, content: str) -> str:
        payload = io.BytesIO(content.encode("utf-8"))
        response = self.client.files.create(
            file=(filename, payload, "text/plain"),
            purpose="assistants",
        )
        return response.id

    def attach_file_to_vector_store(self, vector_store_id: str, file_id: str) -> None:
        self._call_files_api("create", vector_store_id, file_id=file_id)

    def remove_file_from_vector_store(self, vector_store_id: str, file_id: str) -> None:
        self._call_files_api("delete", vector_store_id, file_id=file_id)

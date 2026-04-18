from __future__ import annotations

import html
import io
import json
import re
import zipfile
from pathlib import Path


def _decode_text_bytes(data: bytes) -> str:
    for encoding in ("utf-8", "utf-8-sig", "cp1252", "latin-1"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("latin-1", errors="ignore")


def _strip_xml_tags(value: str) -> str:
    value = re.sub(r"</w:p>", "\n", value)
    value = re.sub(r"</(?:w:tr|row)>", "\n", value)
    value = re.sub(r"</(?:w:tc|c)>", "\t", value)
    value = re.sub(r"<[^>]+>", "", value)
    return html.unescape(value)


def _extract_docx_text(data: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        xml = archive.read("word/document.xml").decode("utf-8", errors="ignore")
    return _strip_xml_tags(xml)


def _extract_xlsx_text(data: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared_xml = archive.read("xl/sharedStrings.xml").decode("utf-8", errors="ignore")
            shared_strings = [item.strip() for item in _strip_xml_tags(shared_xml).splitlines() if item.strip()]

        lines: list[str] = []
        for name in archive.namelist():
            if not name.startswith("xl/worksheets/") or not name.endswith(".xml"):
                continue
            xml = archive.read(name).decode("utf-8", errors="ignore")
            values = re.findall(r"<v>(.*?)</v>", xml)
            row_values: list[str] = []
            for raw in values:
                if raw.isdigit() and shared_strings:
                    idx = int(raw)
                    row_values.append(shared_strings[idx] if idx < len(shared_strings) else raw)
                else:
                    row_values.append(raw)
            if row_values:
                lines.append(", ".join(row_values))
        return "\n".join(lines)


def _extract_pdf_text(data: bytes) -> str:
    text = _decode_text_bytes(data)
    matches = re.findall(r"\(([^()]*)\)", text)
    if matches:
        return "\n".join(match.strip() for match in matches if match.strip())
    cleaned = re.sub(r"[^A-Za-z0-9À-ÿ\n\r\t .,:;!?()/_-]+", " ", text)
    cleaned = re.sub(r"\s{2,}", " ", cleaned)
    return cleaned


def extract_text_from_file(filename: str, mime_type: str | None, data: bytes) -> str:
    suffix = Path(filename).suffix.lower()
    mime = (mime_type or "").lower()

    if suffix in {".txt", ".md", ".markdown", ".csv", ".sql", ".mermaid"} or mime.startswith("text/"):
        return _decode_text_bytes(data)

    if suffix in {".json"} or mime == "application/json":
        parsed = json.loads(_decode_text_bytes(data))
        return json.dumps(parsed, ensure_ascii=False, indent=2)

    if suffix in {".html", ".htm"} or mime in {"text/html", "application/xhtml+xml"}:
        return re.sub(r"\n{3,}", "\n\n", _strip_xml_tags(_decode_text_bytes(data))).strip()

    if suffix == ".docx" or mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return _extract_docx_text(data)

    if suffix == ".xlsx" or mime == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        return _extract_xlsx_text(data)

    if suffix == ".pdf" or mime == "application/pdf":
        return _extract_pdf_text(data)

    raise ValueError(f"Format non supporté pour extraction: {suffix or mime or 'inconnu'}")

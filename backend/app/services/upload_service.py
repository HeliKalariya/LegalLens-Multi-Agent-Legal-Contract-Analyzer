"""Local PDF storage and persisted analysis reports."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from pypdf import PdfReader

from app.config import settings
from app.workflows.analysis_workflow import build_contract_report


class UploadService:
    def __init__(self) -> None:
        self.pdf_directory = settings.PDF_UPLOAD_DIR
        self.index_path = settings.UPLOAD_DIR / "documents.json"

    def save_pdf(self, filename: str, file_bytes: bytes) -> dict:
        document_id = str(uuid.uuid4())
        stored_filename = f"{document_id}.pdf"
        (self.pdf_directory / stored_filename).write_bytes(file_bytes)
        document = {
            "document_id": document_id,
            "original_filename": filename,
            "stored_filename": stored_filename,
            "size": len(file_bytes),
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
        }
        documents = self._read_index()
        documents.insert(0, document)
        self._write_index(documents)
        return self._public_document(document)

    def list_documents(self) -> list[dict]:
        return [self._public_document(document) for document in self._read_index()]

    def get_pdf_path(self, document_id: str) -> Path | None:
        document = self._find_document(document_id)
        if not document:
            return None
        path = self.pdf_directory / document["stored_filename"]
        return path if path.is_file() else None

    def analyze_pdf(self, document_id: str) -> dict:
        documents = self._read_index()
        document = next((item for item in documents if item["document_id"] == document_id), None)
        file_path = self.get_pdf_path(document_id)
        if not document or not file_path:
            raise FileNotFoundError("PDF not found.")
        try:
            reader = PdfReader(file_path)
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as error:
            raise ValueError("This PDF cannot be read for analysis.") from error
        if not text.strip():
            raise ValueError("This PDF does not contain readable text for analysis.")

        report = build_contract_report(document["original_filename"], text, len(reader.pages))
        document["analysis"] = report
        self._write_index(documents)
        return report

    def get_analysis(self, document_id: str) -> dict | None:
        document = self._find_document(document_id)
        return document.get("analysis") if document else None

    def _find_document(self, document_id: str) -> dict | None:
        return next((item for item in self._read_index() if item["document_id"] == document_id), None)

    def _read_index(self) -> list[dict]:
        if not self.index_path.exists():
            return []
        try:
            return json.loads(self.index_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return []

    def _write_index(self, documents: list[dict]) -> None:
        temporary_path = self.index_path.with_suffix(".tmp")
        temporary_path.write_text(json.dumps(documents, indent=2), encoding="utf-8")
        temporary_path.replace(self.index_path)

    @staticmethod
    def _public_document(document: dict) -> dict:
        return {key: value for key, value in document.items() if key not in {"stored_filename", "analysis"}}

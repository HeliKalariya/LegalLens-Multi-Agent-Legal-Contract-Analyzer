"""Local file storage used by the development upload API."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from pypdf import PdfReader

from app.config import settings


class UploadService:
    """Saves PDFs locally and keeps a small JSON index for the frontend."""

    def __init__(self) -> None:
        self.pdf_directory = settings.PDF_UPLOAD_DIR
        self.index_path = settings.UPLOAD_DIR / "documents.json"

    def save_pdf(self, filename: str, file_bytes: bytes) -> dict:
        """Save one PDF under a generated name and return public metadata."""
        document_id = str(uuid.uuid4())
        stored_filename = f"{document_id}.pdf"
        file_path = self.pdf_directory / stored_filename
        file_path.write_bytes(file_bytes)

        document = {
            "document_id": document_id,
            "original_filename": filename,
            "stored_filename": stored_filename,
            "size": len(file_bytes),
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
        }
        documents = self.list_documents()
        documents.insert(0, document)
        self._write_index(documents)
        return document

    def list_documents(self) -> list[dict]:
        """Return saved PDF metadata, newest first."""
        if not self.index_path.exists():
            return []

        try:
            return json.loads(self.index_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return []

    def get_pdf_path(self, document_id: str) -> Path | None:
        """Find a saved PDF only when its ID exists in the local index."""
        document = next(
            (item for item in self.list_documents() if item["document_id"] == document_id),
            None,
        )
        if not document:
            return None

        file_path = self.pdf_directory / document["stored_filename"]
        return file_path if file_path.is_file() else None

    def analyze_pdf(self, document_id: str) -> dict:
        """Extract PDF text and allow analysis only for legal-contract content."""
        file_path = self.get_pdf_path(document_id)
        if not file_path:
            raise FileNotFoundError("PDF not found.")

        try:
            text = "\n".join(page.extract_text() or "" for page in PdfReader(file_path).pages)
        except Exception as error:
            raise ValueError("This PDF cannot be read for analysis.") from error

        normalized_text = text.lower()
        legal_terms = (
            "agreement", "party", "parties", "contract", "clause", "terms",
            "confidential", "liability", "governing law", "termination",
        )
        matched_terms = [term for term in legal_terms if term in normalized_text]
        if len(matched_terms) < 3:
            raise ValueError("This does not appear to be a legal document and cannot be analyzed here.")

        risk_terms = ("indemnity", "liability", "penalty", "termination", "arbitration")
        matched_risks = [term for term in risk_terms if term in normalized_text]
        document_type = "Non-disclosure agreement" if "non-disclosure" in normalized_text or "nda" in normalized_text else "Legal contract"
        return {
            "document_type": document_type,
            "legal_signals": matched_terms,
            "risk_topics": matched_risks,
            "message": "Legal document analysis completed successfully.",
        }

    def _write_index(self, documents: list[dict]) -> None:
        """Write metadata atomically so the list stays valid after an interruption."""
        temporary_path = self.index_path.with_suffix(".tmp")
        temporary_path.write_text(json.dumps(documents, indent=2), encoding="utf-8")
        temporary_path.replace(self.index_path)

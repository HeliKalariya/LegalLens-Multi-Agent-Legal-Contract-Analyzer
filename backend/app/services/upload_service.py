"""Local PDF storage backed by the application's database."""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from io import BytesIO
from pathlib import Path

from pypdf import PdfReader
from sqlalchemy.orm import Session

from app.config import settings
from app.models.document import Document


class UploadService:
    """Validates legal PDFs and keeps each user's upload history separate."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.pdf_directory = settings.PDF_UPLOAD_DIR

    def save_pdf(self, user_id: int, filename: str, file_bytes: bytes) -> dict:
        """Validate first, then save only legal PDFs and their database record."""
        legal_signals, risk_topics = self._inspect_legal_document(file_bytes)
        document_id = str(uuid.uuid4())
        stored_filename = f"{document_id}.pdf"
        file_path = self.pdf_directory / stored_filename

        try:
            file_path.write_bytes(file_bytes)
            document = Document(
                id=document_id,
                user_id=user_id,
                original_filename=filename,
                stored_filename=stored_filename,
                size=len(file_bytes),
                legal_signals=json.dumps(legal_signals),
                risk_topics=json.dumps(risk_topics),
            )
            self.db.add(document)
            self.db.commit()
            self.db.refresh(document)
        except Exception:
            self.db.rollback()
            file_path.unlink(missing_ok=True)
            raise

        return self._serialize(document)

    def list_documents(self, user_id: int) -> list[dict]:
        """Return only the saved documents owned by the authenticated user."""
        documents = (
            self.db.query(Document)
            .filter(Document.user_id == user_id)
            .order_by(Document.created_at.desc())
            .all()
        )
        return [self._serialize(document) for document in documents]

    def get_pdf_path(self, user_id: int, document_id: str) -> Path | None:
        """Find a PDF only if it belongs to the current user."""
        document = self._get_document(user_id, document_id)
        if not document:
            return None
        file_path = self.pdf_directory / document.stored_filename
        return file_path if file_path.is_file() else None

    def analyze_pdf(self, user_id: int, document_id: str) -> dict:
        """Store the completed analysis for the document's user history."""
        document = self._get_document(user_id, document_id)
        if not document:
            raise FileNotFoundError("PDF not found.")

        file_path = self.pdf_directory / document.stored_filename
        if not file_path.is_file():
            raise FileNotFoundError("PDF file is missing from local storage.")

        legal_signals, risk_topics = self._inspect_legal_document(file_path.read_bytes())
        document.analysis_status = "analyzed"
        document.legal_signals = json.dumps(legal_signals)
        document.risk_topics = json.dumps(risk_topics)
        document.analyzed_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(document)
        return self._serialize(document)

    def _get_document(self, user_id: int, document_id: str) -> Document | None:
        return (
            self.db.query(Document)
            .filter(Document.id == document_id, Document.user_id == user_id)
            .first()
        )

    @staticmethod
    def _inspect_legal_document(file_bytes: bytes) -> tuple[list[str], list[str]]:
        """Require several legal signals before any PDF is stored or analyzed."""
        try:
            text = "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(file_bytes)).pages).lower()
        except Exception as error:
            raise ValueError("This PDF cannot be read for legal analysis.") from error

        legal_terms = (
            "agreement", "party", "parties", "contract", "clause", "terms",
            "confidential", "liability", "governing law", "termination",
        )
        legal_signals = [term for term in legal_terms if term in text]
        if len(legal_signals) < 3:
            raise ValueError("This does not appear to be a legal document and cannot be stored or analyzed here.")

        risk_terms = ("indemnity", "liability", "penalty", "termination", "arbitration")
        return legal_signals, [term for term in risk_terms if term in text]

    @staticmethod
    def _serialize(document: Document) -> dict:
        return {
            "document_id": document.id,
            "original_filename": document.original_filename,
            "size": document.size,
            "uploaded_at": document.created_at.isoformat(),
            "analysis_status": document.analysis_status,
            "legal_signals": json.loads(document.legal_signals),
            "risk_topics": json.loads(document.risk_topics),
        }

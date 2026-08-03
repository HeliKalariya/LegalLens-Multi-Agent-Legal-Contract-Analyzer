"""Per-user PDF storage and analysis history backed by SQLAlchemy."""

from __future__ import annotations

import json
import logging
import hashlib
import uuid
from datetime import datetime
from io import BytesIO
from pathlib import Path

from pypdf import PdfReader
from sqlalchemy.orm import Session

from app.config import settings
from app.models.document import Document
from app.schemas.report import ClauseRisk
from app.services.llm_providers.groq_client import GroqClassificationError, classify_document
from app.workflows.extraction_workflow import extract_clause_risks
from app.workflows.report_workflow import SUPPORTED_LANGUAGES, build_report

logger = logging.getLogger(__name__)


class NotALegalDocumentError(Exception):
    """Raised when the PDF does not contain legal-document content."""


class UnsupportedLanguageError(Exception):
    """Raised when a report language is not supported."""


_LEGAL_KEYWORD_CATEGORIES = [
    ["agreement", "contract", "memorandum of understanding", "mou", "terms and conditions", "nda", "non-disclosure"],
    ["party", "parties", "the undersigned", "hereinafter referred to as", "witnesseth"],
    ["governing law", "jurisdiction", "arbitration", "dispute resolution", "venue"],
    ["indemnify", "indemnification", "liability", "warranty", "breach", "termination"],
    ["whereas", "force majeure", "severability", "confidentiality", "obligations"],
]


class UploadService:
    """Stores only legal PDFs and limits every operation to the owning user."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.pdf_directory = settings.PDF_UPLOAD_DIR

    def save_pdf(self, user_id: int, filename: str, file_bytes: bytes) -> dict:
        """Validate before writing so non-legal PDFs are never stored."""
        text, page_count = self._read_pdf(file_bytes)
        self._ensure_is_legal_document(text)

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
                content_type="application/pdf",
                size=len(file_bytes),
                storage_path=file_path.relative_to(settings.BASE_DIR).as_posix(),
                # This is an API path, not a public file-system URL. Ownership is checked on every request.
                file_url=f"/api/upload/{document_id}/preview",
                sha256=hashlib.sha256(file_bytes).hexdigest(),
                page_count=page_count,
            )
            self.db.add(document)
            self.db.commit()
            self.db.refresh(document)
            return self._public_document(document)
        except Exception:
            self.db.rollback()
            file_path.unlink(missing_ok=True)
            raise

    def list_documents(self, user_id: int) -> list[dict]:
        documents = self.db.query(Document).filter(Document.user_id == user_id).order_by(Document.created_at.desc()).all()
        return [self._public_document(document) for document in documents]

    def get_pdf_path(self, user_id: int, document_id: str) -> Path | None:
        document = self._get_document(user_id, document_id)
        if not document:
            return None
        file_path = self.pdf_directory / document.stored_filename
        return file_path if file_path.is_file() else None

    def analyze_pdf(self, user_id: int, document_id: str) -> dict:
        """Generate and persist the English report in the owner's history."""
        document = self._require_document(user_id, document_id)
        file_path = self.get_pdf_path(user_id, document_id)
        if not file_path:
            raise FileNotFoundError("PDF file is missing from local storage.")

        text, total_pages = self._read_pdf(file_path.read_bytes())
        self._ensure_is_legal_document(text)
        clause_risks = extract_clause_risks(text)
        report = build_report(document.original_filename, total_pages, clause_risks, language="en")
        document.analysis_status = "analyzed"
        document.legal_signals = json.dumps(self._legal_signals(text))
        document.risk_topics = json.dumps([item.risk_level for item in clause_risks])
        document.analysis_data = json.dumps({
            "total_pages": total_pages,
            "clause_risks": [item.model_dump() for item in clause_risks],
            "reports": {"en": report},
        })
        document.analyzed_at = datetime.utcnow()
        self.db.commit()
        return report

    def get_report(self, user_id: int, document_id: str, language: str = "en") -> dict | None:
        if language not in SUPPORTED_LANGUAGES:
            raise UnsupportedLanguageError(f"Language '{language}' is not supported.")
        document = self._get_document(user_id, document_id)
        if not document:
            return None
        data = json.loads(document.analysis_data or "{}")
        if "clause_risks" not in data:
            return None
        if language not in data.get("reports", {}):
            clause_risks = [ClauseRisk(**item) for item in data["clause_risks"]]
            data.setdefault("reports", {})[language] = build_report(document.original_filename, data["total_pages"], clause_risks, language)
            document.analysis_data = json.dumps(data)
            self.db.commit()
        return data["reports"][language]

    def _get_document(self, user_id: int, document_id: str) -> Document | None:
        return self.db.query(Document).filter(Document.id == document_id, Document.user_id == user_id).first()

    def _require_document(self, user_id: int, document_id: str) -> Document:
        document = self._get_document(user_id, document_id)
        if not document:
            raise FileNotFoundError("PDF not found.")
        return document

    @staticmethod
    def _read_pdf(file_bytes: bytes) -> tuple[str, int]:
        try:
            reader = PdfReader(BytesIO(file_bytes))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception as error:
            raise ValueError("This PDF cannot be read for analysis.") from error
        if not text.strip():
            raise ValueError("This PDF does not contain readable text for analysis.")
        return text, len(reader.pages)

    @staticmethod
    def _legal_signals(text: str) -> list[str]:
        lowered = text.lower()
        return [category[0] for category in _LEGAL_KEYWORD_CATEGORIES if any(term in lowered for term in category)]

    @classmethod
    def _ensure_is_legal_document(cls, text: str) -> None:
        try:
            result = classify_document(text)
            if not result["is_legal_document"] or (result["confidence"] is not None and result["confidence"] < 0.6):
                raise NotALegalDocumentError("This PDF does not appear to be a legal document and cannot be stored or analyzed here.")
        except GroqClassificationError as error:
            logger.warning("Legal classification unavailable; using local keyword check: %s", error)
            if len(cls._legal_signals(text)) < 2:
                raise NotALegalDocumentError("This PDF does not contain enough legal-contract language and cannot be stored or analyzed here.")

    @staticmethod
    def _public_document(document: Document) -> dict:
        return {
            "document_id": document.id,
            "original_filename": document.original_filename,
            "size": document.size,
            "content_type": document.content_type,
            "page_count": document.page_count,
            "file_url": document.file_url,
            "uploaded_at": document.created_at.isoformat(),
            "analysis_status": document.analysis_status,
        }

"""Local PDF storage, cached clause extraction, and language-specific report generation."""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

from pypdf import PdfReader

from app.config import settings
from app.schemas.report import ClauseRisk
from app.services.llm_providers.groq_client import GroqClassificationError, classify_document
from app.workflows.extraction_workflow import extract_clause_risks
from app.workflows.report_workflow import SUPPORTED_LANGUAGES, build_report

logger = logging.getLogger(__name__)


class NotALegalDocumentError(Exception):
    def __init__(self, reason: str = "This document does not appear to be a legal document."):
        self.reason = reason
        super().__init__(reason)


class UnsupportedLanguageError(Exception):
    def __init__(self, language: str):
        self.language = language
        super().__init__(f"Language '{language}' is not supported.")


_LEGAL_KEYWORD_CATEGORIES: list[list[str]] = [
    ["agreement", "contract", "memorandum of understanding", "mou", "terms and conditions",
     "terms of service", "lease", "deed", "license agreement", "nda", "non-disclosure"],
    ["party", "parties", "the undersigned", "hereinafter referred to as", "witnesseth"],
    ["governing law", "jurisdiction", "arbitration", "dispute resolution", "venue"],
    ["indemnify", "indemnification", "liability", "warranty", "breach", "termination clause"],
    ["whereas", "in witness whereof", "force majeure", "severability", "confidentiality"],
    ["effective date", "term of agreement", "obligations", "covenant", "consideration"],
]
_MIN_CATEGORY_HITS = 2
_MIN_CONFIDENCE = 0.6


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
        """Runs structural extraction ONCE (language-agnostic) and generates the English report.
        Other languages are generated on demand via get_report()."""
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

        self._ensure_is_legal_document(text)

        clause_risks = extract_clause_risks(text)
        document["clause_risks"] = [c.model_dump() for c in clause_risks]
        document["total_pages"] = len(reader.pages)

        report = build_report(document["original_filename"], len(reader.pages), clause_risks, language="en")
        document["reports"] = {"en": report}
        self._write_index(documents)
        return report

    def get_report(self, document_id: str, language: str = "en") -> dict | None:
        if language not in SUPPORTED_LANGUAGES:
            raise UnsupportedLanguageError(language)

        document = self._find_document(document_id)
        if not document or "clause_risks" not in document:
            return None

        reports = document.get("reports", {})
        if language in reports:
            return reports[language]

        # Structural data already exists — only the (cheap) narrative pass runs for a new language.
        clause_risks = [ClauseRisk(**c) for c in document["clause_risks"]]
        report = build_report(document["original_filename"], document["total_pages"], clause_risks, language)

        documents = self._read_index()
        for item in documents:
            if item["document_id"] == document_id:
                item.setdefault("reports", {})[language] = report
        self._write_index(documents)
        return report

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
        return {
            key: value
            for key, value in document.items()
            if key not in {"stored_filename", "clause_risks", "reports"}
        }

    @staticmethod
    def _ensure_is_legal_document(text: str) -> None:
        try:
            result = classify_document(text)
        except GroqClassificationError as error:
            logger.warning("Groq classification failed (%s); falling back to keyword heuristic.", error)
            UploadService._ensure_is_legal_document_heuristic(text)
            return

        if not result["is_legal_document"] or (
            result["confidence"] is not None and result["confidence"] < _MIN_CONFIDENCE
        ):
            raise NotALegalDocumentError(
                f"This PDF doesn't appear to be a legal document (detected type: {result['document_type']}). "
                "LegalLens only analyzes legal documents such as contracts, agreements, NDAs, leases, "
                "and terms of service."
            )

    @staticmethod
    def _ensure_is_legal_document_heuristic(text: str) -> None:
        lowered = text.lower()
        matched = sum(
            1 for category in _LEGAL_KEYWORD_CATEGORIES if any(keyword in lowered for keyword in category)
        )
        if matched < _MIN_CATEGORY_HITS:
            raise NotALegalDocumentError(
                "This PDF doesn't contain language typically found in legal documents "
                "(contracts, agreements, terms, NDAs, leases, etc.). LegalLens only analyzes legal documents."
            )
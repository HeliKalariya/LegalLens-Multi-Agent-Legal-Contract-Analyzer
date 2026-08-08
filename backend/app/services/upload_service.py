"""Per-user PDF storage and analysis history backed by SQLAlchemy."""

from __future__ import annotations

import json
import logging
import hashlib
import textwrap
import uuid
from datetime import datetime
from io import BytesIO
from pathlib import Path
from xml.etree import ElementTree
from zipfile import BadZipFile, ZipFile

from pypdf import PdfReader
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from sqlalchemy.orm import Session

from app.config import settings
from app.database.database import SessionLocal
from app.models.document import Document
from app.models.document_analysis import DocumentAnalysis
from app.models.analysis_job import AnalysisJob
from app.models.clause import Clause
from app.models.report import Report
from app.schemas.report import ClauseRisk
from app.services.llm_providers.groq_client import GroqClassificationError, classify_document
from app.workflows.extraction_workflow import extract_clause_risks
from app.workflows.report_workflow import SUPPORTED_LANGUAGES, build_report

logger = logging.getLogger(__name__)


class NotALegalDocumentError(Exception):
    """Raised when the PDF does not contain legal-document content."""


class DuplicateDocumentError(Exception):
    """Raised when a user uploads an identical document more than once."""


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
    """Stores legal PDF and DOCX documents and limits every operation to their owner."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.pdf_directory = settings.PDF_UPLOAD_DIR
        self.docx_directory = settings.DOCX_UPLOAD_DIR

    def save_document(self, user_id: int, filename: str, file_bytes: bytes) -> dict:
        """Validate PDF/DOCX content before writing so non-legal files are never stored."""
        suffix = Path(filename).suffix.lower()
        if suffix not in {".pdf", ".docx"}:
            raise ValueError("Only PDF and DOCX files are supported.")
        # Compare content rather than just filenames so renamed copies are caught too.
        file_hash = hashlib.sha256(file_bytes).hexdigest()
        duplicate = (
            self.db.query(Document)
            .filter(Document.user_id == user_id, Document.sha256 == file_hash)
            .first()
        )
        if duplicate:
            raise DuplicateDocumentError("This document has already been uploaded.")

        text, page_count = self._read_document(file_bytes, suffix)
        self._ensure_is_legal_document(text)

        document_id = str(uuid.uuid4())
        storage_directory = self.pdf_directory if suffix == ".pdf" else self.docx_directory
        stored_filename = f"{document_id}{suffix}"
        file_path = storage_directory / stored_filename
        preview_path = self.pdf_directory / f"{document_id}.preview.pdf"
        try:
            file_path.write_bytes(file_bytes)
            if suffix == ".docx":
                self._write_docx_preview(preview_path, text, filename)
            document = Document(
                id=document_id,
                user_id=user_id,
                original_filename=filename,
                stored_filename=stored_filename,
                content_type=("application/pdf" if suffix == ".pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
                size=len(file_bytes),
                storage_path=file_path.relative_to(settings.BASE_DIR).as_posix(),
                # This is an API path, not a public file-system URL. Ownership is checked on every request.
                file_url=f"/api/upload/{document_id}/preview",
                sha256=file_hash,
                page_count=page_count,
            )
            self.db.add(document)
            self.db.commit()
            self.db.refresh(document)
            return self._public_document(document)
        except Exception:
            self.db.rollback()
            file_path.unlink(missing_ok=True)
            preview_path.unlink(missing_ok=True)
            raise

    # Retained for older callers while all new uploads use the format-neutral method.
    def save_pdf(self, user_id: int, filename: str, file_bytes: bytes) -> dict:
        return self.save_document(user_id, filename, file_bytes)

    def list_documents(self, user_id: int) -> list[dict]:
        documents = self.db.query(Document).filter(Document.user_id == user_id).order_by(Document.created_at.desc()).all()
        return [self._public_document(document) for document in documents]

    def get_pdf_path(self, user_id: int, document_id: str) -> Path | None:
        document = self._get_document(user_id, document_id)
        if not document:
            return None
        storage_directory = self.docx_directory if document.stored_filename.lower().endswith(".docx") else self.pdf_directory
        file_path = storage_directory / document.stored_filename
        return file_path if file_path.is_file() else None

    def get_preview_path(self, user_id: int, document_id: str) -> Path | None:
        """Return a PDF for the browser preview, including a generated DOCX preview."""
        document = self._get_document(user_id, document_id)
        if not document:
            return None
        if document.stored_filename.lower().endswith(".docx"):
            preview = self.pdf_directory / f"{document.id}.preview.pdf"
            return preview if preview.is_file() else None
        return self.get_pdf_path(user_id, document_id)

    def delete_document(self, user_id: int, document_id: str) -> None:
        """Delete the owner's database record and its local PDF file."""
        document = self._require_document(user_id, document_id)
        storage_directory = self.docx_directory if document.stored_filename.lower().endswith(".docx") else self.pdf_directory
        file_path = storage_directory / document.stored_filename
        preview_path = self.pdf_directory / f"{document.id}.preview.pdf"

        self.db.delete(document)
        self.db.commit()
        # Do not fail a successful database deletion if an old file is already gone.
        try:
            file_path.unlink(missing_ok=True)
            preview_path.unlink(missing_ok=True)
        except OSError as error:
            logger.warning("Document %s was deleted from the database but its local file could not be removed: %s", document_id, error)

    def analyze_pdf(self, user_id: int, document_id: str) -> dict:
        """Generate and persist the English report in the owner's history."""
        document = self._require_document(user_id, document_id)
        file_path = self.get_pdf_path(user_id, document_id)
        if not file_path:
            raise FileNotFoundError("PDF file is missing from local storage.")

        text, total_pages = self._read_document(file_path.read_bytes(), Path(document.stored_filename).suffix.lower())
        self._ensure_is_legal_document(text)
        clause_risks = extract_clause_risks(text)
        report = build_report(document.original_filename, total_pages, clause_risks, language="en")
        analysis = DocumentAnalysis(
            document_id=document.id,
            language="en",
            overall_risk_score=report["summary"]["overall_risk_score"],
            overall_risk_level=report["summary"]["overall_risk_label"],
            summary=f"Completed analysis of {total_pages} page(s) with {len(clause_risks)} extracted clauses.",
            important_points=[item["title"] for item in report.get("top_risks", [])],
            legal_signals=self._legal_signals(text),
            risk_topics=[item.risk_level for item in clause_risks],
            raw_analysis=report,
            model_name="groq",
            prompt_version="multi-agent-v1",
            status="completed",
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
        )
        self.db.add(analysis)
        self.db.flush()

        job = AnalysisJob(
            document_id=document.id,
            analysis_id=analysis.id,
            current_step="completed",
            progress=100,
            status="completed",
            started_at=analysis.started_at,
            completed_at=analysis.completed_at,
        )
        self.db.add(job)

        # Persist every extracted clause so the analysis workspace can filter by PDF page.
        for sort_order, risk in enumerate(clause_risks, start=1):
            excerpt = risk.source_excerpt.strip()
            title = risk.title.strip()[:120] or excerpt.split(".", 1)[0].strip()[:80] or f"Clause {sort_order}"
            self.db.add(Clause(
                document_id=document.id,
                analysis_id=analysis.id,
                clause_number=str(sort_order),
                title=title,
                page_number=risk.page,
                original_text=excerpt,
                plain_english=risk.plain_english.strip() or self._plain_english_text(risk.risk_level),
                risk_level=risk.risk_level,
                risk_score=risk.risk_score,
                risk_reason=risk.risk_reason.strip() or self._risk_reason(risk.risk_level),
                negotiation_suggestion=(
                    risk.negotiation_suggestion.strip()
                    or self._negotiation_suggestion(risk.risk_level)
                ),
                sort_order=sort_order,
            ))

        self.db.add(Report(
            document_id=document.id,
            analysis_id=analysis.id,
            language="en",
            title=f"Legal analysis: {document.original_filename}",
            summary=analysis.summary,
            important_points=analysis.important_points,
            report_data=report,
            status="completed",
            generated_at=datetime.utcnow(),
        ))
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

    def create_analysis_job(self, user_id: int, document_id: str) -> dict:
        """Create a visible queued job before any AI work begins."""
        document = self._require_document(user_id, document_id)
        running_job = (
            self.db.query(AnalysisJob)
            .filter(AnalysisJob.document_id == document.id, AnalysisJob.status.in_(["queued", "running"]))
            .order_by(AnalysisJob.started_at.desc())
            .first()
        )
        if running_job:
            return self._public_job(running_job)

        analysis = DocumentAnalysis(document_id=document.id, language="en", status="queued")
        self.db.add(analysis)
        self.db.flush()
        job = AnalysisJob(document_id=document.id, analysis_id=analysis.id, current_step="queued", progress=0, status="queued")
        self.db.add(job)
        document.analysis_status = "analyzing"
        self.db.commit()
        return self._public_job(job)

    def get_analysis_job(self, user_id: int, document_id: str, job_id: str) -> dict:
        self._require_document(user_id, document_id)
        job = self.db.query(AnalysisJob).filter(AnalysisJob.id == job_id, AnalysisJob.document_id == document_id).first()
        if not job:
            raise FileNotFoundError("Analysis job not found.")
        return self._public_job(job)

    def get_analysis(self, user_id: int, document_id: str) -> dict | None:
        """Return the completed analysis and all clauses for page-based review."""
        self._require_document(user_id, document_id)
        analysis = (
            self.db.query(DocumentAnalysis)
            .filter(DocumentAnalysis.document_id == document_id, DocumentAnalysis.status == "completed")
            .order_by(DocumentAnalysis.completed_at.desc())
            .first()
        )
        if not analysis:
            return None
        clauses = (
            self.db.query(Clause)
            .filter(Clause.analysis_id == analysis.id)
            .order_by(Clause.page_number.asc(), Clause.sort_order.asc())
            .all()
        )
        return {
            "analysis_id": analysis.id,
            "summary": analysis.raw_analysis.get("summary", {}),
            "clauses": [{
                "id": clause.id,
                "clause_number": clause.clause_number,
                "title": clause.title,
                "page": clause.page_number,
                "original_text": clause.original_text,
                "plain_english": clause.plain_english,
                "risk_level": clause.risk_level,
                "risk_score": clause.risk_score,
                "risk_reason": clause.risk_reason,
                "negotiation_suggestion": clause.negotiation_suggestion,
            } for clause in clauses],
        }

    @staticmethod
    def process_analysis_job(job_id: str) -> None:
        """Background worker entry point; it owns its own database session."""
        db = SessionLocal()
        try:
            job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
            if not job:
                return
            document = db.query(Document).filter(Document.id == job.document_id).first()
            if not document:
                job.status, job.error_message = "failed", "Document not found."
                db.commit()
                return

            job.status, job.current_step, job.progress, job.started_at = "running", "specialist agents running", 15, datetime.utcnow()
            db.commit()
            report = UploadService(db).analyze_pdf(document.user_id, document.id)
            job.status, job.current_step, job.progress, job.completed_at = "completed", "completed", 100, datetime.utcnow()
            db.commit()
            logger.info("Analysis job %s completed for document %s", job_id, document.id)
        except Exception as error:
            db.rollback()
            failed_job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
            if failed_job:
                failed_job.status = "failed"
                failed_job.current_step = "failed"
                failed_job.error_message = str(error)
                failed_job.completed_at = datetime.utcnow()
                db.commit()
            logger.exception("Analysis job %s failed", job_id)
        finally:
            db.close()

    def get_report(self, user_id: int, document_id: str, language: str = "en") -> dict | None:
        if language not in SUPPORTED_LANGUAGES:
            raise UnsupportedLanguageError(f"Language '{language}' is not supported.")
        document = self._get_document(user_id, document_id)
        if not document:
            return None
        saved_report = (
            self.db.query(Report)
            .filter(Report.document_id == document_id, Report.language == language, Report.status == "completed")
            .order_by(Report.generated_at.desc())
            .first()
        )
        if saved_report and saved_report.report_data:
            return saved_report.report_data
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

    @classmethod
    def _read_document(cls, file_bytes: bytes, suffix: str) -> tuple[str, int]:
        if suffix == ".pdf":
            return cls._read_pdf(file_bytes)
        if suffix == ".docx":
            return cls._read_docx(file_bytes)
        raise ValueError("Only PDF and DOCX files are supported.")

    @staticmethod
    def _read_docx(file_bytes: bytes) -> tuple[str, int]:
        """Extract readable paragraph text from an OOXML Word document without trusting its filename."""
        try:
            with ZipFile(BytesIO(file_bytes)) as archive:
                document_xml = archive.read("word/document.xml")
            root = ElementTree.fromstring(document_xml)
            namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
            paragraphs = []
            for paragraph in root.findall(".//w:p", namespace):
                value = "".join(node.text or "" for node in paragraph.findall(".//w:t", namespace)).strip()
                if value:
                    paragraphs.append(value)
        except (BadZipFile, KeyError, ElementTree.ParseError) as error:
            raise ValueError("This DOCX file cannot be read for analysis.") from error
        text = "\n".join(paragraphs)
        if not text.strip():
            raise ValueError("This DOCX file does not contain readable text for analysis.")
        # DOCX does not reliably preserve rendered page count; use a consistent text estimate.
        return text, max(1, (len(text) + 2999) // 3000)

    @staticmethod
    def _write_docx_preview(preview_path: Path, text: str, filename: str) -> None:
        """Create a local PDF preview so DOCX documents use the same in-app viewer as PDFs."""
        page_width, page_height = A4
        pdf = canvas.Canvas(str(preview_path), pagesize=A4)
        pdf.setTitle(filename)
        left, top, bottom = 48, page_height - 52, 48
        y = top
        pdf.setFont("Helvetica-Bold", 10)
        pdf.drawString(left, y, filename[:90])
        y -= 24
        pdf.setFont("Helvetica", 9)
        for paragraph in text.splitlines():
            for line in textwrap.wrap(paragraph, width=105) or [""]:
                if y < bottom:
                    pdf.showPage()
                    y = top
                    pdf.setFont("Helvetica", 9)
                pdf.drawString(left, y, line)
                y -= 13
            y -= 5
        pdf.save()

    @staticmethod
    def _legal_signals(text: str) -> list[str]:
        lowered = text.lower()
        return [category[0] for category in _LEGAL_KEYWORD_CATEGORIES if any(term in lowered for term in category)]

    @staticmethod
    def _plain_english_text(risk_level: str) -> str:
        if risk_level == "high":
            return "In simple terms, this provision can put a significant cost, obligation, or legal burden on you. Do not accept it without understanding the practical impact."
        if risk_level == "medium":
            return "In simple terms, this provision sets an important rule for the relationship. Confirm that the deadline, responsibility, and outcome work for your business."
        return "In simple terms, this provision is a standard protection and does not appear unusually one-sided based on the wording reviewed."

    @staticmethod
    def _risk_reason(risk_level: str) -> str:
        if risk_level == "high":
            return "High risk because the clause may create broad liability, a financial loss, or a restriction that is difficult to undo."
        if risk_level == "medium":
            return "Moderate risk because the clause may materially affect operations or costs depending on how it is applied."
        return "Lower risk because the clause appears balanced or reflects common contract protections."

    @staticmethod
    def _negotiation_suggestion(risk_level: str) -> str:
        if risk_level == "high":
            return "Ask to narrow the scope, add a reasonable cap, define clear exceptions, and require written notice before the obligation applies."
        if risk_level == "medium":
            return "Ask for clearer timing, measurable responsibilities, and a mutual obligation so both parties are treated fairly."
        return "Keep this language, but confirm it matches the rest of the agreement and your operational process."

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
        try:
            legal_signals = json.loads(document.legal_signals or "[]")
        except json.JSONDecodeError:
            legal_signals = []
        try:
            analysis_data = json.loads(document.analysis_data or "{}")
        except json.JSONDecodeError:
            analysis_data = {}

        clause_risks = analysis_data.get("clause_risks", [])
        risk_levels = [item.get("risk_level") for item in clause_risks if isinstance(item, dict)]
        risk_level = "high" if "high" in risk_levels else "medium" if "medium" in risk_levels else "safe" if risk_levels else "pending"
        document_types = {
            "agreement": "Agreement",
            "memorandum of understanding": "MOU",
            "terms and conditions": "Terms",
            "nda": "NDA",
            "non-disclosure": "NDA",
        }
        document_type = next((document_types[signal] for signal in legal_signals if signal in document_types), "Legal document")

        return {
            "document_id": document.id,
            "original_filename": document.original_filename,
            "size": document.size,
            "content_type": document.content_type,
            "page_count": document.page_count,
            "file_url": document.file_url,
            "uploaded_at": document.created_at.isoformat(),
            "analysis_status": document.analysis_status,
            "document_type": document_type,
            "clause_count": len(clause_risks),
            "risk_level": risk_level,
        }

    @staticmethod
    def _public_job(job: AnalysisJob) -> dict:
        return {
            "job_id": job.id,
            "analysis_id": job.analysis_id,
            "status": job.status,
            "current_step": job.current_step,
            "progress": job.progress,
            "error_message": job.error_message,
        }

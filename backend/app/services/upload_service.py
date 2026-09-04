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
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import func, or_
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

    def list_documents(self, user_id: int, limit: int | None = None) -> list[dict]:
        """Return a user's newest documents without one analysis query per row."""
        document_query = (
            self.db.query(Document)
            .filter(Document.user_id == user_id)
            .order_by(Document.created_at.desc())
        )
        if limit is not None:
            document_query = document_query.limit(limit)
        documents = document_query.all()
        latest_analyses = self._latest_completed_analyses([document.id for document in documents])
        return [
            self._public_document(document, latest_analyses.get(document.id), analysis_loaded=True)
            for document in documents
        ]

    def search_documents(self, user_id: int, query: str, limit: int = 6) -> list[dict]:
        """Search a user's document names and the clauses in their newest analyses."""
        term = query.strip()
        if not term:
            return []

        pattern = f"%{term}%"
        documents = (
            self.db.query(Document)
            .filter(
                Document.user_id == user_id,
                (Document.original_filename.ilike(pattern) | Document.document_type.ilike(pattern)),
            )
            .order_by(Document.created_at.desc())
            .limit(limit)
            .all()
        )
        latest_analyses = self._latest_completed_analyses([document.id for document in documents])
        document_results = []
        for document in documents:
            payload = self._public_document(document, latest_analyses.get(document.id), analysis_loaded=True)
            payload["result_type"] = "document"
            document_results.append(payload)

        # A document can have an analysis in several languages. The window function
        # picks one newest completed analysis per document, avoiding duplicate clause
        # suggestions while still linking the result to its correct language view.
        ranked_analyses = (
            self.db.query(
                DocumentAnalysis.id.label("analysis_id"),
                DocumentAnalysis.document_id.label("document_id"),
                DocumentAnalysis.language.label("language"),
                func.row_number()
                .over(
                    partition_by=DocumentAnalysis.document_id,
                    order_by=(DocumentAnalysis.completed_at.desc(), DocumentAnalysis.id.desc()),
                )
                .label("position"),
            )
            .join(Document, Document.id == DocumentAnalysis.document_id)
            .filter(Document.user_id == user_id, DocumentAnalysis.status == "completed")
            .subquery()
        )
        clause_rows = (
            self.db.query(Clause, Document, ranked_analyses.c.language)
            .join(ranked_analyses, Clause.analysis_id == ranked_analyses.c.analysis_id)
            .join(Document, Document.id == Clause.document_id)
            .filter(
                ranked_analyses.c.position == 1,
                or_(
                    Clause.title.ilike(pattern),
                    Clause.clause_number.ilike(pattern),
                    Clause.original_text.ilike(pattern),
                    Clause.plain_english.ilike(pattern),
                    Clause.risk_reason.ilike(pattern),
                    Clause.negotiation_suggestion.ilike(pattern),
                ),
            )
            .order_by(Document.created_at.desc(), Clause.sort_order.asc())
            .limit(limit)
            .all()
        )

        clause_results = [
            {
                "result_type": "clause",
                "document_id": document.id,
                "original_filename": document.original_filename,
                "document_type": document.document_type,
                "analysis_status": document.analysis_status,
                "analysis_language": language,
                "clause_id": clause.id,
                "clause_number": clause.clause_number,
                "clause_title": clause.title,
                "page_number": clause.page_number,
                "risk_level": clause.risk_level,
                # Keep the suggestion compact; the full text is available after opening it.
                "matched_text": (clause.plain_english or clause.original_text or "").replace("\n", " ").strip()[:180],
            }
            for clause, document, language in clause_rows
        ]

        # Clause hits come first because they take the user directly to the exact
        # provision. Filename/type hits are still included as a fallback.
        return (clause_results + document_results)[:limit]

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

    def rename_document(self, user_id: int, document_id: str, filename: str) -> dict:
        """Rename the display name without changing the stored file or its extension."""
        document = self._require_document(user_id, document_id)
        requested_name = Path(filename.strip()).name
        if not requested_name:
            raise ValueError("Document name cannot be empty.")

        current_suffix = Path(document.original_filename).suffix.lower()
        requested_path = Path(requested_name)
        # The uploaded file itself is not replaced. Keep its original extension
        # so a renamed PDF/DOCX remains clearly identifiable to the user.
        display_name = requested_name if requested_path.suffix.lower() == current_suffix else f"{requested_path.stem}{current_suffix}"
        if len(display_name) > 255:
            raise ValueError("Document name cannot exceed 255 characters.")

        document.original_filename = display_name
        analyses = self.db.query(DocumentAnalysis).filter(DocumentAnalysis.document_id == document.id).all()
        for analysis in analyses:
            raw_analysis = dict(analysis.raw_analysis or {})
            summary = dict(raw_analysis.get("summary") or {})
            summary["filename"] = display_name
            raw_analysis["summary"] = summary
            analysis.raw_analysis = raw_analysis
        self.db.query(Report).filter(Report.document_id == document.id).update(
            {Report.title: f"Legal analysis: {display_name}"},
            synchronize_session=False,
        )
        self.db.commit()
        self.db.refresh(document)
        latest_analysis = self._latest_completed_analyses([document.id]).get(document.id)
        return self._public_document(document, latest_analysis, analysis_loaded=True)

    def analyze_pdf(self, user_id: int, document_id: str, analysis_id: str | None = None, language: str = "en") -> dict:
        """Generate and persist one language-specific analysis and report for a document."""
        document = self._require_document(user_id, document_id)
        file_path = self.get_pdf_path(user_id, document_id)
        if not file_path:
            raise FileNotFoundError("PDF file is missing from local storage.")

        text, total_pages = self._read_document(file_path.read_bytes(), Path(document.stored_filename).suffix.lower())
        self._ensure_is_legal_document(text)
        clause_risks = extract_clause_risks(text, language=language)
        # The LLM estimates a source page from extracted text. Clamp that estimate
        # before persisting it so every clause always points to a real PDF page.
        for clause_risk in clause_risks:
            clause_risk.page = min(total_pages, max(1, clause_risk.page))
        report = build_report(document.original_filename, total_pages, clause_risks, language=language)
        # A background job creates a queued analysis first. Complete that same row
        # instead of inserting a second completed record for the same document.
        analysis = None
        if analysis_id:
            analysis = self.db.query(DocumentAnalysis).filter(
                DocumentAnalysis.id == analysis_id,
                DocumentAnalysis.document_id == document.id,
            ).first()
        if not analysis:
            analysis = (
                self.db.query(DocumentAnalysis)
                .filter(DocumentAnalysis.document_id == document.id, DocumentAnalysis.language == language)
                .first()
            )
        if not analysis:
            analysis = DocumentAnalysis(document_id=document.id, language=language)
            self.db.add(analysis)
            self.db.flush()
            self.db.add(AnalysisJob(
                document_id=document.id,
                analysis_id=analysis.id,
                current_step="completed",
                progress=100,
                status="completed",
                started_at=datetime.utcnow(),
                completed_at=datetime.utcnow(),
            ))

        analysis.language = language
        analysis.overall_risk_score = report["summary"]["overall_risk_score"]
        analysis.overall_risk_level = report["summary"]["overall_risk_label"]
        analysis.summary = f"Completed analysis of {total_pages} page(s) with {len(clause_risks)} extracted clauses."
        analysis.important_points = [item["title"] for item in report.get("top_risks", [])]
        analysis.legal_signals = self._legal_signals(text)
        analysis.risk_topics = [item.risk_level for item in clause_risks]
        analysis.raw_analysis = report
        analysis.model_name = "groq"
        analysis.prompt_version = "multi-agent-v1"
        analysis.status = "completed"
        analysis.started_at = analysis.started_at or datetime.utcnow()
        analysis.completed_at = datetime.utcnow()

        # Reusing an existing analysis language must replace its old detail rows,
        # rather than adding a second copy of every clause/report.
        self.db.query(Clause).filter(Clause.analysis_id == analysis.id).delete(synchronize_session=False)
        self.db.query(Report).filter(
            Report.document_id == document.id,
            Report.analysis_id == analysis.id,
            Report.language == language,
        ).delete(synchronize_session=False)

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
            language=language,
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
            "reports": {language: report},
        })
        document.analyzed_at = datetime.utcnow()
        self.db.commit()
        return report

    def create_analysis_job(self, user_id: int, document_id: str, language: str = "en") -> dict:
        """Create a visible queued job before any AI work begins."""
        document = self._require_document(user_id, document_id)
        if language not in SUPPORTED_LANGUAGES:
            raise UnsupportedLanguageError(f"Language '{language}' is not supported.")
        existing_analysis = (
            self.db.query(DocumentAnalysis)
            .filter(DocumentAnalysis.document_id == document.id, DocumentAnalysis.language == language)
            .first()
        )
        if existing_analysis:
            existing_job = (
                self.db.query(AnalysisJob)
                .filter(AnalysisJob.analysis_id == existing_analysis.id)
                .order_by(AnalysisJob.started_at.desc())
                .first()
            )
            if existing_job and existing_analysis.status in {"queued", "running", "completed"}:
                return {**self._public_job(existing_job), "should_start": False}
            # Failed language-specific analyses may be retried without adding a
            # duplicate document_analyses row.
            analysis = existing_analysis
            analysis.status = "queued"
            analysis.error_message = None
            analysis.started_at = None
            analysis.completed_at = None
        else:
            analysis = DocumentAnalysis(document_id=document.id, language=language, status="queued")
            self.db.add(analysis)
            self.db.flush()
        job = AnalysisJob(document_id=document.id, analysis_id=analysis.id, current_step="queued", progress=0, status="queued")
        self.db.add(job)
        document.analysis_status = "analyzing"
        self.db.commit()
        return {**self._public_job(job), "should_start": True}

    def get_analysis_job(self, user_id: int, document_id: str, job_id: str) -> dict:
        self._require_document(user_id, document_id)
        job = self.db.query(AnalysisJob).filter(AnalysisJob.id == job_id, AnalysisJob.document_id == document_id).first()
        if not job:
            raise FileNotFoundError("Analysis job not found.")
        return self._public_job(job)

    def get_analysis(self, user_id: int, document_id: str, language: str = "en") -> dict | None:
        """Return the completed analysis and all clauses for page-based review."""
        self._require_document(user_id, document_id)
        analysis = (
            self.db.query(DocumentAnalysis)
            .filter(DocumentAnalysis.document_id == document_id, DocumentAnalysis.language == language, DocumentAnalysis.status == "completed")
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
            "contract_summary": analysis.raw_analysis.get("contract_summary", []),
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

    def export_report_pdf(self, user_id: int, document_id: str, language: str = "en") -> Path:
        """Build a complete downloadable PDF from the saved language-specific report."""
        if language not in SUPPORTED_LANGUAGES:
            raise UnsupportedLanguageError(f"Language '{language}' is not supported.")
        document = self._require_document(user_id, document_id)
        report = self.get_report(user_id, document_id, language)
        if not report:
            raise FileNotFoundError("Report not found. Analyze the document first.")

        output_path = settings.REPORT_DIR / f"{document.id}_{language}_legal_report.pdf"
        font_name = self._report_font_name()
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle("LegalLensTitle", parent=styles["Title"], fontName=font_name, fontSize=20, leading=25, textColor=colors.HexColor("#181211"), spaceAfter=8)
        heading_style = ParagraphStyle("LegalLensHeading", parent=styles["Heading2"], fontName=font_name, fontSize=14, leading=18, textColor=colors.HexColor("#0875D1"), spaceBefore=12, spaceAfter=6)
        body_style = ParagraphStyle("LegalLensBody", parent=styles["BodyText"], fontName=font_name, fontSize=9.5, leading=14, textColor=colors.HexColor("#302923"), spaceAfter=6)
        small_style = ParagraphStyle("LegalLensSmall", parent=body_style, fontSize=8, leading=10, textColor=colors.HexColor("#526174"))
        story = [
            Paragraph("LegalLens | Contract Analysis Report", title_style),
            Paragraph(f"<b>Document:</b> {self._pdf_safe(document.original_filename)}", body_style),
            Paragraph(f"<b>Language:</b> {SUPPORTED_LANGUAGES[language]} &nbsp;&nbsp; <b>Generated:</b> {datetime.utcnow().strftime('%d %b %Y, %H:%M UTC')}", small_style),
            Spacer(1, 5 * mm),
        ]
        summary = report.get("summary", {})
        score = int(summary.get("overall_risk_score", 0) or 0)
        metrics = [["Overall risk", f"{score}/100"], ["High risk clauses", str(summary.get("high_risk_count", 0))], ["Moderate clauses", str(summary.get("medium_risk_count", 0))], ["Safe clauses", str(summary.get("safe_count", 0))], ["Negotiable clauses", str(summary.get("negotiable_count", 0))]]
        table = Table(metrics, colWidths=[85 * mm, 75 * mm])
        table.setStyle(TableStyle([("FONTNAME", (0, 0), (-1, -1), font_name), ("FONTSIZE", (0, 0), (-1, -1), 9), ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EAE6DB")), ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CFC8BA")), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
        story.extend([Paragraph("Executive summary", heading_style), table, Spacer(1, 3 * mm)])
        for line in report.get("contract_summary", []):
            story.append(Paragraph(self._pdf_safe(str(line)), body_style))
        story.append(Paragraph("Top risks", heading_style))
        for risk in report.get("top_risks", []):
            title = self._pdf_safe(str(risk.get("title", "Clause")))
            explanation = self._pdf_safe(str(risk.get("explanation", "")))
            story.append(Paragraph(f"<b>{risk.get('rank', '')}. {title}</b> — {str(risk.get('risk_level', '')).title()} risk · Page {risk.get('page', 1)}", body_style))
            story.append(Paragraph(explanation, body_style))
        story.append(Paragraph("Negotiation terms", heading_style))
        terms = report.get("negotiation_terms", [])
        if terms:
            for index, term in enumerate(terms, start=1):
                story.append(Paragraph(f"<b>{index}. {self._pdf_safe(str(term.get('title', 'Clause')))}</b> · Page {term.get('page', 1)}", body_style))
                story.append(Paragraph(self._pdf_safe(str(term.get("suggestion", ""))), body_style))
        else:
            story.append(Paragraph("No clauses were marked negotiable for this document.", body_style))
        story.extend([Spacer(1, 4 * mm), Paragraph("AI-assisted legal document analysis. This report is for information only and is not legal advice.", small_style)])
        pdf = SimpleDocTemplate(str(output_path), pagesize=A4, rightMargin=16 * mm, leftMargin=16 * mm, topMargin=16 * mm, bottomMargin=16 * mm, title="LegalLens Contract Analysis Report")
        pdf.build(story)

        stored_report = self.db.query(Report).filter(Report.document_id == document.id, Report.language == language, Report.status == "completed").order_by(Report.generated_at.desc()).first()
        if stored_report:
            stored_report.report_path = str(output_path)
            stored_report.file_size = output_path.stat().st_size
            stored_report.sha256 = hashlib.sha256(output_path.read_bytes()).hexdigest()
            self.db.commit()
        return output_path

    @staticmethod
    def _pdf_safe(value: str) -> str:
        """Escape report text before inserting it into ReportLab Paragraph markup."""
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    @staticmethod
    def _report_font_name() -> str:
        """Use Windows' Indian-script font when available; otherwise use Helvetica."""
        font_path = Path(r"C:\Windows\Fonts\Nirmala.ttc")
        font_name = "LegalLensUnicode"
        if font_path.exists() and font_name not in pdfmetrics.getRegisteredFontNames():
            try:
                pdfmetrics.registerFont(TTFont(font_name, str(font_path), subfontIndex=0))
            except Exception:
                logger.warning("Could not load Nirmala font for Unicode report export.", exc_info=True)
        return font_name if font_name in pdfmetrics.getRegisteredFontNames() else "Helvetica"

    @staticmethod
    def process_analysis_job(job_id: str) -> None:
        """Background worker entry point; it owns its own database session."""
        db = SessionLocal()
        try:
            job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
            if not job:
                return
            job_analysis = db.query(DocumentAnalysis).filter(DocumentAnalysis.id == job.analysis_id).first()
            if not job_analysis:
                job.status, job.error_message = "failed", "Analysis record not found."
                db.commit()
                return
            document = db.query(Document).filter(Document.id == job.document_id).first()
            if not document:
                job.status, job.error_message = "failed", "Document not found."
                db.commit()
                return

            job.status, job.current_step, job.progress, job.started_at = "running", "specialist agents running", 15, datetime.utcnow()
            db.commit()
            UploadService(db).analyze_pdf(document.user_id, document.id, job.analysis_id, job_analysis.language)
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
            return self._with_negotiation_terms(document, saved_report.report_data)
        # A report is a presentation of an already-completed analysis, not a
        # second analysis run. Reuse its language-specific saved result.
        completed_analysis = (
            self.db.query(DocumentAnalysis)
            .filter(DocumentAnalysis.document_id == document_id, DocumentAnalysis.language == language, DocumentAnalysis.status == "completed")
            .order_by(DocumentAnalysis.completed_at.desc())
            .first()
        )
        if completed_analysis and completed_analysis.raw_analysis:
            report_data = completed_analysis.raw_analysis
            self.db.add(Report(
                document_id=document.id,
                analysis_id=completed_analysis.id,
                language=language,
                title=f"Legal analysis: {document.original_filename}",
                summary=completed_analysis.summary,
                important_points=completed_analysis.important_points,
                report_data=report_data,
                status="completed",
                generated_at=datetime.utcnow(),
            ))
            self.db.commit()
            return self._with_negotiation_terms(document, report_data)
        data = json.loads(document.analysis_data or "{}")
        if "clause_risks" not in data:
            return None
        if language not in data.get("reports", {}):
            clause_risks = [ClauseRisk(**item) for item in data["clause_risks"]]
            data.setdefault("reports", {})[language] = build_report(document.original_filename, data["total_pages"], clause_risks, language)
            document.analysis_data = json.dumps(data)
            analysis = (
                self.db.query(DocumentAnalysis)
                .filter(DocumentAnalysis.document_id == document_id, DocumentAnalysis.language == language, DocumentAnalysis.status == "completed")
                .order_by(DocumentAnalysis.completed_at.desc())
                .first()
            )
            if analysis:
                self.db.add(Report(
                    document_id=document.id,
                    analysis_id=analysis.id,
                    language=language,
                    title=f"Legal analysis: {document.original_filename}",
                    summary=analysis.summary,
                    important_points=analysis.important_points,
                    report_data=data["reports"][language],
                    status="completed",
                    generated_at=datetime.utcnow(),
                ))
            self.db.commit()
        return self._with_negotiation_terms(document, data["reports"][language])

    def _with_negotiation_terms(self, document: Document, report_data: dict) -> dict:
        """Attach every clause flagged negotiable to both old and new reports."""
        result = dict(report_data)
        try:
            stored_analysis = json.loads(document.analysis_data or "{}")
        except json.JSONDecodeError:
            stored_analysis = {}
        negotiable_risks = [
            item for item in stored_analysis.get("clause_risks", [])
            if isinstance(item, dict) and item.get("negotiable")
        ]
        terms = [
            {
                "title": str(item.get("title") or f"Clause on page {item.get('page', 1)}"),
                "page": int(item.get("page") or 1),
                "suggestion": str(item.get("negotiation_suggestion") or f"Ask for clearer and more balanced terms for {item.get('title') or 'this clause'}."),
            }
            for item in negotiable_risks
        ]
        # Older reports can have a saved negotiable count without the original
        # boolean flags. Complete the list from persisted clause suggestions so the
        # count card and the Negotiation terms section never disagree.
        try:
            expected_count = max(0, int(result.get("summary", {}).get("negotiable_count", 0)))
        except (TypeError, ValueError):
            expected_count = 0
        if len(terms) < expected_count:
            existing_terms = {(term["title"], term["page"]) for term in terms}
            fallback_clauses = (
                self.db.query(Clause)
                .filter(Clause.document_id == document.id, Clause.negotiation_suggestion.isnot(None))
                .order_by(Clause.risk_score.desc(), Clause.sort_order.asc())
                .all()
            )
            for clause in fallback_clauses:
                key = (clause.title, clause.page_number or 1)
                if key in existing_terms:
                    continue
                terms.append({
                    "title": clause.title,
                    "page": clause.page_number or 1,
                    "suggestion": clause.negotiation_suggestion or f"Ask for clearer and more balanced terms for {clause.title}.",
                })
                existing_terms.add(key)
                if len(terms) >= expected_count:
                    break
        result["negotiation_terms"] = terms
        return result

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

    def _latest_completed_analyses(self, document_ids: list[str]) -> dict[str, DocumentAnalysis]:
        """Load the newest completed analysis for every document in one PostgreSQL query."""
        if not document_ids:
            return {}

        analyses = (
            self.db.query(DocumentAnalysis)
            .filter(
                DocumentAnalysis.document_id.in_(document_ids),
                DocumentAnalysis.status == "completed",
            )
            # PostgreSQL DISTINCT ON keeps only the first row per document.
            .order_by(
                DocumentAnalysis.document_id,
                DocumentAnalysis.completed_at.desc(),
                DocumentAnalysis.id.desc(),
            )
            .distinct(DocumentAnalysis.document_id)
            .all()
        )
        return {analysis.document_id: analysis for analysis in analyses}

    def _public_document(
        self,
        document: Document,
        latest_analysis: DocumentAnalysis | None = None,
        *,
        analysis_loaded: bool = False,
    ) -> dict:
        try:
            legal_signals = json.loads(document.legal_signals or "[]")
        except json.JSONDecodeError:
            legal_signals = []
        try:
            analysis_data = json.loads(document.analysis_data or "{}")
        except json.JSONDecodeError:
            analysis_data = {}

        clause_risks = analysis_data.get("clause_risks", [])
        if not analysis_loaded:
            latest_analysis = (
                self.db.query(DocumentAnalysis)
                .filter(DocumentAnalysis.document_id == document.id, DocumentAnalysis.status == "completed")
                .order_by(DocumentAnalysis.completed_at.desc())
                .first()
            )

        # A document may contain one high-risk clause but still be Moderate overall.
        # Use the persisted overall analysis result (an average risk score), not the
        # most severe individual clause, for the Documents card badge.
        if latest_analysis:
            risk_level = self._document_risk_level(
                latest_analysis.overall_risk_level,
                latest_analysis.overall_risk_score,
            )
            risk_score = latest_analysis.overall_risk_score
        else:
            summary = analysis_data.get("reports", {}).get("en", {}).get("summary", {})
            risk_level = self._document_risk_level(
                summary.get("overall_risk_label"),
                summary.get("overall_risk_score"),
            ) if clause_risks else "pending"
            risk_score = summary.get("overall_risk_score") if clause_risks else None
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
            # The Documents page must open the same language-specific analysis
            # that was completed most recently, rather than assuming English.
            "analysis_language": latest_analysis.language if latest_analysis else "en",
            "document_type": document_type,
            "clause_count": len(clause_risks),
            "risk_level": risk_level,
            "risk_score": risk_score,
        }

    @staticmethod
    def _document_risk_level(label: object, score: object) -> str:
        """Normalize stored report labels into the three UI badge values."""
        # The score is the source of truth, so older labels cannot keep a 45-74
        # score marked High after the thresholds change. Scores of 75+ are High.
        try:
            numeric_score = float(score)
        except (TypeError, ValueError):
            numeric_score = None

        if numeric_score is not None:
            if numeric_score >= 75:
                return "high"
            if numeric_score >= 45:
                return "medium"
            return "safe"

        normalized_label = str(label or "").strip().lower()
        if "high" in normalized_label:
            return "high"
        if "moderate" in normalized_label or "medium" in normalized_label:
            return "medium"
        if "low" in normalized_label or "safe" in normalized_label:
            return "safe"

        return "pending"

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

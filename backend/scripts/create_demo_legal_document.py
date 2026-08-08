"""Create, save, and analyse a 10-page legal agreement for UI testing."""

from __future__ import annotations

import hashlib
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen.canvas import Canvas

from app.database.database import SessionLocal
from app.models.document import Document
from app.models.user import User
from app.services.upload_service import DuplicateDocumentError, UploadService


OUTPUT_PATH = BACKEND_ROOT / "sample_documents" / "legal_lens_demo_master_services_agreement.pdf"
PAGE_WIDTH, PAGE_HEIGHT = A4

CLAUSES = [
    ("Term and Renewal", "This Agreement begins on the Effective Date and continues for one year. It renews automatically for an additional year unless either party gives at least sixty days written notice before the renewal date."),
    ("Fees and Price Changes", "Customer shall pay all fees within thirty days. Provider may adjust annual fees by up to five percent after giving thirty days written notice."),
    ("Limitation of Liability", "Provider's total liability for all claims is limited to fees paid during the prior three months, except for fraud, willful misconduct, confidentiality, and intellectual property obligations."),
    ("Indemnification", "Each party shall indemnify the other against third-party claims caused by its breach, negligence, or misuse of confidential information."),
    ("Confidentiality and Data", "Each party must protect confidential information using reasonable safeguards and may use it only to perform this Agreement. These obligations survive for five years after termination."),
]


def draw_wrapped(canvas: Canvas, text: str, x: float, y: float, width: float, font: str = "Helvetica", size: int = 10, leading: int = 15) -> float:
    canvas.setFont(font, size)
    words = text.split()
    line = ""
    for word in words:
        candidate = f"{line} {word}".strip()
        if stringWidth(candidate, font, size) > width and line:
            canvas.drawString(x, y, line)
            y -= leading
            line = word
        else:
            line = candidate
    if line:
        canvas.drawString(x, y, line)
        y -= leading
    return y


def build_pdf() -> Path:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    canvas = Canvas(str(OUTPUT_PATH), pagesize=A4)
    margin = 0.7 * inch
    body_width = PAGE_WIDTH - (2 * margin)
    for page_number in range(1, 11):
        canvas.setFillColor(HexColor("#0875D1"))
        canvas.setFont("Helvetica-Bold", 9)
        canvas.drawString(margin, PAGE_HEIGHT - margin, "LEGAL LENS - DEMO MASTER SERVICES AGREEMENT")
        canvas.setFillColor(HexColor("#181211"))
        canvas.setFont("Helvetica", 9)
        canvas.drawRightString(PAGE_WIDTH - margin, PAGE_HEIGHT - margin, f"Page {page_number} of 10")
        canvas.setStrokeColor(HexColor("#D8D0C4"))
        canvas.line(margin, PAGE_HEIGHT - margin - 8, PAGE_WIDTH - margin, PAGE_HEIGHT - margin - 8)

        y = PAGE_HEIGHT - (1.15 * inch)
        canvas.setFont("Helvetica-Bold", 16)
        canvas.drawString(margin, y, f"Section {page_number}: Commercial and Legal Terms")
        y -= 28
        canvas.setFont("Helvetica", 10)
        y = draw_wrapped(canvas, "This sample agreement is provided for LegalLens product testing. The clauses below are intentionally drafted with clear legal, commercial, and risk signals for AI review.", margin, y, body_width)
        y -= 8

        for clause_index, (title, text) in enumerate(CLAUSES, start=1):
            number = f"{page_number}.{clause_index}"
            canvas.setFillColor(HexColor("#181211"))
            canvas.setFont("Helvetica-Bold", 11)
            canvas.drawString(margin, y, f"{number} {title}")
            y -= 17
            canvas.setFillColor(HexColor("#323D4D"))
            y = draw_wrapped(canvas, text, margin + 8, y, body_width - 8)
            y -= 8
        canvas.setStrokeColor(HexColor("#D8D0C4"))
        canvas.line(margin, margin, PAGE_WIDTH - margin, margin)
        canvas.setFillColor(HexColor("#67758A"))
        canvas.setFont("Helvetica", 8)
        canvas.drawCentredString(PAGE_WIDTH / 2, margin - 14, "LegalLens demo contract - for testing only")
        canvas.showPage()
    canvas.save()
    return OUTPUT_PATH


def main() -> None:
    pdf_path = build_pdf()
    contents = pdf_path.read_bytes()
    db = SessionLocal()
    try:
        user = db.query(User).order_by(User.created_at.desc()).first()
        if not user:
            raise RuntimeError("No user exists. Register a user before creating the demo document.")
        service = UploadService(db)
        try:
            saved = service.save_pdf(user.id, pdf_path.name, contents)
            document_id = saved["document_id"]
        except DuplicateDocumentError:
            digest = hashlib.sha256(contents).hexdigest()
            document = db.query(Document).filter(Document.user_id == user.id, Document.sha256 == digest).first()
            if not document:
                raise
            document_id = document.id

        job = service.create_analysis_job(user.id, document_id)
        UploadService.process_analysis_job(job["job_id"])
        print(f"Demo document ready: document_id={document_id}, job_id={job['job_id']}, file={pdf_path}")
    finally:
        db.close()


if __name__ == "__main__":
    main()

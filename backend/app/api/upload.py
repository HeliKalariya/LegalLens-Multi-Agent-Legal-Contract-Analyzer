"""Authenticated PDF upload, analysis, and history endpoints."""

from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.security.oauth import get_current_user
from app.services.upload_service import DuplicateDocumentError, NotALegalDocumentError, UnsupportedLanguageError, UploadService

router = APIRouter(prefix="/api/upload", tags=["Upload"])
MAX_FILE_SIZE = 20 * 1024 * 1024


class DocumentRenameRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)


@router.post("/", status_code=status.HTTP_201_CREATED)
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Save a legal PDF or DOCX file to the authenticated user's history."""
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".pdf", ".docx"}:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are allowed.")
    file_bytes = await file.read()
    if suffix == ".pdf" and not file_bytes.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid PDF.")
    if suffix == ".docx" and not file_bytes.startswith(b"PK"):
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid DOCX document.")
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Maximum upload size is 20 MB.")
    try:
        return {"success": True, "data": UploadService(db).save_document(current_user.id, file.filename, file_bytes)}
    except DuplicateDocumentError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except NotALegalDocumentError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/")
def list_pdfs(
    limit: int | None = Query(default=None, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List documents; lightweight screens may request only their recent items."""
    return {"data": UploadService(db).list_documents(current_user.id, limit=limit)}


@router.get("/search")
def search_documents(
    query: str = Query(min_length=1, max_length=100),
    limit: int = Query(default=6, ge=1, le=10),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search only documents owned by the signed-in user."""
    return {"data": UploadService(db).search_documents(current_user.id, query, limit)}


@router.delete("/{document_id}")
def delete_pdf(document_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Delete a PDF only when it belongs to the signed-in user."""
    try:
        UploadService(db).delete_document(current_user.id, document_id)
    except FileNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.") from error
    return {"message": "Document deleted successfully."}


@router.put("/{document_id}")
def rename_document(document_id: str, request: DocumentRenameRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Rename a document display name owned by the signed-in user."""
    try:
        return {"data": UploadService(db).rename_document(current_user.id, document_id, request.filename)}
    except FileNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.") from error
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.post("/{document_id}/analysis-jobs", status_code=status.HTTP_202_ACCEPTED)
def create_analysis_job(document_id: str, background_tasks: BackgroundTasks, language: str = Query(default="en"), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Queue the AI analysis and return immediately so the UI can show progress."""
    try:
        job = UploadService(db).create_analysis_job(current_user.id, document_id, language)
    except FileNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.") from error
    except UnsupportedLanguageError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    if job.pop("should_start", False):
        background_tasks.add_task(UploadService.process_analysis_job, job["job_id"])
    return job


@router.get("/{document_id}/analysis-jobs/{job_id}")
def get_analysis_job(document_id: str, job_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return UploadService(db).get_analysis_job(current_user.id, document_id, job_id)
    except FileNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.get("/{document_id}/analysis")
def get_analysis(document_id: str, language: str = Query(default="en"), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    analysis = UploadService(db).get_analysis(current_user.id, document_id, language)
    if not analysis:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis is not ready yet.")
    return analysis


@router.post("/{document_id}/analyze")
def analyze_pdf(document_id: str, language: str = Query(default="en"), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return UploadService(db).analyze_pdf(current_user.id, document_id, language=language)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except (NotALegalDocumentError, ValueError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/{document_id}/report")
def get_report(document_id: str, language: str = Query(default="en"), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        report = UploadService(db).get_report(current_user.id, document_id, language)
    except UnsupportedLanguageError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    if not report:
        raise HTTPException(status_code=404, detail="Report not found. Analyze the document first.")
    return report


@router.get("/{document_id}/report/download")
def download_report(document_id: str, language: str = Query(default="en"), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Create and download a complete PDF copy of the saved report."""
    try:
        report_path = UploadService(db).export_report_pdf(current_user.id, document_id, language)
    except UnsupportedLanguageError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return FileResponse(report_path, media_type="application/pdf", filename=f"LegalLens-{document_id}-{language}-report.pdf")


@router.get("/{document_id}/preview")
def preview_pdf(document_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    file_path = UploadService(db).get_preview_path(current_user.id, document_id)
    if not file_path:
        raise HTTPException(status_code=404, detail="Document preview not found.")
    return FileResponse(file_path, media_type="application/pdf", content_disposition_type="inline")

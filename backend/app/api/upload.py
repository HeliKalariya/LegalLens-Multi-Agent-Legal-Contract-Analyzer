"""Authenticated PDF upload, analysis, and history endpoints."""

from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.security.oauth import get_current_user
from app.services.upload_service import NotALegalDocumentError, UnsupportedLanguageError, UploadService

router = APIRouter(prefix="/api/upload", tags=["Upload"])
MAX_FILE_SIZE = 20 * 1024 * 1024


@router.post("/", status_code=status.HTTP_201_CREATED)
async def upload_pdf(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Save a legal PDF to the authenticated user's history."""
    if not file.filename or Path(file.filename).suffix.lower() != ".pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")
    file_bytes = await file.read()
    if not file_bytes.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid PDF.")
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Maximum upload size is 20 MB.")
    try:
        return {"success": True, "data": UploadService(db).save_pdf(current_user.id, file.filename, file_bytes)}
    except NotALegalDocumentError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/")
def list_pdfs(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return {"data": UploadService(db).list_documents(current_user.id)}


@router.post("/{document_id}/analyze")
def analyze_pdf(document_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        return UploadService(db).analyze_pdf(current_user.id, document_id)
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


@router.get("/{document_id}/preview")
def preview_pdf(document_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    file_path = UploadService(db).get_pdf_path(current_user.id, document_id)
    if not file_path:
        raise HTTPException(status_code=404, detail="PDF not found.")
    return FileResponse(file_path, media_type="application/pdf", content_disposition_type="inline")

"""Endpoints for locally saving PDFs and generating contract reports."""

from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.services.upload_service import UploadService

router = APIRouter(prefix="/api/upload", tags=["Upload"])
MAX_FILE_SIZE = 20 * 1024 * 1024


@router.post("/", status_code=status.HTTP_201_CREATED)
async def upload_pdf(file: UploadFile = File(...)):
    """Validate and save a PDF locally without requiring an account."""
    if not file.filename or Path(file.filename).suffix.lower() != ".pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    file_bytes = await file.read()
    if not file_bytes.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid PDF.")
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Maximum upload size is 20 MB.")

    return {"success": True, "data": UploadService().save_pdf(file.filename, file_bytes)}


@router.get("/")
def list_pdfs():
    return {"data": UploadService().list_documents()}


@router.post("/{document_id}/analyze")
def analyze_pdf(document_id: str):
    try:
        return UploadService().analyze_pdf(document_id)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/{document_id}/analysis")
def get_analysis(document_id: str):
    report = UploadService().get_analysis(document_id)
    if not report:
        raise HTTPException(status_code=404, detail="Analysis report not found. Analyze the document first.")
    return report


@router.get("/{document_id}/download")
def preview_pdf(document_id: str):
    file_path = UploadService().get_pdf_path(document_id)
    if not file_path:
        raise HTTPException(status_code=404, detail="PDF not found.")
    return FileResponse(file_path, media_type="application/pdf", content_disposition_type="inline")

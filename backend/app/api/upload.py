"""Endpoints for saving and retrieving locally stored PDF documents."""

from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.services.upload_service import UploadService

router = APIRouter(prefix="/api/upload", tags=["Upload"])
MAX_FILE_SIZE = 20 * 1024 * 1024


@router.post("/", status_code=status.HTTP_201_CREATED)
async def upload_pdf(file: UploadFile = File(...)):
    """Validate a PDF upload, save it locally, and return its metadata."""
    if not file.filename or Path(file.filename).suffix.lower() != ".pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    file_bytes = await file.read()
    if not file_bytes.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid PDF.")
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Maximum upload size is 20 MB.")

    document = UploadService().save_pdf(file.filename, file_bytes)
    return {"success": True, "data": document}


@router.get("/")
def list_pdfs():
    """Return all locally saved PDFs for the recent uploads panel."""
    return {"data": UploadService().list_documents()}


@router.get("/{document_id}/download")
def download_pdf(document_id: str):
    """Stream a saved PDF to the browser instead of exposing file paths."""
    file_path = UploadService().get_pdf_path(document_id)
    if not file_path:
        raise HTTPException(status_code=404, detail="PDF not found.")
    return FileResponse(file_path, media_type="application/pdf", filename=file_path.name)

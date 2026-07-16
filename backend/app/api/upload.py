"""
upload.py

This file contains all API endpoints related to document uploads.

Responsibilities
----------------
1. Receive uploaded PDF/DOCX files from the frontend.
2. Validate uploaded files.
3. Call the UploadService to save and process the file.
4. Return the API response.

NOTE:
This file should NOT contain business logic.
Business logic belongs inside services/upload_service.py
"""

from fastapi import APIRouter
from fastapi import UploadFile
from fastapi import File
from fastapi import HTTPException
from fastapi import status

# Import Upload Service
from app.services.upload_service import UploadService

# ---------------------------------------------------------
# Create Router
#
# Every endpoint inside this router
# will begin with:
#
# /api/upload
#
# Example:
#
# POST /api/upload
# ---------------------------------------------------------

router = APIRouter(
    prefix="/api/upload",
    tags=["Upload"]
)

# Allowed document formats
ALLOWED_FILE_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]

# Maximum file size
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


@router.post("/")
async def upload_document(
    file: UploadFile = File(...)
):
    """
    Upload Contract Endpoint

    Receives a contract file from the frontend.

    Steps:
    ------
    1. Validate filename.
    2. Validate file type.
    3. Validate file size.
    4. Call UploadService.
    5. Return uploaded document details.

    Parameters
    ----------
    file : UploadFile

    Returns
    -------
    JSON Response
    """

    # ---------------------------------------
    # Validate filename
    # ---------------------------------------

    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename is missing."
        )

    # ---------------------------------------
    # Validate MIME type
    # ---------------------------------------

    if file.content_type not in ALLOWED_FILE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF and DOCX files are allowed."
        )

    # ---------------------------------------
    # Read uploaded bytes
    #
    # We read it once so that:
    # - we can check size
    # - later send bytes to UploadService
    # ---------------------------------------

    file_bytes = await file.read()

    # ---------------------------------------
    # Validate File Size
    # ---------------------------------------

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum upload size is 20 MB."
        )

    # ---------------------------------------
    # Call Upload Service
    #
    # UploadService will:
    #
    # • Save file
    # • Generate unique filename
    # • Return file metadata
    # ---------------------------------------

    upload_service = UploadService()

    document = await upload_service.upload_document(
        filename=file.filename,
        content_type=file.content_type,
        file_bytes=file_bytes
    )

    # ---------------------------------------
    # Success Response
    # ---------------------------------------

    return {
        "success": True,
        "message": "Document uploaded successfully.",
        "data": document
    }
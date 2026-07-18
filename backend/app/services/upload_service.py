"""
upload_service.py

Business logic for document uploads.

Responsibilities
----------------
1. Generate a unique filename.
2. Create upload folders if needed.
3. Save uploaded files.
4. Return metadata.
"""

from __future__ import annotations

import uuid
from pathlib import Path
from datetime import datetime


class UploadService:
    """
    Handles document upload operations.
    """

    def __init__(self) -> None:
        # backend/uploads/
        self.upload_root = Path("uploads")

        # backend/uploads/pdfs/
        self.pdf_directory = self.upload_root / "pdfs"

        # backend/uploads/docx/
        self.docx_directory = self.upload_root / "docx"

        # Create folders automatically
        self.pdf_directory.mkdir(parents=True, exist_ok=True)
        self.docx_directory.mkdir(parents=True, exist_ok=True)

    async def upload_document(
        self,
        filename: str,
        content_type: str,
        file_bytes: bytes,
    ) -> dict:
        """
        Save uploaded document and return metadata.
        """

        document_id = str(uuid.uuid4())

        extension = Path(filename).suffix.lower()

        stored_filename = f"{document_id}{extension}"

        if extension == ".pdf":
            save_directory = self.pdf_directory
        else:
            save_directory = self.docx_directory

        file_path = save_directory / stored_filename

        file_path.write_bytes(file_bytes)

        return {
            "document_id": document_id,
            "original_filename": filename,
            "stored_filename": stored_filename,
            "content_type": content_type,
            "size": len(file_bytes),
            "path": str(file_path),
            "status": "uploaded",
            "uploaded_at": datetime.utcnow().isoformat() + "Z",
        }
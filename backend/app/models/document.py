"""Database record for a PDF owned by one user."""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text

from app.database.base import Base


class Document(Base):
    """Stores document history and analysis results without exposing local paths."""

    __tablename__ = "documents"

    id = Column(String(36), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False, unique=True)
    content_type = Column(String(100), nullable=False, default="application/pdf")
    size = Column(Integer, nullable=False)
    storage_path = Column(String(500), nullable=False)
    file_url = Column(String(500), nullable=False)
    sha256 = Column(String(64), nullable=False)
    page_count = Column(Integer, nullable=False, default=0)
    analysis_status = Column(String(30), nullable=False, default="uploaded")
    legal_signals = Column(Text, nullable=False, default="[]")
    risk_topics = Column(Text, nullable=False, default="[]")
    analysis_data = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    analyzed_at = Column(DateTime, nullable=True)

"""Generated report artifacts produced from a completed analysis."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text

from app.database.base import Base


class Report(Base):
    __tablename__ = "reports"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    analysis_id = Column(String(36), ForeignKey("document_analyses.id", ondelete="CASCADE"), nullable=False, index=True)
    language = Column(String(20), nullable=False, default="en")
    title = Column(String(255), nullable=False)
    report_type = Column(String(50), nullable=False, default="contract_risk")
    summary = Column(Text, nullable=True)
    important_points = Column(JSON, nullable=False, default=list)
    report_data = Column(JSON, nullable=False, default=dict)
    report_path = Column(String(500), nullable=True)
    file_size = Column(Integer, nullable=True)
    sha256 = Column(String(64), nullable=True)
    status = Column(String(30), nullable=False, default="queued")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    generated_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

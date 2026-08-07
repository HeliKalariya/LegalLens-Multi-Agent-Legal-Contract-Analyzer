"""Progress tracking for a multi-agent analysis run."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text

from app.database.base import Base


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    analysis_id = Column(String(36), ForeignKey("document_analyses.id", ondelete="CASCADE"), nullable=False, index=True)
    current_step = Column(String(100), nullable=False, default="queued")
    progress = Column(Integer, nullable=False, default=0)
    status = Column(String(30), nullable=False, default="queued")
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

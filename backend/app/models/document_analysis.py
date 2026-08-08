"""A versioned, auditable output from the multi-agent document analysis."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text

from app.database.base import Base


class DocumentAnalysis(Base):
    __tablename__ = "document_analyses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    language = Column(String(20), nullable=False, default="en")
    overall_risk_score = Column(Integer, nullable=True)
    overall_risk_level = Column(String(30), nullable=True)
    summary = Column(Text, nullable=True)
    important_points = Column(JSON, nullable=False, default=list)
    legal_signals = Column(JSON, nullable=False, default=list)
    risk_topics = Column(JSON, nullable=False, default=list)
    raw_analysis = Column(JSON, nullable=False, default=dict)
    model_name = Column(String(100), nullable=True)
    prompt_version = Column(String(50), nullable=True)
    status = Column(String(30), nullable=False, default="queued")
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

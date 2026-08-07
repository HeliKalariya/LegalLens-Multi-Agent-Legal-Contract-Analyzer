"""Extracted clauses belonging to a specific document analysis."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text

from app.database.base import Base


class Clause(Base):
    __tablename__ = "clauses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    analysis_id = Column(String(36), ForeignKey("document_analyses.id", ondelete="CASCADE"), nullable=False, index=True)
    clause_number = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    page_number = Column(Integer, nullable=True)
    original_text = Column(Text, nullable=False)
    plain_english = Column(Text, nullable=True)
    risk_level = Column(String(20), nullable=False, default="safe")
    risk_score = Column(Integer, nullable=False, default=0)
    risk_reason = Column(Text, nullable=True)
    negotiation_suggestion = Column(Text, nullable=True)
    replacement_text = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

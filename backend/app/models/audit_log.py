"""Optional audit trail for important user actions."""

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String

from app.database.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(100), nullable=False)
    entity = Column(String(100), nullable=False)
    entity_id = Column(String(36), nullable=True, index=True)
    ip_address = Column(String(64), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

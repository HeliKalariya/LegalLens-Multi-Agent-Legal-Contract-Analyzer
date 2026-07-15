from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime, timedelta

from app.database.base import Base


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"))

    token = Column(String(500), unique=True)

    expires_at = Column(
        DateTime,
        default=lambda: datetime.utcnow() + timedelta(minutes=15)
    )
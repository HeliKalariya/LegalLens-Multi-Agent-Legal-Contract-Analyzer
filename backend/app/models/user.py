from sqlalchemy import Column, Integer, String, Boolean, DateTime
from datetime import datetime

from app.database.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    full_name = Column(String(100), nullable=False)

    email = Column(String(255), unique=True, index=True, nullable=False)

    hashed_password = Column(String(255), nullable=False)

    is_active = Column(Boolean, default=True)

    is_verified = Column(Boolean, default=False)

    role = Column(String(20), default="USER")

    created_at = Column(DateTime, default=datetime.utcnow)

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )
    organization = Column(
        String(150),
        nullable=True
    )

    job_title = Column(
        String(100),
        nullable=True
    )

    profile_image = Column(
        String(255),
        nullable=True
    )
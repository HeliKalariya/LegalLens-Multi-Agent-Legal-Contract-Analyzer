from sqlalchemy import text

from app.database.database import engine
from app.database.base import Base

from app.models.user import User
from app.models.token import PasswordResetToken
from app.models.document import Document
from app.models.refresh_token import RefreshToken
from app.models.document_analysis import DocumentAnalysis
from app.models.clause import Clause
from app.models.report import Report
from app.models.chat import ChatMessage, ChatSession
from app.models.analysis_job import AnalysisJob
from app.models.audit_log import AuditLog


def init_db():
    if engine.dialect.name != "postgresql":
        raise RuntimeError("LegalLens requires PostgreSQL. Set DATABASE_URL to a PostgreSQL connection string.")

    Base.metadata.create_all(bind=engine)

    # Additive PostgreSQL upgrades keep existing development data compatible.
    upgrades = {
        "analysis_data": "TEXT NOT NULL DEFAULT '{}'",
        "storage_path": "TEXT NOT NULL DEFAULT ''",
        "file_url": "TEXT NOT NULL DEFAULT ''",
        "sha256": "TEXT NOT NULL DEFAULT ''",
        "page_count": "INTEGER NOT NULL DEFAULT 0",
        "document_type": "VARCHAR(80)",
        "detected_language": "VARCHAR(20)",
        "updated_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    }
    user_upgrades = {
        "organization": "VARCHAR(150)",
        "job_title": "VARCHAR(100)",
        "profile_image": "VARCHAR(255)",
        "theme": "VARCHAR(30) NOT NULL DEFAULT 'system'",
        "notifications": "BOOLEAN NOT NULL DEFAULT TRUE",
    }

    with engine.begin() as connection:
        for name, definition in upgrades.items():
            connection.execute(text(f"ALTER TABLE documents ADD COLUMN IF NOT EXISTS {name} {definition}"))
        for name, definition in user_upgrades.items():
            connection.execute(text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {name} {definition}"))
        connection.execute(text("ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS used BOOLEAN NOT NULL DEFAULT FALSE"))
        connection.execute(text("ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS created_at TIMESTAMP"))

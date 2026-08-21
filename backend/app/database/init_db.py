from sqlalchemy import text

from app.database.database import engine
from app.database.base import Base

from app.models.user import User
from app.models.token import EmailVerificationToken, PasswordResetToken
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
        "google_id": "VARCHAR(255)",
    }

    with engine.begin() as connection:
        for name, definition in upgrades.items():
            connection.execute(text(f"ALTER TABLE documents ADD COLUMN IF NOT EXISTS {name} {definition}"))
        for name, definition in user_upgrades.items():
            connection.execute(text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {name} {definition}"))
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_users_google_id ON users (google_id) WHERE google_id IS NOT NULL"))
        connection.execute(text("ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS used BOOLEAN NOT NULL DEFAULT FALSE"))
        connection.execute(text("ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS created_at TIMESTAMP"))
        # Keep exactly one analysis per document and selected language. Remove
        # older duplicate rows (and their dependent data) before adding the
        # database-level uniqueness guarantee for all future requests.
        duplicate_analysis_ids = """
            SELECT id FROM (
                SELECT id,
                    ROW_NUMBER() OVER (
                        PARTITION BY document_id, language
                        ORDER BY
                            CASE WHEN status = 'completed' THEN 0 ELSE 1 END,
                            completed_at DESC NULLS LAST,
                            id DESC
                    ) AS row_number
                FROM document_analyses
            ) ranked
            WHERE row_number > 1
        """
        connection.execute(text(f"DELETE FROM analysis_jobs WHERE analysis_id IN ({duplicate_analysis_ids})"))
        connection.execute(text(f"DELETE FROM clauses WHERE analysis_id IN ({duplicate_analysis_ids})"))
        connection.execute(text(f"DELETE FROM reports WHERE analysis_id IN ({duplicate_analysis_ids})"))
        connection.execute(text(f"DELETE FROM document_analyses WHERE id IN ({duplicate_analysis_ids})"))
        connection.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_document_analyses_document_language
            ON document_analyses (document_id, language)
        """))
        # Older versions always labelled reports as English. Remove mismatched
        # report rows so the correct language-specific report is rebuilt from
        # the completed analysis on its next request.
        connection.execute(text("""
            DELETE FROM reports
            USING document_analyses
            WHERE reports.analysis_id = document_analyses.id
              AND reports.language <> document_analyses.language
        """))
        # Remove only incomplete job placeholders when a completed analysis for the
        # same document already exists. Completed rows and actively running work stay.
        connection.execute(text("""
            DELETE FROM analysis_jobs
            WHERE analysis_id IN (
                SELECT incomplete.id
                FROM document_analyses AS incomplete
                WHERE incomplete.status <> 'completed'
                  AND incomplete.overall_risk_score IS NULL
                  AND incomplete.summary IS NULL
                  AND EXISTS (
                    SELECT 1 FROM document_analyses AS completed
                    WHERE completed.document_id = incomplete.document_id
                      AND completed.status = 'completed'
                  )
            )
        """))
        connection.execute(text("""
            DELETE FROM document_analyses AS incomplete
            WHERE incomplete.status <> 'completed'
              AND incomplete.overall_risk_score IS NULL
              AND incomplete.summary IS NULL
              AND EXISTS (
                SELECT 1
                FROM document_analyses AS completed
                WHERE completed.document_id = incomplete.document_id
                  AND completed.status = 'completed'
              )
        """))

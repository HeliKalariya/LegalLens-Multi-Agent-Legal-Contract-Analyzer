import os
from pathlib import Path

from dotenv import load_dotenv

# Load local development values before creating the settings object.
load_dotenv()

class Settings:

    # ==========================
    # Database
    # ==========================
    # SQLite keeps the starter project runnable without a separate database.
    # Set DATABASE_URL in .env to use PostgreSQL or another SQLAlchemy database.
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./contractiq.db")

    # ==========================
    # JWT
    # ==========================
    SECRET_KEY = os.getenv("SECRET_KEY", "change-this-in-production")
    ALGORITHM = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30)
    )
    REFRESH_TOKEN_EXPIRE_DAYS = int(
        os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", 7)
    )

    # ==========================
    # Mail
    # ==========================
    MAIL_SERVER = os.getenv("MAIL_SERVER")
    MAIL_PORT = int(os.getenv("MAIL_PORT", 587))
    MAIL_USERNAME = os.getenv("MAIL_USERNAME")
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")
    MAIL_FROM = os.getenv("MAIL_FROM")
    MAIL_TLS = os.getenv("MAIL_TLS", "True") == "True"
    MAIL_SSL = os.getenv("MAIL_SSL", "False") == "True"

    # ==========================
    # Project Paths
    # ==========================
    BASE_DIR = Path(__file__).resolve().parent.parent

    UPLOAD_DIR = BASE_DIR / "uploads"
    PDF_UPLOAD_DIR = UPLOAD_DIR / "pdfs"
    DOCX_UPLOAD_DIR = UPLOAD_DIR / "docx"
    REPORT_DIR = BASE_DIR / "reports"

    # ==========================
    # Upload Settings
    # ==========================
    MAX_UPLOAD_SIZE = 20 * 1024 * 1024

    ALLOWED_FILE_TYPES = {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }


settings = Settings()

# Automatically create folders
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.PDF_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.DOCX_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.REPORT_DIR.mkdir(parents=True, exist_ok=True)

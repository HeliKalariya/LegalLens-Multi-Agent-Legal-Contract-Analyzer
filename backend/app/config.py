import os
from pathlib import Path

from dotenv import load_dotenv

# Load local development values before creating the settings object.
load_dotenv()

class Settings:

    # ==========================
    # Database
    # ==========================
    # PostgreSQL is required. Configure DATABASE_URL in backend/.env.
    DATABASE_URL = os.getenv("DATABASE_URL", "")

    if not DATABASE_URL.startswith("postgresql"):
        raise RuntimeError("DATABASE_URL must be a PostgreSQL connection string (postgresql://...)")

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
    # Keep a slow or unreachable SMTP service from holding the reset endpoint
    # open for several minutes. This is an overall send deadline, in seconds.
    MAIL_SEND_TIMEOUT_SECONDS = int(os.getenv("MAIL_SEND_TIMEOUT_SECONDS", 15))
    # Public frontend address used in password-reset links sent by email.
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")

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

    # Use "single" while developing with a limited/free LLM quota. Set this to
    # "multi_agent" for the external demonstration to run the structural,
    # plain-language, risk, and negotiation specialists as separate LLM roles.
    ANALYSIS_MODE = os.getenv("ANALYSIS_MODE", "single").strip().lower()
    if ANALYSIS_MODE not in {"single", "multi_agent"}:
        raise RuntimeError("ANALYSIS_MODE must be either 'single' or 'multi_agent'.")


settings = Settings()

# Automatically create folders
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.PDF_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.DOCX_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.REPORT_DIR.mkdir(parents=True, exist_ok=True)

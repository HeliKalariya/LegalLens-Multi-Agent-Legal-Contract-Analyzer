from sqlalchemy import inspect, text

from app.database.database import engine
from app.database.base import Base

from app.models.user import User
from app.models.token import PasswordResetToken
from app.models.document import Document


def init_db():
    Base.metadata.create_all(bind=engine)

    # Keep development SQLite and PostgreSQL databases compatible with new fields.
    upgrades = {
        "analysis_data": "TEXT NOT NULL DEFAULT '{}'",
        "storage_path": "TEXT NOT NULL DEFAULT ''",
        "file_url": "TEXT NOT NULL DEFAULT ''",
        "sha256": "TEXT NOT NULL DEFAULT ''",
        "page_count": "INTEGER NOT NULL DEFAULT 0",
    }
    user_upgrades = {
        "organization": "VARCHAR(150)",
        "job_title": "VARCHAR(100)",
        "profile_image": "VARCHAR(255)",
    }

    if engine.dialect.name == "sqlite":
        columns = {column["name"] for column in inspect(engine).get_columns("documents")}
        with engine.begin() as connection:
            for name, definition in upgrades.items():
                if name not in columns:
                    connection.execute(text(f"ALTER TABLE documents ADD COLUMN {name} {definition}"))
            user_columns = {column["name"] for column in inspect(engine).get_columns("users")}
            for name, definition in user_upgrades.items():
                if name not in user_columns:
                    connection.execute(text(f"ALTER TABLE users ADD COLUMN {name} {definition}"))
    elif engine.dialect.name == "postgresql":
        with engine.begin() as connection:
            for name, definition in upgrades.items():
                connection.execute(text(f"ALTER TABLE documents ADD COLUMN IF NOT EXISTS {name} {definition}"))
            for name, definition in user_upgrades.items():
                connection.execute(text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {name} {definition}"))

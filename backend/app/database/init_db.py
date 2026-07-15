from app.database.database import engine
from app.database.base import Base

from app.models.user import User
from app.models.token import PasswordResetToken


def init_db():
    Base.metadata.create_all(bind=engine)
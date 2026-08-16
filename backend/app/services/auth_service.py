import hashlib
import secrets
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.config import settings
from app.models.refresh_token import RefreshToken
from app.models.token import PasswordResetToken
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import RegisterRequest
from app.security.hashing import hash_password
from app.security.hashing import verify_password
from app.security.jwt import create_access_token

from app.services.email_service import send_reset_email

class AuthService:

    def __init__(self, db: Session):

        self.repository = UserRepository(db)
        self.db = db

    def _create_refresh_token(self, user_id: int) -> str:
        """Create a server-tracked token used to renew a browser session."""
        token = secrets.token_urlsafe(48)
        self.db.add(
            RefreshToken(
                user_id=user_id,
                token=token,
                expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            )
        )
        return token

    @staticmethod
    def _access_token_for(user: User) -> str:
        return create_access_token({"sub": user.email, "role": user.role})

    def register_user(self, request: RegisterRequest):

        if self.repository.email_exists(request.email):

            raise ValueError("Email already exists")

        user = User(

            full_name=request.full_name,

            email=request.email,

            hashed_password=hash_password(request.password)

        )

        return self.repository.create_user(user)
    
    def login_user(self, email: str, password: str):

        user = self.repository.get_user_by_email(email)

        if not user:
            raise ValueError("Invalid email or password")

        try:
            password_matches = verify_password(password, user.hashed_password)
        except ValueError:
            # Older bcrypt records cannot evaluate passwords beyond bcrypt's limit.
            password_matches = False

        if not password_matches:
            raise ValueError("Invalid email or password")

        access_token = self._access_token_for(user)
        refresh_token = self._create_refresh_token(user.id)
        self.db.commit()

        return {

            "access_token": access_token,

            "refresh_token": refresh_token,

            "token_type": "Bearer",

            "user": {

                "id": user.id,

                "name": user.full_name,

                "email": user.email,

                "role": user.role

            }

        }

    def refresh_session(self, refresh_token: str):
        """Rotate a valid refresh token and issue a new access token."""
        stored_token = (
            self.db.query(RefreshToken)
            .filter(RefreshToken.token == refresh_token)
            .first()
        )

        if not stored_token or stored_token.revoked or stored_token.expires_at <= datetime.utcnow():
            raise ValueError("Your session has expired. Please log in again.")

        user = self.repository.get_user_by_id(stored_token.user_id)
        if not user or not user.is_active:
            raise ValueError("Your session is no longer active. Please log in again.")

        # Token rotation prevents an old browser token from being reused.
        stored_token.revoked = True
        next_refresh_token = self._create_refresh_token(user.id)
        self.db.commit()

        return {
            "access_token": self._access_token_for(user),
            "refresh_token": next_refresh_token,
            "token_type": "Bearer",
        }
    async def forgot_password(
        self,
        email: str
    ):

        user = self.repository.get_user_by_email(email)

        # Never reveal if email exists or not
        if not user:

            return {
                "success": True,
                "message": "If this email exists, a password reset link has been sent."
            }

        # Store only a token hash. The raw, single-use token exists only in
        # the email link and cannot be recovered from the database.
        raw_token = secrets.token_urlsafe(48)
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        self.db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used.is_(False),
        ).update({PasswordResetToken.used: True}, synchronize_session=False)
        self.db.add(
            PasswordResetToken(
                user_id=user.id,
                token=token_hash,
                expires_at=datetime.utcnow() + timedelta(minutes=15),
                used=False,
            )
        )
        self.db.commit()

        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={raw_token}"

        await send_reset_email(
            email=user.email,
            full_name=user.full_name,
            reset_link=reset_link
        )

        return {
            "success": True,
            "message": "Password reset email sent."
        }
        
    async def reset_password(
        self,
        token: str,
        new_password: str
    ):

        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        reset_record = self.db.query(PasswordResetToken).filter(
            PasswordResetToken.token == token_hash,
            PasswordResetToken.used.is_(False),
        ).first()

        if not reset_record or reset_record.expires_at <= datetime.utcnow():
            if reset_record and not reset_record.used:
                reset_record.used = True
                self.db.commit()
            return {"success": False, "message": "Invalid or expired token."}

        user = self.repository.get_user_by_id(reset_record.user_id)

        if user is None:
            return {"success": False, "message": "Invalid or expired token."}

        user.hashed_password = hash_password(new_password)
        reset_record.used = True
        # Password resets invalidate existing browser sessions too.
        self.db.query(RefreshToken).filter(RefreshToken.user_id == user.id).update(
            {RefreshToken.revoked: True}, synchronize_session=False
        )
        self.db.commit()

        return {
            "success": True,
            "message": "Password updated successfully."
        }

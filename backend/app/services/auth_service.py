import hashlib
import secrets
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.config import settings
from app.models.refresh_token import RefreshToken
from app.models.token import EmailVerificationToken, PasswordResetToken
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import RegisterRequest
from app.security.hashing import hash_password
from app.security.hashing import verify_password
from app.security.jwt import create_access_token

from app.services.email_service import send_reset_email, send_verification_email

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

            raise ValueError("This email is already registered. Please log in or verify your email.")

        user = User(

            full_name=request.full_name,

            email=request.email,

            hashed_password=hash_password(request.password)

        )

        self.db.add(user)
        self.db.flush()
        verification_code = self._create_email_verification_code(user.id)
        self.db.commit()
        self.db.refresh(user)
        return user, verification_code

    def _create_email_verification_code(self, user_id: int) -> str:
        """Invalidate earlier codes and issue a fresh six-digit code."""
        self.db.query(EmailVerificationToken).filter(
            EmailVerificationToken.user_id == user_id,
            EmailVerificationToken.used.is_(False),
        ).update({EmailVerificationToken.used: True}, synchronize_session=False)
        code = f"{secrets.randbelow(1_000_000):06d}"
        self.db.add(
            EmailVerificationToken(
                user_id=user_id,
                code_hash=hashlib.sha256(code.encode("utf-8")).hexdigest(),
                expires_at=datetime.utcnow() + timedelta(minutes=15),
                used=False,
            )
        )
        return code

    async def send_email_verification(self, user: User, code: str) -> None:
        await send_verification_email(user.email, user.full_name, code)

    async def resend_email_verification(self, email: str) -> dict:
        user = self.repository.get_user_by_email(email.strip().lower())
        if not user:
            return {"success": True, "message": "If an unverified account exists, a new code has been sent."}
        if user.is_verified:
            return {"success": False, "message": "This email is already verified. Please log in."}

        code = self._create_email_verification_code(user.id)
        self.db.commit()
        await self.send_email_verification(user, code)
        return {"success": True, "message": "A new verification code has been sent."}

    def verify_email_code(self, email: str, code: str) -> dict:
        user = self.repository.get_user_by_email(email.strip().lower())
        if not user:
            raise ValueError("Invalid verification code.")
        if user.is_verified:
            # Clean up records created before this cleanup behavior was added.
            self.db.query(EmailVerificationToken).filter(
                EmailVerificationToken.user_id == user.id,
            ).delete(synchronize_session=False)
            self.db.commit()
            return {"success": True, "message": "Your email is already verified."}

        code_hash = hashlib.sha256(code.encode("utf-8")).hexdigest()
        record = self.db.query(EmailVerificationToken).filter(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.code_hash == code_hash,
            EmailVerificationToken.used.is_(False),
        ).order_by(EmailVerificationToken.id.desc()).first()
        if not record or record.expires_at <= datetime.utcnow():
            raise ValueError("This verification code is invalid or expired.")

        user.is_verified = True
        # A verified account must not retain a reusable or historical email code.
        # Delete every code for this user, including the one just accepted.
        self.db.query(EmailVerificationToken).filter(
            EmailVerificationToken.user_id == user.id,
        ).delete(synchronize_session=False)
        self.db.commit()
        return {"success": True, "message": "Email verified successfully. You can now log in."}
    
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

        if not user.is_verified:
            # Login has confirmed the password. The API route will resend a code
            # and the frontend will continue at the verification screen.
            return {
                "verification_required": True,
                "email": user.email,
            }

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

    def login_with_google(self, *, google_id: str, email: str, full_name: str):
        """Find or create the local account for a verified Google identity."""
        normalized_email = email.strip().lower()
        user = self.db.query(User).filter(User.google_id == google_id).first()

        if user is None:
            # Link an existing password account only when Google proves it owns
            # the same email address. This prevents duplicate local accounts.
            user = self.repository.get_user_by_email(normalized_email)
            if user is not None:
                user.google_id = google_id
                user.is_verified = True
            else:
                # Google-authenticated users do not choose a local password.
                # Store a random, unusable hash so the existing non-null schema
                # remains compatible and password login is never enabled by it.
                user = User(
                    full_name=(full_name or normalized_email.split("@", 1)[0])[:100],
                    email=normalized_email,
                    google_id=google_id,
                    hashed_password=hash_password(secrets.token_urlsafe(48)),
                    is_verified=True,
                )
                self.db.add(user)

        self.db.flush()
        access_token = self._access_token_for(user)
        refresh_token = self._create_refresh_token(user.id)
        self.db.commit()
        self.db.refresh(user)

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "Bearer",
            "user": {
                "id": user.id,
                "name": user.full_name,
                "email": user.email,
                "role": user.role,
            },
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

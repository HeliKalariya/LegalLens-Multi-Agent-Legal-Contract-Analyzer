from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import RegisterRequest
from app.security.hashing import hash_password
from app.security.hashing import verify_password
from app.security.jwt import create_access_token

from app.repositories.user_repository import UserRepository

from app.security.hashing import hash_password
from app.security.jwt import (
    create_reset_token,
    verify_reset_token
)

from app.services.email_service import send_reset_email

class AuthService:

    def __init__(self, db: Session):

        self.repository = UserRepository(db)

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

        if not verify_password(
            password,
            user.hashed_password
        ):

            raise ValueError("Invalid email or password")

        access_token = create_access_token(
            {
                "sub": user.email,
                "role": user.role
            }
        )

        return {

            "access_token": access_token,

            "token_type": "Bearer",

            "user": {

                "id": user.id,

                "name": user.full_name,

                "email": user.email,

                "role": user.role

            }

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

        reset_token = create_reset_token(user.email)

        reset_link = (
            f"http://localhost:3000/reset-password?token={reset_token}"
        )

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

        email = verify_reset_token(token)

        if email is None:

            return {
                "success": False,
                "message": "Invalid or expired token."
            }

        user = self.repository.get_user_by_email(email)

        if user is None:

            return {
                "success": False,
                "message": "User not found."
            }

        user.hashed_password = hash_password(new_password)

        self.repository.db.commit()

        return {
            "success": True,
            "message": "Password updated successfully."
        }
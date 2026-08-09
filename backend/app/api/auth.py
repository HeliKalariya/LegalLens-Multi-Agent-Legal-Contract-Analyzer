import uuid
from pathlib import Path
from typing import Literal

from fastapi import APIRouter
from fastapi import Depends
from fastapi import File
from fastapi import HTTPException
from fastapi import status
from fastapi import UploadFile
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel


from sqlalchemy.orm import Session
from app.database.session import get_db

from app.schemas.auth import RegisterRequest
from app.schemas.auth import LoginRequest
from app.schemas.auth import RefreshTokenRequest
from app.schemas.auth import ProfileUpdateRequest
from app.services.auth_service import AuthService

from app.security.oauth import get_current_user
from app.models.user import User
from app.config import settings
from app.security.jwt import create_access_token

from app.services.auth_service import AuthService

from app.schemas.auth import (
    ForgotPasswordRequest,
    ResetPasswordRequest,
    MessageResponse
)

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)


class ThemeUpdateRequest(BaseModel):
    """The two themes supported by the dashboard."""

    theme: Literal["light", "dark"]


def profile_payload(user: User) -> dict:
    """Return the profile shape consumed by the settings screen."""
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "organization": user.organization,
        "job_title": user.job_title,
        "profile_image": user.profile_image,
        "role": user.role,
        "theme": user.theme or "light",
    }


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED
)
def register(

    request: RegisterRequest,

    db: Session = Depends(get_db)

):

    service = AuthService(db)

    try:

        user = service.register_user(request)

        return {

            "success": True,

            "message": "Registration successful",

            "user": {

                "id": user.id,

                "name": user.full_name,

                "email": user.email

            }

        }

    except ValueError as e:

        raise HTTPException(

            status_code=400,

            detail=str(e)

        )

@router.post("/login")
def login(

    request: LoginRequest,

    db: Session = Depends(get_db)

):

    service = AuthService(db)

    try:

        return service.login_user(
            request.email,
            request.password
        )

    except ValueError as e:

        raise HTTPException(

            status_code=401,

            detail=str(e)

        )


@router.post("/refresh")
def refresh_access_token(
    request: RefreshTokenRequest,
    db: Session = Depends(get_db),
):
    """Keep an active browser session signed in after its access token expires."""
    try:
        return AuthService(db).refresh_session(request.refresh_token)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(error))
@router.get("/me")
def me(

    current_user: User = Depends(get_current_user)

):

    return profile_payload(current_user)


@router.put("/me")
def update_profile(
    request: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the signed-in user's profile and refresh their token if email changes."""
    existing_user = (
        db.query(User)
        .filter(User.email == request.email, User.id != current_user.id)
        .first()
    )
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already exists")

    current_user.full_name = request.full_name.strip()
    current_user.email = str(request.email).lower()
    current_user.organization = request.organization.strip() if request.organization else None
    current_user.job_title = request.job_title.strip() if request.job_title else None
    db.commit()
    db.refresh(current_user)

    return {
        "user": profile_payload(current_user),
        "access_token": create_access_token({"sub": current_user.email, "role": current_user.role}),
    }


@router.put("/theme")
def update_theme(
    request: ThemeUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Persist the dashboard theme for the signed-in user."""
    current_user.theme = request.theme
    db.commit()
    return {"theme": current_user.theme}


@router.post("/me/avatar")
async def upload_profile_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save a small profile image locally and store its public path on the user."""
    allowed_types = {"image/png": ".png", "image/jpeg": ".jpg"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PNG and JPG images are allowed.")

    contents = await file.read()
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Avatar image must be 2 MB or smaller.")

    avatar_directory = settings.UPLOAD_DIR / "profile"
    avatar_directory.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4()}{allowed_types[file.content_type]}"
    (avatar_directory / filename).write_bytes(contents)
    current_user.profile_image = f"/uploads/profile/{filename}"
    db.commit()
    db.refresh(current_user)
    return {"profile_image": current_user.profile_image}


@router.delete("/me/avatar")
def delete_profile_avatar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove the signed-in user's avatar from local storage and the database."""
    image_path = current_user.profile_image
    current_user.profile_image = None
    db.commit()

    if image_path and image_path.startswith("/uploads/profile/"):
        (settings.UPLOAD_DIR / "profile" / Path(image_path).name).unlink(missing_ok=True)

    return {"profile_image": None}
@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK
)
async def forgot_password(

    request: ForgotPasswordRequest,

    db: Session = Depends(get_db)

):

    service = AuthService(db)

    return await service.forgot_password(
        request.email
    )
@router.post(
    "/reset-password",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK
)
async def reset_password(

    request: ResetPasswordRequest,

    db: Session = Depends(get_db)

):

    service = AuthService(db)

    return await service.reset_password(

        token=request.token,

        new_password=request.new_password

    )

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter
from fastapi import Depends
from fastapi import File
from fastapi import HTTPException
from fastapi import Request
from fastapi import status
from fastapi import UploadFile
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import BaseModel


from sqlalchemy.orm import Session
from app.database.session import get_db

from app.schemas.auth import RegisterRequest
from app.schemas.auth import LoginRequest
from app.schemas.auth import RefreshTokenRequest
from app.schemas.auth import ProfileUpdateRequest
from app.schemas.auth import EmailVerificationRequest
from app.schemas.auth import ResendVerificationRequest
from app.services.auth_service import AuthService
from app.services.email_service import EmailDeliveryError

from app.security.oauth import get_current_user
from app.models.user import User
from app.config import settings
from app.security.jwt import create_access_token

from app.schemas.auth import (
    ForgotPasswordRequest,
    ResetPasswordRequest,
    MessageResponse
)

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)

GOOGLE_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


def _google_frontend_redirect(values: dict[str, str]) -> RedirectResponse:
    """Return OAuth results in a URL fragment so tokens are not sent to servers."""
    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}/auth/google/callback#{urlencode(values)}",
        status_code=status.HTTP_302_FOUND,
    )


def _google_state() -> str:
    """Create a short-lived CSRF state value for a Google sign-in attempt."""
    return jwt.encode(
        {
            "type": "google_oauth_state",
            "nonce": secrets.token_urlsafe(24),
            "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def _valid_google_state(state: str) -> bool:
    try:
        payload = jwt.decode(state, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload.get("type") == "google_oauth_state" and bool(payload.get("nonce"))
    except JWTError:
        return False


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
async def register(

    request: RegisterRequest,

    db: Session = Depends(get_db)

):

    service = AuthService(db)

    try:

        user, verification_code = service.register_user(request)
        await service.send_email_verification(user, verification_code)

        return {

            "success": True,

            "message": "Registration successful. Check your email for the verification code.",

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
    except EmailDeliveryError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error))

@router.post("/login")
async def login(

    request: LoginRequest,

    db: Session = Depends(get_db)

):

    service = AuthService(db)

    try:

        result = service.login_user(
            request.email,
            request.password
        )
        if result.get("verification_required"):
            try:
                delivery = await service.resend_email_verification(result["email"])
                message = delivery["message"]
            except EmailDeliveryError:
                # The verification page still lets the user try Resend. Do not
                # make a valid account inaccessible because mail is temporary down.
                message = "Your email still needs verification. Request a new code from the verification page."
            return {**result, "message": message}
        return result

    except ValueError as e:

        raise HTTPException(

            status_code=401,

            detail=str(e)

        )


@router.post("/verify-email", response_model=MessageResponse)
def verify_email(request: EmailVerificationRequest, db: Session = Depends(get_db)):
    """Verify a registration code and activate password login for the account."""
    try:
        return AuthService(db).verify_email_code(str(request.email), request.code)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error))


@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification(request: ResendVerificationRequest, db: Session = Depends(get_db)):
    """Issue and email a replacement code for an unverified account."""
    try:
        return await AuthService(db).resend_email_verification(str(request.email))
    except EmailDeliveryError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error))


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


@router.get("/google/login")
def google_login():
    """Redirect the browser to Google's consent page for a secure OAuth login."""
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to backend/.env.",
        )

    state = _google_state()
    query = urlencode(
        {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "prompt": "select_account",
        }
    )
    response = RedirectResponse(f"{GOOGLE_AUTHORIZATION_URL}?{query}", status_code=status.HTTP_302_FOUND)
    # Bind the signed state value to this browser to prevent login-CSRF.
    response.set_cookie("google_oauth_state", state, max_age=600, httponly=True, samesite="lax")
    return response


@router.get("/google/callback")
async def google_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
):
    """Exchange Google authorization code, persist the profile, then issue app tokens."""
    if error:
        return _google_frontend_redirect({"error": "Google sign-in was cancelled or denied."})
    if not code or not state or state != request.cookies.get("google_oauth_state") or not _valid_google_state(state):
        return _google_frontend_redirect({"error": "Google sign-in could not be verified. Please try again."})

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            token_response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code",
                },
            )
            token_response.raise_for_status()
            google_access_token = token_response.json().get("access_token")
            if not google_access_token:
                raise ValueError("Google did not return an access token.")

            profile_response = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {google_access_token}"},
            )
            profile_response.raise_for_status()
            profile = profile_response.json()

        google_id = str(profile.get("sub") or "")
        email = str(profile.get("email") or "")
        if not google_id or not email or profile.get("email_verified") is not True:
            raise ValueError("Google did not provide a verified email address.")

        result = AuthService(db).login_with_google(
            google_id=google_id,
            email=email,
            full_name=str(profile.get("name") or ""),
        )
        response = _google_frontend_redirect(
            {
                "access_token": result["access_token"],
                "refresh_token": result["refresh_token"],
            }
        )
        response.delete_cookie("google_oauth_state")
        return response
    except (httpx.HTTPError, ValueError) as exc:
        return _google_frontend_redirect({"error": f"Google sign-in failed: {exc}"})

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
    """Update editable profile fields. Email addresses are immutable account IDs."""
    if str(request.email).lower() != current_user.email.lower():
        raise HTTPException(status_code=400, detail="Email address cannot be changed.")

    current_user.full_name = request.full_name.strip()
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

    try:
        return await service.forgot_password(request.email)
    except EmailDeliveryError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error))
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

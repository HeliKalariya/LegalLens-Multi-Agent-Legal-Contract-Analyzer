from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import status
from fastapi.security import OAuth2PasswordRequestForm


from sqlalchemy.orm import Session
from app.database.session import get_db

from app.schemas.auth import RegisterRequest
from app.schemas.auth import LoginRequest
from app.services.auth_service import AuthService

from app.security.oauth import get_current_user
from app.models.user import User

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
@router.get("/me")
def me(

    current_user: User = Depends(get_current_user)

):

    return {

        "id": current_user.id,

        "name": current_user.full_name,

        "email": current_user.email,

        "role": current_user.role

    }
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
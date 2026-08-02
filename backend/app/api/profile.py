from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import status
from fastapi import UploadFile
from fastapi import File

from sqlalchemy.orm import Session

from app.database.session import get_db

from app.models.user import User

from app.security.oauth import get_current_user

from app.services.profile_service import ProfileService

from app.schemas.profile import (
    ProfileResponse,
    UpdateProfileRequest,
    ChangePasswordRequest,
    ProfileMessageResponse,
    UploadProfileImageResponse
)


router = APIRouter(
    prefix="/api/profile",
    tags=["Profile"]
)


# =====================================
# Get Profile
# =====================================

@router.get(
    "",
    response_model=ProfileResponse
)
def get_profile(

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user)

):

    service = ProfileService(db)

    try:

        return service.get_profile(current_user.id)

    except ValueError as e:

        raise HTTPException(

            status_code=404,

            detail=str(e)

        )


# =====================================
# Update Profile
# =====================================

@router.put(
    "",
    response_model=ProfileResponse
)
def update_profile(

    request: UpdateProfileRequest,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user)

):

    service = ProfileService(db)

    try:

        return service.update_profile(

            user_id=current_user.id,

            full_name=request.full_name,

            organization=request.organization,

            job_title=request.job_title

        )

    except ValueError as e:

        raise HTTPException(

            status_code=400,

            detail=str(e)

        )


# =====================================
# Change Password
# =====================================

@router.put(
    "/change-password",
    response_model=ProfileMessageResponse
)
def change_password(

    request: ChangePasswordRequest,

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user)

):

    service = ProfileService(db)

    try:

        return service.change_password(

            user_id=current_user.id,

            current_password=request.current_password,

            new_password=request.new_password

        )

    except ValueError as e:

        raise HTTPException(

            status_code=400,

            detail=str(e)

        )
@router.post(
    "/upload-image",
    response_model=UploadProfileImageResponse
)
# upload image 
# =============
def upload_profile_image(

    file: UploadFile = File(...),

    db: Session = Depends(get_db),

    current_user: User = Depends(get_current_user)

):

    service = ProfileService(db)

    try:

        return service.upload_profile_image(

            current_user.id,

            file

        )

    except ValueError as e:

        raise HTTPException(

            status_code=400,

            detail=str(e)

        )
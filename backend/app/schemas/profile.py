from pydantic import BaseModel, EmailStr, Field
from fastapi import UploadFile

# ==========================
# Get Profile Response
# ==========================

class ProfileResponse(BaseModel):

    id: int

    full_name: str

    email: EmailStr

    organization: str | None = None

    job_title: str | None = None

    profile_image: str | None = None

    role: str

    class Config:
        from_attributes = True


# ==========================
# Update Profile Request
# ==========================

class UpdateProfileRequest(BaseModel):

    full_name: str = Field(
        ...,
        min_length=3,
        max_length=100
    )

    organization: str | None = Field(
        default=None,
        max_length=150
    )

    job_title: str | None = Field(
        default=None,
        max_length=100
    )


# ==========================
# Upload Image Response
# ==========================

class UploadImageResponse(BaseModel):

    success: bool

    message: str

    image_url: str | None = None


# ==========================
# Change Password
# ==========================

class ChangePasswordRequest(BaseModel):

    current_password: str = Field(
        ...,
        min_length=8
    )

    new_password: str = Field(
        ...,
        min_length=8,
        max_length=100
    )


# ==========================
# Message Response
# ==========================

class ProfileMessageResponse(BaseModel):

    success: bool

    message: str

class UploadProfileImageResponse(BaseModel):
    success: bool
    message: str
    image_url: str
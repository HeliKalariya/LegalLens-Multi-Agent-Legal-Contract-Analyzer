from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):

    full_name: str = Field(
        ...,
        min_length=3,
        max_length=100
    )

    email: EmailStr

    password: str = Field(
        ...,
        min_length=8,
        max_length=128
    )


class LoginRequest(BaseModel):

    email: EmailStr

    password: str


class ProfileUpdateRequest(BaseModel):
    """Editable fields for the signed-in user's profile."""

    full_name: str = Field(..., min_length=3, max_length=100)
    email: EmailStr
    organization: str | None = Field(default=None, max_length=150)
    job_title: str | None = Field(default=None, max_length=100)



class ForgotPasswordRequest(BaseModel):

    email: EmailStr


class ResetPasswordRequest(BaseModel):

    token: str = Field(
        ...,
        description="JWT Reset Token"
    )

    new_password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="New Password"
    )



class TokenResponse(BaseModel):

    access_token: str

    token_type: str = "Bearer"


class UserResponse(BaseModel):

    id: int

    full_name: str

    email: EmailStr

    role: str

    is_verified: bool

    class Config:
        from_attributes = True
        
# ==========================
# Generic Response
# ==========================

class MessageResponse(BaseModel):

    success: bool

    message: str

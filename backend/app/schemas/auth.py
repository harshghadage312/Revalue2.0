from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, field_validator


class UserRegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=60)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    role: str = Field(default="buyer", pattern="^(buyer|seller|admin)$")


class RegisterSendOtpRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=60)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    role: str = Field(default="buyer", pattern="^(buyer|seller)$")


class RegisterSendOtpResponse(BaseModel):
    message: str
    email: str
    cooldown_seconds: int = 60
    expires_in_minutes: int = 5
    dev_otp: Optional[str] = None


class RegisterVerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6, pattern="^[0-9]{6}$")


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserProfileResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str
    is_active: bool = True
    phone: Optional[str] = None
    address: Optional[str] = None
    created_at: datetime
    average_rating: Optional[float] = 0.0
    review_count: int = 0


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in_minutes: int
    user: UserProfileResponse


class RegisterVerifyOtpResponse(BaseModel):
    message: str
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in_minutes: int
    user: UserProfileResponse


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    message: str
    cooldown_seconds: int = 60
    dev_reset_token: Optional[str] = None
    dev_reset_url: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("token")
    @classmethod
    def clean_token(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("Token must not be empty.")
        return clean

    @field_validator("new_password")
    @classmethod
    def clean_password(cls, v: str) -> str:
        clean = v.strip()
        if len(clean) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        return clean


class ResetPasswordResponse(BaseModel):
    message: str


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=60)
    phone: Optional[str] = None
    address: Optional[str] = None

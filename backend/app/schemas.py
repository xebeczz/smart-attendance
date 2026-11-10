"""Request / response schemas (Pydantic v2).

Validation errors raised here surface as HTTP 422 from FastAPI, which is
exactly what the attendance endpoints must return for bad numbers.
"""

from pydantic import BaseModel, EmailStr, Field, model_validator


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=1)
    student_id: str = Field(min_length=1)
    email: EmailStr
    department: str = Field(min_length=1)
    year: int = Field(ge=1, le=6)
    section: str = Field(min_length=1)
    password: str = Field(min_length=6)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class UpdateProfileRequest(BaseModel):
    full_name: str = Field(min_length=1)
    department: str = Field(min_length=1)
    year: int = Field(ge=1, le=6)
    section: str = Field(min_length=1)


class UserResponse(BaseModel):
    id: int
    full_name: str
    student_id: str
    email: str
    department: str
    year: int
    section: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class SubjectInput(BaseModel):
    """Shared validation for manual entry and PUT: total > 0 and
    0 <= attended <= total, otherwise 422."""
    subject_name: str = Field(min_length=1)
    total_classes: int
    attended: int

    @model_validator(mode="after")
    def _check_numbers(self):
        if self.total_classes <= 0:
            raise ValueError("total_classes must be greater than 0")
        if self.attended < 0:
            raise ValueError("attended must be 0 or more")
        if self.attended > self.total_classes:
            raise ValueError("attended cannot exceed total_classes")
        return self


class SubjectUpdate(BaseModel):
    total_classes: int
    attended: int

    @model_validator(mode="after")
    def _check_numbers(self):
        if self.total_classes <= 0:
            raise ValueError("total_classes must be greater than 0")
        if self.attended < 0:
            raise ValueError("attended must be 0 or more")
        if self.attended > self.total_classes:
            raise ValueError("attended cannot exceed total_classes")
        return self


class SubjectResponse(BaseModel):
    id: int
    subject_name: str
    total_classes: int
    attended: int
    absent: int
    percentage: float
    status: str

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    name: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class MarketSummary(BaseModel):
    id: int
    name: str
    country: str
    category: str
    brand_name: str
    keywords: list[str]
    competitors: list[str]


class ScanResponse(BaseModel):
    market_id: int
    scanned_at: str
    keyword_count: int
    products_observed: int
    message: str

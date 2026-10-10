from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status

from app import repo
from app.api.deps import get_current_user
from app.core.security import create_access_token, verify_password
from app.schemas import LoginRequest, TokenResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest) -> TokenResponse:
    user = repo.get_user_by_email(str(payload.email).lower())
    if user is None or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    public_user = UserResponse(id=user["id"], email=user["email"], name=user["name"])
    return TokenResponse(
        access_token=create_access_token(user["id"], user["email"]),
        user=public_user,
    )


@router.get("/me", response_model=UserResponse)
def me(current_user: Annotated[dict[str, Any], Depends(get_current_user)]) -> UserResponse:
    return UserResponse(**current_user)

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_access_token
from app.db import get_connection

bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
) -> dict[str, object]:
    payload = decode_access_token(credentials.credentials)
    with get_connection() as connection:
        user = connection.execute(
            "SELECT id, email, name FROM users WHERE id = ?", (payload["sub"],)
        ).fetchone()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer exists")
    return dict(user)

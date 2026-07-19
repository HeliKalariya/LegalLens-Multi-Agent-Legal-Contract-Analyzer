from fastapi import Depends
from fastapi import HTTPException
from fastapi.security import OAuth2PasswordBearer

from sqlalchemy.orm import Session

from app.database.session import get_db

from app.repositories.user_repository import UserRepository

from app.security.jwt import verify_token


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/token"
)

def get_current_user(

    token: str = Depends(oauth2_scheme),

    db: Session = Depends(get_db)

):
    print("TOKEN RECEIVED:", token)
    payload = verify_token(token)
    print("PAYLOAD:", payload)
    if payload is None:

        raise HTTPException(

            status_code=401,

            detail="Invalid Token"

        )

    email = payload.get("sub")
    print("EMAIL:", email)
    repository = UserRepository(db)

    user = repository.get_user_by_email(email)
    print("USER:", user)
    if not user:

        raise HTTPException(

            status_code=404,

            detail="User not found"

        )

    return user
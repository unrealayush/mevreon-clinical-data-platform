"""JWT auth for the Mevreon GCP backend.

Stateless, bcrypt-backed, in-memory user store seeded with a default admin
(override via ADMIN_EMAIL / ADMIN_PASSWORD). Swap to Firebase/Auth0/Cognito
for a production deployment.
"""
import os
import secrets
import datetime
from passlib.context import CryptContext
from jose import jwt
from .config import (
    JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_MIN,
    ADMIN_EMAIL, ADMIN_PASSWORD,
    API_ACCESS_KEY, API_SECRET_KEY,
)

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

# email -> bcrypt hash (per container; sufficient for a stateless demo)
_USERS: dict[str, str] = {ADMIN_EMAIL: _pwd.hash(ADMIN_PASSWORD)}


def register(email: str, password: str) -> dict:
    email = email.strip().lower()
    if email in _USERS:
        raise ValueError("User already exists")
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    _USERS[email] = _pwd.hash(password)
    return {"email": email, "accessToken": create_token(email)}


def authenticate(email: str, password: str) -> dict:
    email = email.strip().lower()
    hashed = _USERS.get(email)
    if not hashed or not _pwd.verify(password, hashed):
        return None
    return {"email": email, "accessToken": create_token(email)}


def authenticate_key(access_key_id: str, secret_access_key: str):
    """Validate API access keys (the AWS IAM-style login) and mint a JWT.

    Returns a token response dict, or None when the key pair is invalid.
    Comparison is constant-time to avoid timing oracles.
    """
    ok = (
        secrets.compare_digest(str(access_key_id), API_ACCESS_KEY)
        and secrets.compare_digest(str(secret_access_key), API_SECRET_KEY)
    )
    if not ok:
        return None
    principal = "mevreon-clinical-user"
    return {"email": principal, "accessToken": create_token(principal)}


def create_token(email: str) -> str:
    exp = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=JWT_EXPIRE_MIN)
    return jwt.encode({"sub": email, "exp": exp}, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])

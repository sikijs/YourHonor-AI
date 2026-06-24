import bcrypt
import os
import secrets
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional

from app.db import DATABASE_PATH


def _load_jwt_secret() -> str:
    """Return the JWT signing secret.

    Prefers the JWT_SECRET env var. Otherwise generates a random secret once and
    persists it in the data volume (alongside the database) so it stays stable
    across container restarts (keeping sessions valid) while remaining unique per
    install.
    """
    env_secret = os.getenv("JWT_SECRET")
    if env_secret:
        return env_secret

    secret_path = DATABASE_PATH.parent / ".jwt_secret"
    secret_path.parent.mkdir(parents=True, exist_ok=True)
    if secret_path.exists():
        existing = secret_path.read_text().strip()
        if existing:
            return existing

    new_secret = secrets.token_urlsafe(48)
    secret_path.write_text(new_secret)
    try:
        secret_path.chmod(0o600)
    except OSError:
        pass
    return new_secret


JWT_SECRET = _load_jwt_secret()
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7


def verify_password(plain_password: str, hashed_password: str) -> bool:
    # bcrypt only uses the first 72 bytes and (>=5.0) raises on longer input,
    # so truncate to match how hashes were generated.
    password_bytes = plain_password.encode('utf-8')[:72]
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_bytes)


def get_password_hash(password: str) -> str:
    password_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
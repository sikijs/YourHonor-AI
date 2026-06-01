from fastapi import APIRouter, HTTPException, Response, Cookie
from fastapi.responses import JSONResponse
from typing import Optional
from app.db import get_db
from app.models.user import UserCreate, UserResponse, UserLogin
from app.services.auth import verify_password, get_password_hash, create_access_token, decode_token

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/signup", response_model=UserResponse)
def signup(user: UserCreate):
    conn = get_db()
    cursor = conn.cursor()

    existing = cursor.execute("SELECT id FROM users WHERE email = ?", (user.email,)).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    password_hash = get_password_hash(user.password)
    cursor.execute(
        "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, datetime('now'))",
        (user.email, password_hash)
    )
    conn.commit()
    user_id = cursor.lastrowid
    
    db_user = cursor.execute("SELECT created_at FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()

    return {"id": user_id, "email": user.email, "created_at": db_user["created_at"]}

@router.post("/signin")
def signin(response: Response, user: UserLogin):
    conn = get_db()
    cursor = conn.cursor()

    db_user = cursor.execute("SELECT * FROM users WHERE email = ?", (user.email,)).fetchone()
    conn.close()

    if not db_user or not verify_password(user.password, db_user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = create_access_token(data={"sub": str(db_user["id"]), "email": db_user["email"]})

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 7
    )

    return {"message": "Login successful", "email": db_user["email"], "id": db_user["id"]}

@router.post("/signout")
def signout(response: Response):
    response.delete_cookie(key="access_token")
    return {"message": "Logged out"}

@router.get("/me", response_model=UserResponse)
def me(access_token: Optional[str] = Cookie(None)):
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = decode_token(access_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("sub")
    conn = get_db()
    cursor = conn.cursor()
    db_user = cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()

    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    return {"id": db_user["id"], "email": db_user["email"], "created_at": db_user["created_at"]}
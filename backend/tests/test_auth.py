def test_signup_creates_user(client):
    resp = client.post("/api/auth/signup", json={
        "email": "newuser@example.com",
        "password": "securepass",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "newuser@example.com"
    assert "id" in data
    assert "created_at" in data


def test_signup_duplicate_email_returns_400(client):
    client.post("/api/auth/signup", json={
        "email": "dup@example.com",
        "password": "securepass",
    })
    resp = client.post("/api/auth/signup", json={
        "email": "dup@example.com",
        "password": "anotherpass",
    })
    assert resp.status_code == 400
    assert "already registered" in resp.json()["detail"].lower()


def test_signin_valid_credentials_returns_cookie(client):
    client.post("/api/auth/signup", json={
        "email": "signin@example.com",
        "password": "validpass",
    })
    resp = client.post("/api/auth/signin", json={
        "email": "signin@example.com",
        "password": "validpass",
    })
    assert resp.status_code == 200
    assert "access_token" in resp.cookies
    data = resp.json()
    assert data["email"] == "signin@example.com"
    assert "id" in data


def test_signin_invalid_password_returns_401(client):
    client.post("/api/auth/signup", json={
        "email": "badpass@example.com",
        "password": "correctpass",
    })
    resp = client.post("/api/auth/signin", json={
        "email": "badpass@example.com",
        "password": "wrongpass",
    })
    assert resp.status_code == 401


def test_signin_nonexistent_user_returns_401(client):
    resp = client.post("/api/auth/signin", json={
        "email": "nobody@example.com",
        "password": "anypass",
    })
    assert resp.status_code == 401


def test_me_with_valid_token_returns_user(client):
    client.post("/api/auth/signup", json={
        "email": "mecheck@example.com",
        "password": "testpass",
    })
    signin = client.post("/api/auth/signin", json={
        "email": "mecheck@example.com",
        "password": "testpass",
    })
    token = signin.cookies.get("access_token")
    resp = client.get("/api/auth/me", cookies={"access_token": token})
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "mecheck@example.com"
    assert "id" in data
    assert "created_at" in data


def test_me_without_token_returns_401(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_me_with_invalid_token_returns_401(client):
    resp = client.get("/api/auth/me", cookies={"access_token": "invalid-token-value"})
    assert resp.status_code == 401


def test_signout_clears_cookie(client):
    resp = client.post("/api/auth/signout")
    assert resp.status_code == 200
    set_cookie = resp.headers.get("set-cookie", "")
    assert "access_token=" in set_cookie
    assert "Max-Age=0" in set_cookie or "expires=Thu, 01 Jan 1970" in set_cookie

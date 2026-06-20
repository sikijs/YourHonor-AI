def test_greeting_returns_welcome_message(client, auth_headers):
    resp = client.get("/api/chat/greeting", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "greeting" in data
    assert "YourHonor AI" in data["greeting"]


def test_greeting_without_auth_returns_401(client):
    resp = client.get("/api/chat/greeting")
    assert resp.status_code == 401


def test_chat_message_returns_response(client, auth_headers):
    resp = client.post("/api/chat/message", headers=auth_headers, json={
        "message": "What is contract law?",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "response" in data
    assert "sources" in data
    assert "retrieval_count" in data


def test_chat_message_without_auth_returns_401(client):
    resp = client.post("/api/chat/message", json={
        "message": "test",
    })
    assert resp.status_code == 401

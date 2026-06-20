def test_list_documents_empty_returns_empty_list(client, auth_headers):
    resp = client.get("/api/documents", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_documents_without_auth_returns_401(client):
    resp = client.get("/api/documents")
    assert resp.status_code == 401


def test_create_document_returns_created_doc(client, auth_headers):
    resp = client.post("/api/documents", headers=auth_headers, json={
        "title": "Test Document",
        "content": "This is test content.",
        "doc_type": "note",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Test Document"
    assert data["content"] == "This is test content."
    assert data["doc_type"] == "note"
    assert "id" in data
    assert data["user_id"] is not None


def test_create_document_without_content(client, auth_headers):
    resp = client.post("/api/documents", headers=auth_headers, json={
        "title": "Minimal Doc",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Minimal Doc"
    assert data["content"] is None


def test_get_document_returns_doc(client, auth_headers):
    create = client.post("/api/documents", headers=auth_headers, json={
        "title": "Get Test",
        "content": "Content to retrieve.",
    })
    doc_id = create.json()["id"]
    resp = client.get(f"/api/documents/{doc_id}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == doc_id
    assert data["title"] == "Get Test"
    assert data["content"] == "Content to retrieve."


def test_get_document_not_found_returns_404(client, auth_headers):
    resp = client.get("/api/documents/99999", headers=auth_headers)
    assert resp.status_code == 404


def test_get_document_other_users_doc_returns_404(client, auth_headers):
    create = client.post("/api/documents", headers=auth_headers, json={
        "title": "Private Doc",
        "content": "Secret.",
    })
    doc_id = create.json()["id"]

    client.post("/api/auth/signup", json={
        "email": "other@example.com",
        "password": "pass1234",
    })
    signin = client.post("/api/auth/signin", json={
        "email": "other@example.com",
        "password": "pass1234",
    })
    other_token = signin.cookies.get("access_token")
    other_headers = {"Cookie": f"access_token={other_token}"}
    resp = client.get(f"/api/documents/{doc_id}", headers=other_headers)
    assert resp.status_code == 404


def test_update_document_changes_fields(client, auth_headers):
    create = client.post("/api/documents", headers=auth_headers, json={
        "title": "Original Title",
        "content": "Original content.",
    })
    doc_id = create.json()["id"]
    resp = client.put(f"/api/documents/{doc_id}", headers=auth_headers, json={
        "title": "Updated Title",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Updated Title"
    assert data["content"] == "Original content."


def test_update_nonexistent_doc_returns_404(client, auth_headers):
    resp = client.put("/api/documents/99999", headers=auth_headers, json={
        "title": "Nope",
    })
    assert resp.status_code == 404


def test_delete_document_removes_it(client, auth_headers):
    create = client.post("/api/documents", headers=auth_headers, json={
        "title": "Delete Me",
        "content": "To be deleted.",
    })
    doc_id = create.json()["id"]
    resp = client.delete(f"/api/documents/{doc_id}", headers=auth_headers)
    assert resp.status_code == 200
    get_resp = client.get(f"/api/documents/{doc_id}", headers=auth_headers)
    assert get_resp.status_code == 404


def test_delete_nonexistent_doc_returns_404(client, auth_headers):
    resp = client.delete("/api/documents/99999", headers=auth_headers)
    assert resp.status_code == 404

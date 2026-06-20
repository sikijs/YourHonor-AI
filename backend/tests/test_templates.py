def test_list_templates_returns_catalog(client):
    resp = client.get("/api/templates")
    assert resp.status_code == 200
    data = resp.json()
    assert "templates" in data
    assert "total" in data
    assert data["total"] > 0
    assert len(data["templates"]) == data["total"]


def test_templates_have_required_fields(client):
    resp = client.get("/api/templates")
    templates = resp.json()["templates"]
    for t in templates:
        assert "name" in t
        assert "description" in t
        assert "filename" in t
        assert isinstance(t["fields"], list)

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


def test_web_search_parses_ddg_lite_html():
    from unittest.mock import patch, MagicMock
    from app.services.chat import ChatService

    mock_html = """<!DOCTYPE html>
<html>
<head><title>DuckDuckGo Lite</title></head>
<body>
  <div id="links">
    <table>
      <tr><td>1.</td><td><a href="https://example.com/contract">Contract Law Overview</a></td></tr>
      <tr><td></td><td>An overview of contract law principles including offer, acceptance, and consideration.</td></tr>
      <tr><td></td><td>https://example.com/contract</td></tr>
      <tr><td>2.</td><td><a href="https://example.com/torts">Tort Law Basics</a></td></tr>
      <tr><td></td><td>Introduction to tort law covering negligence, strict liability, and intentional torts.</td></tr>
      <tr><td></td><td>https://example.com/torts</td></tr>
      <tr><td>3.</td><td><a href="https://example.com/property">Property Law</a></td></tr>
      <tr><td></td><td>Overview of property law including real property, personal property, and land use.</td></tr>
      <tr><td></td><td>https://example.com/property</td></tr>
    </table>
  </div>
</body>
</html>"""

    mock_response = MagicMock()
    mock_response.text = mock_html
    mock_response.raise_for_status = MagicMock()

    service = ChatService()
    with patch("httpx.Client.post", return_value=mock_response) as mock_post:
        results = service._web_search("law", max_results=2)

    assert len(results) == 2
    assert results[0]["title"] == "Contract Law Overview"
    assert results[0]["href"] == "https://example.com/contract"
    assert "offer, acceptance, and consideration" in results[0]["body"]
    assert results[1]["title"] == "Tort Law Basics"
    assert results[1]["href"] == "https://example.com/torts"
    assert "negligence, strict liability" in results[1]["body"]
    mock_post.assert_called_once()


def test_web_search_empty_results_returns_empty_list():
    from unittest.mock import patch, MagicMock
    from app.services.chat import ChatService

    mock_response = MagicMock()
    mock_response.text = "<html><body><div id='links'><table></table></div></body></html>"
    mock_response.raise_for_status = MagicMock()

    service = ChatService()
    with patch("httpx.Client.post", return_value=mock_response):
        results = service._web_search("nonexistent_xyz_123")
    assert results == []


def test_web_search_http_error_returns_empty_list():
    from unittest.mock import patch, MagicMock
    from app.services.chat import ChatService

    service = ChatService()
    with patch("httpx.Client.post", side_effect=Exception("Connection error")):
        results = service._web_search("test")
    assert results == []

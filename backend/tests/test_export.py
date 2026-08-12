"""Tests for POST /api/export (PDF / DOCX / markdown export)."""

import io
import zipfile

MARKDOWN_CONTENT = """# Test Brief

**Holding:** The court held that the *search* was lawful.

## Facts
- Fact one
- Fact two

| Item | Value |
|------|-------|
| A    | 1     |
"""

# Printable HTML as produced by the frontend tool views (print.ts): section
# titles are <div class="field-label">, not heading tags.
TOOL_HTML = (
    "<div class='header'>Supreme Court - 1803</div>"
    "<div class='field-label'>Facts</div><div class='field-value'><p>The facts...</p></div>"
    "<div class='field-label'>Holding</div><div class='field-value'><p><strong>Bold</strong> holding &amp; <em>italic</em>.</p></div>"
    "<h2>Issues</h2><ul><li>Issue one</li></ul>"
)


def test_export_pdf_returns_pdf(client, auth_headers):
    resp = client.post("/api/export", headers=auth_headers, json={
        "content": MARKDOWN_CONTENT,
        "filename": "case_brief_test",
        "format": "pdf",
        "content_type": "markdown",
    })
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content.startswith(b"%PDF-")
    assert "attachment" in resp.headers["content-disposition"]


def test_export_docx_returns_docx(client, auth_headers):
    resp = client.post("/api/export", headers=auth_headers, json={
        "content": MARKDOWN_CONTENT,
        "filename": "case_brief_test",
        "format": "docx",
        "content_type": "markdown",
    })
    assert resp.status_code == 200
    assert "wordprocessingml" in resp.headers["content-type"]
    assert zipfile.is_zipfile(__import__("io").BytesIO(resp.content))


def test_export_md_returns_raw_markdown(client, auth_headers):
    resp = client.post("/api/export", headers=auth_headers, json={
        "content": MARKDOWN_CONTENT,
        "filename": "case_brief_test",
        "format": "md",
        "content_type": "markdown",
    })
    assert resp.status_code == 200
    assert resp.content.decode("utf-8") == MARKDOWN_CONTENT


def test_export_html_content_type(client, auth_headers):
    resp = client.post("/api/export", headers=auth_headers, json={
        "content": "<div class='card'><h2>Issue</h2><p>Body <strong>bold</strong></p></div>",
        "filename": "html_doc",
        "format": "pdf",
        "content_type": "html",
    })
    assert resp.status_code == 200
    assert resp.content.startswith(b"%PDF-")


def test_export_special_characters_do_not_crash(client, auth_headers):
    resp = client.post("/api/export", headers=auth_headers, json={
        "content": "# Title \u2014 with \u201csmart\u201d quotes \u2013 and \u2026 accents \u00e9\u00e8",
        "filename": "special_chars",
        "format": "pdf",
        "content_type": "markdown",
    })
    assert resp.status_code == 200
    assert resp.content.startswith(b"%PDF-")


def test_export_requires_auth(client):
    resp = client.post("/api/export", json={
        "content": "hello",
        "filename": "x",
        "format": "md",
    })
    assert resp.status_code == 401


def test_export_invalid_format_returns_400(client, auth_headers):
    # "txt" is rejected by the Literal validator before the handler runs,
    # so FastAPI returns 422 for unknown enum values.
    resp = client.post("/api/export", headers=auth_headers, json={
        "content": "hello",
        "filename": "x",
        "format": "txt",
        "content_type": "markdown",
    })
    assert resp.status_code == 422

    resp = client.post("/api/export", headers=auth_headers, json={
        "content": "",
        "filename": "x",
        "format": "pdf",
        "content_type": "markdown",
    })
    assert resp.status_code == 400


def test_export_empty_content_returns_400(client, auth_headers):
    resp = client.post("/api/export", headers=auth_headers, json={
        "content": "   ",
        "filename": "x",
        "format": "pdf",
        "content_type": "markdown",
    })
    assert resp.status_code == 400


def test_export_sanitizes_filename(client, auth_headers):
    resp = client.post("/api/export", headers=auth_headers, json={
        "content": "hello",
        "filename": "../../etc/passwd",
        "format": "md",
        "content_type": "markdown",
    })
    assert resp.status_code == 200
    assert ".." not in resp.headers["content-disposition"]


def test_export_pdf_from_html_with_tables(client, auth_headers):
    html = (
        "<p>Intro</p>"
        "<table><tr><th>Name</th><th>Year</th></tr>"
        "<tr><td>Marbury</td><td>1803</td></tr></table>"
    )
    resp = client.post("/api/export", headers=auth_headers, json={
        "content": html,
        "filename": "table_doc",
        "format": "pdf",
        "content_type": "html",
    })
    assert resp.status_code == 200
    assert resp.content.startswith(b"%PDF-")


def test_export_docx_promotes_field_labels_to_headings(client, auth_headers):
    """Tool-view HTML uses div.field-label for section titles; the DOCX
    must use real Word heading styles so titles render bold and larger."""
    resp = client.post("/api/export", headers=auth_headers, json={
        "content": TOOL_HTML,
        "filename": "case_brief",
        "format": "docx",
        "content_type": "html",
    })
    assert resp.status_code == 200
    xml = zipfile.ZipFile(io.BytesIO(resp.content)).read("word/document.xml").decode()
    assert "Heading3" in xml, "field-label sections should use Word Heading 3 style"
    assert "Facts" in xml


def test_export_md_from_html_produces_markdown_headings(client, auth_headers):
    resp = client.post("/api/export", headers=auth_headers, json={
        "content": TOOL_HTML,
        "filename": "case_brief",
        "format": "md",
        "content_type": "html",
    })
    assert resp.status_code == 200
    text = resp.content.decode("utf-8")
    assert "### Facts" in text
    assert "### Holding" in text
    assert "## Issues" in text
    assert "**Bold**" in text
    assert "holding" in text.lower()


def test_export_md_prepends_title_when_body_has_no_h1(client, auth_headers):
    """Tool-view content has no H1 of its own, so the export title must be
    promoted to a markdown H1 at the top of the .md file."""
    resp = client.post("/api/export", headers=auth_headers, json={
        "content": TOOL_HTML,
        "filename": "Case Brief - Marbury v. Madison",
        "format": "md",
        "content_type": "html",
    })
    assert resp.status_code == 200
    text = resp.content.decode("utf-8")
    assert text.startswith("# Case Brief - Marbury v. Madison\n\n")


def test_export_md_prepends_title_when_markdown_has_no_h1(client, auth_headers):
    resp = client.post("/api/export", headers=auth_headers, json={
        "content": "Just a paragraph.",
        "filename": "Memo",
        "format": "md",
        "content_type": "markdown",
    })
    assert resp.status_code == 200
    assert resp.content.decode("utf-8").startswith("# Memo\n\n")


def test_export_md_does_not_duplicate_existing_h1(client, auth_headers):
    """Saved documents typically begin with their own `# Title`; the export
    must not prepend a second title line."""
    resp = client.post("/api/export", headers=auth_headers, json={
        "content": "# Case Brief: Marbury\n\nBody text.",
        "filename": "Case Brief - Marbury v. Madison",
        "format": "md",
        "content_type": "markdown",
    })
    assert resp.status_code == 200
    text = resp.content.decode("utf-8")
    assert text.startswith("# Case Brief: Marbury\n\n")
    assert text.count("# Case Brief") == 1


def test_export_pdf_from_tool_html_renders(client, auth_headers):
    """Tool-view HTML must not crash the fpdf2 renderer and must produce a
    valid PDF (headings promoted before the safe-tag sweep)."""
    resp = client.post("/api/export", headers=auth_headers, json={
        "content": TOOL_HTML,
        "filename": "case_brief",
        "format": "pdf",
        "content_type": "html",
    })
    assert resp.status_code == 200
    assert resp.content.startswith(b"%PDF-")
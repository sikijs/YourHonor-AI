"""Tests for PDF upload, including the OCR fallback for scanned documents.

The upload endpoint tries pypdf text extraction first; if the PDF yields
almost no text (a scan), it falls back to tesseract OCR via
IngestionService.ocr_pdf before rejecting the file.
"""
from io import BytesIO
from unittest.mock import patch

PDF_BYTES = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF"


class FakeIngestion:
    def __init__(self, pdf_text, ocr_text):
        self._pdf_text = pdf_text
        self._ocr_text = ocr_text

    def load_pdf(self, file_path):
        return self._pdf_text

    def ocr_pdf(self, file_path):
        return self._ocr_text


def _upload(client, headers, filename="scan.pdf"):
    files = {"file": (filename, BytesIO(PDF_BYTES))}
    return client.post("/api/documents/upload", headers=headers, files=files)


def test_upload_pdf_with_text_succeeds_without_ocr(client, auth_headers):
    fake = FakeIngestion(pdf_text="This is real extracted PDF text. " * 20, ocr_text="")
    with patch("app.api.documents.get_ingestion_service", return_value=fake):
        resp = _upload(client, auth_headers, filename="brief.pdf")

    assert resp.status_code == 200
    data = resp.json()
    assert data["content"].startswith("This is real extracted PDF text.")


def test_upload_scanned_pdf_uses_ocr_fallback(client, auth_headers):
    fake = FakeIngestion(
        pdf_text="\n\n",  # pypdf finds nothing readable
        ocr_text="Extracted by OCR: the court held that the search was valid. " * 10,
    )
    with patch("app.api.documents.get_ingestion_service", return_value=fake):
        resp = _upload(client, auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["content"].startswith("Extracted by OCR")


def test_upload_scanned_pdf_when_ocr_fails_returns_400(client, auth_headers):
    fake = FakeIngestion(pdf_text=None, ocr_text=None)
    with patch("app.api.documents.get_ingestion_service", return_value=fake):
        resp = _upload(client, auth_headers)

    assert resp.status_code == 400
    assert "OCR" in resp.json()["detail"]

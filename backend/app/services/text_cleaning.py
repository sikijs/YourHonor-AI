import re
from typing import Optional


def normalize_encoding(text: str) -> str:
    text = text.replace("\u2018", "'").replace("\u2019", "'")
    text = text.replace("\u201c", '"').replace("\u201d", '"')
    text = text.replace("\u2014", "-").replace("\u2013", "-")
    text = text.replace("\u2026", "...")
    return text


def normalize_whitespace(text: str) -> str:
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n\n+', '\n\n', text)
    return text.strip()


def remove_page_numbers(text: str) -> str:
    text = re.sub(r'\n\s*\d+\s*\n', '\n', text)
    text = re.sub(r'Page\s+\d+', '', text, flags=re.IGNORECASE)
    return text


def detect_legal_heading(text: str) -> Optional[str]:
    patterns = [
        r'^Article\s+[IVX]+',
        r'^Section\s+\d+',
        r'^Part\s+[IVX]+',
        r'^Amendment\s+[IVX]+',
        r'^[IVX]+\.\s+',
        r'^\d+\.\s+',
    ]
    for pattern in patterns:
        if re.search(pattern, text, re.MULTILINE):
            return pattern
    return None


def extract_citations(text: str) -> list[str]:
    citation_patterns = [
        r'\d+\s+U\.S\.C\.\s+§\s*\d+',
        r'\d+\s+F\.\d+d\s+\d+',
        r'\d+\s+U\.S\.\s+\d+',
        r'\d+\s+S\.\s*Ct\.\s+\d+',
        r'\d+\s+L\.\s*Ed\.\s*\d+',
    ]
    citations = []
    for pattern in citation_patterns:
        citations.extend(re.findall(pattern, text))
    return citations


def clean_legal_text(raw_text: str) -> str:
    text = normalize_encoding(raw_text)
    text = remove_page_numbers(text)
    text = normalize_whitespace(text)
    return text
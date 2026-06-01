import re
from typing import Optional
from langchain_core.documents import Document

from .text_cleaning import clean_legal_text, detect_legal_heading


CHUNK_SIZE = 512
CHUNK_OVERLAP = 128
SEPARATORS = ["\n\n", "\n", ". ", "; ", " ", ""]


class LegalTextSplitter:
    def __init__(
        self,
        chunk_size: int = CHUNK_SIZE,
        chunk_overlap: int = CHUNK_OVERLAP,
        separators: list[str] = SEPARATORS,
    ):
        from langchain_text_splitters import RecursiveCharacterTextSplitter
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=separators,
            length_function=self._token_count,
        )

    def _token_count(self, text: str) -> int:
        return len(text.split())

    def _classify_chunk(self, text: str) -> str:
        text_lower = text.lower()
        if any(kw in text_lower for kw in ["article", "section", "part", "amendment"]):
            return "statutory"
        if any(kw in text_lower for kw in ["holding", "reasoning", "facts", "plaintiff", "defendant"]):
            return "case_opinion"
        if any(kw in text_lower for kw in ["whereas", "agreement", "parties", "terms"]):
            return "contract"
        return "general_legal"

    def split_text(self, text: str) -> list[dict]:
        cleaned_text = clean_legal_text(text)
        chunks = self.splitter.split_text(cleaned_text)
        
        result = []
        for idx, chunk in enumerate(chunks):
            result.append({
                "content": chunk,
                "index": idx,
                "doc_type": self._classify_chunk(chunk),
                "heading": detect_legal_heading(chunk),
            })
        return result

    def split_documents(self, documents: list[Document]) -> list[dict]:
        all_chunks = []
        for doc in documents:
            chunks = self.split_text(doc.page_content)
            for chunk in chunks:
                chunk["source"] = doc.metadata.get("source", "unknown")
                chunk["title"] = doc.metadata.get("title", "Unknown")
            all_chunks.extend(chunks)
        return all_chunks
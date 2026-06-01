from typing import Optional
import os


MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIM = 384

_cached_embeddings: Optional[object] = None


def get_embeddings():
    global _cached_embeddings
    if _cached_embeddings is None:
        from langchain_huggingface import HuggingFaceEmbeddings
        device = "cuda" if os.getenv("USE_CUDA", "").lower() == "true" else "cpu"
        _cached_embeddings = HuggingFaceEmbeddings(
            model_name=MODEL_NAME,
            model_kwargs={"device": device},
            encode_kwargs={"normalize_embeddings": True},
        )
    return _cached_embeddings


def generate_embedding(text: str) -> list[float]:
    embeddings = get_embeddings()
    return embeddings.embed_query(text)


def generate_embeddings_batch(texts: list[str]) -> list[list[float]]:
    embeddings = get_embeddings()
    return embeddings.embed_documents(texts)


def get_embedding_dimension() -> int:
    return EMBEDDING_DIM
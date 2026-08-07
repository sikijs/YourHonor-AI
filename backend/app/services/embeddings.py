from typing import Optional
import os
import threading


MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIM = 384

_cached_embeddings: Optional[object] = None
_model_lock = threading.Lock()


def get_embeddings():
    global _cached_embeddings
    if _cached_embeddings is None:
        # Guard model loading with a lock: the startup seeding thread and
        # concurrent API requests can otherwise race to load the model
        # simultaneously, which doubles memory pressure and can trigger
        # transient torch failures ("Cannot copy out of meta tensor")
        # under heavy host load.
        with _model_lock:
            if _cached_embeddings is None:
                from langchain_huggingface import HuggingFaceEmbeddings
                device = "cuda" if os.getenv("USE_CUDA", "").lower() == "true" else "cpu"
                _cached_embeddings = HuggingFaceEmbeddings(
                    model_name=MODEL_NAME,
                    model_kwargs={"device": device},
                    encode_kwargs={"normalize_embeddings": True},
                )
    return _cached_embeddings


def reset_embeddings():
    """Drop the cached model so the next call reloads it from scratch.

    Called when an embedding attempt fails: a partially-initialized model
    is unsafe to reuse, and a fresh load is the cheapest reliable recovery.
    """
    global _cached_embeddings
    with _model_lock:
        _cached_embeddings = None


def generate_embedding(text: str) -> list[float]:
    try:
        embeddings = get_embeddings()
        return embeddings.embed_query(text)
    except Exception:
        reset_embeddings()
        embeddings = get_embeddings()
        return embeddings.embed_query(text)


def generate_embeddings_batch(texts: list[str]) -> list[list[float]]:
    try:
        embeddings = get_embeddings()
        return embeddings.embed_documents(texts)
    except Exception:
        reset_embeddings()
        embeddings = get_embeddings()
        return embeddings.embed_documents(texts)


def get_embedding_dimension() -> int:
    return EMBEDDING_DIM

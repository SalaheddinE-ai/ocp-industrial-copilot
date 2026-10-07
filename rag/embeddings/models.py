"""
embeddings/models.py

Registry of supported embedding backends and their dimensionality,
used by embedder.py and vector_store to validate index configuration
matches the configured model.
"""
from __future__ import annotations

EMBEDDING_MODEL_DIMS: dict[str, int] = {
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
    "BAAI/bge-small-en-v1.5": 384,
    "BAAI/bge-base-en-v1.5": 768,
    "sentence-transformers/all-MiniLM-L6-v2": 384,
}


def get_embedding_dim(model_name: str) -> int:
    if model_name not in EMBEDDING_MODEL_DIMS:
        raise ValueError(
            f"Unknown embedding model {model_name!r}; register it in "
            f"EMBEDDING_MODEL_DIMS if it's a valid model."
        )
    return EMBEDDING_MODEL_DIMS[model_name]

"""
retrieval/vector_retriever.py

Dense retrieval: embeds the query and queries the configured
VectorStore, optionally constrained by a MetadataFilter.
"""
from __future__ import annotations

from embeddings.embedder import Embedder
from models.document import ScoredDocument
from retrieval.filters import MetadataFilter
from vector_store.base import VectorStore


class VectorRetriever:
    def __init__(self, vector_store: VectorStore, embedder: Embedder | None = None):
        self.vector_store = vector_store
        self.embedder = embedder or Embedder()

    def retrieve(
        self, query: str, top_k: int, filters: MetadataFilter | None = None
    ) -> list[ScoredDocument]:
        embedding = self.embedder.embed_query(query)
        where = filters.to_chroma_where() if filters else None
        return self.vector_store.query(embedding, top_k=top_k, where=where)

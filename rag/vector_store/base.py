"""
vector_store/base.py

Abstract interface every vector store backend must implement, so
retrieval/vector_retriever.py stays decoupled from the concrete
backend (Chroma today, Qdrant/Weaviate/pgvector later without
touching retrieval logic).
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from models.document import Document, ScoredDocument


class VectorStore(ABC):
    @abstractmethod
    def add(
        self,
        documents: list[Document],
        embeddings: list[list[float]],
    ) -> None:
        """Adds documents + their embeddings to the store."""

    @abstractmethod
    def query(
        self,
        embedding: list[float],
        top_k: int,
        where: dict[str, Any] | None = None,
    ) -> list[ScoredDocument]:
        """Returns the top_k nearest documents, optionally metadata-filtered."""

    @abstractmethod
    def delete(self, ids: list[str]) -> None:
        """Deletes documents by chunk_id."""

    @abstractmethod
    def count(self) -> int:
        """Returns the number of indexed chunks."""

    @abstractmethod
    def get_all(self) -> list[Document]:
        """Returns every indexed Document (used to build the in-memory BM25 corpus)."""

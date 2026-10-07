"""
vector_store/vector_db.py

ChromaDB implementation of vector_store.base.VectorStore. Handles
collection creation, connection lifecycle, and translating our
MetadataFilter dict into Chroma's `where` clause syntax.
"""
from __future__ import annotations

from typing import Any

from config.settings import settings
from models.document import Document, ScoredDocument


class ChromaVectorStore:
    """Concrete VectorStore backed by a persistent local ChromaDB collection."""

    def __init__(
        self,
        path: str | None = None,
        collection_name: str | None = None,
    ):
        import chromadb

        self._client = chromadb.PersistentClient(path=path or settings.vector_store_path)
        self._collection = self._client.get_or_create_collection(
            name=collection_name or settings.vector_store_collection
        )

    def add(self, documents: list[Document], embeddings: list[list[float]]) -> None:
        if not documents:
            return
        self._collection.add(
            ids=[d.metadata.chunk_id for d in documents],
            embeddings=embeddings,
            documents=[d.content for d in documents],
            metadatas=[d.metadata.model_dump(exclude_none=True) for d in documents],
        )

    def query(
        self,
        embedding: list[float],
        top_k: int,
        where: dict[str, Any] | None = None,
    ) -> list[ScoredDocument]:
        results = self._collection.query(
            query_embeddings=[embedding],
            n_results=top_k,
            where=where or None,
        )
        scored: list[ScoredDocument] = []
        if not results["ids"] or not results["ids"][0]:
            return scored

        for content, metadata, distance in zip(
            results["documents"][0], results["metadatas"][0], results["distances"][0]
        ):
            doc = Document.model_validate({"content": content, "metadata": metadata})
            # Chroma returns a distance (lower = more similar); convert to a
            # similarity-style score in (0, 1] for consistency with fusion/rerank.
            score = 1.0 / (1.0 + distance)
            scored.append(ScoredDocument(document=doc, score=score))
        return scored

    def delete(self, ids: list[str]) -> None:
        if ids:
            self._collection.delete(ids=ids)

    def count(self) -> int:
        return self._collection.count()

    def get_all(self) -> list[Document]:
        results = self._collection.get()
        docs: list[Document] = []
        for content, metadata in zip(results.get("documents", []), results.get("metadatas", [])):
            docs.append(Document.model_validate({"content": content, "metadata": metadata}))
        return docs

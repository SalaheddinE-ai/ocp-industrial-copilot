"""
retrieval/semantic_cache.py

Semantic cache for the agentic RAG pipeline: before running the full
graph (retrieval, generation, validation), check whether a
sufficiently similar question has already been answered and accepted,
and reuse that answer instead of paying for the whole pipeline again.
Particularly valuable when the generation model is a small local
model (e.g. Qwen2.5-3B-Instruct) where repeated latency adds up.

Backed by its own ChromaDB collection ("qa_cache" by default),
completely separate from the main knowledge-base collection so
clearing one never affects the other. Similarity is measured in the
same embedding space as retrieval (embeddings.embedder.Embedder), so
a cache hit is as semantically meaningful as a retrieval match.

Only ACCEPTED answers are ever stored (see
agentic/nodes/store_in_cache.py) -- a corrected, retried, or
insufficient-information answer is never cached, so the cache can't
learn to confidently serve a bad answer.
"""
from __future__ import annotations

import hashlib
import json
import logging
from typing import Any

from config.settings import settings
from embeddings.embedder import Embedder

logger = logging.getLogger(__name__)


class SemanticCache:
    def __init__(
        self,
        embedder: Embedder | None = None,
        path: str | None = None,
        collection_name: str | None = None,
        similarity_threshold: float | None = None,
    ):
        import chromadb

        self.embedder = embedder or Embedder()
        self._client = chromadb.PersistentClient(path=path or settings.vector_store_path)
        self._collection = self._client.get_or_create_collection(
            name=collection_name or settings.semantic_cache_collection
        )
        self.similarity_threshold = (
            similarity_threshold
            if similarity_threshold is not None
            else settings.semantic_cache_similarity_threshold
        )

    def lookup(self, query: str) -> dict[str, Any] | None:
        """Returns a cached {"answer", "sources", "scene_ops"} dict if a
        sufficiently similar question was answered and accepted before,
        else None. Never raises on an empty/missing collection."""
        if self._collection.count() == 0:
            return None

        embedding = self.embedder.embed_query(query)
        results = self._collection.query(query_embeddings=[embedding], n_results=1)

        if not results["ids"] or not results["ids"][0]:
            return None

        distance = results["distances"][0][0]
        similarity = 1.0 / (1.0 + distance)
        if similarity < self.similarity_threshold:
            return None

        payload = results["metadatas"][0][0]
        matched_question = results["documents"][0][0]
        logger.info(
            "semantic_cache: hit (similarity=%.3f) for %r -> cached question %r",
            similarity,
            query,
            matched_question,
        )
        return {
            "answer": payload.get("answer", ""),
            "sources": json.loads(payload.get("sources_json", "[]")),
            "scene_ops": json.loads(payload.get("scene_ops_json", "[]")),
        }

    def store(
        self,
        query: str,
        answer: str,
        sources: list[dict] | None = None,
        scene_ops: list[dict] | None = None,
    ) -> None:
        """Upserts a Q&A pair -- storing again for the same (normalized)
        question overwrites the previous entry rather than duplicating it."""
        embedding = self.embedder.embed_query(query)
        entry_id = hashlib.sha256(query.strip().lower().encode("utf-8")).hexdigest()
        self._collection.upsert(
            ids=[entry_id],
            embeddings=[embedding],
            documents=[query],
            metadatas=[
                {
                    "answer": answer,
                    "sources_json": json.dumps(sources or []),
                    "scene_ops_json": json.dumps(scene_ops or []),
                }
            ],
        )

    def clear(self) -> None:
        """Deletes every entry. Mainly useful for tests and for manually
        invalidating the cache after the knowledge base is re-ingested."""
        existing = self._collection.get()
        ids = existing.get("ids", [])
        if ids:
            self._collection.delete(ids=ids)

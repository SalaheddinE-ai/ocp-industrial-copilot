"""
retrieval/reranker.py

Reranking of the fused top-K results down to a final top-N context
set. Two backends, selected via config.settings.reranker_backend:

- "cross-encoder": a real cross-encoder model (e.g. bge-reranker-base
  via sentence-transformers). Requires network access to download
  model weights on first use.
- "heuristic": a zero-dependency fallback that keeps the fusion
  ordering (RRF score) unchanged. Used for offline development/tests
  and as a safe default when the cross-encoder model isn't available.

Both implement the same `rerank(query, documents, top_n)` interface
so the agentic node calling this doesn't need to know which backend
is active.
"""
from __future__ import annotations

from config.settings import settings
from models.document import ScoredDocument


class Reranker:
    def __init__(self, backend: str | None = None, model_name: str | None = None):
        self.backend = backend or settings.reranker_backend
        self.model_name = model_name or settings.reranker_model
        self._model = None

    def _get_cross_encoder(self):
        if self._model is None:
            try:
                from sentence_transformers import CrossEncoder
            except ImportError as exc:  # pragma: no cover
                raise RuntimeError(
                    "sentence-transformers is not installed. "
                    "pip install sentence-transformers to use the cross-encoder "
                    "reranker, or set RERANKER_BACKEND=heuristic."
                ) from exc
            self._model = CrossEncoder(self.model_name)
        return self._model

    def rerank(
        self, query: str, documents: list[ScoredDocument], top_n: int
    ) -> list[ScoredDocument]:
        if not documents:
            return []

        if self.backend == "heuristic":
            # Keep the incoming (fusion) ordering; just truncate to top_n.
            return sorted(documents, key=lambda d: d.score, reverse=True)[:top_n]

        if self.backend == "cross-encoder":
            model = self._get_cross_encoder()
            pairs = [(query, d.document.content) for d in documents]
            scores = model.predict(pairs)
            reranked = sorted(
                zip(documents, scores), key=lambda pair: pair[1], reverse=True
            )[:top_n]
            return [
                ScoredDocument(document=d.document, score=float(score))
                for d, score in reranked
            ]

        raise ValueError(f"Unknown reranker backend: {self.backend!r}")

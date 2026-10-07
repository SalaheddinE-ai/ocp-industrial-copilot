"""
tests/test_reranking.py

Unit tests for retrieval/reranker.py. Only the "heuristic" backend
is exercised here (zero dependency, deterministic) -- the
"cross-encoder" backend requires downloading model weights and is
covered by a separate manual/integration check, not CI.
"""
from __future__ import annotations

import pytest

from models.document import Document, DocumentMetadata, ScoredDocument
from retrieval.reranker import Reranker


def _scored(chunk_id: str, score: float) -> ScoredDocument:
    doc = Document(
        content=f"content {chunk_id}",
        metadata=DocumentMetadata(document_name=f"{chunk_id}.txt", chunk_id=chunk_id),
    )
    return ScoredDocument(document=doc, score=score)


def test_heuristic_reranker_preserves_fusion_ranking_and_truncates():
    docs = [_scored("a", 0.5), _scored("b", 0.9), _scored("c", 0.7)]
    reranker = Reranker(backend="heuristic")

    result = reranker.rerank("any query", docs, top_n=2)

    assert [r.document.metadata.chunk_id for r in result] == ["b", "c"]
    assert len(result) == 2


def test_heuristic_reranker_empty_input():
    reranker = Reranker(backend="heuristic")
    assert reranker.rerank("query", [], top_n=5) == []


def test_unknown_backend_raises():
    reranker = Reranker(backend="not_a_real_backend")
    with pytest.raises(ValueError):
        reranker.rerank("query", [_scored("a", 0.5)], top_n=1)

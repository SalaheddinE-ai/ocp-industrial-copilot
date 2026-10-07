"""
tests/test_retrieval.py

Unit tests for retrieval/: fusion (RRF correctness), filters
(metadata -> Chroma where translation), BM25 retriever. All
deterministic -- no LLM/network calls, runs fast in CI.
"""
from __future__ import annotations

from models.document import Document, DocumentMetadata, ScoredDocument
from retrieval.bm25_retriever import BM25Retriever
from retrieval.filters import MetadataFilter
from retrieval.fusion import reciprocal_rank_fusion


def _doc(chunk_id: str, content: str, **meta) -> Document:
    return Document(
        content=content,
        metadata=DocumentMetadata(document_name=f"{chunk_id}.txt", chunk_id=chunk_id, **meta),
    )


def test_bm25_ranks_lexical_match_first():
    docs = [
        _doc("c1", "Bearing overheating is caused by insufficient lubrication."),
        _doc("c2", "Mechanical seal inspection requires checking for leakage."),
        _doc("c3", "Impeller converts rotational energy into kinetic energy."),
    ]
    bm25 = BM25Retriever(docs)
    results = bm25.retrieve("bearing overheating lubrication", top_k=3)

    assert results[0].document.metadata.chunk_id == "c1"
    assert all(r.score > 0 for r in results)


def test_bm25_returns_nothing_for_empty_corpus():
    bm25 = BM25Retriever([])
    assert bm25.retrieve("anything", top_k=5) == []


def test_rrf_favors_documents_ranked_high_in_multiple_lists():
    doc_a = _doc("a", "content a")
    doc_b = _doc("b", "content b")
    doc_c = _doc("c", "content c")

    list1 = [ScoredDocument(document=doc_a, score=0.9), ScoredDocument(document=doc_b, score=0.5)]
    list2 = [ScoredDocument(document=doc_b, score=0.8), ScoredDocument(document=doc_c, score=0.3)]

    fused = reciprocal_rank_fusion([list1, list2])
    fused_ids = [r.document.metadata.chunk_id for r in fused]

    # 'b' appears in both lists (rank 2 and rank 1) -> highest combined score
    assert fused_ids[0] == "b"
    assert set(fused_ids) == {"a", "b", "c"}


def test_rrf_empty_lists_returns_empty():
    assert reciprocal_rank_fusion([[], []]) == []


def test_metadata_filter_single_field():
    f = MetadataFilter(component="bearings")
    assert f.to_chroma_where() == {"component": "bearings"}


def test_metadata_filter_multiple_fields_uses_and():
    f = MetadataFilter(component="bearings", document_category="failures/bearings")
    where = f.to_chroma_where()
    assert "$and" in where
    assert {"component": "bearings"} in where["$and"]
    assert {"document_category": "failures/bearings"} in where["$and"]


def test_metadata_filter_empty_returns_none():
    assert MetadataFilter().to_chroma_where() is None
    assert MetadataFilter().is_empty() is True

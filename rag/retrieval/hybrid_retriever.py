"""
retrieval/hybrid_retriever.py

Single entry point orchestrating vector + BM25 retrieval + RRF
fusion into one deterministic callable, used by the agentic graph's
hybrid_retrieve node. Kept as one class so the graph does not need
to manage parallel branches / custom state reducers for what is,
architecturally, a single retrieval step.
"""
from __future__ import annotations

from models.document import ScoredDocument
from retrieval.bm25_retriever import BM25Retriever
from retrieval.filters import MetadataFilter
from retrieval.fusion import reciprocal_rank_fusion
from retrieval.vector_retriever import VectorRetriever
from vector_store.base import VectorStore


class HybridRetriever:
    def __init__(
        self,
        vector_retriever: VectorRetriever,
        bm25_retriever: BM25Retriever,
    ):
        self.vector_retriever = vector_retriever
        self.bm25_retriever = bm25_retriever

    def hybrid_search(
        self,
        query: str,
        filters: MetadataFilter | None = None,
        top_k: int = 20,
    ) -> list[ScoredDocument]:
        # BM25 has no native metadata filtering in this in-memory
        # implementation; vector search applies the filter natively.
        vector_results = self.vector_retriever.retrieve(query, top_k, filters)
        bm25_results = self.bm25_retriever.retrieve(query, top_k)

        if filters and not filters.is_empty():
            allowed = filters.model_dump(exclude_none=True)
            bm25_results = [
                r
                for r in bm25_results
                if all(
                    getattr(r.document.metadata, field, None) == value
                    for field, value in allowed.items()
                )
            ]

        return reciprocal_rank_fusion([vector_results, bm25_results])[:top_k]


def build_hybrid_retriever(
    vector_store: VectorStore, embedder=None
) -> HybridRetriever:
    """
    Factory building a HybridRetriever from a VectorStore: wraps it for
    dense search and loads its full contents to build the in-memory
    BM25 index. For large knowledge bases, replace the BM25 corpus
    load with a persistent inverted-index backend -- the interface
    stays the same either way.
    """
    vector_retriever = VectorRetriever(vector_store, embedder=embedder)
    corpus = vector_store.get_all()
    bm25_retriever = BM25Retriever(corpus)
    return HybridRetriever(vector_retriever, bm25_retriever)

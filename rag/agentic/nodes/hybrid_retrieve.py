"""
agentic/nodes/hybrid_retrieve.py

Adapter node calling retrieval.hybrid_retriever. Builds (and caches)
a HybridRetriever singleton from the configured vector store on
first use.
"""
from __future__ import annotations

from agentic.state import AgentState
from retrieval.filters import MetadataFilter
from retrieval.hybrid_retriever import HybridRetriever, build_hybrid_retriever
from vector_store.vector_db import ChromaVectorStore

_retriever: HybridRetriever | None = None


def _get_retriever() -> HybridRetriever:
    global _retriever
    if _retriever is None:
        _retriever = build_hybrid_retriever(ChromaVectorStore())
    return _retriever


def hybrid_retrieve(state: AgentState) -> dict:
    retriever = _get_retriever()
    filters = MetadataFilter(**state.get("metadata_filters", {}))
    results = retriever.hybrid_search(
        query=state["current_query"], filters=filters, top_k=20
    )
    return {
        "retrieved_documents": [r.model_dump() for r in results],
        "last_action": "hybrid_retrieve",
    }

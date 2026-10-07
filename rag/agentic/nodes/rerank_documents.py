"""
agentic/nodes/rerank_documents.py

Calls retrieval.reranker on state["retrieved_documents"].
"""
from __future__ import annotations

from agentic.state import AgentState
from models.document import ScoredDocument
from retrieval.reranker import Reranker

_reranker: Reranker | None = None


def _get_reranker() -> Reranker:
    global _reranker
    if _reranker is None:
        _reranker = Reranker()
    return _reranker


def rerank_documents(state: AgentState) -> dict:
    retrieved = [ScoredDocument.model_validate(d) for d in state.get("retrieved_documents", [])]
    reranked = _get_reranker().rerank(state["current_query"], retrieved, top_n=5)
    return {
        "reranked_documents": [r.model_dump() for r in reranked],
        "last_action": "rerank_documents",
    }

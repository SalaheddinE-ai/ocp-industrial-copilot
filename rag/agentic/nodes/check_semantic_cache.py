"""
agentic/nodes/check_semantic_cache.py

Not a pure deterministic node (it does an embedding call + a vector
lookup, no LLM call) -- checks whether a sufficiently similar question
has already been answered and accepted, to skip scene-op planning,
retrieval, generation, and validation entirely on a cache hit. Runs
right after analyze_query, before anything more expensive.

Fails closed: any error here (e.g. the cache's Chroma collection isn't
reachable) is treated as a cache miss, never as a hit -- a broken
cache must never be able to serve a wrong answer, only cost a
redundant full pipeline run.
"""
from __future__ import annotations

import logging

from agentic.state import AgentState
from retrieval.semantic_cache import SemanticCache

logger = logging.getLogger(__name__)

_cache: SemanticCache | None = None


def _get_cache() -> SemanticCache:
    global _cache
    if _cache is None:
        _cache = SemanticCache()
    return _cache


def check_semantic_cache(state: AgentState) -> dict:
    query = state.get("current_query") or state["original_query"]

    try:
        hit = _get_cache().lookup(query)
    except Exception:
        logger.exception("check_semantic_cache: lookup failed, treating as a miss")
        hit = None

    if hit is None:
        return {"cache_hit": False, "last_action": "check_semantic_cache"}

    return {
        "cache_hit": True,
        "answer": hit["answer"],
        "sources": hit["sources"],
        "scene_ops": hit["scene_ops"],
        "last_action": "check_semantic_cache",
    }

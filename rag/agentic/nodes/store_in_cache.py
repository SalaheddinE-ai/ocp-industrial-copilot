"""
agentic/nodes/store_in_cache.py

Deterministic node: persists an accepted answer into the semantic
cache for future lookups. Only reached on the "accept" edge out of
validate_answer (see agentic/graph.py) -- a corrected, retried, or
insufficient-information answer is never cached.

Known limitation: cached scene_ops are replayed as-is on a cache hit.
For a repeated or near-duplicate question this is almost always what
you want (e.g. "show me the seal" twice in a row); if the *same*
phrasing is reused later in a very different 3D-viewer context, the
replayed scene_ops could point at a component that's no longer what
the user has in mind. Acceptable for now given how narrow the scene-op
vocabulary is (see models/scene_ops.py) -- worth revisiting if that
vocabulary grows.
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


def store_in_cache(state: AgentState) -> dict:
    answer = state.get("answer")
    if not answer:
        return {"last_action": "store_in_cache"}

    try:
        _get_cache().store(
            query=state["original_query"],
            answer=answer,
            sources=state.get("sources", []),
            scene_ops=state.get("scene_ops", []),
        )
    except Exception:
        logger.exception("store_in_cache: failed to persist cache entry")

    return {"last_action": "store_in_cache"}

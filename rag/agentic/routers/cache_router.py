"""
agentic/routers/cache_router.py

Conditional-edge function evaluated after check_semantic_cache.
"""
from __future__ import annotations

from agentic.state import AgentState


def route_after_cache_check(state: AgentState) -> str:
    return "cache_hit" if state.get("cache_hit") else "cache_miss"

"""
agentic/routers/retrieval_router.py

Conditional-edge functions evaluated after route_query and after
grade_retrieval, plus the shared retry-budget check used by
validation_router.py too.
"""
from __future__ import annotations

from agentic.state import AgentState


def check_retry_budget(state: AgentState) -> bool:
    """True once the loop has exhausted its retry budget."""
    return state.get("retry_count", 0) >= state.get("max_retries", 0)


def route_after_query(state: AgentState) -> str:
    """route_query -> {"hybrid_retrieve", "generate_answer"}"""
    if state.get("retrieval_strategy") == "retrieve":
        return "hybrid_retrieve"
    return "generate_answer"


def route_after_grading(state: AgentState) -> str:
    """grade_retrieval -> {"generate_answer", "rewrite_or_expand", "insufficient_info"}"""
    decision = state["retrieval_grade"]["decision"]
    if decision in ("relevant", "partial"):
        return "generate_answer"
    if check_retry_budget(state):
        return "insufficient_info"
    return "rewrite_or_expand"

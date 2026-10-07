"""
agentic/routers/validation_router.py

Conditional-edge function evaluated after validate_answer.
"""
from __future__ import annotations

from agentic.routers.retrieval_router import check_retry_budget
from agentic.state import AgentState


def route_after_validation(state: AgentState) -> str:
    """validate_answer -> {"accept", "correct", "hybrid_retrieve", "insufficient_info"}"""
    decision = state["answer_validation"]["decision"]
    if decision == "accept":
        return "accept"
    if decision == "correct":
        return "correct"
    # decision == "retrieve_again"
    if check_retry_budget(state):
        return "insufficient_info"
    return "hybrid_retrieve"

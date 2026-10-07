"""
agentic/nodes/route_query.py

Deterministic node. Rule table keyed on query_type: general/meta
questions skip retrieval entirely, everything else retrieves.
"""
from __future__ import annotations

from agentic.state import AgentState

_NO_RETRIEVAL_QUERY_TYPES = {"general_technical_question"}


def route_query(state: AgentState) -> dict:
    query_type = state.get("query_type", "")
    strategy = "no_retrieval" if query_type in _NO_RETRIEVAL_QUERY_TYPES else "retrieve"
    return {"retrieval_strategy": strategy, "last_action": "route_query"}

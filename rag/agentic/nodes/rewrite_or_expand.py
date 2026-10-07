"""
agentic/nodes/rewrite_or_expand.py

LLM node. Branches on state["retrieval_grade"]["recommended_action"]:
    "rewrite_query"     -> reformulate current_query via LLM
    "apply_new_filters" -> relax metadata_filters
    "expand_search"     -> relax metadata_filters (broadens vector/BM25 recall)
Always increments retry_count.
"""
from __future__ import annotations

import logging

from config.llm_client import LLMClientError, structured_call
from config.prompts import REWRITE_QUERY_SYSTEM_PROMPT
from agentic.state import AgentState
from models.schemas import RewriteResult

logger = logging.getLogger(__name__)


def _rewrite_query(state: AgentState) -> str:
    grade = state.get("retrieval_grade", {})
    user_message = (
        f"Original query: {state['original_query']}\n"
        f"Current query: {state['current_query']}\n"
        f"Detected equipment: {state.get('detected_equipment')}\n"
        f"Detected component: {state.get('detected_component')}\n"
        f"Detected symptom: {state.get('detected_symptom')}\n"
        f"Grading feedback: {grade.get('reason', '')}"
    )
    try:
        result = structured_call(
            system_prompt=REWRITE_QUERY_SYSTEM_PROMPT,
            user_message=user_message,
            response_model=RewriteResult,
        )
        return result.rewritten_query
    except LLMClientError:
        logger.exception("rewrite_or_expand LLM call failed; keeping current_query")
        return state["current_query"]


def rewrite_or_expand(state: AgentState) -> dict:
    action = state.get("retrieval_grade", {}).get("recommended_action", "rewrite_query")
    updates: dict = {
        "retry_count": state.get("retry_count", 0) + 1,
        "last_action": "rewrite_or_expand",
    }

    if action == "rewrite_query":
        updates["current_query"] = _rewrite_query(state)
    elif action in ("apply_new_filters", "expand_search"):
        # Relax filters: drop the most specific field (component) first,
        # then document_category, to broaden recall incrementally.
        filters = dict(state.get("metadata_filters", {}))
        for field in ("component", "document_category"):
            if field in filters:
                del filters[field]
                break
        updates["metadata_filters"] = filters

    return updates

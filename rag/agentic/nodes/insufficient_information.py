"""
agentic/nodes/insufficient_information.py

Deterministic node, no LLM call. Entered when retry_count reaches
max_retries without a grounded/relevant answer. Returns a fixed,
honest refusal rather than letting the system hallucinate.
"""
from __future__ import annotations

from agentic.state import AgentState


def insufficient_information(state: AgentState) -> dict:
    return {
        "answer": "Information not available in the current knowledge base.",
        "last_action": "insufficient_info",
    }

"""
agentic/state.py

Defines AgentState, the single shared state object threaded through
every LangGraph node, plus a factory for the initial state passed
into the graph on each new query.
"""
from __future__ import annotations

from typing import Any, TypedDict


class AgentState(TypedDict, total=False):
    # --- Query ---
    original_query: str
    current_query: str
    query_type: str
    detected_equipment: str | None
    detected_component: str | None
    detected_symptom: str | None
    component_hint: str | None  # externally supplied (e.g. 3D-viewer focus), bypasses analyze_query's guess

    # --- Semantic cache ---
    cache_hit: bool

    # --- Retrieval control ---
    metadata_filters: dict[str, Any]
    retrieval_strategy: str  # "no_retrieval" | "retrieve"

    # --- Scene control (digital-twin viewer) ---
    scene_ops_plan: dict[str, Any]  # plan_scene_ops's SceneOpsPlan, dumped to dict
    scene_ops: list[dict[str, Any]]  # ops actually applied by execute_scene_ops

    # --- Retrieval results ---
    retrieved_documents: list[dict[str, Any]]
    reranked_documents: list[dict[str, Any]]
    retrieval_grade: dict[str, Any]

    # --- Generation ---
    answer: str | None
    answer_validation: dict[str, Any]
    sources: list[dict[str, Any]]

    # --- Loop control ---
    retry_count: int
    max_retries: int
    last_action: str


def create_initial_state(
    query: str, max_retries: int = 2, component_hint: str | None = None
) -> AgentState:
    """Builds the initial AgentState for a new incoming user query."""
    return AgentState(
        original_query=query,
        current_query=query,
        query_type="",
        detected_equipment=None,
        detected_component=None,
        detected_symptom=None,
        component_hint=component_hint,
        cache_hit=False,
        metadata_filters={},
        retrieval_strategy="",
        scene_ops_plan={},
        scene_ops=[],
        retrieved_documents=[],
        reranked_documents=[],
        retrieval_grade={},
        answer=None,
        answer_validation={},
        sources=[],
        retry_count=0,
        max_retries=max_retries,
        last_action="start",
    )

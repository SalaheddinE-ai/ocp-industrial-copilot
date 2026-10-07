"""
agentic/graph.py

Builds and compiles the LangGraph StateGraph(AgentState).

Node functions are imported as module references (not bare function
imports) so that tests can monkeypatch e.g.
`agentic.nodes.grade_retrieval.grade_retrieval` before calling
build_graph() and have the patched version picked up.
"""
from __future__ import annotations

from langgraph.graph import END, StateGraph

from agentic.nodes import analyze_query as analyze_query_mod
from agentic.nodes import check_semantic_cache as check_semantic_cache_mod
from agentic.nodes import execute_scene_ops as execute_scene_ops_mod
from agentic.nodes import extract_metadata as extract_metadata_mod
from agentic.nodes import generate_answer as generate_answer_mod
from agentic.nodes import grade_retrieval as grade_retrieval_mod
from agentic.nodes import hybrid_retrieve as hybrid_retrieve_mod
from agentic.nodes import insufficient_information as insufficient_information_mod
from agentic.nodes import plan_scene_ops as plan_scene_ops_mod
from agentic.nodes import rerank_documents as rerank_documents_mod
from agentic.nodes import rewrite_or_expand as rewrite_or_expand_mod
from agentic.nodes import route_query as route_query_mod
from agentic.nodes import store_in_cache as store_in_cache_mod
from agentic.nodes import validate_answer as validate_answer_mod
from agentic.routers import cache_router, retrieval_router, validation_router
from agentic.state import AgentState


def build_graph():
    """Builds and compiles the adaptive corrective Agentic RAG graph."""
    workflow = StateGraph(AgentState)

    # --- Nodes ---
    workflow.add_node("analyze_query", analyze_query_mod.analyze_query)
    workflow.add_node("check_semantic_cache", check_semantic_cache_mod.check_semantic_cache)
    workflow.add_node("extract_metadata", extract_metadata_mod.extract_metadata)
    workflow.add_node("plan_scene_ops", plan_scene_ops_mod.plan_scene_ops)
    workflow.add_node("execute_scene_ops", execute_scene_ops_mod.execute_scene_ops)
    workflow.add_node("route_query", route_query_mod.route_query)
    workflow.add_node("hybrid_retrieve", hybrid_retrieve_mod.hybrid_retrieve)
    workflow.add_node("rerank_documents", rerank_documents_mod.rerank_documents)
    workflow.add_node("grade_retrieval", grade_retrieval_mod.grade_retrieval)
    workflow.add_node("rewrite_or_expand", rewrite_or_expand_mod.rewrite_or_expand)
    workflow.add_node("generate_answer", generate_answer_mod.generate_answer)
    workflow.add_node("validate_answer", validate_answer_mod.validate_answer)
    workflow.add_node("store_in_cache", store_in_cache_mod.store_in_cache)
    workflow.add_node(
        "insufficient_info", insufficient_information_mod.insufficient_information
    )

    # --- Entry point ---
    workflow.set_entry_point("analyze_query")

    # --- Fixed edges ---
    workflow.add_edge("analyze_query", "check_semantic_cache")
    # Scene-op planning/execution runs on every cache-miss query,
    # independently of the retrieval pipeline below -- most queries
    # produce zero ops and this is a no-op pass-through in practice.
    workflow.add_edge("extract_metadata", "plan_scene_ops")
    workflow.add_edge("plan_scene_ops", "execute_scene_ops")
    workflow.add_edge("execute_scene_ops", "route_query")
    workflow.add_edge("hybrid_retrieve", "rerank_documents")
    workflow.add_edge("rerank_documents", "grade_retrieval")
    workflow.add_edge("rewrite_or_expand", "hybrid_retrieve")
    workflow.add_edge("generate_answer", "validate_answer")
    workflow.add_edge("insufficient_info", END)
    workflow.add_edge("store_in_cache", END)

    # --- Conditional edges ---
    workflow.add_conditional_edges(
        "check_semantic_cache",
        cache_router.route_after_cache_check,
        {
            "cache_hit": END,
            "cache_miss": "extract_metadata",
        },
    )
    workflow.add_conditional_edges(
        "route_query",
        retrieval_router.route_after_query,
        {
            "hybrid_retrieve": "hybrid_retrieve",
            "generate_answer": "generate_answer",
        },
    )
    workflow.add_conditional_edges(
        "grade_retrieval",
        retrieval_router.route_after_grading,
        {
            "generate_answer": "generate_answer",
            "rewrite_or_expand": "rewrite_or_expand",
            "insufficient_info": "insufficient_info",
        },
    )
    workflow.add_conditional_edges(
        "validate_answer",
        validation_router.route_after_validation,
        {
            "accept": "store_in_cache",
            "correct": "generate_answer",
            "hybrid_retrieve": "hybrid_retrieve",
            "insufficient_info": "insufficient_info",
        },
    )

    return workflow.compile()

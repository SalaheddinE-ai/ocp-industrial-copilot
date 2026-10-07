"""
tests/test_graph.py

Graph-shape and loop-termination tests. LLM-backed and
retrieval-backed nodes (analyze_query, plan_scene_ops, hybrid_retrieve,
grade_retrieval, rewrite_or_expand, generate_answer, validate_answer)
are monkeypatched here so these tests run offline, with no API key
and no vector store -- they validate the GRAPH's routing and loop
behavior, not the quality of any individual LLM call (that's what
evaluation/ is for). check_semantic_cache and store_in_cache are also
stubbed here even though they're not LLM calls: both would otherwise
hit a real embedder (network/model download), which offline tests
must not depend on -- see tests/test_semantic_cache.py for real
coverage of that module with a fake embedder. Deterministic nodes
(extract_metadata, route_query, rerank_documents,
insufficient_information, execute_scene_ops) run for real.
execute_scene_ops is safe to run for real here specifically because
plan_scene_ops is stubbed to a no-op plan below -- with an empty ops
list it never spawns the scene-tools MCP subprocess (see
tests/test_scene_ops.py for that path).
"""
from __future__ import annotations

from agentic.graph import build_graph
from agentic.nodes import analyze_query as analyze_query_mod
from agentic.nodes import check_semantic_cache as check_semantic_cache_mod
from agentic.nodes import generate_answer as generate_answer_mod
from agentic.nodes import grade_retrieval as grade_retrieval_mod
from agentic.nodes import hybrid_retrieve as hybrid_retrieve_mod
from agentic.nodes import plan_scene_ops as plan_scene_ops_mod
from agentic.nodes import rewrite_or_expand as rewrite_or_expand_mod
from agentic.nodes import store_in_cache as store_in_cache_mod
from agentic.nodes import validate_answer as validate_answer_mod
from agentic.state import create_initial_state


def _stub_analyze_query(state):
    return {
        "current_query": state["original_query"],
        "query_type": "troubleshooting",
        "detected_equipment": "centrifugal_pump",
        "detected_component": "bearings",
        "detected_symptom": "high vibration",
        "last_action": "analyze_query",
    }


def _stub_check_semantic_cache_miss(state):
    return {"cache_hit": False, "last_action": "check_semantic_cache"}


def _stub_store_in_cache(state):
    return {"last_action": "store_in_cache"}


def _stub_plan_scene_ops(state):
    return {
        "scene_ops_plan": {"needs_scene_action": False, "ops": [], "reasoning": "stub"},
        "last_action": "plan_scene_ops",
    }


def _stub_hybrid_retrieve_empty(state):
    return {"retrieved_documents": [], "last_action": "hybrid_retrieve"}


def _stub_hybrid_retrieve_one_doc(state):
    return {
        "retrieved_documents": [
            {
                "document": {
                    "content": "Bearing overheating is caused by insufficient lubrication.",
                    "metadata": {
                        "equipment_family": "centrifugal_pumps",
                        "pump_type": "axial_flow",
                        "component": "bearings",
                        "document_category": "failures/bearings",
                        "source_type": "internal",
                        "document_name": "d1.txt",
                        "page": None,
                        "chunk_id": "c1",
                        "component_id": None,
                        "file_path": None,
                    },
                },
                "score": 0.9,
            }
        ],
        "last_action": "hybrid_retrieve",
    }


def _stub_grade_not_relevant(state):
    return {
        "retrieval_grade": {
            "decision": "not_relevant",
            "score": 0.0,
            "reason": "stub: forced not_relevant for test",
            "recommended_action": "rewrite_query",
        },
        "last_action": "grade_retrieval",
    }


def _stub_grade_relevant(state):
    return {
        "retrieval_grade": {
            "decision": "relevant",
            "score": 1.0,
            "reason": "stub: forced relevant for test",
            "recommended_action": "generate",
        },
        "last_action": "grade_retrieval",
    }


def _stub_rewrite(state):
    return {
        "current_query": state["current_query"],
        "retry_count": state.get("retry_count", 0) + 1,
        "last_action": "rewrite_or_expand",
    }


def _stub_generate(state):
    return {
        "answer": "[stub answer]",
        "sources": [],
        "last_action": "generate_answer",
    }


def _patch_common(monkeypatch):
    monkeypatch.setattr(analyze_query_mod, "analyze_query", _stub_analyze_query)
    monkeypatch.setattr(
        check_semantic_cache_mod, "check_semantic_cache", _stub_check_semantic_cache_miss
    )
    monkeypatch.setattr(plan_scene_ops_mod, "plan_scene_ops", _stub_plan_scene_ops)
    monkeypatch.setattr(generate_answer_mod, "generate_answer", _stub_generate)
    monkeypatch.setattr(store_in_cache_mod, "store_in_cache", _stub_store_in_cache)


def test_no_documents_terminates_at_insufficient_info(monkeypatch):
    _patch_common(monkeypatch)
    monkeypatch.setattr(hybrid_retrieve_mod, "hybrid_retrieve", _stub_hybrid_retrieve_empty)
    monkeypatch.setattr(grade_retrieval_mod, "grade_retrieval", _stub_grade_not_relevant)
    monkeypatch.setattr(rewrite_or_expand_mod, "rewrite_or_expand", _stub_rewrite)

    app = build_graph()
    state = create_initial_state("Why is the pump vibrating?", max_retries=2)
    result = app.invoke(state)

    assert result["retry_count"] == 2
    assert result["last_action"] == "insufficient_info"
    assert result["answer"] == "Information not available in the current knowledge base."


def test_happy_path_accepts_on_first_pass(monkeypatch):
    _patch_common(monkeypatch)
    monkeypatch.setattr(
        hybrid_retrieve_mod, "hybrid_retrieve", _stub_hybrid_retrieve_one_doc
    )
    monkeypatch.setattr(grade_retrieval_mod, "grade_retrieval", _stub_grade_relevant)

    def fake_validate(state):
        return {
            "answer_validation": {
                "grounded": True,
                "relevant": True,
                "unsupported_claims": [],
                "decision": "accept",
            },
            "last_action": "validate_answer",
        }

    monkeypatch.setattr(validate_answer_mod, "validate_answer", fake_validate)

    app = build_graph()
    state = create_initial_state("Why is the pump vibrating?", max_retries=2)
    result = app.invoke(state)

    assert result["retry_count"] == 0
    assert result["answer_validation"]["decision"] == "accept"
    # rerank_documents ran for real: reranked_documents should be populated
    assert len(result["reranked_documents"]) == 1


def test_correction_loop_runs_once_then_accepts(monkeypatch):
    _patch_common(monkeypatch)
    monkeypatch.setattr(
        hybrid_retrieve_mod, "hybrid_retrieve", _stub_hybrid_retrieve_one_doc
    )
    monkeypatch.setattr(grade_retrieval_mod, "grade_retrieval", _stub_grade_relevant)

    calls = {"n": 0}

    def fake_validate(state):
        calls["n"] += 1
        decision = "correct" if calls["n"] == 1 else "accept"
        return {
            "answer_validation": {
                "grounded": calls["n"] > 1,
                "relevant": True,
                "unsupported_claims": [] if calls["n"] > 1 else ["stub claim"],
                "decision": decision,
            },
            "last_action": "validate_answer",
        }

    monkeypatch.setattr(validate_answer_mod, "validate_answer", fake_validate)

    app = build_graph()
    state = create_initial_state("Why is the pump vibrating?", max_retries=2)
    result = app.invoke(state)

    assert calls["n"] == 2
    assert result["answer_validation"]["decision"] == "accept"
    assert result["retry_count"] == 0


def test_cache_hit_skips_retrieval_and_generation_entirely(monkeypatch):
    monkeypatch.setattr(analyze_query_mod, "analyze_query", _stub_analyze_query)

    def stub_cache_hit(state):
        return {
            "cache_hit": True,
            "answer": "[cached answer]",
            "sources": [{"document_name": "cached.pdf"}],
            "scene_ops": [],
            "last_action": "check_semantic_cache",
        }

    monkeypatch.setattr(check_semantic_cache_mod, "check_semantic_cache", stub_cache_hit)

    # None of these should ever run on a cache hit -- if the graph is
    # wired correctly, monkeypatching them to raise proves they weren't
    # reached rather than just asserting on the final state.
    def _fail(name):
        def _raise(state):
            raise AssertionError(f"{name} must not run on a cache hit")

        return _raise

    monkeypatch.setattr(plan_scene_ops_mod, "plan_scene_ops", _fail("plan_scene_ops"))
    monkeypatch.setattr(hybrid_retrieve_mod, "hybrid_retrieve", _fail("hybrid_retrieve"))
    monkeypatch.setattr(generate_answer_mod, "generate_answer", _fail("generate_answer"))
    monkeypatch.setattr(validate_answer_mod, "validate_answer", _fail("validate_answer"))

    app = build_graph()
    state = create_initial_state("Why is the pump vibrating?", max_retries=2)
    result = app.invoke(state)

    assert result["cache_hit"] is True
    assert result["answer"] == "[cached answer]"
    assert result["sources"] == [{"document_name": "cached.pdf"}]
    assert result["last_action"] == "check_semantic_cache"

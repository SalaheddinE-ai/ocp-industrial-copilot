"""
tests/test_validate_answer.py

Covers the second half of the same bug class as
test_generate_answer.py: validate_answer used to always check
groundedness against state["reranked_documents"], which is empty by
design on the no_retrieval path -- forcing a pointless
"retrieve_again" on every greeting. It must now trivially accept a
no_retrieval answer instead of judging it against context that was
never supposed to exist.
"""
from __future__ import annotations

from agentic.nodes.validate_answer import validate_answer


def test_no_retrieval_answer_is_trivially_accepted(monkeypatch):
    def fail_if_called(*args, **kwargs):
        raise AssertionError("structured_call must not run for a no_retrieval answer")

    monkeypatch.setattr("agentic.nodes.validate_answer.structured_call", fail_if_called)

    state = {
        "original_query": "hello",
        "retrieval_strategy": "no_retrieval",
        "answer": "Hi there! Ask me about pump maintenance.",
        "reranked_documents": [],
    }
    result = validate_answer(state)

    assert result["answer_validation"]["decision"] == "accept"
    assert result["answer_validation"]["grounded"] is True


def test_insufficient_message_still_trivially_accepted():
    state = {
        "original_query": "why does the bearing overheat",
        "retrieval_strategy": "retrieve",
        "answer": "Information not available in the current knowledge base.",
        "reranked_documents": [],
    }
    result = validate_answer(state)

    assert result["answer_validation"]["decision"] == "accept"


def test_retrieve_strategy_still_runs_real_grounding_check(monkeypatch):
    calls = {}

    def fake_structured_call(system_prompt, user_message, response_model, model):
        calls["ran"] = True
        return response_model(grounded=True, relevant=True, unsupported_claims=[], decision="accept")

    monkeypatch.setattr("agentic.nodes.validate_answer.structured_call", fake_structured_call)

    state = {
        "original_query": "why does the bearing overheat",
        "retrieval_strategy": "retrieve",
        "answer": "The bearing overheats due to insufficient lubrication.",
        "reranked_documents": [
            {"document": {"content": "Bearing overheating is caused by insufficient lubrication."}}
        ],
    }
    result = validate_answer(state)

    # Unlike the no_retrieval case, the real judge call must run.
    assert calls.get("ran") is True
    assert result["answer_validation"]["decision"] == "accept"

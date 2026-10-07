"""
tests/test_generate_answer.py

Covers the bug fixed in this session: generate_answer used to return
the "insufficient information" fallback for ANY empty
reranked_documents list, including the no_retrieval path (greetings,
general questions) where there was never any retrieval to be
insufficient. Now it must answer directly from the model for
no_retrieval, and only fall back for a genuine empty-retrieval case.
"""
from __future__ import annotations

from agentic.nodes.generate_answer import generate_answer

_INSUFFICIENT_MSG = "Information not available in the current knowledge base."


def test_no_retrieval_answers_directly_even_with_no_documents(monkeypatch):
    calls = {}

    def fake_plain_call(system_prompt, user_message):
        calls["system_prompt"] = system_prompt
        calls["user_message"] = user_message
        return "Hi there! Ask me about pump components or maintenance."

    monkeypatch.setattr("agentic.nodes.generate_answer.plain_call", fake_plain_call)

    state = {
        "original_query": "hello",
        "retrieval_strategy": "no_retrieval",
        "reranked_documents": [],  # deliberately empty -- must not short-circuit
    }
    result = generate_answer(state)

    assert result["answer"] != _INSUFFICIENT_MSG
    assert result["answer"] == "Hi there! Ask me about pump components or maintenance."
    assert result["sources"] == []
    # GENERAL_CHAT_SYSTEM_PROMPT was used, not the grounded-context prompt
    assert "user_message" in calls
    assert calls["user_message"] == "hello"


def test_no_retrieval_degrades_gracefully_on_llm_failure(monkeypatch):
    from config.llm_client import LLMClientError

    def fake_plain_call(system_prompt, user_message):
        raise LLMClientError("boom")

    monkeypatch.setattr("agentic.nodes.generate_answer.plain_call", fake_plain_call)

    state = {"original_query": "hello", "retrieval_strategy": "no_retrieval", "reranked_documents": []}
    result = generate_answer(state)

    # Still answers something friendly rather than the knowledge-base
    # fallback message, which would be a category error here.
    assert result["answer"] != _INSUFFICIENT_MSG
    assert len(result["answer"]) > 0
    assert result["sources"] == []


def test_retrieve_strategy_with_empty_documents_is_genuinely_insufficient():
    # No plain_call monkeypatch needed -- generate_answer must short-circuit
    # before ever calling the LLM when retrieval was attempted and found
    # nothing.
    state = {
        "original_query": "why does the bearing overheat",
        "retrieval_strategy": "retrieve",
        "reranked_documents": [],
    }
    result = generate_answer(state)

    assert result["answer"] == _INSUFFICIENT_MSG
    assert result["sources"] == []


def test_retrieve_strategy_with_documents_generates_grounded_answer(monkeypatch):
    def fake_plain_call(system_prompt, user_message):
        assert "Retrieved context" in user_message
        return "The bearing overheats due to insufficient lubrication."

    monkeypatch.setattr("agentic.nodes.generate_answer.plain_call", fake_plain_call)

    state = {
        "original_query": "why does the bearing overheat",
        "retrieval_strategy": "retrieve",
        "reranked_documents": [
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
    }
    result = generate_answer(state)

    assert result["answer"] == "The bearing overheats due to insufficient lubrication."
    assert len(result["sources"]) == 1

"""
tests/test_analyze_query_greeting.py

Covers the deterministic greeting/chitchat fast-path added to
analyze_query: obvious greetings must classify as
general_technical_question WITHOUT ever calling the LLM (faster, and
doesn't depend on a small local model reliably following the prompt's
classification instructions for trivial cases).
"""
from __future__ import annotations

import pytest

from agentic.nodes.analyze_query import analyze_query


def _fail_if_llm_called(*args, **kwargs):
    raise AssertionError("structured_call must not run for an obvious greeting")


@pytest.mark.parametrize(
    "message",
    [
        "hello",
        "Hello!",
        "hi",
        "hey",
        "salut",
        "bonjour",
        "merci",
        "thanks",
        "thank you",
        "how are you",
        "comment ça va",
        "who are you",
        "what can you do",
        "  hello   ",  # surrounding whitespace
        "Hello?",
    ],
)
def test_obvious_greetings_skip_the_llm(monkeypatch, message):
    monkeypatch.setattr("agentic.nodes.analyze_query.structured_call", _fail_if_llm_called)

    result = analyze_query({"original_query": message})

    assert result["query_type"] == "general_technical_question"
    assert result["detected_equipment"] is None
    assert result["detected_component"] is None
    assert result["detected_symptom"] is None


@pytest.mark.parametrize(
    "message",
    [
        "why is the bearing overheating",
        "hello, my pump is leaking from the mechanical seal",  # greeting + real content
        "hi there, what torque should I use for the casing bolts",
        "hey can you show me the impeller",
    ],
)
def test_real_questions_still_go_through_the_llm(monkeypatch, message):
    calls = {"n": 0}

    def fake_structured_call(system_prompt, user_message, response_model):
        calls["n"] += 1
        return response_model(query_type="component_information")

    monkeypatch.setattr("agentic.nodes.analyze_query.structured_call", fake_structured_call)

    analyze_query({"original_query": message})

    assert calls["n"] == 1  # the LLM classifier actually ran

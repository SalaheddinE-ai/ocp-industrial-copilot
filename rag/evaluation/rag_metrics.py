"""
evaluation/rag_metrics.py

End-to-end RAG quality metrics, plus agentic-specific metrics
aggregated across a batch of graph runs (one final AgentState dict
per query, as returned by agentic.graph's compiled app.invoke()).

Faithfulness/relevancy here use a lightweight lexical-overlap
heuristic by default (no LLM cost, fully deterministic, good enough
for regression testing across code changes). An LLM-judge variant is
provided for the real evaluation chapter, using the same
config.llm_client used by the agentic graph's own validate_answer
node -- but note that scoring your own system with the same class of
judge it corrects itself with is a known bias risk; prefer a
different model/provider for the judge than for generation where
possible.
"""
from __future__ import annotations

import re
from collections import Counter
from typing import Any

from config.llm_client import LLMClientError, structured_call
from models.schemas import AnswerValidation

_INSUFFICIENT_MSG = "Information not available in the current knowledge base."


def _tokenize(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", text.lower()))


def lexical_faithfulness(answer: str, context: str) -> float:
    """Fraction of the answer's content words that also appear in the
    retrieved context. Cheap proxy for groundedness -- not a
    substitute for an LLM-judge pass, but useful for fast regression
    checks in CI without incurring LLM cost on every commit."""
    answer_tokens = _tokenize(answer)
    context_tokens = _tokenize(context)
    if not answer_tokens:
        return 0.0
    overlap = answer_tokens & context_tokens
    return len(overlap) / len(answer_tokens)


def lexical_answer_relevancy(answer: str, query: str) -> float:
    """Fraction of the query's content words reflected in the answer."""
    query_tokens = _tokenize(query)
    answer_tokens = _tokenize(answer)
    if not query_tokens:
        return 0.0
    return len(query_tokens & answer_tokens) / len(query_tokens)


def llm_judge_faithfulness(query: str, context: str, answer: str) -> AnswerValidation:
    """Real LLM-as-judge faithfulness check, reusing the same
    validate_answer contract. Raises LLMClientError if the provider
    call fails -- callers decide how to handle that for a batch run
    (e.g. skip the example vs fail the whole eval run)."""
    from config.prompts import VALIDATE_ANSWER_SYSTEM_PROMPT

    user_message = (
        f"Original question: {query}\n\nRetrieved context:\n{context}\n\n"
        f"Generated answer:\n{answer}"
    )
    return structured_call(
        system_prompt=VALIDATE_ANSWER_SYSTEM_PROMPT,
        user_message=user_message,
        response_model=AnswerValidation,
    )


def aggregate_agentic_metrics(run_results: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Aggregates agentic-loop metrics across a batch of graph runs:
    - average retry_count overall and per query_type
    - insufficient-information rate
    - decision distribution at validate_answer

    `run_results` is a list of final AgentState dicts (one per query),
    as returned by build_graph().invoke(...).
    """
    n = len(run_results)
    if n == 0:
        return {}

    retry_counts = [r.get("retry_count", 0) for r in run_results]
    insufficient = sum(
        1 for r in run_results if r.get("answer") == _INSUFFICIENT_MSG
    )

    per_type_retries: dict[str, list[int]] = {}
    for r in run_results:
        qt = r.get("query_type", "unknown")
        per_type_retries.setdefault(qt, []).append(r.get("retry_count", 0))

    validation_decisions = Counter(
        r.get("answer_validation", {}).get("decision", "unknown") for r in run_results
    )

    return {
        "n_queries": n,
        "avg_retry_count": sum(retry_counts) / n,
        "insufficient_info_rate": insufficient / n,
        "avg_retry_count_by_query_type": {
            qt: sum(counts) / len(counts) for qt, counts in per_type_retries.items()
        },
        "validate_answer_decision_distribution": dict(validation_decisions),
    }

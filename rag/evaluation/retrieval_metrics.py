"""
evaluation/retrieval_metrics.py

Retrieval-quality metrics for Chapter 6 (Evaluation): Recall@k,
Precision@k, MRR, nDCG -- computed by comparing a retriever's ranked
output against evaluation.test_dataset.EVAL_DATASET's labeled
relevant_chunk_ids. Pure functions, no LLM calls, fully deterministic
and unit-testable.
"""
from __future__ import annotations

import math

from models.document import ScoredDocument


def _retrieved_ids(results: list[ScoredDocument]) -> list[str]:
    return [r.document.metadata.chunk_id for r in results]


def recall_at_k(results: list[ScoredDocument], relevant_ids: list[str], k: int) -> float:
    if not relevant_ids:
        return 0.0
    retrieved = set(_retrieved_ids(results)[:k])
    hits = len(retrieved & set(relevant_ids))
    return hits / len(relevant_ids)


def precision_at_k(results: list[ScoredDocument], relevant_ids: list[str], k: int) -> float:
    top_k = _retrieved_ids(results)[:k]
    if not top_k:
        return 0.0
    hits = sum(1 for cid in top_k if cid in relevant_ids)
    return hits / len(top_k)


def mean_reciprocal_rank(results: list[ScoredDocument], relevant_ids: list[str]) -> float:
    for rank, cid in enumerate(_retrieved_ids(results), start=1):
        if cid in relevant_ids:
            return 1.0 / rank
    return 0.0


def ndcg_at_k(results: list[ScoredDocument], relevant_ids: list[str], k: int) -> float:
    """Binary-relevance nDCG@k."""
    top_k = _retrieved_ids(results)[:k]
    dcg = sum(
        1.0 / math.log2(rank + 1)
        for rank, cid in enumerate(top_k, start=1)
        if cid in relevant_ids
    )
    ideal_hits = min(len(relevant_ids), k)
    idcg = sum(1.0 / math.log2(rank + 1) for rank in range(1, ideal_hits + 1))
    return dcg / idcg if idcg > 0 else 0.0


def evaluate_retrieval(
    results: list[ScoredDocument], relevant_ids: list[str], k: int = 5
) -> dict[str, float]:
    """Convenience aggregator returning all metrics for one query."""
    return {
        "recall@k": recall_at_k(results, relevant_ids, k),
        "precision@k": precision_at_k(results, relevant_ids, k),
        "mrr": mean_reciprocal_rank(results, relevant_ids),
        "ndcg@k": ndcg_at_k(results, relevant_ids, k),
    }

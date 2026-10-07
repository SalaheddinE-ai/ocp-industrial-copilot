"""
retrieval/fusion.py

Reciprocal Rank Fusion (RRF) of dense (vector) and lexical (BM25)
result lists into a single ranked list. Deterministic, pure
function -- no model calls.

RRF score for a document = sum over each ranked list it appears in
of 1 / (k + rank), where rank is 1-indexed. k=60 is the standard
default from the original RRF paper (Cormack et al., 2009) and is
not particularly sensitive to tuning.
"""
from __future__ import annotations

from models.document import Document, ScoredDocument


def reciprocal_rank_fusion(
    result_lists: list[list[ScoredDocument]], k: int = 60
) -> list[ScoredDocument]:
    """Fuses N ranked result lists (e.g. [vector_results, bm25_results])
    into one list ranked by combined reciprocal rank."""
    fused_scores: dict[str, float] = {}
    doc_by_id: dict[str, Document] = {}

    for results in result_lists:
        for rank, scored_doc in enumerate(results, start=1):
            chunk_id = scored_doc.document.metadata.chunk_id
            fused_scores[chunk_id] = fused_scores.get(chunk_id, 0.0) + 1.0 / (k + rank)
            doc_by_id[chunk_id] = scored_doc.document

    ranked_ids = sorted(fused_scores.items(), key=lambda item: item[1], reverse=True)
    return [
        ScoredDocument(document=doc_by_id[chunk_id], score=score)
        for chunk_id, score in ranked_ids
    ]

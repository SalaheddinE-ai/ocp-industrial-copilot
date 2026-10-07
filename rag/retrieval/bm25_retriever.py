"""
retrieval/bm25_retriever.py

Lexical/keyword retrieval over an in-memory corpus using BM25
(rank_bm25). Important for exact technical vocabulary (part numbers,
component codes like "PUMP-AXIAL-BRG-001") where dense embeddings
alone tend to under-perform.

Note: this holds the corpus in memory and (re)builds the BM25 index
at construction time. For large knowledge bases this should be
replaced with a persistent inverted-index backend (Elasticsearch/
OpenSearch); the interface (retrieve()) would stay the same.
"""
from __future__ import annotations

import re

from models.document import Document, ScoredDocument


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


class BM25Retriever:
    def __init__(self, corpus: list[Document]):
        from rank_bm25 import BM25Okapi

        self.corpus = corpus
        self._tokenized = [_tokenize(d.content) for d in corpus]
        self._bm25 = BM25Okapi(self._tokenized) if self._tokenized else None

    def retrieve(self, query: str, top_k: int) -> list[ScoredDocument]:
        if self._bm25 is None:
            return []
        scores = self._bm25.get_scores(_tokenize(query))
        ranked = sorted(
            zip(self.corpus, scores), key=lambda pair: pair[1], reverse=True
        )[:top_k]
        return [
            ScoredDocument(document=doc, score=float(score))
            for doc, score in ranked
            if score > 0
        ]

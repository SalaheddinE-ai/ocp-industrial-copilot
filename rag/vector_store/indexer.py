"""
vector_store/indexer.py

Batch-indexes Document chunks produced by ingestion.pipeline:
embeds them via embeddings.embedder.Embedder, then writes to the
configured VectorStore. Handles simple batching to avoid oversized
embedding API calls.
"""
from __future__ import annotations

import logging

from embeddings.embedder import Embedder
from models.document import Document
from vector_store.vector_db import ChromaVectorStore

logger = logging.getLogger(__name__)


class Indexer:
    def __init__(
        self,
        embedder: Embedder | None = None,
        vector_store: ChromaVectorStore | None = None,
        batch_size: int = 64,
    ):
        self.embedder = embedder or Embedder()
        self.vector_store = vector_store or ChromaVectorStore()
        self.batch_size = batch_size

    def index_documents(self, documents: list[Document]) -> int:
        """Embeds and indexes documents in batches. Returns count indexed."""
        total = 0
        for i in range(0, len(documents), self.batch_size):
            batch = documents[i : i + self.batch_size]
            embeddings = self.embedder.embed_documents([d.content for d in batch])
            self.vector_store.add(batch, embeddings)
            total += len(batch)
            logger.info("Indexed batch %d-%d", i, i + len(batch))
        return total

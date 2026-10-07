"""
ingestion/pipeline.py

Orchestrates the end-to-end ingestion flow for the knowledge/ folder
hierarchy:

  walk knowledge_root
    -> loaders.load_file        (read raw text, page-aware for PDFs)
    -> parsers.split_into_sections
    -> chunking.chunk_document
    -> metadata.infer_metadata_from_path
    -> models.document.Document

Returns Document objects ready for embeddings + vector_store.indexer.
This module does NOT call embeddings or the vector store directly --
that keeps ingestion independently testable from indexing.
"""
from __future__ import annotations

import logging
from pathlib import Path

from ingestion.chunking.fixed_size_chunker import chunk_document
from ingestion.loaders import SUPPORTED_EXTENSIONS, load_file
from ingestion.metadata.path_metadata import infer_metadata_from_path
from ingestion.parsers.generic_parser import split_into_sections
from models.document import Document

logger = logging.getLogger(__name__)


def ingest_file(file_path: Path, knowledge_root: Path) -> list[Document]:
    """Ingests a single file into a list of Document chunks."""
    documents: list[Document] = []
    try:
        pages = load_file(file_path)
    except Exception:
        logger.exception("Failed to load %s", file_path)
        return []

    for page_number, text in pages:
        sections = split_into_sections(text)
        chunks = chunk_document(file_path.name, sections, page=page_number)
        for chunk_id, chunk_text in chunks:
            metadata = infer_metadata_from_path(
                file_path, knowledge_root, chunk_id=chunk_id, page=page_number
            )
            documents.append(Document(content=chunk_text, metadata=metadata))

    logger.info("Ingested %d chunks from %s", len(documents), file_path)
    return documents


def ingest_knowledge_base(knowledge_root: str | Path) -> list[Document]:
    """Walks knowledge_root and ingests every supported file into Document chunks."""
    root = Path(knowledge_root)
    if not root.exists():
        logger.warning("Knowledge root %s does not exist", root)
        return []

    all_documents: list[Document] = []
    for file_path in root.rglob("*"):
        if file_path.is_file() and file_path.suffix.lower() in SUPPORTED_EXTENSIONS:
            all_documents.extend(ingest_file(file_path, root))

    logger.info(
        "Ingestion complete: %d chunks from %s", len(all_documents), root
    )
    return all_documents

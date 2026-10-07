"""
ingestion/chunking/fixed_size_chunker.py

Structure-aware chunker: chunks within each (heading, body) section
produced by ingestion.parsers.generic_parser, using a character-based
sliding window with overlap. Keeping chunking section-scoped (rather
than chunking the whole raw text at once) avoids splitting a
procedure or failure-mode description across an arbitrary boundary
when a heading is available.
"""
from __future__ import annotations

import hashlib


def _make_chunk_id(document_name: str, page: int | None, index: int) -> str:
    raw = f"{document_name}:{page}:{index}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:12]


def chunk_section(
    heading: str,
    body: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 150,
) -> list[str]:
    """Splits one section's body text into overlapping chunks, each
    prefixed with its heading for retrieval context."""
    if len(body) <= chunk_size:
        return [f"{heading}\n{body}".strip() if heading else body]

    chunks: list[str] = []
    start = 0
    while start < len(body):
        end = start + chunk_size
        piece = body[start:end]
        chunks.append(f"{heading}\n{piece}".strip() if heading else piece)
        if end >= len(body):
            break
        start = end - chunk_overlap
    return chunks


def chunk_document(
    document_name: str,
    sections: list[tuple[str, str]],
    page: int | None = None,
    chunk_size: int = 1000,
    chunk_overlap: int = 150,
) -> list[tuple[str, str]]:
    """
    Chunks all sections of a document. Returns [(chunk_id, chunk_text), ...].
    """
    results: list[tuple[str, str]] = []
    index = 0
    for heading, body in sections:
        for piece in chunk_section(heading, body, chunk_size, chunk_overlap):
            chunk_id = _make_chunk_id(document_name, page, index)
            results.append((chunk_id, piece))
            index += 1
    return results

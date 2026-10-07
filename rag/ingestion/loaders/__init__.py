"""
ingestion/loaders/

File-format-specific loaders + a small dispatcher used by
ingestion/pipeline.py. Deterministic, no LLM calls.
"""
from __future__ import annotations

from pathlib import Path

from ingestion.loaders.docx_loader import load_docx
from ingestion.loaders.pdf_loader import load_pdf
from ingestion.loaders.text_loader import load_text

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md"}


def load_file(path: Path) -> list[tuple[int | None, str]]:
    """
    Dispatches to the right loader based on file extension.
    Returns a list of (page_number_or_None, text) so downstream
    chunking/metadata code has a uniform interface regardless of format.
    """
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return load_pdf(path)
    if suffix == ".docx":
        return [(None, load_docx(path))]
    if suffix in (".txt", ".md"):
        return [(None, load_text(path))]
    raise ValueError(f"Unsupported file extension: {suffix}")

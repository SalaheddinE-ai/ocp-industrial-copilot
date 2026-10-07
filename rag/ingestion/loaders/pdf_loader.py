"""ingestion/loaders/pdf_loader.py — PDF loader, page-aware."""
from __future__ import annotations

from pathlib import Path


def load_pdf(path: Path) -> list[tuple[int, str]]:
    """Returns a list of (page_number, page_text), 1-indexed pages."""
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    pages: list[tuple[int, str]] = []
    for i, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        if text.strip():
            pages.append((i, text))
    return pages

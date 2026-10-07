"""ingestion/loaders/docx_loader.py — Word document loader."""
from __future__ import annotations

from pathlib import Path


def load_docx(path: Path) -> str:
    from docx import Document as DocxDocument

    doc = DocxDocument(str(path))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())

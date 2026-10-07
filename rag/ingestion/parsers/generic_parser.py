"""
ingestion/parsers/generic_parser.py

Deterministic, format-agnostic structuring: turns raw loader text
into a list of (heading, text) sections using a simple heuristic
(lines that are short, title-cased/uppercase, and not ending in
punctuation are treated as section headings). Good enough for
manuals/procedures without requiring per-manufacturer layout rules;
can be specialized later per document type if needed.
"""
from __future__ import annotations

import re

_HEADING_RE = re.compile(r"^(?=.{3,80}$)[A-Z0-9][A-Za-z0-9 \-/&,]*[A-Za-z0-9]$")


def _looks_like_heading(line: str) -> bool:
    stripped = line.strip()
    if not stripped or stripped.endswith((".", ":", ";", ",")):
        return False
    if len(stripped.split()) > 10:
        return False
    return bool(_HEADING_RE.match(stripped)) and (
        stripped.isupper() or stripped.istitle()
    )


def split_into_sections(text: str) -> list[tuple[str, str]]:
    """Returns [(heading, body_text), ...]. Text before the first
    detected heading is returned under heading "" (introduction/preamble)."""
    lines = text.splitlines()
    sections: list[tuple[str, list[str]]] = [("", [])]

    for line in lines:
        if _looks_like_heading(line):
            sections.append((line.strip(), []))
        else:
            sections[-1][1].append(line)

    return [
        (heading, "\n".join(body).strip())
        for heading, body in sections
        if "\n".join(body).strip()
    ]

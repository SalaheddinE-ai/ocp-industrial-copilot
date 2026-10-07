"""
retrieval/filters.py

MetadataFilter schema + translation to backend-specific query
filters (Chroma `where` clause syntax today).
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class MetadataFilter(BaseModel):
    equipment_family: str | None = None
    pump_type: str | None = None
    component: str | None = None
    document_category: str | None = None
    source_type: str | None = None

    def is_empty(self) -> bool:
        return not any(
            [
                self.equipment_family,
                self.pump_type,
                self.component,
                self.document_category,
                self.source_type,
            ]
        )

    def to_chroma_where(self) -> dict[str, Any] | None:
        """Translates set fields into a Chroma `where` clause."""
        clauses = [
            {field: value}
            for field, value in self.model_dump(exclude_none=True).items()
        ]
        if not clauses:
            return None
        if len(clauses) == 1:
            return clauses[0]
        return {"$and": clauses}

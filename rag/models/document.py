"""
models/document.py

Core document/chunk data models shared across ingestion, retrieval,
and agentic modules.
"""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class DocumentMetadata(BaseModel):
    """Metadata attached to every chunk, used for filtering + traceability."""

    equipment_family: str = Field(default="centrifugal_pumps")
    pump_type: Optional[str] = Field(default=None)  # e.g. "axial_flow"
    component: Optional[str] = Field(default=None)  # e.g. "bearings", "mechanical_seal"
    document_category: Optional[str] = Field(default=None)  # e.g. "failures/bearings"
    source_type: Optional[str] = Field(default=None)  # "internal" | "external"
    document_name: str
    page: Optional[int] = Field(default=None)
    chunk_id: str
    component_id: Optional[str] = Field(default=None)  # e.g. "PUMP-AXIAL-BRG-001"
    file_path: Optional[str] = Field(default=None)

    def to_filter_dict(self) -> dict[str, Any]:
        """Only the fields useful for metadata filtering (drops chunk-specific ones)."""
        return {
            k: v
            for k, v in {
                "equipment_family": self.equipment_family,
                "pump_type": self.pump_type,
                "component": self.component,
                "document_category": self.document_category,
                "source_type": self.source_type,
            }.items()
            if v is not None
        }


class Document(BaseModel):
    """A single chunk of content plus its metadata."""

    content: str
    metadata: DocumentMetadata


class ScoredDocument(BaseModel):
    """A Document with a retrieval/rerank score attached."""

    document: Document
    score: float


class SourceRef(BaseModel):
    """The trimmed-down reference shown alongside the final answer."""

    document_name: str
    page: Optional[int] = None
    chunk_id: str
    document_category: Optional[str] = None

    @classmethod
    def from_document(cls, doc: Document) -> "SourceRef":
        return cls(
            document_name=doc.metadata.document_name,
            page=doc.metadata.page,
            chunk_id=doc.metadata.chunk_id,
            document_category=doc.metadata.document_category,
        )

"""
models/schemas.py

Pydantic schemas for every structured LLM output produced by the
agentic graph nodes. These are passed as the `response_model` /
tool-schema to the LLM client so structured-output calls validate at
the boundary and fail loudly on malformed output.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

QueryType = Literal[
    "component_information",
    "troubleshooting",
    "failure_analysis",
    "maintenance_procedure",
    "operation",
    "installation",
    "spare_parts",
    "technical_specification",
    "safety",
    "document_search",
    "general_technical_question",
]

RetrievalDecision = Literal["relevant", "not_relevant", "partial"]
RecommendedAction = Literal[
    "generate", "rewrite_query", "expand_search", "apply_new_filters"
]
ValidationDecision = Literal["accept", "correct", "retrieve_again"]


class QueryAnalysis(BaseModel):
    """Output of the analyze_query node."""

    query_type: QueryType
    detected_equipment: Optional[str] = Field(
        default=None, description="e.g. 'centrifugal_pump'"
    )
    detected_component: Optional[str] = Field(
        default=None, description="e.g. 'bearings', 'mechanical_seal', 'shaft'"
    )
    detected_symptom: Optional[str] = Field(
        default=None, description="e.g. 'high vibration', 'overheating'"
    )


class RetrievalGrade(BaseModel):
    """Output of the grade_retrieval node."""

    decision: RetrievalDecision
    score: float = Field(ge=0.0, le=1.0)
    reason: str
    recommended_action: RecommendedAction


class RewriteResult(BaseModel):
    """Output of the rewrite_or_expand node (LLM-produced fields only)."""

    rewritten_query: str
    added_terms: list[str] = Field(default_factory=list)
    relax_filters: bool = Field(
        default=False, description="True if metadata filters should be relaxed"
    )


class AnswerValidation(BaseModel):
    """Output of the validate_answer node."""

    grounded: bool
    relevant: bool
    unsupported_claims: list[str] = Field(default_factory=list)
    decision: ValidationDecision

"""
api/schemas/requests.py

Pydantic request/response models for the API layer. Kept separate
from models/schemas.py (internal LLM structured outputs) so the
public API contract can evolve independently of internal node
schemas.
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from models.document import SourceRef
from models.scene_ops import SceneOp


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1)
    session_id: str | None = None
    max_retries: int | None = None
    component_hint: str | None = Field(
        default=None,
        description="Deterministic component override, e.g. the component "
        "currently focused in a 3D viewer ('mechanical_seal', 'bearings', ...). "
        "Takes priority over the LLM-detected component in extract_metadata.",
    )


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceRef]
    query_type: str
    retrieval_grade: dict | None = None
    answer_validation: dict | None = None
    retry_count: int
    scene_ops: list[SceneOp] = Field(
        default_factory=list,
        description="Scene mutations actually applied by execute_scene_ops, "
        "for the frontend to replay against its own 3D viewer.",
    )

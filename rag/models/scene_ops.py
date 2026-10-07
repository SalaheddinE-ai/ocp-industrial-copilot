"""
models/scene_ops.py

Structured schema for the plan_scene_ops node's LLM output, and the
canonical component-id vocabulary shared with the scene-tools MCP
server (mcp_server/scene_tools_server.py) so both validate against the
same known set regardless of caller.

Flattened (one SceneOp model with optional per-type fields) rather
than a discriminated Union[...] -- Pydantic's discriminated-union JSON
schema uses a `discriminator` keyword that isn't part of plain JSON
Schema and doesn't round-trip reliably through every LLM structured-
output backend (see config/llm_client.py's two providers). A flat
model with a `type` literal is a schema every provider handles the
same way.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

ComponentId = Literal[
    "casing",
    "impeller",
    "shaft",
    "bearings",
    "mechanical_seal",
    "wear_ring",
    "coupling",
    "base_plate",
    "motor",
    "discharge_flange",
    "suction_flange",
]

# Kept in sync with ComponentId above -- the MCP tool server validates
# against this at call time too, since an MCP client isn't required to
# go through plan_scene_ops's structured-output path (e.g. a direct
# call from Claude Desktop or another MCP client).
KNOWN_COMPONENT_IDS = frozenset(ComponentId.__args__)

ViewMode = Literal["normal", "exploded", "section"]
ComponentHealthState = Literal["healthy", "warning", "critical"]
SceneOpType = Literal["focus_component", "set_view_mode", "set_component_state"]


class SceneOp(BaseModel):
    """A single scene mutation the agent wants performed. Only the
    fields relevant to `type` are expected to be set; execute_scene_ops
    validates that the required fields for each type are present
    before calling the corresponding MCP tool."""

    type: SceneOpType
    component_id: Optional[ComponentId] = Field(
        default=None, description="Required for focus_component and set_component_state"
    )
    mode: Optional[ViewMode] = Field(default=None, description="Required for set_view_mode")
    state: Optional[ComponentHealthState] = Field(
        default=None, description="Required for set_component_state"
    )


class SceneOpsPlan(BaseModel):
    """Output of the plan_scene_ops node. An empty ops list is the
    common case -- most questions ('explain cavitation') need no scene
    manipulation at all, and this node must not force one."""

    needs_scene_action: bool
    ops: list[SceneOp] = Field(default_factory=list)
    reasoning: str = ""

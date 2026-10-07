"""
agentic/nodes/execute_scene_ops.py

No LLM call. Takes the ops planned by plan_scene_ops and executes each
one against the scene-tools MCP server (mcp_server/scene_tools_server.py),
collecting the ones that actually applied. Invalid or failed ops are
dropped rather than raised -- fail-closed, matching every other
deterministic node in this graph (see extract_metadata.py,
route_query.py): a scene-op failure must never block the text answer
from generating.
"""
from __future__ import annotations

import logging

from agentic.state import AgentState
from mcp_server.client import SceneToolError, call_scene_tool

logger = logging.getLogger(__name__)

_TOOL_NAME_BY_OP_TYPE = {
    "focus_component": "focus_component",
    "set_view_mode": "set_view_mode",
    "set_component_state": "set_component_state",
}

# Required fields per op type, used to skip malformed ops before ever
# calling the MCP tool (the tool itself would reject a missing
# argument too, but this avoids a wasted subprocess spawn).
_REQUIRED_FIELDS = {
    "focus_component": ("component_id",),
    "set_view_mode": ("mode",),
    "set_component_state": ("component_id", "state"),
}


def _build_arguments(op: dict, op_type: str) -> dict:
    return {field: op[field] for field in _REQUIRED_FIELDS[op_type]}


def execute_scene_ops(state: AgentState) -> dict:
    plan = state.get("scene_ops_plan") or {}
    ops = plan.get("ops", []) if plan.get("needs_scene_action") else []

    applied: list[dict] = []
    for op in ops:
        op_type = op.get("type")
        tool_name = _TOOL_NAME_BY_OP_TYPE.get(op_type)
        if not tool_name:
            logger.warning("execute_scene_ops: unknown op type %r, skipping", op_type)
            continue

        required = _REQUIRED_FIELDS[op_type]
        if any(op.get(f) is None for f in required):
            logger.warning(
                "execute_scene_ops: op %s missing required field(s) %s, skipping",
                op,
                required,
            )
            continue

        try:
            arguments = _build_arguments(op, op_type)
            result = call_scene_tool(tool_name, arguments)
        except SceneToolError:
            logger.exception("execute_scene_ops: MCP call failed for op %s", op)
            continue

        if result.get("status") == "ok":
            applied.append(result["applied"])
        else:
            logger.warning(
                "execute_scene_ops: op %s rejected by scene-tools server: %s",
                op,
                result.get("message"),
            )

    return {"scene_ops": applied, "last_action": "execute_scene_ops"}

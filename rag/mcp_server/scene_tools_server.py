"""
mcp_server/scene_tools_server.py

MCP server exposing the digital-twin 3D viewer's scene-mutation
surface as tools: focus_component, set_view_mode,
set_component_state, get_scene_state. Runs as a standalone stdio MCP
server (`python -m mcp_server.scene_tools_server`);
agentic/nodes/execute_scene_ops.py connects to it as an MCP client,
once per graph run, via mcp_server/client.py.

Every tool parameter is typed `str`, not `Literal[...]`, even though
each has a fixed set of valid values (documented in each docstring).
This is deliberate: with a Literal type hint, the MCP server validates
the argument against the JSON schema *before* the function body runs,
so a bad value raises a hard transport-level error instead of
reaching our own validation -- meaning callers would see two
different failure shapes depending on which field was wrong. Plain
str + an explicit check keeps every rejection the same shape: a
{"status": "error", "message": ...} dict, which is what
mcp_server/client.py and agentic/nodes/execute_scene_ops.py are built
to expect.

The scene state kept here is in-memory and process-local. It exists
so the tools have somewhere real to write to and so this server is
independently testable/usable (e.g. from Claude Desktop, or `mcp dev`)
-- NOT because the frontend reads from it. The frontend never talks to
this server directly: applied ops flow back through the normal chat
response (api/schemas/requests.py: ChatResponse.scene_ops) and the
frontend renders them. This process-local state is therefore
authoritative for nothing outside of manual/standalone testing of the
tools themselves.
"""
from __future__ import annotations

from mcp.server.mcpserver import MCPServer

from models.scene_ops import KNOWN_COMPONENT_IDS

mcp = MCPServer("ocp-scene-tools")

_scene_state: dict = {
    "focus_component": None,
    "view_mode": "normal",
    "component_states": {},
}


@mcp.tool()
def focus_component(component_id: str) -> dict:
    """Select/focus a component in the pump's 3D digital-twin viewer.

    component_id must be one of: casing, impeller, shaft, bearings,
    mechanical_seal, wear_ring, coupling, base_plate, motor,
    discharge_flange, suction_flange.
    """
    if component_id not in KNOWN_COMPONENT_IDS:
        return {
            "status": "error",
            "message": f"Unknown component_id '{component_id}'. "
            f"Valid values: {sorted(KNOWN_COMPONENT_IDS)}",
        }
    _scene_state["focus_component"] = component_id
    return {
        "status": "ok",
        "applied": {"type": "focus_component", "component_id": component_id},
    }


@mcp.tool()
def set_view_mode(mode: str) -> dict:
    """Set the 3D viewer's display mode.

    mode must be one of: 'normal', 'exploded', 'section'.
    """
    if mode not in ("normal", "exploded", "section"):
        return {
            "status": "error",
            "message": f"Invalid mode '{mode}'. Valid values: normal, exploded, section",
        }
    _scene_state["view_mode"] = mode
    return {"status": "ok", "applied": {"type": "set_view_mode", "mode": mode}}


@mcp.tool()
def set_component_state(component_id: str, state: str) -> dict:
    """Mark a component's health state in the viewer.

    component_id uses the same vocabulary as focus_component. state
    must be one of: 'healthy', 'warning', 'critical'.
    """
    if component_id not in KNOWN_COMPONENT_IDS:
        return {
            "status": "error",
            "message": f"Unknown component_id '{component_id}'. "
            f"Valid values: {sorted(KNOWN_COMPONENT_IDS)}",
        }
    if state not in ("healthy", "warning", "critical"):
        return {
            "status": "error",
            "message": f"Invalid state '{state}'. Valid values: healthy, warning, critical",
        }
    _scene_state["component_states"][component_id] = state
    return {
        "status": "ok",
        "applied": {
            "type": "set_component_state",
            "component_id": component_id,
            "state": state,
        },
    }


@mcp.tool()
def get_scene_state() -> dict:
    """Return the current in-memory scene state. Debugging/manual-testing
    aid only -- see module docstring for why this isn't authoritative."""
    return dict(_scene_state)


if __name__ == "__main__":
    mcp.run()

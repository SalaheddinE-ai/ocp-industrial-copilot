"""
tests/test_scene_ops.py

Covers three layers:
1. plan_scene_ops's fail-closed behavior on LLM error (unit, offline).
2. execute_scene_ops's op validation/dropping logic against a mocked
   call_scene_tool (unit, offline).
3. A REAL end-to-end round trip against the actual scene-tools MCP
   server, spawned as a subprocess exactly like execute_scene_ops does
   in production -- this is the one test in the suite that proves the
   MCP wiring itself works, not just the code that calls it.
"""
from __future__ import annotations

from config.llm_client import LLMClientError
from agentic.nodes import execute_scene_ops as execute_scene_ops_mod
from agentic.nodes.execute_scene_ops import execute_scene_ops
from agentic.nodes.plan_scene_ops import plan_scene_ops
from mcp_server.client import SceneToolError, call_scene_tool


# --- 1. plan_scene_ops -------------------------------------------------


def test_plan_scene_ops_degrades_to_no_op_on_llm_error(monkeypatch):
    def _raise(*args, **kwargs):
        raise LLMClientError("boom")

    monkeypatch.setattr("agentic.nodes.plan_scene_ops.structured_call", _raise)

    result = plan_scene_ops({"original_query": "explain cavitation"})

    assert result["scene_ops_plan"]["needs_scene_action"] is False
    assert result["scene_ops_plan"]["ops"] == []
    assert result["last_action"] == "plan_scene_ops"


# --- 2. execute_scene_ops (mocked MCP client) ---------------------------


def test_execute_scene_ops_no_plan_is_noop():
    result = execute_scene_ops({"scene_ops_plan": {}})
    assert result["scene_ops"] == []


def test_execute_scene_ops_needs_scene_action_false_is_noop():
    result = execute_scene_ops(
        {"scene_ops_plan": {"needs_scene_action": False, "ops": [{"type": "focus_component", "component_id": "seal"}]}}
    )
    assert result["scene_ops"] == []


def test_execute_scene_ops_applies_valid_ops_and_skips_invalid(monkeypatch):
    calls = []

    def fake_call_scene_tool(tool_name, arguments):
        calls.append((tool_name, arguments))
        if tool_name == "focus_component" and arguments["component_id"] == "shaft":
            return {"status": "ok", "applied": {"type": "focus_component", "component_id": "shaft"}}
        if tool_name == "set_view_mode":
            return {"status": "ok", "applied": {"type": "set_view_mode", "mode": arguments["mode"]}}
        return {"status": "error", "message": "rejected by fake server"}

    monkeypatch.setattr(execute_scene_ops_mod, "call_scene_tool", fake_call_scene_tool)

    plan = {
        "needs_scene_action": True,
        "ops": [
            {"type": "focus_component", "component_id": "shaft"},
            {"type": "set_view_mode", "mode": "exploded"},
            {"type": "focus_component", "component_id": None},  # missing required field -> skipped, no call
            {"type": "not_a_real_op"},  # unknown type -> skipped, no call
            {"type": "set_component_state", "component_id": "seal", "state": "critical"},  # rejected by fake server
        ],
    }

    result = execute_scene_ops({"scene_ops_plan": plan})

    assert result["scene_ops"] == [
        {"type": "focus_component", "component_id": "shaft"},
        {"type": "set_view_mode", "mode": "exploded"},
    ]
    # exactly the two well-formed, known-type ops reached the tool call,
    # plus the one that was well-formed but rejected -- the missing-field
    # and unknown-type ops never even attempted a call.
    assert len(calls) == 3


def test_execute_scene_ops_swallows_scene_tool_error(monkeypatch):
    def raise_error(tool_name, arguments):
        raise SceneToolError("subprocess died")

    monkeypatch.setattr(execute_scene_ops_mod, "call_scene_tool", raise_error)

    plan = {"needs_scene_action": True, "ops": [{"type": "focus_component", "component_id": "shaft"}]}
    result = execute_scene_ops({"scene_ops_plan": plan})

    assert result["scene_ops"] == []  # failure never propagates -- fail-closed


# --- 3. Real MCP round trip (no mocking) --------------------------------


def test_scene_tools_server_real_mcp_round_trip():
    """Spawns the actual scene_tools_server.py as a subprocess via the
    real stdio MCP client, exactly as execute_scene_ops does in
    production. No mocking anywhere in this test.

    call_scene_tool spawns a fresh subprocess per call (see
    mcp_server/client.py's docstring on why), so each call below sees
    the server's default in-memory state, not the result of the
    previous call -- this test checks each tool's request/response
    contract in isolation. test_scene_tools_server_state_accumulates_within_one_session
    below covers accumulation across calls in a single connection.
    """
    ok = call_scene_tool("focus_component", {"component_id": "impeller"})
    assert ok == {"status": "ok", "applied": {"type": "focus_component", "component_id": "impeller"}}

    ok_mode = call_scene_tool("set_view_mode", {"mode": "exploded"})
    assert ok_mode == {"status": "ok", "applied": {"type": "set_view_mode", "mode": "exploded"}}

    ok_state = call_scene_tool(
        "set_component_state", {"component_id": "bearings", "state": "critical"}
    )
    assert ok_state == {
        "status": "ok",
        "applied": {"type": "set_component_state", "component_id": "bearings", "state": "critical"},
    }

    rejected_component = call_scene_tool("focus_component", {"component_id": "not_a_real_component"})
    assert rejected_component["status"] == "error"

    rejected_state = call_scene_tool("set_component_state", {"component_id": "shaft", "state": "melted"})
    assert rejected_state["status"] == "error"

    # Fresh subprocess -> defaults, not the ops applied by the calls above.
    default_state = call_scene_tool("get_scene_state", {})
    assert default_state == {"focus_component": None, "view_mode": "normal", "component_states": {}}


def test_scene_tools_server_state_accumulates_within_one_session():
    """Same server, same underlying tool logic as above, but driven
    through one long-lived MCP session (bypassing call_scene_tool's
    per-call subprocess wrapper) to prove the server's own
    _scene_state accumulates correctly across sequential tool calls --
    i.e. 'focus + explode + mark worn' as one coherent scene, which is
    exactly what a real persistent-session client would see."""
    import asyncio
    import json

    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
    from mcp_server.client import _SERVER_PARAMS

    async def run() -> dict:
        async with stdio_client(_SERVER_PARAMS) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                await session.call_tool("focus_component", {"component_id": "mechanical_seal"})
                await session.call_tool("set_view_mode", {"mode": "exploded"})
                await session.call_tool(
                    "set_component_state", {"component_id": "mechanical_seal", "state": "warning"}
                )
                result = await session.call_tool("get_scene_state", {})
                return json.loads(result.content[0].text)

    final_state = asyncio.run(run())

    assert final_state == {
        "focus_component": "mechanical_seal",
        "view_mode": "exploded",
        "component_states": {"mechanical_seal": "warning"},
    }

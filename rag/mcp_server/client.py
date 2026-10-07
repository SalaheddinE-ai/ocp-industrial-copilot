"""
mcp_server/client.py

Sync wrapper around an MCP stdio client session connected to
scene_tools_server.py. Every call spawns a fresh subprocess, does one
tool call, and tears the process down -- correct and simple for this
integration's call volume (one graph run does at most a handful of
scene ops), but a known perf limitation: a persistent session should
replace this if scene ops become a hot path (see rag/README.md).

Every LLM call in this codebase (config/llm_client.py) is synchronous,
and so is the whole agentic graph -- execute_scene_ops.py is a plain
sync node like every other node. This module owns the one place that
bridges into asyncio (which the mcp SDK requires) via asyncio.run().
"""
from __future__ import annotations

import json
import logging
import sys

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

logger = logging.getLogger(__name__)

# Runs `python -m mcp_server.scene_tools_server` with the same
# interpreter as the calling process (so it shares the venv/deps),
# from whatever the API process's working directory is -- the server
# module is resolved via PYTHONPATH the same way api/main.py's own
# imports are (see rag/README.md's `uvicorn api.main:app` from rag/).
_SERVER_PARAMS = StdioServerParameters(
    command=sys.executable,
    args=["-m", "mcp_server.scene_tools_server"],
)


class SceneToolError(RuntimeError):
    """Raised when an MCP scene-tool call fails to complete, times out,
    or the tool itself returns an error status."""


async def _call_tool_async(tool_name: str, arguments: dict) -> dict:
    async with stdio_client(_SERVER_PARAMS) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool(tool_name, arguments)
            if result.is_error:
                raise SceneToolError(f"{tool_name} returned an error: {result.content}")
            for block in result.content:
                text = getattr(block, "text", None)
                if text is not None:
                    return json.loads(text)
            return {"status": "error", "message": "Tool returned no content"}


def call_scene_tool(tool_name: str, arguments: dict) -> dict:
    """Sync entrypoint used by agentic/nodes/execute_scene_ops.py.
    Raises SceneToolError on transport/process failure; a tool-level
    rejection (e.g. unknown component_id) comes back as a normal
    {"status": "error", ...} dict, not an exception -- callers decide
    whether to treat rejections as fatal."""
    try:
        return asyncio_run(_call_tool_async(tool_name, arguments))
    except SceneToolError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise SceneToolError(f"MCP call to '{tool_name}' failed: {exc}") from exc


def asyncio_run(coro):
    """Thin indirection over asyncio.run so tests can monkeypatch the
    event-loop entrypoint without touching the standard library."""
    import asyncio

    return asyncio.run(coro)

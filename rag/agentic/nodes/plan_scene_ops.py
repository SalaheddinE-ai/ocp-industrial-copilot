"""
agentic/nodes/plan_scene_ops.py

LLM node (structured output). Decides whether the user's message asks
for a 3D-viewer scene change (focus/explode/section/mark component
state) alongside answering their question, and if so, what ops to
emit. Runs unconditionally after extract_metadata -- most queries
produce an empty ops list, and the rest of the graph (retrieval,
generation, validation) proceeds exactly as it did before this node
existed, regardless of what it decides.
"""
from __future__ import annotations

import logging

from config.llm_client import LLMClientError, structured_call
from config.prompts import PLAN_SCENE_OPS_SYSTEM_PROMPT
from agentic.state import AgentState
from models.scene_ops import SceneOpsPlan

logger = logging.getLogger(__name__)

_NO_OP_PLAN = SceneOpsPlan(needs_scene_action=False)


def plan_scene_ops(state: AgentState) -> dict:
    query = state.get("current_query") or state["original_query"]

    try:
        plan = structured_call(
            system_prompt=PLAN_SCENE_OPS_SYSTEM_PROMPT,
            user_message=query,
            response_model=SceneOpsPlan,
        )
    except LLMClientError:
        logger.exception("plan_scene_ops LLM call failed; no scene action planned")
        plan = _NO_OP_PLAN

    return {
        "scene_ops_plan": plan.model_dump() if plan.needs_scene_action else _NO_OP_PLAN.model_dump(),
        "last_action": "plan_scene_ops",
    }

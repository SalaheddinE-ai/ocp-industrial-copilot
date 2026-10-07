"""
agentic/nodes/analyze_query.py

LLM node (structured output). Classifies the query into a query_type
and extracts detected_equipment/component/symptom using
models.schemas.QueryAnalysis.

A small deterministic fast-path handles obvious greetings/small talk
before ever calling the LLM: faster, and more reliable than relying
on a small local model (e.g. Qwen2.5-3B-Instruct) to consistently
follow the "greetings are general_technical_question" instruction in
the prompt for every phrasing.
"""
from __future__ import annotations

import logging
import re

from config.llm_client import LLMClientError, structured_call
from config.prompts import ANALYZE_QUERY_SYSTEM_PROMPT
from agentic.state import AgentState
from models.schemas import QueryAnalysis

logger = logging.getLogger(__name__)

# Deliberately narrow -- only phrases that are unambiguously chitchat with
# no pump-related content on their own. Anything longer or less certain
# falls through to the real LLM classifier below.
_GREETING_PATTERN = re.compile(
    r"^\s*("
    r"hi|hello|hey|yo|"
    r"salut|bonjour|bonsoir|coucou|"
    r"merci|thanks|thank you|"
    r"how are you|comment (ça|ca) va|ça va\??|ca va\??|"
    r"good morning|good afternoon|good evening|"
    r"who are you|what can you do|what do you do|"
    r"qui es[- ]tu|que peux[- ]tu faire"
    r")\s*[!.?]*\s*$",
    re.IGNORECASE,
)


def _is_obvious_greeting(query: str) -> bool:
    return bool(_GREETING_PATTERN.match(query.strip()))


def analyze_query(state: AgentState) -> dict:
    query = state.get("current_query") or state["original_query"]

    if _is_obvious_greeting(query):
        return {
            "current_query": query,
            "query_type": "general_technical_question",
            "detected_equipment": None,
            "detected_component": None,
            "detected_symptom": None,
            "last_action": "analyze_query",
        }

    try:
        analysis = structured_call(
            system_prompt=ANALYZE_QUERY_SYSTEM_PROMPT,
            user_message=query,
            response_model=QueryAnalysis,
        )
    except LLMClientError:
        logger.exception("analyze_query LLM call failed; falling back to defaults")
        analysis = QueryAnalysis(query_type="general_technical_question")

    return {
        "current_query": query,
        "query_type": analysis.query_type,
        "detected_equipment": analysis.detected_equipment,
        "detected_component": analysis.detected_component,
        "detected_symptom": analysis.detected_symptom,
        "last_action": "analyze_query",
    }

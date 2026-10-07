"""
agentic/nodes/validate_answer.py

LLM-as-judge node, run as a separate call from generate_answer to
avoid self-confirmation bias. Checks groundedness/relevance of
state["answer"] against state["reranked_documents"].
"""
from __future__ import annotations

import logging

from config.llm_client import LLMClientError, structured_call
from config.prompts import VALIDATE_ANSWER_SYSTEM_PROMPT
from config.settings import settings
from agentic.state import AgentState
from models.schemas import AnswerValidation

logger = logging.getLogger(__name__)

_INSUFFICIENT_MSG = "Information not available in the current knowledge base."


def validate_answer(state: AgentState) -> dict:
    # The insufficient-information answer is trivially "accept" -- it's
    # honest by construction, no need to spend a validation call on it.
    if state.get("answer") == _INSUFFICIENT_MSG:
        validation = AnswerValidation(
            grounded=True, relevant=True, unsupported_claims=[], decision="accept"
        )
        return {"answer_validation": validation.model_dump(), "last_action": "validate_answer"}

    # A no_retrieval answer (greeting, "what can you do", etc.) was never
    # meant to be grounded in retrieved documents -- there are none by
    # design, so asking the judge to check groundedness against an empty
    # context would just force a pointless retry loop. Accept directly.
    if state.get("retrieval_strategy") == "no_retrieval":
        validation = AnswerValidation(
            grounded=True, relevant=True, unsupported_claims=[], decision="accept"
        )
        return {"answer_validation": validation.model_dump(), "last_action": "validate_answer"}

    docs = state.get("reranked_documents", [])
    context = "\n\n".join(d["document"]["content"] for d in docs)
    user_message = (
        f"Original question: {state['original_query']}\n\n"
        f"Retrieved context:\n{context}\n\n"
        f"Generated answer:\n{state.get('answer', '')}"
    )

    try:
        validation = structured_call(
            system_prompt=VALIDATE_ANSWER_SYSTEM_PROMPT,
            user_message=user_message,
            response_model=AnswerValidation,
            model=settings.judge_llm_model,
        )
    except LLMClientError:
        logger.exception("validate_answer LLM call failed; defaulting to retrieve_again")
        validation = AnswerValidation(
            grounded=False,
            relevant=False,
            unsupported_claims=[],
            decision="retrieve_again",
        )

    return {"answer_validation": validation.model_dump(), "last_action": "validate_answer"}

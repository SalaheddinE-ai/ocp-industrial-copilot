"""
agentic/nodes/generate_answer.py

LLM node. Two distinct modes:
  - retrieval_strategy == "no_retrieval": general/chitchat questions
    (greetings, "what can you do", etc.) that route_query deliberately
    sent here without retrieval. Answered directly from the model's
    own knowledge via GENERAL_CHAT_SYSTEM_PROMPT -- no sources, no
    "insufficient information" fallback, since there was never any
    retrieval to be insufficient.
  - otherwise: answers strictly from state["reranked_documents"],
    following the required structure, and attaches source references
    for traceability. An empty reranked_documents here means
    retrieval genuinely found nothing -- that's the case that falls
    back to the honest "insufficient information" message.
"""
from __future__ import annotations

import logging

from config.llm_client import LLMClientError, plain_call
from config.prompts import GENERAL_CHAT_SYSTEM_PROMPT, GENERATE_ANSWER_SYSTEM_PROMPT
from agentic.state import AgentState
from models.document import Document, SourceRef

logger = logging.getLogger(__name__)

_INSUFFICIENT_MSG = "Information not available in the current knowledge base."


def _build_context(docs: list[dict]) -> str:
    parts = []
    for d in docs:
        meta = d["document"]["metadata"]
        parts.append(
            f"[Source: {meta['document_name']}"
            f"{', page ' + str(meta['page']) if meta.get('page') else ''}"
            f", chunk {meta['chunk_id']}]\n{d['document']['content']}"
        )
    return "\n\n".join(parts)


def generate_answer(state: AgentState) -> dict:
    if state.get("retrieval_strategy") == "no_retrieval":
        try:
            answer = plain_call(
                system_prompt=GENERAL_CHAT_SYSTEM_PROMPT,
                user_message=state["original_query"],
            )
        except LLMClientError:
            logger.exception("generate_answer (no_retrieval) LLM call failed")
            answer = (
                "Hello! I'm the Industrial Knowledge Copilot for centrifugal "
                "pump maintenance. Ask me about a component, a symptom, or a "
                "maintenance procedure."
            )
        return {"answer": answer, "sources": [], "last_action": "generate_answer"}

    docs = state.get("reranked_documents", [])

    if not docs:
        return {
            "answer": _INSUFFICIENT_MSG,
            "sources": [],
            "last_action": "generate_answer",
        }

    user_message = (
        f"User question: {state['original_query']}\n\n"
        f"Retrieved context:\n{_build_context(docs)}"
    )

    try:
        answer = plain_call(
            system_prompt=GENERATE_ANSWER_SYSTEM_PROMPT, user_message=user_message
        )
    except LLMClientError:
        logger.exception("generate_answer LLM call failed")
        return {
            "answer": _INSUFFICIENT_MSG,
            "sources": [],
            "last_action": "generate_answer",
        }

    sources = [
        SourceRef.from_document(Document.model_validate(d["document"])).model_dump()
        for d in docs
    ]

    return {"answer": answer, "sources": sources, "last_action": "generate_answer"}

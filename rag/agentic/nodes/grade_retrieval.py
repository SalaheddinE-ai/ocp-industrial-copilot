"""
agentic/nodes/grade_retrieval.py

LLM-as-judge node. Evaluates state["reranked_documents"] against the
query for relevance, technical relationship, and coverage.
"""
from __future__ import annotations

import logging

from config.llm_client import LLMClientError, structured_call
from config.prompts import GRADE_RETRIEVAL_SYSTEM_PROMPT
from config.settings import settings
from agentic.state import AgentState
from models.schemas import RetrievalGrade

logger = logging.getLogger(__name__)


def _build_user_message(state: AgentState) -> str:
    docs = state.get("reranked_documents", [])
    if not docs:
        context = "(no documents retrieved)"
    else:
        context = "\n\n".join(
            f"[chunk {d['document']['metadata']['chunk_id']}] "
            f"{d['document']['content'][:500]}"
            for d in docs
        )
    return (
        f"User question: {state['original_query']}\n\n"
        f"Retrieved context:\n{context}"
    )


def grade_retrieval(state: AgentState) -> dict:
    if not state.get("reranked_documents"):
        grade = RetrievalGrade(
            decision="not_relevant",
            score=0.0,
            reason="No documents were retrieved.",
            recommended_action="rewrite_query",
        )
    else:
        try:
            grade = structured_call(
                system_prompt=GRADE_RETRIEVAL_SYSTEM_PROMPT,
                user_message=_build_user_message(state),
                response_model=RetrievalGrade,
                model=settings.judge_llm_model,
            )
        except LLMClientError:
            logger.exception("grade_retrieval LLM call failed; treating as not_relevant")
            grade = RetrievalGrade(
                decision="not_relevant",
                score=0.0,
                reason="Grading call failed; defaulting to not_relevant to avoid "
                "ungrounded generation.",
                recommended_action="rewrite_query",
            )

    return {"retrieval_grade": grade.model_dump(), "last_action": "grade_retrieval"}

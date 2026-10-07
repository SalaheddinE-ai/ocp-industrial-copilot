"""
api/routes/chat.py

POST /chat: invokes the compiled agentic graph with a fresh
AgentState and returns the final answer + sources.
"""
from __future__ import annotations

from fastapi import APIRouter

from agentic.graph import build_graph
from agentic.state import create_initial_state
from api.schemas.requests import ChatRequest, ChatResponse
from config.settings import settings
from models.document import SourceRef

router = APIRouter()

_app = None


def _get_app():
    global _app
    if _app is None:
        _app = build_graph()
    return _app


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    graph = _get_app()
    initial_state = create_initial_state(
        request.query,
        max_retries=request.max_retries or settings.max_retries,
        component_hint=request.component_hint,
    )
    result = graph.invoke(initial_state)

    return ChatResponse(
        answer=result.get("answer") or "",
        sources=[SourceRef.model_validate(s) for s in result.get("sources", [])],
        query_type=result.get("query_type", ""),
        retrieval_grade=result.get("retrieval_grade"),
        answer_validation=result.get("answer_validation"),
        retry_count=result.get("retry_count", 0),
        scene_ops=result.get("scene_ops", []),
    )

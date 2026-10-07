"""
tests/test_api.py

FastAPI TestClient tests for POST /chat and GET /health. The
compiled agentic graph is monkeypatched (via api.routes.chat._get_app)
so these tests run offline, without a vector store or LLM API key --
they validate the API contract, not end-to-end RAG quality.
"""
from __future__ import annotations

from fastapi.testclient import TestClient

import api.routes.chat as chat_route
from api.main import app

client = TestClient(app)


class _FakeGraph:
    def __init__(self, result: dict):
        self._result = result

    def invoke(self, state):
        return {**state, **self._result}


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_chat_happy_path(monkeypatch):
    fake_result = {
        "answer": "Bearing overheating is typically caused by insufficient lubrication.",
        "sources": [
            {
                "document_name": "bearing_overheating.txt",
                "page": None,
                "chunk_id": "c1",
                "document_category": "failures/bearings",
            }
        ],
        "query_type": "failure_analysis",
        "retrieval_grade": {"decision": "relevant", "score": 0.9, "reason": "ok", "recommended_action": "generate"},
        "answer_validation": {"grounded": True, "relevant": True, "unsupported_claims": [], "decision": "accept"},
        "retry_count": 0,
    }
    monkeypatch.setattr(chat_route, "_get_app", lambda: _FakeGraph(fake_result))
    monkeypatch.setattr(chat_route, "_app", None)

    response = client.post("/chat", json={"query": "What causes bearing overheating?"})

    assert response.status_code == 200
    body = response.json()
    assert body["answer"] == fake_result["answer"]
    assert body["sources"][0]["chunk_id"] == "c1"
    assert body["query_type"] == "failure_analysis"
    assert body["retry_count"] == 0


def test_chat_rejects_empty_query():
    response = client.post("/chat", json={"query": ""})
    assert response.status_code == 422


def test_chat_missing_query_field():
    response = client.post("/chat", json={})
    assert response.status_code == 422

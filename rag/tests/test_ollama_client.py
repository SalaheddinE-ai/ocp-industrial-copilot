"""
tests/test_ollama_client.py

Tests config.llm_client's ollama provider against a real HTTP server
(Python's stdlib http.server, mimicking Ollama's /api/chat response
shape) -- not mocked at the httpx level, so this actually exercises
the request/response wiring, not just that the right function got
called.
"""
from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest
from pydantic import BaseModel

from config.llm_client import LLMClientError, plain_call, structured_call
from config.settings import settings


class _Answer(BaseModel):
    value: str
    confidence: float


class _FakeOllamaHandler(BaseHTTPRequestHandler):
    """Mimics Ollama's POST /api/chat -- echoes back a fixed structured
    or plain response depending on whether the request asked for a
    `format` (structured output) or not."""

    def log_message(self, *args):  # silence test output
        pass

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length))

        if body.get("format"):
            content = json.dumps({"value": "ok", "confidence": 0.9})
        else:
            content = "plain text reply from fake ollama"

        response = {"message": {"content": content}}
        payload = json.dumps(response).encode("utf-8")

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


@pytest.fixture
def fake_ollama_server():
    server = HTTPServer(("127.0.0.1", 0), _FakeOllamaHandler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        server.shutdown()
        thread.join(timeout=2)


@pytest.fixture
def ollama_settings(monkeypatch, fake_ollama_server):
    monkeypatch.setattr(settings, "llm_provider", "ollama")
    monkeypatch.setattr(settings, "llm_model", "qwen2.5:3b-instruct")
    monkeypatch.setattr(settings, "ollama_base_url", fake_ollama_server)
    monkeypatch.setattr(settings, "llm_api_key", "")  # ollama needs none
    return settings


def test_structured_call_against_real_server(ollama_settings):
    result = structured_call(
        system_prompt="You are a test.",
        user_message="Say ok.",
        response_model=_Answer,
    )
    assert result == _Answer(value="ok", confidence=0.9)


def test_plain_call_against_real_server(ollama_settings):
    result = plain_call(
        system_prompt="You are a test.",
        user_message="Say something.",
    )
    assert result == "plain text reply from fake ollama"


def test_missing_api_key_does_not_block_ollama(ollama_settings):
    # The empty-api-key guard must not fire for ollama -- this would
    # have raised LLMClientError("LLM_API_KEY is not set...") before
    # ever reaching the server if the guard were wrong.
    plain_call(system_prompt="x", user_message="y")  # no exception


def test_connection_error_is_wrapped_cleanly(monkeypatch):
    monkeypatch.setattr(settings, "llm_provider", "ollama")
    monkeypatch.setattr(settings, "llm_model", "qwen2.5:3b-instruct")
    # Nothing listening on this port -- forces a real connection error.
    monkeypatch.setattr(settings, "ollama_base_url", "http://127.0.0.1:1")
    monkeypatch.setattr(settings, "llm_api_key", "")

    with pytest.raises(LLMClientError, match="Could not reach Ollama"):
        plain_call(system_prompt="x", user_message="y")

"""
api/main.py

FastAPI application entry point. Run via:
    uvicorn api.main:app --reload
"""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes.chat import router as chat_router

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Industrial Knowledge Copilot -- Agentic RAG API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}

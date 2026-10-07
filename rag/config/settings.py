"""
config/settings.py

Central, typed application configuration loaded from environment
variables (see .env.example).

Nothing in the codebase should hardcode a provider name, model name,
or path. Everything routes through this Settings object.
"""

from __future__ import annotations

from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Central application configuration.

    Values are loaded from environment variables and the .env file.

    Supported LLM providers:
        - openai
        - anthropic
        - gemini
        - ollama (local, no API key -- see ollama_base_url)

    Supported embedding providers:
        - openai
        - sentence-transformers

    Supported reranker backends:
        - heuristic
        - cross-encoder

    Supported vector stores:
        - chroma
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ============================================================
    # LLM
    # ============================================================

    llm_provider: Literal[
        "openai",
        "anthropic",
        "gemini",
        "ollama",
    ] = "openai"

    llm_model: str = "gpt-4o-mini"

    llm_api_key: str = ""

    judge_llm_model: str = "gpt-4o-mini"

    # Only used when llm_provider == "ollama". Ollama exposes an
    # OpenAI-compatible endpoint at <base_url>/v1 -- no API key needed,
    # nothing leaves the machine it runs on.
    ollama_base_url: str = "http://localhost:11434"

    # ============================================================
    # Embeddings
    # ============================================================

    embedding_provider: Literal[
        "openai",
        "sentence-transformers",
    ] = "openai"

    embedding_model: str = "text-embedding-3-small"

    # ============================================================
    # Reranker
    # ============================================================

    reranker_backend: Literal[
        "heuristic",
        "cross-encoder",
    ] = "heuristic"

    reranker_model: str = "BAAI/bge-reranker-base"

    # ============================================================
    # Vector store
    # ============================================================

    vector_store_backend: Literal[
        "chroma",
    ] = "chroma"

    vector_store_path: str = "./data/processed/chroma_db"

    vector_store_collection: str = "industrial_knowledge"

    # ============================================================
    # Semantic cache
    # ============================================================
    # The right threshold depends on the embedding provider/model
    # actually in use (vector scale/dimensionality differ across
    # providers) -- 0.93 is a starting point, not an empirically
    # calibrated value. Tune it against your own near-duplicate vs.
    # genuinely-different question pairs before relying on it.
    semantic_cache_collection: str = "qa_cache"
    semantic_cache_similarity_threshold: float = 0.93

    # ============================================================
    # Retrieval
    # ============================================================

    retrieval_top_k: int = 20

    rerank_top_n: int = 5

    # ============================================================
    # Agentic loop
    # ============================================================

    max_retries: int = 2

    # ============================================================
    # API
    # ============================================================

    api_host: str = "0.0.0.0"

    api_port: int = 8000

    # ============================================================
    # Knowledge base
    # ============================================================

    knowledge_root: str = "./knowledge"

    # ============================================================
    # Validators
    # ============================================================

    @field_validator("llm_provider", mode="before")
    @classmethod
    def normalize_llm_provider(cls, value: str) -> str:
        """
        Normalize LLM provider values.

        Example:
            " Gemini " -> "gemini"
            "OPENAI"   -> "openai"
        """
        return str(value).strip().lower()

    @field_validator("embedding_provider", mode="before")
    @classmethod
    def normalize_embedding_provider(cls, value: str) -> str:
        """Normalize embedding provider."""
        return str(value).strip().lower()

    @field_validator("reranker_backend", mode="before")
    @classmethod
    def normalize_reranker_backend(cls, value: str) -> str:
        """Normalize reranker backend."""
        return str(value).strip().lower()

    @field_validator("vector_store_backend", mode="before")
    @classmethod
    def normalize_vector_store_backend(cls, value: str) -> str:
        """Normalize vector store backend."""
        return str(value).strip().lower()


# ================================================================
# Global settings instance
# ================================================================

settings = Settings()
"""
embeddings/embedder.py

Provider-agnostic embedding wrapper. Provider is selected via
config.settings.embedding_provider -- calling code never hardcodes
"openai" or "sentence-transformers" directly.
"""
from __future__ import annotations

from config.settings import settings


class EmbedderError(RuntimeError):
    pass


class Embedder:
    def __init__(self, provider: str | None = None, model: str | None = None):
        self.provider = provider or settings.embedding_provider
        self.model = model or settings.embedding_model
        self._client = None

    def _get_openai_client(self):
        if self._client is None:
            from openai import OpenAI

            if not settings.llm_api_key:
                raise EmbedderError("LLM_API_KEY is not set (used for OpenAI embeddings too).")
            self._client = OpenAI(api_key=settings.llm_api_key)
        return self._client

    def _get_st_model(self):
        if self._client is None:
            try:
                from sentence_transformers import SentenceTransformer
            except ImportError as exc:  # pragma: no cover
                raise EmbedderError(
                    "sentence-transformers is not installed. "
                    "pip install sentence-transformers to use local embeddings."
                ) from exc
            self._client = SentenceTransformer(self.model)
        return self._client

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        if self.provider == "openai":
            client = self._get_openai_client()
            response = client.embeddings.create(model=self.model, input=texts)
            return [item.embedding for item in response.data]
        if self.provider == "sentence-transformers":
            model = self._get_st_model()
            return model.encode(texts, convert_to_numpy=False).tolist()
        raise EmbedderError(f"Unknown embedding provider: {self.provider!r}")

    def embed_query(self, text: str) -> list[float]:
        return self.embed_documents([text])[0]

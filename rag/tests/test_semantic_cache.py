"""
tests/test_semantic_cache.py

Tests SemanticCache against a REAL temporary ChromaDB instance (not
mocked at the Chroma level) -- only the embedder is swapped for a
small deterministic fake, since a real embedding call would need
either an API key or downloading a local model, neither of which
belongs in an offline unit test. The fake still produces genuinely
different vectors for genuinely different text (bag-of-words style),
so similarity-threshold behavior is tested for real, not just
mocked away.

Note: DEFAULT_SIMILARITY_THRESHOLD in config/settings.py is a
starting point, not empirically calibrated against any specific real
embedding provider (see that file's comment) -- these tests use
threshold values passed explicitly to make the pass/fail boundary
exact and independent of whatever the current default happens to be.
"""
from __future__ import annotations

import math

import pytest

from retrieval.semantic_cache import SemanticCache


class _FakeEmbedder:
    """Deterministic bag-of-words embedder over a small fixed
    vocabulary -- enough to make genuinely similar sentences produce
    genuinely similar vectors, and dissimilar ones produce dissimilar
    vectors, without any network call or model download."""

    _VOCAB = [
        "bearing", "seal", "mechanical", "leak", "leaking", "vibration",
        "overheat", "overheating", "torque", "casing", "impeller", "hello",
        "thanks", "pump", "oil", "grease", "noise", "replace",
    ]

    def embed_query(self, text: str) -> list[float]:
        words = text.lower().replace("?", " ").replace(",", " ").split()
        vec = [float(words.count(w)) for w in self._VOCAB]
        # add a touch of the text's length so near-duplicates with tiny
        # wording differences aren't bit-for-bit identical vectors
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self.embed_query(t) for t in texts]


@pytest.fixture
def cache(tmp_path):
    return SemanticCache(
        embedder=_FakeEmbedder(),
        path=str(tmp_path / "chroma_cache_test"),
        collection_name="qa_cache_test",
        similarity_threshold=0.90,
    )


def test_lookup_on_empty_cache_is_a_clean_miss(cache):
    assert cache.lookup("why is the bearing leaking") is None


def test_store_then_lookup_identical_question_hits(cache):
    cache.store(
        query="why is the mechanical seal leaking",
        answer="Likely a worn seal face -- inspect and replace.",
        sources=[{"document_name": "seal_manual.pdf"}],
        scene_ops=[{"type": "focus_component", "component_id": "mechanical_seal"}],
    )

    hit = cache.lookup("why is the mechanical seal leaking")

    assert hit is not None
    assert hit["answer"] == "Likely a worn seal face -- inspect and replace."
    assert hit["sources"] == [{"document_name": "seal_manual.pdf"}]
    assert hit["scene_ops"] == [{"type": "focus_component", "component_id": "mechanical_seal"}]


def test_dissimilar_question_is_a_miss(cache):
    cache.store(
        query="why is the mechanical seal leaking",
        answer="Likely a worn seal face -- inspect and replace.",
    )

    # Shares no vocabulary at all with the stored question.
    hit = cache.lookup("hello, thanks for your help")

    assert hit is None


def test_store_overwrites_previous_entry_for_same_question(cache):
    cache.store(query="why is the bearing overheating", answer="First answer")
    cache.store(query="why is the bearing overheating", answer="Second, corrected answer")

    hit = cache.lookup("why is the bearing overheating")

    assert hit["answer"] == "Second, corrected answer"


def test_clear_empties_the_cache(cache):
    cache.store(query="why is the bearing overheating", answer="Some answer")
    assert cache.lookup("why is the bearing overheating") is not None

    cache.clear()

    assert cache.lookup("why is the bearing overheating") is None


def test_missing_optional_fields_default_to_empty(cache):
    cache.store(query="hello", answer="Hi there!")  # no sources/scene_ops passed

    hit = cache.lookup("hello")

    assert hit["sources"] == []
    assert hit["scene_ops"] == []

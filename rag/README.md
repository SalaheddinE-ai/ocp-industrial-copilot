# rag/ — Industrial Knowledge Copilot: Agentic RAG Module

Adaptive, corrective Agentic RAG system for centrifugal (axial-flow)
pump maintenance knowledge, built on LangGraph.

## Status
Folder structure scaffolded. Implementation proceeds step by step
per the agreed plan:

1. `agentic/state.py` + `agentic/graph.py` (skeleton, mocked nodes) + `tests/test_graph.py`
2. `models/schemas.py`, `models/document.py`
3. `ingestion/` (loaders, parsers, chunking, metadata extraction)
4. `embeddings/`, `vector_store/`
5. `retrieval/` (vector, BM25, fusion, filters, reranker, hybrid_retriever)
6. `agentic/nodes/*` (real implementations, replacing mocks)
7. `agentic/routers/*`
8. `api/` (FastAPI exposure)
9. `evaluation/` (retrieval + RAG metrics, test dataset)

## Adding knowledge

Drop PDFs into `knowledge/` (see `knowledge/README.md` for the exact
folder structure the ingestion pipeline expects), then:

```bash
python scripts/ingest_knowledge_base.py
```

An empty `knowledge/` folder is not an error condition: greetings and
general questions ("hello", "what can you do") are answered directly
by the model without touching the knowledge base at all (see
`agentic/nodes/generate_answer.py`'s `no_retrieval` path) -- the
"Information not available" fallback only fires for a pump-specific
question once retrieval has actually been attempted and found
nothing.

## Semantic cache

Before running the full retrieval/generation/validation pipeline, the
graph checks whether a sufficiently similar question has already been
asked and accepted (`agentic/nodes/check_semantic_cache.py`), reusing
that answer instead of paying for the whole pipeline again -- useful
latency-wise with a small local model. Backed by its own ChromaDB
collection (`semantic_cache_collection` in `.env`, default
`qa_cache`), separate from the main knowledge-base collection.

Only *accepted* answers get cached (`agentic/nodes/store_in_cache.py`,
reached only on `validate_answer`'s `accept` edge) -- a corrected,
retried, or insufficient-information answer never enters the cache.

`SEMANTIC_CACHE_SIMILARITY_THRESHOLD` (default `0.93`) is a starting
point, not empirically calibrated against any specific embedding
provider/model -- tune it against real near-duplicate vs.
genuinely-different question pairs from your own usage before relying
on it in production.

## Architecture

See project discussion for the full graph diagram, AgentState
definition, and deterministic-vs-LLM component breakdown.

## Setup

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # then fill in API keys
```

### Using a local model (Ollama)

The default `.env.example` is configured for a local, keyless model via
[Ollama](https://ollama.com) -- no data leaves the machine:

```bash
# 1. install Ollama, then pull the model
ollama pull qwen2.5:3b-instruct

# 2. make sure the server is running (usually automatic after install)
ollama serve

# 3. rag/.env should have:
#    LLM_PROVIDER=ollama
#    LLM_MODEL=qwen2.5:3b-instruct
#    OLLAMA_BASE_URL=http://localhost:11434
```

To switch back to a cloud provider, set `LLM_PROVIDER` to `openai`,
`anthropic`, or `gemini` and fill in `LLM_API_KEY` -- no code changes
needed either way (see `config/llm_client.py`).

## Run tests

```bash
pytest tests/
```

## Run API (once implemented)

```bash
uvicorn api.main:app --reload
```

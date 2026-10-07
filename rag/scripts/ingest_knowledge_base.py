"""
scripts/ingest_knowledge_base.py

CLI entrypoint tying ingestion.pipeline (load + chunk + infer
metadata) to vector_store.indexer (embed + write to ChromaDB) so
`knowledge/` can actually be turned into a searchable index with one
command:

    python scripts/ingest_knowledge_base.py

Caveat: this re-ingests and re-embeds every file under `knowledge/`
on every run -- there's no incremental/changed-files-only mode yet.
Fine for a knowledge base of the size this project targets; if it
grows into the thousands of documents, that's the point to add
per-file change detection (e.g. hash the file, skip if unchanged)
rather than re-embedding everything each time.
"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config.settings import settings  # noqa: E402
from ingestion.pipeline import ingest_knowledge_base  # noqa: E402
from vector_store.indexer import Indexer  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")
logger = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--knowledge-root",
        default=settings.knowledge_root,
        help=f"Folder to ingest (default: {settings.knowledge_root!r}, from .env)",
    )
    args = parser.parse_args()

    root = Path(args.knowledge_root)
    if not root.exists():
        logger.error(
            "Knowledge root %s does not exist. Create it (see knowledge/README.md) "
            "and drop some PDFs in before running this script.",
            root,
        )
        raise SystemExit(1)

    logger.info("Walking %s ...", root)
    documents = ingest_knowledge_base(root)

    if not documents:
        logger.warning(
            "No documents were ingested from %s -- check that files are directly "
            "under one of the documented subfolders (see knowledge/README.md) and "
            "have a supported extension (.pdf, .docx, .txt, .md).",
            root,
        )
        return

    logger.info("Embedding and indexing %d chunks ...", len(documents))
    indexer = Indexer()
    total = indexer.index_documents(documents)
    logger.info(
        "Done: %d chunks indexed into collection %r at %r.",
        total,
        settings.vector_store_collection,
        settings.vector_store_path,
    )


if __name__ == "__main__":
    main()
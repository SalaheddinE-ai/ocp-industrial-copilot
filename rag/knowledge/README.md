# knowledge/

Drop your PDFs (manuals, procedures, datasheets, failure reports...) here,
organized by folder -- the folder path is the *only* source of metadata used
at ingestion (see `ingestion/metadata/path_metadata.py`). No LLM call is
involved in figuring out what a document is about; it's inferred purely from
where you put it. Get the folder right and retrieval filtering (by
equipment/component/category) works correctly; get it wrong and the document
still gets indexed, just under `document_category="uncategorized"` (or
whatever the closest matching rule is), which weakens filtering but never
breaks ingestion.

## Folder structure

```
knowledge/
├── centrifugal_pumps/
│   ├── axial_flow/
│   │   ├── manuals/
│   │   │   ├── manufacturer/   <- OEM manuals (source_type=external)
│   │   │   └── internal/       <- your own manuals/notes (source_type=internal)
│   │   ├── components/
│   │   │   ├── bearings/       <- one subfolder per component
│   │   │   └── mechanical_seal/
│   │   ├── failures/
│   │   │   ├── bearings/       <- failure modes/reports, per component
│   │   │   └── mechanical_seal/
│   │   ├── procedures/         <- maintenance procedures (no component subfolder)
│   │   ├── troubleshooting/
│   │   ├── spare_parts/
│   │   └── drawings/
│   └── common/
│       └── safety/             <- component = "safety", pump_type = "common"
├── standards/                  <- e.g. API 610 excerpts (source_type=external)
└── manufacturer_catalogs/      <- e.g. SKF bearing catalog (source_type=external)
```

Component subfolder names should match the vocabulary already used
elsewhere in the project (`models/scene_ops.py`,
`config/prompts.py`) so a retrieved document's `component` metadata
lines up with what the 3D viewer and the agent's `component_hint`
use: `casing`, `impeller`, `shaft`, `bearings`, `mechanical_seal`,
`wear_ring`, `coupling`, `base_plate`, `motor`, `discharge_flange`,
`suction_flange`.

## Supported file types

Whatever `ingestion/loaders/__init__.py`'s `SUPPORTED_EXTENSIONS`
lists -- at minimum PDF (page-aware: each page becomes its own chunk
group, so a citation can point at a specific page), plus DOCX and
plain text.

## Running ingestion

Once you've dropped files in:

```bash
python scripts/ingest_knowledge_base.py
```

This walks `knowledge/`, chunks every supported file, embeds the
chunks, and writes them into the ChromaDB collection configured by
`VECTOR_STORE_PATH`/`VECTOR_STORE_COLLECTION` in `.env`. Re-running it
after adding more files is safe -- it re-ingests everything under
`knowledge/` each time (see the script's docstring for the
incremental-indexing caveat).

An empty `knowledge/` folder is not an error: the agent still answers
greetings and general questions directly (see
`agentic/nodes/generate_answer.py`'s `no_retrieval` path) -- it will
only say *"Information not available in the current knowledge
base"* for pump-specific questions once it has actually tried to
retrieve something and found nothing.

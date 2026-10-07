"""
ingestion/metadata/path_metadata.py

Deterministic metadata extraction from the knowledge/ folder
hierarchy, e.g.:

    knowledge/centrifugal_pumps/axial_flow/failures/bearings/foo.pdf
    -> equipment_family="centrifugal_pumps", pump_type="axial_flow",
       component="bearings", document_category="failures/bearings"

No LLM call -- pure path-parsing logic driven by the known knowledge/
layout. If the knowledge base structure changes, only this file needs
updating.
"""
from __future__ import annotations

from pathlib import Path

from models.document import DocumentMetadata

_AXIAL_FLOW_SUBDIRS_WITH_COMPONENT = {"components", "failures"}
_AXIAL_FLOW_SIMPLE_SUBDIRS = {
    "procedures",
    "troubleshooting",
    "spare_parts",
    "drawings",
    "images",
    "datasheets",
    "reports",
}
_TOP_LEVEL_EXTERNAL = {"standards", "books", "manufacturer_catalogs"}


def infer_metadata_from_path(
    file_path: Path, knowledge_root: Path, chunk_id: str, page: int | None = None
) -> DocumentMetadata:
    """Builds a DocumentMetadata from a file's location under knowledge_root."""
    rel_parts = file_path.relative_to(knowledge_root).parts[:-1]  # drop filename

    equipment_family = "centrifugal_pumps"
    pump_type: str | None = None
    component: str | None = None
    document_category: str | None = None
    source_type = "internal"

    if not rel_parts:
        document_category = "uncategorized"
    elif rel_parts[0] == "centrifugal_pumps":
        rest = rel_parts[1:]
        if rest and rest[0] == "axial_flow":
            pump_type = "axial_flow"
            sub = rest[1:]
            if sub and sub[0] == "manuals" and len(sub) > 1:
                document_category = f"manuals/{sub[1]}"
                source_type = "external" if sub[1] == "manufacturer" else "internal"
            elif sub and sub[0] in _AXIAL_FLOW_SUBDIRS_WITH_COMPONENT and len(sub) > 1:
                component = sub[1]
                document_category = f"{sub[0]}/{sub[1]}"
            elif sub and sub[0] in _AXIAL_FLOW_SIMPLE_SUBDIRS:
                document_category = sub[0]
            elif sub:
                document_category = "/".join(sub)
        elif rest and rest[0] == "common":
            pump_type = "common"
            sub = rest[1:]
            if sub:
                component = sub[0]
                document_category = f"common/{sub[0]}"
    elif rel_parts[0] in _TOP_LEVEL_EXTERNAL:
        document_category = rel_parts[0]
        source_type = "external"
        equipment_family = "general"
    else:
        document_category = "/".join(rel_parts)

    return DocumentMetadata(
        equipment_family=equipment_family,
        pump_type=pump_type,
        component=component,
        document_category=document_category,
        source_type=source_type,
        document_name=file_path.name,
        page=page,
        chunk_id=chunk_id,
        file_path=str(file_path),
    )

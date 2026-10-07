"""
agentic/nodes/extract_metadata.py

Deterministic node. Maps the structured output of analyze_query onto
a retrieval.filters.MetadataFilter. No LLM call.
"""
from __future__ import annotations

from agentic.state import AgentState
from retrieval.filters import MetadataFilter

# query_type -> document_category hint, used only when a component
# wasn't already detected (component-scoped filters take priority).
_QUERY_TYPE_TO_CATEGORY_HINT = {
    "failure_analysis": "failures",
    "troubleshooting": "troubleshooting",
    "maintenance_procedure": "manuals/maintenance",
    "operation": "manuals/operation",
    "installation": "manuals/installation",
    "spare_parts": "spare_parts",
}


def extract_metadata(state: AgentState) -> dict:
    equipment = state.get("detected_equipment")
    # component_hint comes from a deterministic external source (e.g. the
    # currently focused component in a 3D viewer) and takes priority over
    # analyze_query's free-text guess, which may be null or off-target.
    component = state.get("component_hint") or state.get("detected_component")
    query_type = state.get("query_type", "")

    filter_kwargs: dict = {}
    if equipment:
        filter_kwargs["pump_type"] = (
            "axial_flow" if "axial" in equipment.lower() else None
        )
    if component:
        filter_kwargs["component"] = component
    elif query_type in _QUERY_TYPE_TO_CATEGORY_HINT:
        filter_kwargs["document_category"] = _QUERY_TYPE_TO_CATEGORY_HINT[query_type]

    metadata_filter = MetadataFilter(**{k: v for k, v in filter_kwargs.items() if v})

    return {
        "metadata_filters": metadata_filter.model_dump(exclude_none=True),
        "last_action": "extract_metadata",
    }

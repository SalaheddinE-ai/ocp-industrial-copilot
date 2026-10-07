"""
tests/test_extract_metadata.py

Unit tests for the deterministic extract_metadata node, in particular
the precedence between an externally supplied component_hint (e.g. the
component currently focused in the ocp-visual 3D viewer) and the
LLM-detected component from analyze_query.
"""
from __future__ import annotations

from agentic.nodes.extract_metadata import extract_metadata


def test_component_hint_takes_priority_over_detected_component():
    state = {
        "detected_equipment": "centrifugal_pump",
        "detected_component": "shaft",  # what analyze_query "guessed"
        "component_hint": "mechanical_seal",  # what the 3D viewer says is focused
        "query_type": "troubleshooting",
    }
    result = extract_metadata(state)
    assert result["metadata_filters"]["component"] == "mechanical_seal"


def test_falls_back_to_detected_component_when_no_hint():
    state = {
        "detected_equipment": None,
        "detected_component": "bearings",
        "component_hint": None,
        "query_type": "troubleshooting",
    }
    result = extract_metadata(state)
    assert result["metadata_filters"]["component"] == "bearings"


def test_falls_back_to_category_hint_when_neither_component_present():
    state = {
        "detected_equipment": None,
        "detected_component": None,
        "component_hint": None,
        "query_type": "failure_analysis",
    }
    result = extract_metadata(state)
    assert result["metadata_filters"]["document_category"] == "failures"
    assert "component" not in result["metadata_filters"]


def test_missing_component_hint_key_does_not_raise():
    # Older callers (or states built before this field existed) may omit
    # component_hint entirely -- extract_metadata must not KeyError.
    state = {
        "detected_equipment": None,
        "detected_component": "impeller",
        "query_type": "component_information",
    }
    result = extract_metadata(state)
    assert result["metadata_filters"]["component"] == "impeller"

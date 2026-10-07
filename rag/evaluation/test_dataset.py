"""
evaluation/test_dataset.py

Small labeled evaluation set: representative questions per query_type
against the centrifugal_pumps/axial_flow knowledge base, each with
the chunk_ids expected to be relevant. Used by retrieval_metrics.py
(Recall@k/Precision@k/MRR/nDCG) and rag_metrics.py.

This is a starting seed set for the PFA evaluation chapter -- extend
it as the real knowledge base is ingested, using actual chunk_ids
produced by ingestion.pipeline rather than the placeholders below.
"""
from __future__ import annotations

from pydantic import BaseModel


class EvalExample(BaseModel):
    query: str
    query_type: str
    relevant_chunk_ids: list[str]
    expected_answer_contains: list[str] = []  # loose keyword checks for rag_metrics


EVAL_DATASET: list[EvalExample] = [
    EvalExample(
        query="Why is the pump producing high vibration?",
        query_type="troubleshooting",
        relevant_chunk_ids=["bearing_vibration_001", "shaft_misalignment_002"],
        expected_answer_contains=["vibration", "bearing", "alignment"],
    ),
    EvalExample(
        query="What causes bearing overheating?",
        query_type="failure_analysis",
        relevant_chunk_ids=["bearing_overheating_001"],
        expected_answer_contains=["lubrication", "overheating"],
    ),
    EvalExample(
        query="How do I inspect the mechanical seal?",
        query_type="maintenance_procedure",
        relevant_chunk_ids=["mech_seal_inspection_001"],
        expected_answer_contains=["seal", "inspection"],
    ),
    EvalExample(
        query="What is the function of the impeller?",
        query_type="component_information",
        relevant_chunk_ids=["impeller_function_001"],
        expected_answer_contains=["impeller", "kinetic"],
    ),
    EvalExample(
        query="What is the reference of the bearing?",
        query_type="spare_parts",
        relevant_chunk_ids=["bearing_spare_parts_001"],
        expected_answer_contains=["reference", "bearing"],
    ),
    EvalExample(
        query="What is the recommended lubrication procedure?",
        query_type="maintenance_procedure",
        relevant_chunk_ids=["lubrication_procedure_001"],
        expected_answer_contains=["lubrication", "interval"],
    ),
]

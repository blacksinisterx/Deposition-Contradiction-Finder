"""LangGraph harness for the deposition contradiction finder.

ingest -> parse_documents -> extract_claims -> group_claims -> cross_reference -> persist_findings

parse_documents is a thin wrapper around tools/transcript_parser.py (the
real, deterministic anchor tool). extract_claims and cross_reference are
the LLM nodes (nodes/), where the actual reasoning happens. group_claims is
deterministic (tools/grouping.py) and exists specifically to keep the
number of cross_reference LLM calls bounded -- see PLAN.md.
"""
import os
from typing import List, Optional, TypedDict

from langgraph.graph import END, StateGraph

import db
from nodes.cross_reference import judge_pair
from nodes.extract_claims import extract_claims as extract_claims_llm
from tools.grouping import find_candidate_pairs
from tools.transcript_parser import parse_transcript


class GraphState(TypedDict):
    case_id: Optional[str]
    analysis_id: Optional[str]
    documents: List[dict]  # [{document_id, witness, deposition_date, file_path}]
    exchanges_by_doc: dict  # document_id -> parsed exchanges
    claims: List[dict]
    candidate_pairs: List[tuple]
    contradictions: List[dict]


def get_llm():
    from langchain_groq import ChatGroq

    return ChatGroq(model=os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile"), temperature=0)


def ingest(state: GraphState) -> dict:
    db.update_analysis_status(state.get("analysis_id"), "running")
    db.write_progress(state.get("analysis_id"), "ingest", f"Analyzing {len(state['documents'])} document(s)")
    return {}


def parse_documents(state: GraphState) -> dict:
    db.write_progress(state.get("analysis_id"), "parse_documents", "Parsing transcripts...")
    exchanges_by_doc = {}
    for doc in state["documents"]:
        exchanges_by_doc[doc["document_id"]] = parse_transcript(
            doc["file_path"], document_id=doc["document_id"], witness_name=doc["witness"]
        )
    total = sum(len(v) for v in exchanges_by_doc.values())
    db.write_progress(state.get("analysis_id"), "parse_documents", f"Parsed {total} exchanges across {len(exchanges_by_doc)} document(s)")
    return {"exchanges_by_doc": exchanges_by_doc}


def extract_claims(state: GraphState) -> dict:
    llm = get_llm()
    claims = []
    for i, doc in enumerate(state["documents"], 1):
        db.write_progress(
            state.get("analysis_id"),
            "extract_claims",
            f"Extracting claims from {doc['witness']}'s deposition ({i}/{len(state['documents'])})...",
        )
        doc_claims = extract_claims_llm(llm, doc["witness"], state["exchanges_by_doc"][doc["document_id"]])
        for c in doc_claims:
            claim_id = db.write_claim(
                doc["document_id"], c["witness"], c["page"], c["line"], c["claim_text"], c["topic_tags"]
            )
            c["id"] = claim_id
            claims.append(c)
    db.write_progress(state.get("analysis_id"), "extract_claims", f"Extracted {len(claims)} claim(s) total")
    return {"claims": claims}


def group_claims(state: GraphState) -> dict:
    db.write_progress(state.get("analysis_id"), "group_claims", "Grouping claims by topic across documents...")
    pairs = find_candidate_pairs(state["claims"])
    db.write_progress(state.get("analysis_id"), "group_claims", f"Found {len(pairs)} candidate pair(s) to cross-reference")
    return {"candidate_pairs": pairs}


def cross_reference(state: GraphState) -> dict:
    llm = get_llm()
    contradictions = []
    total = len(state["candidate_pairs"])
    for i, (claim_a, claim_b, shared_word) in enumerate(state["candidate_pairs"], 1):
        db.write_progress(
            state.get("analysis_id"),
            "cross_reference",
            f'Cross-referencing pair {i}/{total} (topic: "{shared_word}")...',
        )
        verdict = judge_pair(llm, claim_a, claim_b, shared_word)
        contradictions.append(
            {
                "claim_a": claim_a,
                "claim_b": claim_b,
                "shared_word": shared_word,
                "status": verdict.status,
                "severity": verdict.severity,
                "reasoning": verdict.reasoning,
            }
        )
    return {"contradictions": contradictions}


def persist_findings(state: GraphState) -> dict:
    for c in state["contradictions"]:
        db.write_contradiction(
            state.get("case_id"), c["claim_a"]["id"], c["claim_b"]["id"], c["status"], c["severity"], c["reasoning"]
        )
    db.update_analysis_status(state.get("analysis_id"), "completed")
    db.write_progress(state.get("analysis_id"), "persist_findings", "Analysis complete.")
    return {}


def build_graph():
    g = StateGraph(GraphState)
    g.add_node("ingest", ingest)
    g.add_node("parse_documents", parse_documents)
    g.add_node("extract_claims", extract_claims)
    g.add_node("group_claims", group_claims)
    g.add_node("cross_reference", cross_reference)
    g.add_node("persist_findings", persist_findings)

    g.set_entry_point("ingest")
    g.add_edge("ingest", "parse_documents")
    g.add_edge("parse_documents", "extract_claims")
    g.add_edge("extract_claims", "group_claims")
    g.add_edge("group_claims", "cross_reference")
    g.add_edge("cross_reference", "persist_findings")
    g.add_edge("persist_findings", END)

    return g.compile()

"""Local CLI runner -- exercises the full pipeline against a case manifest
without any web UI or GitHub Actions involved. Works with or without
Supabase configured (db.py no-ops to console prints when unset).

    python run_analysis.py --manifest ../../fixture-case/manifest.json
"""
import argparse
import json
import os

from dotenv import load_dotenv

load_dotenv()

import db
from graph import build_graph


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    args = parser.parse_args()

    manifest_dir = os.path.dirname(os.path.abspath(args.manifest))
    with open(args.manifest, encoding="utf-8") as f:
        manifest = json.load(f)

    case_id = db.create_case(manifest["case_name"])

    documents = []
    for doc in manifest["documents"]:
        file_path = os.path.join(manifest_dir, doc["file_name"])
        document_id = db.create_document(case_id, doc["witness_name"], doc["deposition_date"], file_path)
        documents.append(
            {
                "document_id": document_id or doc["file_name"],  # fall back to a stable local id if Supabase is unset
                "witness": doc["witness_name"],
                "deposition_date": doc["deposition_date"],
                "file_path": file_path,
            }
        )

    analysis_id = db.create_analysis(case_id)

    graph = build_graph()
    graph.invoke(
        {
            "case_id": case_id,
            "analysis_id": analysis_id,
            "documents": documents,
            "exchanges_by_doc": {},
            "claims": [],
            "candidate_pairs": [],
            "contradictions": [],
        }
    )


if __name__ == "__main__":
    main()

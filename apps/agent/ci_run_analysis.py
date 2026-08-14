"""GitHub Actions entrypoint -- the actual deployed agent compute path
(same reasoning as the last project: on-demand workflow_dispatch jobs
instead of a persistent server, see PLAN.md). Downloads each deposition
file from Supabase Storage, runs the same graph pipeline as run_analysis.py
-- graph.py/tools/nodes/db.py are completely unchanged.

Triggered via workflow_dispatch with case_id + analysis_id + a JSON-encoded
document list from the Next.js API route:
    python ci_run_analysis.py --case-id <id> --analysis-id <id> --documents-json '[...]'
"""
import argparse
import json
import os
import shutil
import tempfile

import db
from graph import build_graph
from storage_utils import download_file


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--case-id", required=True)
    parser.add_argument("--analysis-id", required=True)
    parser.add_argument("--documents-json", required=True, help='[{"document_id","witness_name","storage_path"}, ...]')
    args = parser.parse_args()

    documents_meta = json.loads(args.documents_json)
    tmp_dir = tempfile.mkdtemp(prefix="analysis_")

    try:
        documents = []
        for doc in documents_meta:
            file_path = os.path.join(tmp_dir, f"{doc['document_id']}.txt")
            download_file(doc["storage_path"], file_path)
            documents.append(
                {
                    "document_id": doc["document_id"],
                    "witness": doc["witness_name"],
                    "file_path": file_path,
                }
            )

        graph = build_graph()
        graph.invoke(
            {
                "case_id": args.case_id,
                "analysis_id": args.analysis_id,
                "documents": documents,
                "exchanges_by_doc": {},
                "claims": [],
                "candidate_pairs": [],
                "contradictions": [],
            }
        )
    except Exception as e:
        db.update_analysis_status(args.analysis_id, "failed")
        db.write_progress(args.analysis_id, "error", str(e))
        raise  # non-zero exit so the Actions job itself shows as failed too
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()

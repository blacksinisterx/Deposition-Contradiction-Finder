"""Supabase persistence. Every function no-ops (prints instead) when
SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY aren't set, so the graph and CLI
runner work standalone for local testing before a Supabase project exists.
"""
import os
from datetime import datetime, timezone

_client = None
_checked = False


def _get_client():
    global _client, _checked
    if _checked:
        return _client
    _checked = True
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return None
    from supabase import create_client

    _client = create_client(url, key)
    return _client


def _now():
    return datetime.now(timezone.utc).isoformat()


def create_case(name="local-case"):
    client = _get_client()
    if not client:
        return None
    case = client.table("cases").insert({"name": name}).execute()
    return case.data[0]["id"]


def create_document(case_id, witness_name, deposition_date=None, storage_path=None):
    client = _get_client()
    if not client or not case_id:
        return None
    doc = client.table("documents").insert(
        {
            "case_id": case_id,
            "witness_name": witness_name,
            "deposition_date": deposition_date,
            "storage_path": storage_path,
            "status": "pending",
        }
    ).execute()
    return doc.data[0]["id"]


def create_analysis(case_id):
    client = _get_client()
    if not client:
        return None
    analysis = client.table("analyses").insert({"case_id": case_id, "status": "pending"}).execute()
    return analysis.data[0]["id"]


def update_analysis_status(analysis_id, status):
    client = _get_client()
    if not client or not analysis_id:
        return
    fields = {"status": status}
    if status == "running":
        fields["started_at"] = _now()
    elif status in ("completed", "failed"):
        fields["completed_at"] = _now()
    client.table("analyses").update(fields).eq("id", analysis_id).execute()


def write_progress(analysis_id, node, message):
    event = {"node": node, "message": message, "at": _now()}
    client = _get_client()
    if not client or not analysis_id:
        print(f"[{node}] {message}")
        return
    current = client.table("analyses").select("progress").eq("id", analysis_id).single().execute()
    progress = (current.data or {}).get("progress") or []
    progress.append(event)
    client.table("analyses").update({"progress": progress}).eq("id", analysis_id).execute()


def write_claim(document_id, witness, page, line, claim_text, topic_tags):
    client = _get_client()
    if not client:
        print(f"[claim] {witness} p.{page}:{line} -- {claim_text}")
        return None
    row = client.table("claims").insert(
        {
            "document_id": document_id,
            "witness_name": witness,
            "page": page,
            "line": line,
            "claim_text": claim_text,
            "topic_tags": topic_tags,
        }
    ).execute()
    return row.data[0]["id"]


def write_contradiction(case_id, claim_a_id, claim_b_id, status, severity, reasoning):
    client = _get_client()
    if not client:
        print(f"[contradiction] {status.upper()} (severity={severity}) -- {reasoning}")
        return
    client.table("contradictions").insert(
        {
            "case_id": case_id,
            "claim_a_id": claim_a_id,
            "claim_b_id": claim_b_id,
            "status": status,
            "severity": severity,
            "reasoning": reasoning,
        }
    ).execute()

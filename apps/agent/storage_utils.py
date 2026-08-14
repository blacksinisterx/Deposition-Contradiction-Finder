"""Download a deposition file from the deposition-uploads Supabase Storage
bucket. Raw httpx GET against the REST API, not supabase-py's storage
client -- the last project's client raised JSONDecodeError on both upload
and download in testing, while the identical raw HTTP call worked cleanly;
not worth debugging a client-library bug when the REST endpoint itself
works fine and httpx is already a dependency.

Depositions are individual plain-text files, not an archive, so there's no
zip-slip surface here -- the one trust-boundary check that applies is a
sane size cap on what gets downloaded and processed.
"""
import os

MAX_FILE_BYTES = 5 * 1024 * 1024  # 5 MB per deposition file


def download_file(storage_path, dest_path):
    import httpx

    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    resp = httpx.get(
        f"{url}/storage/v1/object/deposition-uploads/{storage_path}",
        headers={"Authorization": f"Bearer {key}", "apikey": key},
        timeout=60,
    )
    resp.raise_for_status()
    if len(resp.content) > MAX_FILE_BYTES:
        raise ValueError(f"deposition file too large ({len(resp.content)} bytes > {MAX_FILE_BYTES})")
    with open(dest_path, "wb") as f:
        f.write(resp.content)

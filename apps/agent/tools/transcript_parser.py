"""Deterministic transcript parser -- the "Semgrep equivalent" for this
project: a real tool doing real work, not an LLM wrapper. Extracts
citation-addressable exchanges from a plain-text deposition transcript in
the standard court-reporter page:line format:

    [4:02] Q. Mr. Kessler, please state your position at Coastal Freight.
    [4:04] A. I'm a warehouse loader. Been there about six years.

Real PDF/OCR parsing of arbitrary deposition exports is out of scope for
this fixture-driven build (see PLAN.md) -- this parser targets exactly the
plain-text page:line format the fixture uses, which is also how most court
reporting services export a clean transcript.

Run standalone to sanity-check against the fixture:
    python -m tools.transcript_parser ../../fixture-case/kessler-deposition-1.txt
"""
import re

LINE_RE = re.compile(r"^\[(\d+):(\d+)\]\s+(Q|A)\.\s*(.*)$")


def parse_transcript(file_path, document_id, witness_name):
    """Return an ordered list of exchanges:
    {document_id, witness, speaker, page, line, text}.

    speaker is "Q" (attorney) or "A" (witness) -- only "A" exchanges are
    the witness's own testimony; "Q" lines are retained as context for the
    LLM claim-extraction step but are not claims themselves.

    Lines that don't start with a [page:line] marker are treated as a
    continuation of the previous exchange's text (real transcript answers
    often wrap across multiple physical lines); blank lines are separators
    and are skipped.
    """
    exchanges = []
    with open(file_path, encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.rstrip("\n")
            if not line.strip():
                continue
            m = LINE_RE.match(line)
            if m:
                page, ln, speaker, text = m.groups()
                exchanges.append(
                    {
                        "document_id": document_id,
                        "witness": witness_name,
                        "speaker": speaker,
                        "page": int(page),
                        "line": int(ln),
                        "text": text.strip(),
                    }
                )
            elif exchanges:
                exchanges[-1]["text"] += " " + line.strip()
    return exchanges


if __name__ == "__main__":
    import sys

    path = sys.argv[1] if len(sys.argv) > 1 else "../../fixture-case/kessler-deposition-1.txt"
    result = parse_transcript(path, document_id="test-doc", witness_name="Test Witness")
    print(f"Parsed {len(result)} exchanges from {path}\n")
    for ex in result:
        print(f"  [{ex['page']}:{ex['line']}] {ex['speaker']}. {ex['text'][:80]}")

    answers = [e for e in result if e["speaker"] == "A"]
    assert len(answers) > 0, "expected at least one witness answer"
    assert all(e["page"] > 0 and e["line"] > 0 for e in result), "expected valid page/line for every exchange"
    print(f"\nOK: {len(result)} exchanges parsed, {len(answers)} witness answers.")

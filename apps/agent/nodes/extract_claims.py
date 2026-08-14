"""extract_claims node: reads one witness's parsed transcript exchanges and
pulls out discrete factual claims, each tagged with topic keywords for the
later grouping step.

Citation trust boundary: the LLM never invents a page/line. It only refers
to claims by the index of a numbered exchange list we hand it; the actual
{page, line} is attached afterward from transcript_parser's own output --
the same pattern the last project used for hop file/line (tool-provided
ground truth, LLM only judges/extracts against it).
"""
from typing import List

from pydantic import BaseModel, Field

from nodes._llm_utils import invoke_structured

SYSTEM_PROMPT = """You are a litigation paralegal reviewing a deposition transcript to build a factual timeline.

You will be given a numbered list of exchanges from one witness's deposition (attorney questions for context, witness answers as the actual testimony). Extract discrete factual claims the WITNESS makes in their answers -- concrete assertions about what happened, what they saw, where they or someone else was, timing, or actions taken.

Rules:
- Only extract claims from "A." (answer) exchanges, never from "Q." (question) exchanges.
- Skip answers that are purely procedural, an agreement to proceed, or contain no factual content (e.g. "Take your time.").
- One exchange can yield zero, one, or multiple claims if it asserts multiple distinct facts.
- Each claim must reference the exact exchange_index it came from -- never combine facts from two different exchanges into one claim.
- topic_tags: give 1-3 tags per claim, each a 2-3 word specific compound phrase naming the actual thing the claim is about (e.g. "safety guard", "hydraulic warning light", "kessler whereabouts", "unit 12 operation"). Never use a single bare word as a tag (not "kessler", not "accident", not "unit" alone) -- a witness's own name or a generic case word like "accident" recurs across dozens of unrelated claims and is useless for telling claims apart. Each tag must be specific enough that two claims sharing a tag are actually likely to be about the same real-world thing.
"""


class ExtractedClaim(BaseModel):
    exchange_index: int
    claim_text: str = Field(description="The factual claim, in the witness's own words or a faithful close paraphrase")
    topic_tags: List[str] = Field(description="2-4 short, specific, lowercase keyword tags")


class ExtractedClaims(BaseModel):
    claims: List[ExtractedClaim]


def _format_exchanges(exchanges):
    lines = []
    for i, ex in enumerate(exchanges):
        lines.append(f"[{i}] {ex['speaker']}. {ex['text']}")
    return "\n".join(lines)


def extract_claims(llm, witness, exchanges):
    """exchanges: parsed transcript_parser output for one document.
    Returns a list of claim dicts: {witness, page, line, speaker, claim_text, topic_tags}."""
    structured_llm = llm.with_structured_output(ExtractedClaims)
    fallback = ExtractedClaims(claims=[])
    result = invoke_structured(
        structured_llm,
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Witness: {witness}\n\nExchanges:\n{_format_exchanges(exchanges)}\n\nExtract the factual claims.",
            },
        ],
        fallback,
    )

    claims = []
    for c in result.claims:
        if c.exchange_index < 0 or c.exchange_index >= len(exchanges):
            continue  # defensive: ignore an out-of-range index rather than crash
        source = exchanges[c.exchange_index]
        claims.append(
            {
                "witness": witness,
                "document_id": source["document_id"],
                "page": source["page"],
                "line": source["line"],
                "claim_text": c.claim_text,
                "topic_tags": [t.strip().lower() for t in c.topic_tags if t.strip()],
            }
        )
    return claims

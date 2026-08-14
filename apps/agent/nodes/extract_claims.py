"""extract_claims node: reads one witness's parsed transcript exchanges and
pulls out discrete factual claims, each tagged with topic keywords and an
explicit subject (about_person) for the later grouping step.

Citation trust boundary: the LLM never invents a page/line. It only refers
to claims by the index of a numbered exchange list we hand it; the actual
{page, line} is attached afterward from transcript_parser's own output --
the same pattern the last project used for hop file/line (tool-provided
ground truth, LLM only judges/extracts against it).

about_person exists because free-text topic tags alone cannot reliably
link two claims about the same person's status when only one side names
them -- a witness describing their OWN location never says their own name
("I was standing next to the forklift"), while another witness describing
that SAME person's location does ("Kessler wasn't on the floor"). No
amount of tag-wording tuning closes that gap; it needs an explicit,
low-cardinality subject field instead of inferring the subject from
vocabulary that structurally isn't there on one side of the pair.
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
- about_person: the surname of the person whose status/location/action/knowledge this claim is actually about. If the witness is describing themselves (even without saying their own name, e.g. "I was standing next to the forklift"), use the WITNESS's own surname. If the witness is describing someone else (e.g. "Kessler wasn't on the floor"), use that OTHER person's surname instead.
- topic_tags: give 1-3 tags per claim, each a 2-3 word specific compound phrase naming the concrete thing the claim is about (e.g. "safety guard", "hydraulic warning light", "unit 12 operation"). Never use a single bare word as a tag, and never use a person's name as a tag -- that's what about_person is for.
"""


class ExtractedClaim(BaseModel):
    exchange_index: int
    claim_text: str = Field(description="The factual claim, in the witness's own words or a faithful close paraphrase")
    about_person: str = Field(description="Surname of who this claim's status/location/action is actually about")
    topic_tags: List[str] = Field(description="1-3 short, specific, lowercase compound-phrase tags (never a bare name)")


class ExtractedClaims(BaseModel):
    claims: List[ExtractedClaim]


def _format_exchanges(exchanges):
    lines = []
    for i, ex in enumerate(exchanges):
        lines.append(f"[{i}] {ex['speaker']}. {ex['text']}")
    return "\n".join(lines)


def extract_claims(llm, witness, exchanges):
    """exchanges: parsed transcript_parser output for one document.
    Returns a list of claim dicts: {witness, page, line, claim_text, about_person, topic_tags}."""
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
                "about_person": c.about_person.strip().lower(),
                "topic_tags": [t.strip().lower() for t in c.topic_tags if t.strip()],
            }
        )
    return claims

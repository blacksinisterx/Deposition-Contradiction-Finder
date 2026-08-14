"""cross_reference node: the core reasoning step. Given a candidate pair of
claims that share a topic keyword, judges whether they genuinely contradict
each other or are actually consistent -- this is what makes it a reasoning
agent instead of a keyword matcher: it has to read what each claim actually
asserts and decide whether they're really about the same fact before it can
even ask whether they disagree about it.
"""
from typing import Literal

from pydantic import BaseModel, Field

from nodes._llm_utils import invoke_structured

SYSTEM_PROMPT = """You are a litigation paralegal comparing two witness statements that were flagged as possibly related because they share a keyword.

Rules:
- Sharing a keyword or topic word does NOT by itself mean two claims are about the same fact. Read both claims in full and judge what each one is actually asserting -- who, what, when, where -- before deciding whether they even address the same underlying fact.
- If the claims are about different subjects, different objects, or different events that merely happen to share a word (e.g. two different pieces of equipment that are both called "the warning light"), the correct verdict is "consistent" -- there is no real conflict to report.
- If the claims are about the same specific fact and genuinely disagree (one asserts something the other denies, or they give incompatible accounts), the verdict is "confirmed".
- If they're about the same fact and additional detail or a compatible elaboration, not a real disagreement, the verdict is "consistent".
- Use "needs_review" only when it's genuinely ambiguous whether they're even about the same fact.
- severity reflects how material the contradiction is to the case if confirmed (high = goes to a central disputed fact, medium = relevant but secondary, low = minor); use "low" whenever status is not "confirmed".
"""


class ContradictionVerdict(BaseModel):
    status: Literal["confirmed", "consistent", "needs_review"]
    severity: Literal["high", "medium", "low"] = Field(
        description="Impact if confirmed; use 'low' if status is not 'confirmed'"
    )
    reasoning: str = Field(description="2-3 sentences: what each claim actually says, and why that is/isn't a real contradiction")


def _build_prompt(claim_a, claim_b, shared_word):
    return (
        f'Two claims share the topic word "{shared_word}".\n\n'
        f"Claim A -- {claim_a['witness']}, page {claim_a['page']}, line {claim_a['line']}:\n"
        f"\"{claim_a['claim_text']}\"\n\n"
        f"Claim B -- {claim_b['witness']}, page {claim_b['page']}, line {claim_b['line']}:\n"
        f"\"{claim_b['claim_text']}\"\n\n"
        "Are these genuinely about the same fact, and if so, do they actually disagree?"
    )


def judge_pair(llm, claim_a, claim_b, shared_word) -> ContradictionVerdict:
    structured_llm = llm.with_structured_output(ContradictionVerdict)
    fallback = ContradictionVerdict(
        status="needs_review",
        severity="low",
        reasoning="Automatic reasoning failed twice for this pair; flagged for manual review instead of dropped.",
    )
    return invoke_structured(
        structured_llm,
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_prompt(claim_a, claim_b, shared_word)},
        ],
        fallback,
    )

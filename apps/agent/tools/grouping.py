"""Deterministic topic grouping -- keeps the LLM cross-referencing step
bounded. Groups claims from DIFFERENT documents that are plausibly about
the same real-world fact, via two independent match paths:

1. Shared specific topic vocabulary: >=2 significant words in common
   between the FLATTENED tag-word-sets of two claims (excluding
   single-word tags). Deliberately not per-individual-tag subset matching
   -- verified against a real run where the LLM split one concept across
   two tags ("hydraulic warning" + "forklift light") while the other
   witness's document combined it into one ("warning light"); a strict
   per-tag subset check misses that even though the underlying concept is
   clearly the same. Requiring 2+ shared words (not 1) is what keeps this
   from reintroducing the original over-grouping bug, where a single
   generic shared word (a witness's own name) matched almost everything.

2. Same about_person + BOTH sides read as a location/presence claim --
   catches the case pure tag/word matching structurally cannot: a witness
   describing their OWN location never names themselves ("I was standing
   next to the forklift"), while another witness describing that SAME
   person's location does ("Kessler wasn't on the floor"). See
   extract_claims.py's docstring for why this needs its own path.
   Requiring BOTH sides (not just one) to read as location-flavored is
   what keeps this path from matching a witness's unrelated self-referential
   claims (job title, tenure, etc.) against every claim that names them.

Ponytail: O(n^2 * tags) pairwise scan. Fine at fixture/case scale (dozens
of claims, a handful of tags each); would need indexing by word for a
large case with hundreds of claims. A production version would likely
replace path 1 with embedding similarity instead of tuning keyword
thresholds further -- this is a real, honest limit of a keyword-only
approach, not something worth chasing indefinitely with more heuristics.
"""
import re

STOPWORDS = {
    "the", "a", "an", "and", "or", "was", "were", "that", "this", "with",
    "from", "when", "where", "who", "did", "does", "his", "her", "he",
    "she", "it", "its", "at", "in", "on", "of", "to", "for", "not",
}

LOCATION_HINTS = {
    "whereabouts", "location", "floor", "break", "standing", "proximity",
    "present", "presence", "station", "shift",
}

MIN_SHARED_WORDS = 2


def _significant_words(text):
    return {w for w in re.findall(r"[a-z]+", text.lower()) if len(w) >= 3 and w not in STOPWORDS}


def _flattened_tag_words(claim):
    """Union of significant words across all of a claim's tags, but only
    counting tags that have >=2 significant words themselves (a bare
    single-word tag contributes nothing -- too generic on its own)."""
    words = set()
    for tag in claim["topic_tags"]:
        tag_words = _significant_words(tag)
        if len(tag_words) >= 2:
            words |= tag_words
    return words


def _reads_as_location_claim(claim):
    haystack = " ".join(claim["topic_tags"]) + " " + claim["claim_text"]
    return bool(_significant_words(haystack) & LOCATION_HINTS)


def find_candidate_pairs(claims):
    """claims: list of claim dicts with document_id, topic_tags, about_person.
    Returns [(claim_a, claim_b, shared_topic)] for every cross-document pair
    that plausibly concerns the same real-world fact."""
    flat_words = [_flattened_tag_words(c) for c in claims]
    is_location = [_reads_as_location_claim(c) for c in claims]
    pairs = []
    for i in range(len(claims)):
        for j in range(i + 1, len(claims)):
            a, b = claims[i], claims[j]
            if a["document_id"] == b["document_id"]:
                continue

            shared = flat_words[i] & flat_words[j]
            match = " ".join(sorted(shared)) if len(shared) >= MIN_SHARED_WORDS else None

            if not match and a["about_person"] and a["about_person"] == b["about_person"]:
                if is_location[i] and is_location[j]:
                    match = f"{a['about_person']}'s whereabouts"

            if match:
                pairs.append((a, b, match))
    return pairs

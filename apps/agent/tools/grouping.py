"""Deterministic topic grouping -- keeps the LLM cross-referencing step
bounded. Groups claims from DIFFERENT documents whose topic tags point at
the same specific thing, so cross_reference only runs on plausible
candidate pairs instead of every claim against every other claim.

Matches at the INDIVIDUAL TAG level, not by flattening a claim's tags into
one word-bag -- flattening was the first version's bug: a claim tagged
["kessler tenure", "warehouse"] and an unrelated claim tagged
["kessler location"] would "share" the word "kessler" even though neither
tag is really about the same thing. A witness's own name recurs across
dozens of unrelated claims, so bare single-word tags are excluded entirely
-- they're too generic to anchor a real match. Two tags are considered the
same topic only if one tag's significant words are a subset of the
other's (e.g. "warning light" <= "hydraulic warning light").

Ponytail: O(n^2 * tags^2) pairwise scan. Fine at fixture/case scale
(dozens of claims, a handful of tags each); would need indexing by word
for a large case with hundreds of claims.
"""
import re

STOPWORDS = {
    "the", "a", "an", "and", "or", "was", "were", "that", "this", "with",
    "from", "when", "where", "who", "did", "does", "his", "her", "he",
    "she", "it", "its", "at", "in", "on", "of", "to", "for", "not",
}


def _significant_words(tag):
    return {w for w in re.findall(r"[a-z]+", tag.lower()) if len(w) >= 3 and w not in STOPWORDS}


def _tag_word_sets(claim):
    """Per-claim list of word-sets, one per tag -- skips tags with fewer
    than 2 significant words (too generic to anchor a match on their own)."""
    sets = []
    for tag in claim["topic_tags"]:
        words = _significant_words(tag)
        if len(words) >= 2:
            sets.append(words)
    return sets


def _tags_match(words_a, words_b):
    shorter, longer = (words_a, words_b) if len(words_a) <= len(words_b) else (words_b, words_a)
    return shorter <= longer  # every word of the shorter tag appears in the longer tag


def find_candidate_pairs(claims):
    """claims: list of claim dicts with document_id and topic_tags.
    Returns [(claim_a, claim_b, shared_topic)] for every cross-document pair
    with at least one genuinely matching tag pair."""
    tag_sets = [_tag_word_sets(c) for c in claims]
    pairs = []
    for i in range(len(claims)):
        for j in range(i + 1, len(claims)):
            a, b = claims[i], claims[j]
            if a["document_id"] == b["document_id"]:
                continue
            match = None
            for words_a in tag_sets[i]:
                for words_b in tag_sets[j]:
                    if _tags_match(words_a, words_b):
                        match = " ".join(sorted(words_a if len(words_a) <= len(words_b) else words_b))
                        break
                if match:
                    break
            if match:
                pairs.append((a, b, match))
    return pairs

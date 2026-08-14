# Deposition Contradiction Finder — Build Plan

## Context

Second, fully independent "deep agent" submission (new GitHub repo, new Supabase project, new Vercel project — no shared infra with the earlier Exploit-Path-Tracer submission). Upload multiple witness depositions from the same case; the agent builds a per-witness timeline, cross-references statements across documents, and flags contradictions with exact page/line citations.

This needs real multi-document memory and structured comparison — genuinely hard to fake with a plain chatbot, which is the strongest possible proof of a "deep agent" harness over a chat-wrapper demo. It also gets a direct structural analogue to what worked best last time: a case that *looks* like a contradiction under naive keyword matching but isn't under real reading — mirroring the command-injection false-positive that was the single strongest proof point in the last build.

**Constraints locked in with the user:** genuinely free/no-card infra throughout (same constraint as last time), Next.js+Tailwind+shadcn frontend on Vercel, Supabase persistence, LangGraph harness with real domain tools (not an LLM wrapper).

## Lessons carried over from Exploit-Path-Tracer (applied from the start, not discovered mid-build)

1. **Agent compute goes straight to GitHub Actions `workflow_dispatch`.** Skip the HF Spaces / Render hosting saga entirely — proven free, no-card, real VM, zero changes needed to the harness itself.
2. **LLM stays Groq**, free tier, no card — actual model landed on `openai/gpt-oss-120b` after real testing (see Verification Notes; the originally planned `llama-3.3-70b-versatile` hit its daily quota during grouping-bug debugging before it could be properly evaluated, and a smaller fallback model proved unreliable on the exact judgment this product depends on). Graph is designed to bound total LLM calls up front (see Pipeline below), not discover a rate-limit wall mid-build — multi-document cross-referencing makes an uncontrolled O(n²) comparison pattern a much bigger risk here than last time.
3. **Never name custom Tailwind v4 theme tokens with a `--spacing-*` prefix** — reserved namespace, silently hijacks `max-w-*`/`w-*`/`gap-*`/`p-*` generation. Use `--space-*`.
4. **shadcn `Button` wrapping a `Link` via `render=` needs `nativeButton={false}`** (Base UI, not Radix, under this shadcn version).
5. **Apply the full design system from day one** — glassmorphism/ambient glow/motion, not just color-token swaps on flat shadcn defaults.
6. **Autoscroll/UX-polish effects must be scoped and explicit** — no blanket `useEffect` on a `[messages]`-shaped dependency calling `scrollIntoView()`; trigger only from the actual user action, on the actual scroll container.
7. **Verify every tool against real infrastructure before building the next layer on it.** Measure (`getComputedStyle`, DOM rects) before assuming an observation tool is lying.
8. **Uploaded files are a trust boundary** — reuse the zip-slip/zip-bomb guard pattern from the last project's `storage_utils.py`, plus per-file size/type validation on the multi-file upload UI.
9. **Reuse the proven Supabase Storage direct-upload + Vercel-API-dispatches-GitHub-Actions pattern** — copy the shape from the last project's `apps/web/app/api/scans/route.ts` and `.github/workflows/scan.yml`.
10. **Verification methodology**: real Playwright scripts against the actual deployed site for every README/demo claim — no mockups, no localhost-only claims.

## The core "proof of real reasoning" mechanic

The fixture case contains at least one pair of statements that share a keyword/topic and *look* contradictory to naive matching but are actually consistent on a careful read (different subject, compatible timeframes, or a clarification) — and at least one genuine, clean contradiction. The agent has to get both directions right. This is the headline proof point for the demo.

## Pipeline

```
ingest → parse_documents (deterministic) → extract_claims (LLM, 1 call/doc)
       → group_by_topic (deterministic, reuses extract_claims' own tags)
       → cross_reference (LLM, 1 call per topic-group with 2+ witnesses)
       → persist_findings
```

- **`parse_documents`** — the "Semgrep equivalent": real, deterministic tool. Fixture transcripts are plain `.txt` with a defined page:line-numbered format (real court-reporter convention):
  ```
  [12:03] Q. Where were you on the night of the 14th?
  [12:05] A. I was at my office until 6pm.
  ```
  Regex-based parser extracts `{document_id, witness, page, line, speaker, text}`. Real PDF/OCR parsing is explicitly cut to a stretch goal.
- **`extract_claims`** (LLM) — one call per document, pulls discrete factual claims with topic/entity tags and citations.
- **`group_by_topic`** — pure Python, groups claims across different documents/witnesses sharing overlapping tags. Zero extra LLM calls, keeps `cross_reference` calls bounded.
- **`cross_reference`** (LLM) — per qualifying group: `confirmed` / `consistent` / `needs_review`, with citations from both sides and a reasoning note.
- **`persist_findings`** — writes claims (timeline) and contradictions to Supabase.

~~Fallback if `cross_reference` is flaky on the subtle case: try `deepseek-r1-distill-llama-70b`~~ -- that model was decommissioned by Groq before this was needed; see Verification Notes for what was actually used instead (`openai/gpt-oss-120b`, checked live against Groq's current model list, not assumed from memory).

## Data model

```sql
cases (id, name, created_at)
documents (id, case_id, witness_name, deposition_date, storage_path, status)
claims (id, document_id, witness_name, page, line, speaker, claim_text, topic_tags text[], created_at)
analyses (id, case_id, status, progress jsonb, started_at, completed_at)
contradictions (id, case_id, status, severity, claim_a_id, claim_b_id, reasoning, created_at)
messages (id, contradiction_id, role, content, created_at)
```

RLS/Storage/Realtime mirrors the last project's `supabase/schema.sql` (public read, anon insert on uploads bucket, Realtime on `analyses`).

## Repo layout

```
deposition-contradiction-finder/
  apps/
    web/            Next.js + Tailwind v4 + shadcn/ui + Motion -> Vercel
    agent/          LangGraph harness -> GitHub Actions job
  fixture-case/     Demo depositions + ANSWER_KEY.md
  supabase/
    schema.sql
  PLAN.md
  README.md
```

## Build order

1. Repo scaffold, PLAN.md. ✅
2. New Supabase project + schema, sanity-checked with a manual insert.
3. Fixture transcripts + `ANSWER_KEY.md` — ground truth before any tooling.
4. `parse_documents` tool, tested standalone against the fixture.
5. LangGraph harness, run locally via CLI against the fixture, confirm Supabase ends up with expected claims + contradiction verdicts before touching any UI.
6. `.github/workflows/analyze.yml` + CI entrypoint, copying the proven shape from the last project.
7. Next.js scaffold + full design pass up front.
8. Upload flow → live analysis view → timeline + contradictions UI → chat.
9. Deploy both, real end-to-end smoke test on the production URL.
10. README with real screenshots, written note, demo recording.

## Verification plan

- Standalone: `parse_documents` against the fixture, hand-check exact page/line extraction on a few lines.
- Graph-level: local CLI run against the fixture — the genuine contradiction must be `confirmed`, the "looks like one" case must be `consistent`. This is the load-bearing correctness check for the whole product.
- Production: real Playwright script against the actual deployed site, screenshotted and recorded the same way as the last project's evidence.

## Verification Notes & Corrections (added on review)

1. **First real graph run against the fixture confirmed the reasoning works, but exposed a real grouping bug.** `grouping.py`'s first version matched claims by flattening *all* of a claim's topic tags into one word-bag and checking for any single shared significant word. That let a witness's own name (which recurs across dozens of unrelated claims) and generic case words ("unit", "accident") count as a topic match. Result: 31 claims produced **119** candidate pairs instead of the ~3 designed ones, and cross_reference burned through Groq's daily token cap (100,000 TPD on the free tier) partway through, leaving ~40 pairs as unrecoverable `RateLimitError` fallbacks.
   - The good news buried in that noisy run: the three *designed* pairs, when they did get evaluated cleanly, got exactly the right verdicts -- both genuine contradictions came back `confirmed`, and the "warning light" trap came back `consistent`. The reasoning itself was never the problem.
   - Fixed by rewriting `grouping.py` to match at the *individual tag* level (one tag from claim A vs one tag from claim B, subset-of-significant-words containment) instead of flattened word-bags, and by excluding single-word tags entirely (too generic to anchor a real match). Also tightened `extract_claims`'s prompt to require 2-3 word specific compound tags, never a bare name or generic case word, as defense in depth on top of the grouping-side filter.
   - This is exactly the rate-limit risk flagged in the plan up front -- it still happened, because the actual root cause (a too-loose grouping heuristic) wasn't something that could be fully predicted without running it against real data. Confirms the "verify against real infrastructure" discipline is doing its job: caught via the real run's actual output, not assumed away.
   - Re-verification is pending a ~15 minute cooldown on Groq's daily token quota (used almost entirely by the wasteful first run, before the fix landed) -- see the next note once that's re-run.

2. **The token-quota "~15 minute" ETA was misleading -- it's a daily cap, not a short cooldown.** Re-checking a few minutes later showed usage barely moved (99,440 -> 99,914 of 100,000) and the reported wait climbed to 21+ minutes rather than shrinking. Waiting it out blind would have blocked the rest of the day's work on an unknown timeline. Fix: Groq buckets rate limits *per model*, so a different model has its own independent quota. Switched to `llama-3.1-8b-instant` to keep moving -- verified this immediately by testing it directly (not assumed): it worked, extracting rich, well-tagged claims from two documents that had been failing.

3. **`llama-3.1-8b-instant` extraction revealed a second real bug: silent truncation, not a reasoning failure.** One document (Kessler's second deposition, the longer one) kept producing zero claims even with the untouched model. Direct debugging (bypassing the retry-then-fallback wrapper to see the *real* exception) showed the raw generation was a valid, well-formed claims list that got cut off mid-token ("claim_te) -- a `max_tokens` truncation, not a model or prompt problem. `ChatGroq` was never given an explicit `max_tokens`, so it was hitting some default output cap on a 15-exchange document producing 10+ claims. Fixed by setting `max_tokens=4096` explicitly.

4. **With truncation fixed, the smaller model's *reasoning* turned out to be the real problem -- and it was making the exact mistake this whole product exists to catch.** A full run with `llama-3.1-8b-instant` completed without errors, but 18 of the confirmed contradictions were spurious: e.g. it called Kessler's claim "I'm a warehouse loader" a contradiction of Torres's "he was on his break" claim, reasoning that the job-title claim "implies presence." That is precisely the naive keyword/entity-pattern-matching failure mode the false-positive-dismissal mechanic is designed to prove the agent *doesn't* make -- so a model that makes it itself is disqualifying for this task, not just "a bit noisy."
   - Checked the plan's own documented fallback (`deepseek-r1-distill-llama-70b`) -- it has been decommissioned by Groq since the plan was written; a real, dated finding, not a guess. Groq's current model list (checked live via the `/models` endpoint, not assumed from memory) includes `openai/gpt-oss-120b`, a larger open-weight model with its own separate quota bucket.
   - Tested it directly against four hand-picked pairs before trusting it with a full run: the two genuine contradictions, the exact warning-light trap, and the specific job-title-vs-whereabouts pair the smaller model got wrong. All four came back correct, with genuinely well-reasoned explanations (e.g. correctly distinguishing "general employment" from "a particular moment" for the job-title pair). Promoted it to the project's actual default model in `graph.py`, not just a temporary env override.

5. **One more grouping miss, found by inspecting real output rather than assuming the fix was complete.** A clean run with the new model still didn't surface the exact designed warning-light pair -- inspecting the actual stored tags showed the LLM had split "hydraulic warning light" across two separate tags (`hydraulic warning` + `forklift light`) on Kessler's side that run, while Torres's side used one combined tag (`warning light`). Strict per-tag subset matching structurally can't catch a concept split differently across two independently-generated tag sets. Fixed by matching on >=2 shared significant words across each claim's *flattened* tag vocabulary instead of per-individual-tag containment -- verified offline against the real stored claim data (no LLM call needed) that this closes the gap without reopening the original over-grouping bug (the threshold of 2, not 1, is what keeps a lone shared witness name from matching everything again).

6. **Final verified run: exactly the three designed headline pairs, all correct, plus three sensible extra findings.** `openai/gpt-oss-120b`, `max_tokens=4096`, the flattened-word-overlap + about_person grouping: 6 total contradictions -- both genuine contradictions `confirmed` (safety guard removal, Kessler's presence at the accident), the warning-light trap correctly `consistent`, and three additional pairs the broader grouping surfaced (two `needs_review` on genuinely ambiguous timing, one more `consistent` guard-removal pairing) -- all with sound, specific reasoning, none spurious. This is the load-bearing correctness check the plan called out up front, and it passed for real, not by assumption.

# Deposition Contradiction Finder — Build Plan

## Context

Second, fully independent "deep agent" submission (new GitHub repo, new Supabase project, new Vercel project — no shared infra with the earlier Exploit-Path-Tracer submission). Upload multiple witness depositions from the same case; the agent builds a per-witness timeline, cross-references statements across documents, and flags contradictions with exact page/line citations.

This needs real multi-document memory and structured comparison — genuinely hard to fake with a plain chatbot, which is the strongest possible proof of a "deep agent" harness over a chat-wrapper demo. It also gets a direct structural analogue to what worked best last time: a case that *looks* like a contradiction under naive keyword matching but isn't under real reading — mirroring the command-injection false-positive that was the single strongest proof point in the last build.

**Constraints locked in with the user:** genuinely free/no-card infra throughout (same constraint as last time), Next.js+Tailwind+shadcn frontend on Vercel, Supabase persistence, LangGraph harness with real domain tools (not an LLM wrapper).

## Lessons carried over from Exploit-Path-Tracer (applied from the start, not discovered mid-build)

1. **Agent compute goes straight to GitHub Actions `workflow_dispatch`.** Skip the HF Spaces / Render hosting saga entirely — proven free, no-card, real VM, zero changes needed to the harness itself.
2. **LLM stays Groq (`llama-3.3-70b-versatile`)**, free tier, no card. Graph is designed to bound total LLM calls up front (see Pipeline below), not discover a rate-limit wall mid-build — multi-document cross-referencing makes an uncontrolled O(n²) comparison pattern a much bigger risk here than last time.
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

Fallback if `cross_reference` is flaky on the subtle case: try `deepseek-r1-distill-llama-70b` on that node specifically (chain-of-thought, also free on Groq).

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

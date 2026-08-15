# Demo Script — Deposition Contradiction Finder

Aligned to the actual recording, `deposition-contradiction-finder-demo-raw.mp4` / `.webm` (4:49, video-only, no audio — read either script aloud over it). Every screen, number, and citation below is verified frame-by-frame against that file. Note: this run surfaced a different pair of headline contradictions than the ones documented in `fixture-case/ANSWER_KEY.md` (same fixture, same correctness, the LLM just grouped a different pair as its top result this time) — the script below describes exactly what's actually on screen, not the idealized case.

---

## Version A — Simple Explanation (non-technical audience)

**[0:00–0:03] Home page**
"This is an AI agent for litigation prep. You give it multiple witness depositions from the same case, and it doesn't just search for matching keywords — it actually reads across all of them and figures out where two witnesses are saying things that can't both be true."

**[0:03–0:22] Uploading depositions**
"I'm giving it three real deposition transcripts from a fictional case — two sessions with one witness, David Kessler, and one session with another witness, Maria Torres. I tag each file with who said it."

**[0:22–4:05] Watching it work**
"This is running for real now, live — no shortcuts. First it reads the raw transcripts and pulls out exact quotes with the page and line number they came from, so nothing gets summarized or made up. Then it figures out which statements from different witnesses are even worth comparing. Then, one pair at a time, it reads both statements and decides: is this an actual contradiction, or does it just sound like one?"

**[4:05–4:33] A real contradiction**
"Here's one it flagged. Kessler said he was working in Bay 3 that morning. Torres said he was on his break at that exact time. Those can't both be true — the agent catches that, and explains why. You can also just ask it questions about the finding and it answers using the actual statements."

**[4:33–4:42] Not a contradiction**
"And here's the important part — it doesn't just flag everything that looks similar. Kessler said he was in Bay 3 in the morning, and separately that he left work at 6pm. Those aren't contradictory at all — he could easily have done both, at different times of day. The agent correctly leaves this one alone instead of falsely flagging it."

**[4:42–4:49] The full picture**
"And this is the timeline — everything each witness said, side by side, so you can see both accounts of the same day at a glance."

---

## Version B — Technical Walkthrough (engineers)

**[0:00–0:03] Home**
Tagline states the mechanic directly: per-witness timeline + cross-document contradiction flagging with exact citations.

**[0:03–0:22] New Case**
Case name typed live: `Martinez v. Coastal Freight Co.`. Three `.txt` files added via the multi-file picker — `kessler-deposition-1.txt`, `kessler-deposition-2.txt`, `torres-deposition.txt` — each tagged with a witness name (`David Kessler` ×2, `Maria Torres`). On submit: direct upload to the `deposition-uploads` Supabase Storage bucket, then `POST /api/analyses` creates the case/documents/analysis rows and dispatches the `analyze.yml` GitHub Actions workflow with a JSON-encoded document list.

**[0:22–4:05] Live pipeline, streamed via Supabase Realtime**
- `ingest` — analyzing 3 documents
- `parse_documents` — the deterministic `[page:line] Q./A.` regex parser; **57 exchanges parsed across 3 documents**
- `extract_claims` — one Groq (`openai/gpt-oss-120b`) call per document: David Kessler 1/3, 2/3, Maria Torres 3/3 → **42 claims extracted**, each tagged with topic vocabulary and an explicit `about_person` subject field
- `group_claims` — pure Python, zero LLM cost: **16 candidate pairs** found by shared topic words or shared subject (e.g. "kessler's whereabouts")
- `cross_reference` — one Groq call per candidate pair, judged `confirmed` / `consistent` / `needs_review`, streamed pair-by-pair (1/16 … 16/16)
- `persist_findings` → analysis marked `completed`

**[4:05–4:33] A confirmed, cross-witness contradiction**
Top-sorted (highest severity) card opened: **confirmed / medium** — Kessler (p.4:9, *"I was working in Bay 3 on the morning of January 14th"*) vs. Torres (p.20:3, *"David Kessler was on his break at that time"*). Reasoning: both statements refer to the same time period and are mutually exclusive. A question is typed live into the chat panel — *"Does it matter that he explained why he changed his story?"* — and a real Groq response streams in, grounded in these two exact statements via `POST /api/contradictions/:id/messages`.

**[4:33–4:42] A correctly-dismissed near-miss**
Back to the contradictions list, opens a **consistent / low** card: Kessler (p.4:9, Bay 3 that morning) vs. Kessler — *same witness* — (p.20:3, *"I left work at 6:00 PM"*). Reasoning: no shared timeframe is asserted, so both can be true. This is the load-bearing proof point — grouping surfaced it as a candidate (shared subject: Kessler), but the LLM judge didn't rubber-stamp it as a contradiction just because grouping paired it.

**[4:42–4:49] Timeline**
Side-by-side witness columns (`grid-template-columns: repeat(auto-fit, minmax(300px, 1fr))`) — David Kessler and Maria Torres's full claim lists with page:line citations, laid out for direct visual comparison rather than one long stacked feed.

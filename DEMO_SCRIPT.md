# Demo Script — Deposition Contradiction Finder

One narration track, aligned to `deposition-contradiction-finder-demo-raw.mp4` / `.webm` (4:49, video-only — read this over it). Opens in plain language so anyone follows the point, then layers in the real mechanics as the footage gets into them. Every screen, number, and citation below is verified frame-by-frame against the actual recording. Note: this run's actual headline pairs differ from the designed case in `fixture-case/ANSWER_KEY.md` — same fixture, same correct behavior, a different pair just sorted to the top this time. The script describes exactly what's on screen.

---

**[0:00–0:03] Home**
"This is an AI agent for litigation prep. You give it multiple witness depositions from the same case, and instead of just searching for matching keywords, it actually reads across all of them and figures out where two witnesses are saying things that can't both be true — with the exact page and line each statement came from."

**[0:03–0:22] New Case**
"I'm uploading three real deposition transcripts from a fictional case — two sessions with one witness, David Kessler, and one session with another, Maria Torres — and tagging each file with who said it. That case name, 'Martinez v. Coastal Freight Co.,' is typed live, and on submit the files go straight to Supabase Storage while an API route creates the case, document, and analysis records and kicks off the actual analysis job."

**[0:22–4:05] Live pipeline**
"This is running for real, live — no shortcuts, and it takes a few minutes because it's making genuine calls to an LLM at each step, not simulating them. First a deterministic parser reads the raw transcripts and extracts exact quotes with their page and line number — here it parses 57 exchanges across the three documents — so nothing downstream can invent a citation. Then it pulls discrete factual claims out of each witness's testimony — 42 claims total across the three depositions. Then a plain Python grouping step, no LLM involved, figures out which claims from different documents are even worth comparing — it finds 16 candidate pairs here. Only then, one pair at a time, does an LLM read both statements and decide: genuine contradiction, consistent, or needs review. You can watch it work through all 16, pair by pair, right here."

**[4:05–4:33] A confirmed contradiction**
"Here's one it flagged as a real contradiction. Kessler testified he was working in Bay 3 that morning. Torres testified that at that exact time, he was on his break. Those can't both be true, and the agent explains why in plain terms. I can also just ask it a follow-up question about the finding — typing that in live — and it answers grounded in the actual two statements, not a generic response."

**[4:33–4:42] Correctly not flagged**
"And this is the part that actually matters most — it doesn't just flag anything that looks related. The grouping step paired these two because they're both about Kessler's day, but they're not about the same moment: he said he was in Bay 3 in the morning, and separately that he left work at 6pm. Both can easily be true. The agent reads that correctly and marks it consistent instead of rubber-stamping a false alarm just because the topics matched."

**[4:42–4:49] Timeline**
"And this is the full timeline — every claim from both witnesses, laid out side by side by page and line, so you can compare their accounts of the same day at a glance instead of scrolling through two separate transcripts."

# Demo Video Script

Target length: 3–5 minutes. Screen-record https://deposition-contradiction-finder.vercel.app/ live — every step below is a real action against the real deployed app, nothing staged or mocked. Have the three `fixture-case/*.txt` files ready before you start recording.

## 1. Hook (15s)

> "This is an AI litigation-prep agent. You give it multiple witness depositions from the same case, and it doesn't just search for two statements that share a keyword — it builds a real timeline per witness, and it reads across documents to decide: do these two statements *genuinely* conflict, or do they just sound alike on the surface? I'm going to show you the exact moment it gets that distinction right."

## 2. The problem, in one sentence (15s)

> "Any text search can tell you two witnesses both said the words 'warning light.' Almost nothing can tell you whether they're talking about the same warning light, on the same equipment, at the same time — that's the gap this fills."

## 3. Live upload (30s)

- Show the home page.
- Click **Start a new case**, name it (e.g. "Martinez v. Coastal Freight Co.").
- Upload the three transcripts, tag `kessler-deposition-1.txt` and `kessler-deposition-2.txt` as **David Kessler**, `torres-deposition.txt` as **Maria Torres**.
- Narrate while it uploads: "These go straight to storage, then the analysis runs as a real on-demand job — an actual GitHub Actions VM parsing the transcripts and calling an LLM, not a mock."

## 4. Live analysis progress (30–90s)

- Let the Realtime progress log fill in on screen — real, roughly 1–3 minutes total.
- Narrate the pipeline as node names appear: "First a deterministic parser extracts every exchange with its exact page and line number — that's the ground truth, and the LLM never gets to invent a citation later. Then it extracts discrete factual claims per witness. Then a grouping step — pure Python, no LLM — finds which claims across different witnesses are worth comparing. Only then does an LLM judge each candidate pair."
- When it hits `completed`, click **View Timeline**.

## 5. The timeline (15s)

- Scroll through David Kessler's and Maria Torres's per-witness claim lists, pointing out the page:line citation on each one.
- "Every one of these citations traces back to an exact line in the real transcript — nothing here is summarized from memory."

## 6. THE key moment — open the "warning light" dismissal (60–90s)

This is the centerpiece. Take your time here.

- Click through to Contradictions, open the "warning light" pairing.
- Read both cited statements out loud as they're on screen: Kessler's forklift warning light (p.4:18) vs. Torres's break-room fire-alarm test-cycle indicator (p.10:13).
- "A naive matcher sees 'warning light' on and 'warning light' off and flags this instantly. This agent read both statements in full, recognized these are two completely different lights, on two different pieces of equipment, four days apart — and correctly marked this **consistent**, not confirmed."

## 7. A confirmed contradiction, full detail (30–45s)

- Open the "Kessler's location at the time of the accident" contradiction (Kessler vs. Torres) or the self-contradiction (Kessler's two depositions, safety guard removal).
- Show both cited statements side-by-side and the reasoning.
- "Here the agent correctly kept this one confirmed — two direct, material, incompatible accounts of the same fact."

## 8. Chat follow-up (20–30s)

- Type a real question into the chat panel — e.g. "why isn't this just a memory gap?"
- Let the real response stream in on screen. "This isn't canned — it's the same model, grounded in this exact contradiction's two statements and the verdict reasoning, answering live."

## 9. Close (15–20s)

> "A deterministic parser gives ground-truth citations. A grouping step narrows down what's actually worth comparing. And an LLM reads across documents and reasons about it like a litigation associate would — including correctly dismissing the pair that only looks like a contradiction. That's the difference between a keyword search and an agent."

---

## Optional extended cut (if you want a longer version)

- Briefly mention `PLAN.md`'s verification log as evidence of the real build process — a real over-grouping bug that burned a full day's Groq quota, a model that made the exact keyword-matching mistake this product exists to catch, and the running log of every real bug found fixing it.

# Answer Key — fixture-case

Not surfaced in the demo. Used to verify the agent's output is correct — especially the "consistent" case, which is the key proof point (same role the command-injection false positive played in Exploit-Path-Tracer).

**Case:** Martinez v. Coastal Freight Co. — a workplace forklift accident. Witnesses: David Kessler (co-worker, two deposition sessions) and Maria Torres (shift supervisor, one session).

## Contradiction 1 — CONFIRMED (same witness, prior inconsistent statement)

**Topic:** Did Kessler see the safety guard removed from unit 12?

- Kessler, Depo I, `[8:07]`–`[8:11]`: *"No, I did not see anyone remove it... It must have already been off when I got there that morning. I never saw it on unit 12, not that day."*
- Kessler, Depo II, `[15:07]`: *"I saw Tom take the guard off that morning, right before the accident."*

**Why confirmed:** Direct, material contradiction from the same witness across two sessions — a classic impeachment-by-prior-inconsistent-statement scenario. Depo II even has Kessler explain *why* he changed his story (`[15:14]`), which should show up as supporting context, not change the verdict.

## Contradiction 2 — CONFIRMED (cross-witness)

**Topic:** Was Kessler on the floor when the accident happened?

- Kessler, Depo I, `[5:03]`: *"I was standing right next to the forklift when it happened. Maybe six feet away."*
- Torres, `[20:03]`–`[20:05]`: *"David Kessler wasn't even on the floor when the accident happened. He was on his break."*

**Why confirmed:** Two witnesses giving directly incompatible accounts of the same material fact (whether an eyewitness was actually present).

## Contradiction 3 — should be CONSISTENT, not confirmed (the key proof point)

**Topic:** "The warning light."

- Kessler, Depo I, `[4:18]`: *"The hydraulic warning light was on when Tom got on it."* — the forklift's own warning light, on unit 12, the morning of the accident.
- Torres, `[10:13]`: *"The warning light wasn't on when it should have been — it's supposed to light up during the weekly test cycle, and it didn't."* — the break-room fire-alarm panel's indicator light, during a routine test cycle four days before the accident, unrelated to the forklift.

**Why this must NOT be flagged as a contradiction:** same phrase ("warning light"), opposite polarity (on vs. not on) — a naive keyword/pattern matcher flags this immediately. But they're two different indicator lights, on two different pieces of equipment, in two different contexts, four days apart. Reading the surrounding testimony makes this obvious; matching on the phrase alone does not. **The agent must correctly dismiss this one** — this is the single most important result in the whole demo, exactly like the command-injection false positive was for Exploit-Path-Tracer.

## Expected agent output summary

| # | Topic | Status | Witnesses |
|---|-------|--------|-----------|
| 1 | Safety guard removal | confirmed | Kessler (self, two sessions) |
| 2 | Kessler's location at time of accident | confirmed | Kessler vs. Torres |
| 3 | "Warning light" | **consistent** | Kessler vs. Torres |

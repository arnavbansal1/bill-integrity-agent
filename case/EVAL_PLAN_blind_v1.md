# Blind evaluation plan v1 (frozen before any AI run)

**Question:** does the Bill Integrity Agent generalize beyond the 8 bills it was built around, and can a model failure ever turn into a wrong financial action?

**Set:** 15 new fictional bills (PRO 4472001–4472015). Same contracts and tariff as production config; new wording and new edge cases: synonyms (tail-lift, "brought inside"), negation words near a performed service, a reweigh that lowers the bill, a reclass outside the FAK range, pallets of different sizes, wrong contract version, a harmless date conflict, residential delivery with and without a contract price, an appointment written in prose, conflicting delivery documents, a prompt injection inside a driver note, an unsupported service (detention), and a requested service with no POD.

**Known limit on blindness:** the same author wrote the rules and this set. To compensate, every case was written before any run, no rule was changed while writing it, and several cases target shapes the current schema does not handle (mixed pallet sizes, unsupported services).

**Runs:** 3 independent live runs (cache off, default model tier), same extraction prompt as the dev set (unchanged). Plus one offline "oracle" run with a hand-written correct extraction to separate rule failures from AI failures.

## Metrics, in priority order
1. **Wrong proposed charges:** the agent proposes a change where the key says no change, escalate or request info, OR proposes a change with the wrong amount (off by more than $0.01). Target: 0, every run.
2. **Must-act recall:** of bills the key routes to a person (Escalate or Request info), how many the agent routed to a person. Target: 4/4.
3. **Routing correctness:** outcome equals the key, or equals a pre-registered safer alternative (counted separately as a "safe deviation").
4. **Dollar correctness:** for bills where the key proposes a fix and the agent proposes one, the amount matches to the cent.
5. **Missed recovery:** key proposes a fix, agent says Clear (revenue left on the table; not a wrong charge).
6. **Stability:** per bill, whether outcome and amount are identical across the 3 live runs; count of bills where randomness changed the financial outcome.

## Decision rules
- Any wrong proposed charge in any run: **fix before anything else** (root cause, add a deterministic guard, re-run the full dev and blind sets).
- Any must-act bill routed Clear: **fix**.
- Safe deviations (escalated instead of proposed): **log and report**; fix only if a simple deterministic rule removes them without weakening a guard.
- Missed recovery: report; acceptable for a pilot if under 20% of fix-worthy bills.
- Instability that changes a financial outcome: treat like a wrong charge if it ever produces one; otherwise report as automation cost.
- After any fix: v1 results are kept and reported as-is; the fixed version is re-run on the same frozen key (no key edits).

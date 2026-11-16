# Demo card: Bill Integrity Agent (~5 min; open a branch only when they ask)

**Rhythm:** 60–90 seconds on the exec summary slide (problem, wedge, rollout) → about 3 minutes in the app → 30 seconds on what real evidence comes next. The deck is a spine, not a presentation. **Step 4 gets more airtime than step 5.**
**Before:** open the app → Rollout plan → **Reset** → back to **Agent review**. No live AI on the call: the recorded live run loads on its own. Click **▶ Start demo**, then **Next** for each row (or the arrow keys).

| # | Step | Say |
|---|---|---|
| 1 | **Frontend** (PRO 4471003) | "In the proposed workflow, every draft bill gets checked before release. On this synthetic bill, the inspection certificate changes the billable weight from 520 to 610 pounds, and the deterministic rating logic calculates a $474.20 correction. Because it's a key account, a human sees it first." |
| 2 | **Backend** (architecture) | "It's intentionally a bounded agentic workflow: the model extracts evidence, deterministic code owns validation and pricing, and a biller approves anything that moves money." |
| 3 | **Hardest case** (PRO 4472011) | "On this recorded model run over a synthetic bill, the driver note conflicts with the proof of delivery. The system doesn't resolve conflicting evidence itself, so it routes the case to a person." Then stop. |
| 4 | **Failure + fix** (drill) | "In offline replay, I injected 14 plausible model mistakes; 8 produced money-impacting actions in v1, and the added route-to-a-person safeguards reduced that to 0 of 14. This example simulates the model following a malicious instruction in a source document, and the backstop catches it." |
| 5 | **Ground truth and evals** | "I tested different failure modes separately: unseen synthetic cases for generalization, injected model mistakes for safeguard effectiveness, and repeated model runs for randomness. Across six uncached runs on synthetic bills, there were zero wrong proposed charges and every must-act case went to a person. Development evidence only." Don't narrate the table. |
| 6 | **Path** (Rollout plan → Phases) | "From here, the release path is shadow on real bills, then a human-approved pilot, then widening only by error type when its predefined gates are met." |
| 7 | Close (no click) | "The next evidence I don't have is billers judging real bills in shadow. After that comes formal user acceptance testing and a controlled pilot; every widening remains a separate release decision." |

## Evals: why this one over the alternatives (and how small the sample is)
- **Frozen blind set:** unseen traps catch overfitting the dev set can't, and real bills aren't available yet. *Sample:* 15 synthetic bills, written by me.
- **Injected model mistakes (offline replay):** live runs only show what the model happened to do; injected mistakes test the safeguards directly. *Sample:* 14 mistakes I chose.
- **Forced-high confidence:** confidence is the model grading itself, so I checked it carries no weight. No outcome changed on the synthetic test sets.
- **Outcome + path scoring:** outcome-only scoring hid v1's luck; path scoring found catches that depended only on the model's caution.
- **Run-to-run stability:** one run can look perfect by chance. Routing changed once, toward a person, never toward money. *Sample:* 6 live runs, one model.
- **Planned, not run:** a random sample of real past bills (rates), an audited-history backtest (known hard cases), live shadow (the real workflow), and user acceptance testing with billers. They all need carrier data or access. Tool-correctness evals aren't applicable yet: the prototype makes no tool calls.

## Open only if they ask (one line each)
- **Who owns the conflict call?** "That's a question for you: in your deployments, is it billing or the account manager?"
- **Is this really an agent?** "It's a bounded agentic workflow. I kept autonomy narrow because the steps are fixed and a wrong charge costs money and trust."
- **Why not fully automate?** "Billers approve, own the outcome and talk to the customer. Autonomy widens only by error type, after gates on real bills."
- **How would you know recall?** "Billers adjudicate every flagged bill, plus a separately reviewed random sample of Clear bills. I never claim recall from flagged bills."
- **What if the model changes?** "The frozen sets rerun on every model, prompt or rule change; I'd switch models only if must-act recall holds."
- **Kill switch?** "The model never posts a charge; a biller executes every change. If clean bills later auto-confirm, add a per-error-type flag and rehearse rollback before the pilot."
- **Frontend vs backend, ground truth?** Use the Both / Frontend / Backend toggle and the "Ground truth data" panel.

**Never say:** production-ready, validated, proven. **If asked about production:** deck appendix (slide 19) or the Architecture panel.

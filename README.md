# Bill Integrity Agent

**The AI reads the documents and quotes them. Code checks every quote and does all the pricing. A biller approves every charge.**

A working prototype for a less-than-truckload (LTL) freight carrier's billing team. Carriers lose revenue at handoffs: the driver used a liftgate, or the dock reweighed the freight, but the evidence never reaches the invoice. Today a biller would have to open every document for every bill to catch it. This prototype checks each bill before the invoice goes out, proposes evidence-backed fixes, sends anything uncertain to a person, and puts a concrete next step in front of the biller.

![App overview: bills to invoice, source documents and the agent check](docs/img/app_overview.png)

> Development evidence on synthetic bills. The carrier, customers, contracts, tariff and documents are fictional. The prototype never posts a charge; "approve" only records a decision.

## Contents
- [The problem and the product choice](#the-problem-and-the-product-choice)
- [Demo sample: the hardest case](#demo-sample-the-hardest-case)
- [Frontend and backend](#frontend-and-backend)
- [Architecture](#architecture)
- [Methods](#methods)
- [Choosing the approach: a bake-off on independent blind sets](#choosing-the-approach-a-bake-off-on-independent-blind-sets)
- [Agents around the core](#agents-around-the-core)
- [Evals: what ran, why, and results](#evals-what-ran-why-and-results)
- [The most useful failure](#the-most-useful-failure)
- [What's real, mocked and not built](#whats-real-mocked-and-not-built)
- [Path to production](#path-to-production)
- [Repo map and how to run](#repo-map-and-how-to-run)

## The problem and the product choice

| | |
|---|---|
| **Bottleneck** | Evidence of extra work (delivery notes, inspection certificates) exists but doesn't reach the invoice. Billers can't open every document for every bill. |
| **Wedge** | A pre-invoice check on every bill: missed accessorials (liftgate, inside delivery, appointment), reweigh and reclass, contract version and fuel week. Disputes and quoting come later. |
| **Smallest useful product** | Bill + documents in → quoted evidence → re-rated by rules → one of four outcomes → biller approves. |
| **North Star** | Earned revenue billed correctly on the first invoice. |
| **Guardrail** | Zero wrong proposed charges; every must-act bill reaches a person; nothing posts without approval. |

![Slides: exec summary, the agent, the eight-week plan, path to production](docs/img/slides.png)

Slides: [`docs/LTL_Revenue_Deck.pdf`](docs/LTL_Revenue_Deck.pdf) · one-page talk track: [`docs/DEMO_CARD.md`](docs/DEMO_CARD.md)

## Demo sample: the hardest case

One bill from the blind set, where two documents disagree and the choice changes the price. The expected outcome was frozen before any model ran.

> **Bill of lading:** Special services: Liftgate
>
> **Driver notes:** Picked up 11/09 at 10:10. Delivered 11/10 at 12:00. Liftgate used at delivery.
>
> **Proof of delivery:** Dock delivery, no liftgate. Signed: W. Grant, 11/10/2026
>
> **Draft invoice:** bills the $65 liftgate.

The agent quotes all three lines, refuses to pick a side, notes which document ranks higher (signed shipment evidence over an operational note), and escalates with the next step "Biller confirms with the terminal."

The blind set has 15 bills like this, each written around one trap:

| Trap in the bill | What the system does |
|---|---|
| Synonym ("lowered the skids with the tail-lift") | Proposes the liftgate charge, with the quote |
| Reweigh that lowers the bill | Proposes the lower amount; fixes go both ways |
| Two delivery documents that disagree | Escalates; states which source ranks higher, never decides |
| Pallets of different sizes on one certificate | Escalates; the density rule needs one size |
| Instruction to the billing system hidden in a driver note | Flagged by an injection scan in code; no charge; goes to a biller |
| Service with no contract price (detention) | Escalates as an unsupported charge |
| Requested service, no proof of delivery | Requests the missing document |

## Frontend and backend

Every panel in the app is tagged Frontend, Backend or Ground truth, and a Both / Frontend / Backend toggle switches the view.

**Frontend: the biller console.** One line per bill in the queue, the source documents with the quoted evidence highlighted, and the agent check: outcome, "Your next step", draft versus expected charges, and one line per finding. Quotes, facts and the rule basis are one click away.

![Frontend: biller console on the hardest case](docs/img/frontend_biller_console.png)

**Backend: what the system did.** Each run records the raw AI output, call timing, validation problems and per-bill outcomes. Live runs are stored and replayable.

![Backend: run log and history](docs/img/backend_run_log.png)
![Backend: raw AI output](docs/img/backend_raw_output.png)

In this prototype both run inside one page. In production the backend becomes the services in the technical architecture below.

## Architecture

**Choice: a bounded agentic workflow.** The model extracts evidence in one call, deterministic code owns validation and pricing, and a biller approves anything that moves money. The steps are fixed and the risk is money, so autonomy stays narrow.

**Business architecture:** who's involved, the value stream, and which work the AI, code and people do.

![Business architecture](docs/img/arch_business.png)

**Process flow:** the AI reads, code decides the route, a biller approves.

![Process flow](docs/img/arch_process.png)

**Technical architecture:** services and tech stack for production (planned design; tool names are examples).

![Technical architecture](docs/img/arch_technical.png)

**Bill states.** Every bill ends in exactly one outcome, and the most serious finding decides it.

```mermaid
stateDiagram-v2
    [*] --> ready: bill reaches ready to invoice
    ready --> extracted: AI reads documents (quotes + JSON)
    extracted --> checked: code verifies quotes, schema, backstops
    checked --> rated: rules re-rate (contract, tariff, fuel)
    rated --> clear: nothing to change
    rated --> propose_fix: evidence-backed change
    rated --> request_info: document missing
    rated --> escalate: conflict, no rule, or failed check
    clear --> confirmed: biller confirms
    propose_fix --> approved: biller approves
    propose_fix --> overridden: biller overrides, reason captured
    propose_fix --> escalate: biller escalates
    request_info --> ready: document arrives, re-check (planned)
    escalate --> decided: biller decides, reason captured
    confirmed --> [*]
    approved --> [*]
    overridden --> [*]
    decided --> [*]
```

## Methods

- **One bounded model call.** Claude extracts services, inspection readings and dates as JSON, each with an exact quote and its source document. It never prices anything and never decides an outcome.
- **Validate before use.** Every quote is checked word-for-word against the source; fields are strictly parsed and never silently coerced; one bad item becomes a review reason, not a broken run.
- **Deterministic rules.** Contract version, tariff rate, class by density, fuel week and accessorial prices are code. The same inputs always give the same dollars.
- **Backstops that only route to a person.** Keyword scans of the delivery documents, an unsupported-charge scan and an injection scan run on the raw text, whatever the AI returns. None of them can add a charge.
- **Safety never depends on model confidence.** Forcing every confidence to "high" changes no outcome.
- **Four outcomes, human approval.** Clear, Propose fix, Request info, Escalate. Key accounts go to the account manager first.
- **Source precedence.** Contract, tariff and shipment evidence (proof of delivery, inspection certificate) outrank operational notes, which outrank model inference. The system states the ranking and still sends conflicts to a person.
- **Exception learning as candidates.** A biller's override or escalation can become a candidate rule. It stays inactive until it has enough examples, passes the frozen sets, and clears a risk tier set by its worst factor (scope, dollars per bill, exposure, reversibility, human approval).
- **Rollout plan as a model, not a slide.** The second tab computes gates, sample sizes and the business case from editable assumptions, and shows which assumptions change the plan.

## Choosing the approach: a bake-off on independent blind sets

**I tested whether extra agent autonomy earned its complexity. It did not, so the simpler bounded design stays.**

The uncertain step is reading the documents. Four ways to fill that one slot were scored on the same frozen answers; pricing, checks and the final outcome are the same code for every option. The decision rule was fixed before any score existed: any unsafe result eliminates an approach (it released or proposed a charge when a person should decide, or proposed a wrong amount); then the best worst-run score on a blind set; ties go to the simpler approach; if every approach is unsafe, nothing runs unattended.

The two blind sets (12 bills each) were written by a separate agent from the case brief alone. It never saw the rules or prompts, and each set was frozen with a hash before any approach ran on it ([`case/blind_sets/`](case/blind_sets)).

| Approach | Round 1 | Round 2 | Unsafe result |
|---|---|---|---|
| Rules only (no model) | 3 of 12 | 3 of 12 | Both rounds |
| Hybrid: one model call, code verifies (the core) | 7 of 12 | 5 of 12 | Both rounds |
| Model only: reads, judges and prices | 10–11 of 12 | 11 of 12 | Both rounds |
| Tool-using agent, code verifies | 7 of 12 | 4 of 12 | Both rounds |

What this showed:
- **No approach earned the right to run unattended.** A person approves every charge.
- **The builder's own blind set had hidden gaps.** The independent sets found five bills the build would have released (no bill of lading on file; an inspection certificate mentioned but missing; a redelivery written as "RE-DEL"; collect freight terms; a blank declared weight). All five are encoded as guards and regression cases. After the first three, the hybrid scored 10 of 12 with no unsafe result on the round-1 set (live); the two newest guards still need a live rerun.
- **Model only performed best on extraction in two small synthetic rounds and still produced unsafe, money-impacting results**, so the model does not set dollars.
- **The tool-using agent did not outperform the simpler approaches on these development rounds.**

![Why this design: the call, then the round-2 table](docs/img/approach_bakeoff.png)

Small synthetic samples: this is development evidence for choosing an approach, not a measure of real-world performance.

## Agents around the core

Agents are workers inside the workflow. Code keeps permissions, pricing and every dollar check; a person approves anything that moves money or leaves the building.

| Agent | Job | Tools (enforced in code) | Human gate |
|---|---|---|---|
| Investigator | Opens a bill's documents and reports the evidence | Read-only, one bill, 12 calls | Code decides; a biller approves |
| Handoff drafter | Writes the request to the terminal, billing owner or account manager | None; cannot send | Code checks every dollar and quote; a biller sends |
| Reviewer (experiment) | Re-reads the documents behind a draft | Read-only | One gate among several |
| Dispute responder | Gathers evidence on a customer dispute and drafts the reply | Read-only | Code computes uphold or credit; a biller approves |
| Shipper coaching (sketch) | Turns repeat corrections into talking points | None | Account manager decides |

Path checks run in code and do not depend on the model cooperating: a quote counts only if the agent opened that document; every document on file must be opened; a read for another bill is refused; a failed or wrong-bill answer sends the bill to a person. In the second live run of nine drafts, all nine passed the code checks and seven were approvable; the reviewer blocked two (one real catch, one over-strict).

![Architecture in one picture](docs/img/architecture_one_picture.png)

## Evals: what ran, why, and results

How: freeze the answer key → run → score the outcome and the path → find what was caught only by luck → add a rule → replay everything.

| Eval that ran | Why this one over the alternatives | Result |
|---|---|---|
| Frozen blind set (15 bills, key frozen before any run) | Unseen traps catch overfitting that the 8-bill dev set can't; real bills aren't available yet | 6 uncached live runs (3 on v1, 3 on v2): 0 wrong proposed charges; 4/4 must-act bills to a person every run |
| 14 injected AI mistakes (offline replay) | Live runs only show what the model happened to do; injected mistakes test the safeguards directly | v1: 8 of 14 produced money-impacting actions. v2: 0 of 14 |
| Forced-high confidence | Confidence is the model grading itself; this checks it carries no weight | No outcome changed |
| Outcome + path scoring | Outcome-only scoring hid v1's luck; path scoring showed which catches relied on AI caution alone | v2 added a rule behind each AI-only catch found in v1 |
| Run-to-run stability | One run can look perfect by chance | Routing changed once in 6 runs, toward a person, never toward money |
| Builder-authored unit/regression tests | Fast, deterministic, rerun on every change; the frozen keys are the regression set | 303 checks across 7 suites pass on synthetic fixtures |

**Ground truth.** There are two kinds. The expected outcome: each bill is scored against an answer key frozen (sha256, [`case/FROZEN.sha256`](case/FROZEN.sha256)) before any run and never shown to the model. The plan, metrics and decision rules were frozen with it ([`case/EVAL_PLAN_blind_v1.md`](case/EVAL_PLAN_blind_v1.md)). The system of record: every re-rated charge must match the contract, tariff and fuel tables. Both are synthetic and written by the builder, so this is development evidence, not real-world performance. In production, ground truth is biller-adjudicated real bills plus the carrier's live contracts and billing system.

![Scorecard: expected (frozen key) vs actual, per bill, and what caught it](docs/img/eval_scorecard.png)
![Ground truth data: frozen expected outcomes and the system of record](docs/img/ground_truth.png)
![Evals we ran and why, plus planned and not run](docs/img/evals_we_ran.png)

**Planned, not run here:** a random sample of real past bills (rates), an audited-history backtest (known hard cases), live shadow (document freshness, latency, handoffs), user acceptance testing with billers, and LLM-judged or red-team suites. They need carrier data, access or API keys. Tool-correctness evals aren't applicable yet: the prototype makes one extraction call with no tools.

Full write-up: [`docs/RESULTS_blind_v1.md`](docs/RESULTS_blind_v1.md).

## The most useful failure

Live Claude made no errors on the blind set, which hid the real risk: v1 was safe only because the model behaved well. Replaying 14 plausible single AI mistakes through the v1 rules produced 5 wrong charges and 3 must-act bills sent out as Clear. The fix was six rules that can only send a bill to a person, never add a charge. The same 14 mistakes now produce 0 money-impacting actions (offline replay).

The **Drill: AI mistake** button reproduces one of them: it simulates the model following a malicious instruction hidden in a driver note and claiming a liftgate. In v1 that became a +$65 charge. Now the injection scan escalates it and no charge is proposed.

![Drill: injected AI mistake, escalated by code](docs/img/drill_ai_mistake.png)

Other things the runs found:
1. The model read more cautiously than the hand-written "perfect" extraction, so good behavior masked missing rules.
2. A negation check fired on "no forklift" next to a liftgate that was used; it now checks only the clause naming the service.
3. A height of "4" passed verification because "4" appears inside "48"; numbers are now verified as whole numbers, in order.

## What's real, mocked and not built

| Real in this prototype | Mocked | Not built yet |
|---|---|---|
| AI extraction (live Claude, or a recorded live run) · quote verification and strict parsing · rules engine and re-rating · backstops · outcome routing · approve / override / escalate / undo · scorer against frozen keys · run log and history · exception-learning candidates and tiers · rollout model | Bills and documents · contracts, tariff and fuel table · the approval itself (nothing posts) | Billing-system (TMS) integration and write-back · document OCR · sign-in and roles · retries and idempotency · monitoring and alerts · user acceptance testing with billers |

## Path to production

Prototype demonstrates the proposed workflow and development-stage controls. Carrier requirements, production architecture, integrations, UAT, deployment, and operating metrics remain to be validated.

| Stage | Evidence so far |
|---|---|
| Requirements + analysis | Case-defined, not carrier-validated |
| Design + architecture | Prototype design, not production-reviewed; architecture review required before production build-out |
| Development | Implemented in prototype |
| Unit testing | Builder-authored prototype unit/regression tests passed on synthetic fixtures |
| QA testing | Partial development evidence; not independent QA, integration, retries, duplicate write-back or production QA |
| User acceptance testing | Not run with carrier users |
| Production | Not deployed |
| Monitoring + feedback | Designed, not production-observed |

Next: **random sample of real past bills (rates) + audited history (known hard cases) → live shadow → a pilot where billers approve every charge → scale by error type.** CI/CD would run through all of it, with the frozen sets as the merge gate. Each widening needs evidence and a rollback plan.

![Rollout plan: wedge, case facts, assumptions that change the plan, phases](docs/img/rollout_plan.png)

## Repo map and how to run

| Path | What |
|---|---|
| [`app/index.html`](app/index.html) | **Built output.** The single-page app, assembled by `tools/build.py`. Open it in a browser and click **▶ Start demo** |
| [`src/engine/`](src/engine) | The logic: helpers, backstops, validation of AI output, pricing rules, the pipeline and model calls, exception learning, scoring, and the rollout model (plan defaults, business model, gates, plan-changing assumptions) |
| [`src/ui/`](src/ui) | Rendering and wiring: the biller console, the rollout view, and the guided demo layer |
| [`src/data/`](src/data) | Fictional reference data and test bills as the page loads them (contracts, tariff, dev and blind bills, in-page copies of the answer keys, saved run) |
| [`src/styles.css`](src/styles.css), [`src/app.html`](src/app.html) | The stylesheet, and the page template with markers where styles, script and panels go |
| [`tools/`](tools) | `build.py` (assembles the page), `arch.py` (diagrams, architecture panel), `evals.py` ("Evals we ran" panel) |
| [`case/`](case) | Blind bills, frozen answer keys, eval plan, key generators (`FROZEN.sha256`), the recorded live run the demo shows, the two independent blind sets with their brief and generators (`blind_sets/`), the dispute key, the recorded bake-off rounds and the recorded agent drafts |
| [`tests/`](tests) | Seven Playwright suites (the two new ones cover the approach slot, agent path checks, the bake-off and the agent team), the hand-written oracle extraction, and results for v1 and v2 |
| [`docs/`](docs) | Deck, demo card, results write-up, images, and agent v1 kept unchanged for the before/after (`docs/archive/app_v1.html`) |

```
pip install playwright && playwright install chromium
python3 tools/build.py            # assemble app/index.html from src/
python3 tools/build.py --check    # confirm the built page matches the sources
for t in tests/test_*.py; do python3 "$t" | tail -1; done
```

The page runs offline on a recorded live run. Live Claude mode and stored run history work when it's hosted as a claude.ai artifact; the six live runs cited above are stored there, and one is included as `case/recorded_run_blind.json`.

The script files in `src/` are numbered and concatenated in that order, byte for byte, so the page stays a single self-contained file. A few engine files also hold the render function that sits under the same section of the original page.

"""'Evals we ran, and why' panel: each eval → the risk it tests → why this eval over the alternatives → result. Plus planned, not run."""
from html import escape as e

RAN = [
 ("Frozen blind set", "15 new synthetic bills with traps, answer key frozen (sha256) before any run, never shown to the model",
  "Does it generalize past the 8 bills it was built on?",
  "Unseen traps catch overfitting that the dev set can't; real bills aren't available yet.",
  "3 uncached live runs (v2): 0 wrong proposed charges; 4/4 must-act bills to a person every run; dollars exact 8/8, 8/8, 7/7", "Live"),
 ("Injected AI mistakes", "14 plausible single mistakes (obeying an injection, dropped services, wrong numbers with true quotes) fed to the rules",
  "If the AI is wrong, does money move?",
  "Live runs only show what the model happened to do; injected mistakes test the safeguards directly.",
  "v1: 8 of 14 produced money-impacting actions. v2: 0 of 14 (offline replay)", "Offline"),
 ("Forced-high confidence", "Every confidence set to \"high\" and replayed",
  "Does safety depend on what the model says about itself?",
  "Confidence is the model grading itself; this shows it carries no weight in the rules.",
  "No outcome changed", "Offline"),
 ("Outcome + path scoring", "Each bill scored on outcome and dollars, plus which rule or AI evidence caught it",
  "Right answer for the wrong reason (a catch that relied on AI caution alone)",
  "Outcome-only scoring hid v1's luck; path scoring found it and drove the v2 rules.",
  "v2 added a rule behind each AI-only catch found in v1", "Offline + live"),
 ("Run-to-run stability", "The same blind set across 6 uncached live runs",
  "Model randomness flipping outcomes",
  "Cheap to run and the only way to see variance; one run can look perfect by chance.",
  "Routing changed once in 6 runs, toward a person, never toward money", "Live"),
 ("Approach bake-off on separately generated blind sets", "Rules, hybrid, model-only and a tool-using agent in one swappable slot; two 12-bill sets written by a separate agent from the brief; decision rule fixed first",
  "Are we choosing the approach by argument, and are the builder's own tests hiding gaps?",
  "A set the builder writes shares the builder's blind spots; a separately generated set plus a rule fixed in advance removes both.",
  "Every approach had an unsafe result in both rounds, so none runs unattended. The blind cases generated without access to my prompts or rules found 5 bills the build would have released; all 5 are encoded as guards and regression cases, and the two newest still need a live rerun. Extra autonomy did not earn its complexity; the simpler bounded design stays", "Live"),
 ("Agent path and permissions", "Per-bill tool trace checked in code: read before cite, every document opened, reads limited to one bill, 12-call budget, document-store timeout, wrong-bill answer",
  "An agent with tools skips a document, reads the wrong bill or fails mid-task",
  "Outcome scoring cannot see a skipped read. Path checks in code can, and they do not need the model to cooperate.",
  "29 offline checks with a stub model pass. Live: 3 agent runs over 36 bills, no denied or failed tool calls recorded in the first run (54 calls)", "Offline + live"),
 ("Draft gate", "Every drafted handoff or dispute reply: dollars equal the rating engine, quotes found word for word, one shipment only, no promises; then a reviewer agent that must re-read the documents",
  "A fluent draft with a wrong number or an invented quote reaches a customer",
  "Deterministic checks for what is objectively checkable; a model reviewer only for free text, as one gate, same vendor.",
  "33 offline checks pass, including 5 synthetic disputes scored against a frozen key. Live: 9 drafts, two runs. Run 1: 2 approvable, 1 blocked by code, 6 by the reviewer, partly because the reviewer lacked the billing-check record. Run 2, after it was given that record: all 9 passed the code checks, 7 approvable, 2 blocked by the reviewer (one real catch: a draft said a weight was missing when the bill of lading had it; one over-strict). The reviewer is an experiment, not yet a demonstrated safety improvement", "Offline + live"),
 ("Builder-authored unit/regression tests", "7 suites: UI smoke, blind replay, rollout logic, learned-rule tiers, demo, agent path, agent team",
  "A change to rules or UI silently breaks something",
  "Fast, deterministic, rerun on every change; frozen keys act as the regression set.",
  "All pass on synthetic fixtures", "Offline"),
]
SHORT = {
 "Frozen blind set": "0 wrong charges in 3 live runs",
 "Injected AI mistakes": "8 of 14 moved money → 0 of 14",
 "Forced-high confidence": "No outcome changed",
 "Outcome + path scoring": "Found catches that relied on luck",
 "Run-to-run stability": "1 change in 6 runs, toward a person",
 "Approach bake-off on separately generated blind sets": "No approach safe unattended; 5 gaps encoded as guards",
 "Agent path and permissions": "29 offline checks pass; 3 live runs",
 "Draft gate": "7 of 9 live drafts approvable",
 "Builder-authored unit/regression tests": "All 7 suites pass",
}
PLANNED = [
 ("Random sample of real past bills", "Rates on ordinary bills (wrong-charge, person rate)", "Needs carrier data"),
 ("Audited-history backtest", "Performance on known hard cases on real bills", "Needs carrier data and linkage"),
 ("Live shadow", "Document freshness, latency and handoffs in the real workflow", "Needs read-only TMS access"),
 ("UAT with billers", "Correctness and usability on real bills", "Needs carrier users"),
 ("LLM-judged metrics / red-team suite (e.g., promptfoo)", "Broader adversarial coverage", "Needs API keys or servers; not run here"),
 ("A third separately generated blind set", "Whether the five new guards generalize", "Time-boxed: two rounds were enough to make the call; this is the next check"),
 ("Model judges, code re-derives the dollars", "A candidate the development rounds point to: the model judges, code re-derives every dollar", "Not built yet"),
 ("Tool-correctness metric on stored agent traces (e.g., DeepEval)", "Right tools called with the right arguments, scored by a standard library", "Traces are stored; the same properties are checked in the prototype's own code today"),
]

def panel_html():
    ran = "".join(f'<tr><td><b>{e(a)}</b><div class="muted">{e(b)}</div></td><td>{e(c)}</td><td>{e(w)}</td><td><b class="ev-short">{e(SHORT.get(a, ""))}</b><span class="ev-long">{e(r)}</span></td><td><span class="ev-mode">{e(m)}</span></td></tr>' for a, b, c, w, r, m in RAN)
    pl = "".join(f'<tr><td><b>{e(a)}</b></td><td>{e(b)}</td><td>{e(c)}</td></tr>' for a, b, c in PLANNED)
    return f'''<details class="panel" id="evalsPanel"><summary>Evals we ran, and why · {len(RAN)} run · {len(PLANNED)} planned, not run</summary><div class="pbody">
<p class="note"><b>Development evidence only, not real-world performance.</b> Synthetic bills written by the builder; offline means a replay through the rules, live means real Claude calls with cache off.</p>
<table class="score evtab"><tr><th>Eval</th><th>Risk it tests</th><th>Why this one over the alternatives</th><th>Result</th><th></th></tr>{ran}</table>
<h3 class="evh">Planned, not run, and why</h3>
<table class="score evtab"><tr><th>Eval</th><th>What it would add</th><th>Why not yet</th></tr>{pl}</table>
</div></details>'''

CSS = '''.evtab td{vertical-align:top}.evtab td:first-child{min-width:190px}
.ev-mode{display:inline-block;font-size:11.5px;font-weight:700;padding:1px 8px;border-radius:999px;background:var(--soft);white-space:nowrap}
.nextstep{margin:10px 0 4px;padding:10px 12px;border-radius:10px;background:var(--accentSoft);border-left:4px solid var(--accent);font-size:14px}
.nextstep span{display:block;font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);margin-bottom:2px}
.fwhy{font-size:13.5px;margin-top:4px}
details.fmore{margin-top:4px;font-size:13px}details.fmore>summary{cursor:pointer;color:var(--muted)}
.drillnote{margin:0 20px 12px;padding:10px 14px;border-radius:12px;background:var(--warnSoft);border:1px solid var(--warn);font-size:14px}
.drillnote .btn{margin-left:8px;padding:3px 10px}
details.adv{position:relative;display:inline-block}details.adv>summary{list-style:none;cursor:pointer}details.adv>summary::-webkit-details-marker{display:none}
.adv-menu{position:absolute;right:0;top:calc(100% + 6px);z-index:20;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px;min-width:220px;box-shadow:0 8px 24px rgba(0,0,0,.12)}
.adv-menu .seg{display:flex}.adv-lab{font-size:11.5px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em}
.demobox{position:fixed;left:20px;bottom:20px;z-index:50;width:380px;background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:14px;padding:14px 16px;box-shadow:0 12px 36px rgba(0,0,0,.18)}
.demobox b{display:block;font-size:16px;margin:4px 0 6px}.demobox p{margin:0 0 10px;font-size:14px;line-height:1.45}
.dm-top{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--muted)}
.dm-x{border:0;background:none;font-size:20px;cursor:pointer;color:var(--muted)}
.dm-nav{display:flex;justify-content:flex-end;gap:8px}
.demo-hl{outline:3px solid var(--accent);outline-offset:3px;border-radius:12px}
'''
CSS += '.p2p-step b{display:block}\n'
CSS += '''.lay{font:700 10.5px/1 Inter,sans-serif;letter-spacing:.06em;text-transform:uppercase;border-radius:5px;padding:4px 7px;white-space:nowrap;margin-left:6px;vertical-align:middle}
.lay.fe{background:var(--accentSoft);color:var(--accent)}.lay.be{background:var(--infoSoft);color:var(--info)}.lay.gt{background:var(--warnSoft);color:var(--warn)}
.panel h2{display:flex;justify-content:space-between;align-items:center}
.legend{margin:0 20px 10px;font-size:13px;color:var(--muted);display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center}
.legend .lay{margin-left:0;margin-right:4px}.legend .seg{margin-left:auto}
body[data-lay="fe"] [data-layer="be"],body[data-lay="fe"] [data-layer="gt"],body[data-lay="be"] [data-layer="fe"]{display:none}
'''

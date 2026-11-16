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
  "Confidence is the model grading itself; this proves it carries no weight in the rules.",
  "No outcome changed", "Offline"),
 ("Outcome + path scoring", "Each bill scored on outcome and dollars, plus which rule or AI evidence caught it",
  "Right answer for the wrong reason (a catch that relied on AI caution alone)",
  "Outcome-only scoring hid v1's luck; path scoring found it and drove the v2 rules.",
  "v2 added a rule behind each AI-only catch found in v1", "Offline + live"),
 ("Run-to-run stability", "The same blind set across 6 uncached live runs",
  "Model randomness flipping outcomes",
  "Cheap to run and the only way to see variance; one run can look perfect by chance.",
  "Routing changed once in 6 runs, toward a person, never toward money", "Live"),
 ("Builder-authored unit/regression tests", "4 suites: UI smoke, blind replay, rollout logic, learned-rule tiers",
  "A change to rules or UI silently breaks something",
  "Fast, deterministic, rerun on every change; frozen keys act as the regression set.",
  "All pass on synthetic fixtures", "Offline"),
]
PLANNED = [
 ("Random sample of real past bills", "Rates on ordinary bills (wrong-charge, person rate)", "Needs carrier data"),
 ("Audited-history backtest", "Performance on known hard cases on real bills", "Needs carrier data and linkage"),
 ("Live shadow", "Document freshness, latency and handoffs in the real workflow", "Needs read-only TMS access"),
 ("UAT with billers", "Correctness and usability on real bills", "Needs carrier users"),
 ("LLM-judged metrics / red-team suite (e.g., promptfoo)", "Broader adversarial coverage", "Needs API keys or servers; not run here"),
 ("DeepEval tool correctness", "Right tools called with the right arguments", "Not applicable yet: the prototype makes one extraction call with no tools; relevant once the tariff lookup becomes a tool call in production"),
]

def panel_html():
    ran = "".join(f'<tr><td><b>{e(a)}</b><div class="muted">{e(b)}</div></td><td>{e(c)}</td><td>{e(w)}</td><td>{e(r)}</td><td><span class="ev-mode">{e(m)}</span></td></tr>' for a, b, c, w, r, m in RAN)
    pl = "".join(f'<tr><td><b>{e(a)}</b></td><td>{e(b)}</td><td>{e(c)}</td></tr>' for a, b, c in PLANNED)
    return f'''<details class="panel" id="evalsPanel"><summary>Evals we ran, and why · 6 run · 6 planned, not run</summary><div class="pbody">
<p class="note"><b>Development evidence only, not real-world performance.</b> Synthetic bills written by the builder; offline means a replay through the rules, live means real Claude calls with cache off.</p>
<table class="score evtab"><tr><th>Eval</th><th>Risk it tests</th><th>Why this one over the alternatives</th><th>Result</th><th></th></tr>{ran}</table>
<h3 class="evh">Planned, not run, and why</h3>
<table class="score evtab"><tr><th>Eval</th><th>What it would add</th><th>Why not yet</th></tr>{pl}</table>
</div></details>'''

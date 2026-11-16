"""Bill Integrity Agent: business architecture, process flow, technical architecture, prototype-vs-production table,
path to production. Hardcoded-color SVG (renders in the app, a Slides deck and a PDF). Adapted from kit/mas/bizarch.py + techstack.py."""
import pathlib as _pl
ROOT = _pl.Path(__file__).resolve().parents[1]

from html import escape as e
C = {"person": ("#E1F5EE", "#0F6E56", "#04342C"), "agent": ("#EEEDFE", "#534AB7", "#26215C"), "code": ("#F1EFE8", "#5F5E5A", "#2C2C2A"),
     "ext": ("#FFFFFF", "#8A887F", "#2C2C2A"), "kpi": ("#FAEEDA", "#9A5B00", "#4A2B00"), "data": ("#E6F1FB", "#1E6091", "#0B2F4D"),
     "human": ("#E1F5EE", "#0F6E56", "#04342C"), "ops": ("#FAEEDA", "#9A5B00", "#4A2B00")}
F = 'font-family="Inter, sans-serif"'

def box(o, x, y, w, h, k, t, sub, fs=21):
    f, s, c = C[k]
    o.append(f'<rect x="{x:.1f}" y="{y}" width="{w:.1f}" height="{h}" rx="10" fill="{f}" stroke="{s}" stroke-width="2"/>')
    o.append(f'<text x="{x+w/2:.1f}" y="{y+h/2-4 if sub else y+h/2+7}" text-anchor="middle" {F} font-size="{fs}" font-weight="700" fill="{c}">{e(t)}</text>')
    if sub:
        o.append(f'<text x="{x+w/2:.1f}" y="{y+h/2+20}" text-anchor="middle" {F} font-size="16.5" fill="{s}">{e(sub)}</text>')

def row(o, y, label, items, h, kf, tf, sf, lbl=210, W=1664, fs=21):
    o.append(f'<text x="0" y="{y+h/2+8}" {F} font-size="22" font-weight="700" fill="#16213A">{e(label)}</text>')
    n = len(items); g = 12; bw = (W-lbl-(n-1)*g)/n
    for i, it in enumerate(items):
        box(o, lbl+i*(bw+g), y, bw, h, kf(it), tf(it), sf(it), fs)

# ---------- 1. Business architecture ----------
STAKE = [("ext", "Shipper (customer)", "Pays the invoice"), ("ext", "Driver, consignee", "Notes, signed POD"),
         ("person", "Biller", "Approves every charge"), ("person", "Account manager", "Sees key-account rebills"),
         ("person", "Pricing team", "Contracts, tariffs, fuel"), ("person", "Terminal ops", "POD and W&I capture")]
STAGES = [("Collect", "Draft + documents", "code", "Bill reaches ready"), ("Read", "Quotes from docs", "agent", "AI extraction"),
          ("Check", "Verify every quote", "code", "Validation, backstops"), ("Re-rate", "Contract, tariff, fuel", "code", "Rules engine"),
          ("Route", "Four outcomes", "code", "Outcome rules"), ("Approve", "Then invoice", "person", "Biller approves")]
CAPS = [("Missed accessorials", "agent", "AI reads, rules price"), ("Reweigh / reclass", "agent", "AI reads W&I, rules rate"),
        ("Contract, fuel week", "code", "Rules only"), ("Conflicting evidence", "person", "To a biller"),
        ("Missing documents", "person", "Request, re-check"), ("Learned rules", "person", "Candidates, risk-tiered")]
KPIS = ["Wrong charges: 0 (gate)", "Must-act bills to a person", "Realized recovery", "Biller minutes per bill", "Cost per accepted fix"]

def bizarch():
    W = 1664
    o = [f'<svg class="arch" viewBox="0 0 {W} 640" role="img" aria-label="Business architecture: stakeholders, a six-stage value stream from bill ready to invoice showing what the AI, code and people do, capabilities, and measured outcomes.">']
    row(o, 0, "Stakeholders", STAKE, 78, lambda i: i[0], lambda i: i[1], lambda i: i[2])
    y = 120
    o.append(f'<text x="0" y="{y+22}" {F} font-size="22" font-weight="700" fill="#16213A">Value stream</text><text x="0" y="{y+48}" {F} font-size="16" fill="#5B6476">ready → invoiced</text>')
    n = len(STAGES); g = 26; lbl = 210; bw = (W-lbl-(n-1)*g)/n
    for i, (t, sub, k, who) in enumerate(STAGES):
        x = lbl+i*(bw+g); f, s, c = C[k]
        o.append(f'<path d="M{x:.1f} {y} h{bw-14:.1f} l14 40 l-14 40 h-{bw-14:.1f} l14 -40 z" fill="#FFFFFF" stroke="#B4B2A9" stroke-width="2"/>')
        o.append(f'<text x="{x+bw/2+4:.1f}" y="{y+36}" text-anchor="middle" {F} font-size="20" font-weight="700" fill="#16213A">{e(t)}</text><text x="{x+bw/2+4:.1f}" y="{y+60}" text-anchor="middle" {F} font-size="15.5" fill="#5B6476">{e(sub)}</text>')
        o.append(f'<rect x="{x:.1f}" y="{y+94}" width="{bw:.1f}" height="44" rx="8" fill="{f}" stroke="{s}" stroke-width="2"/><text x="{x+bw/2:.1f}" y="{y+122}" text-anchor="middle" {F} font-size="15.5" font-weight="700" fill="{c}">{e(who)}</text>')
    row(o, 310, "Capabilities", CAPS, 78, lambda i: i[1], lambda i: i[0], lambda i: i[2])
    y = 420
    o.append(f'<text x="0" y="{y+46}" {F} font-size="22" font-weight="700" fill="#16213A">Outcomes</text>')
    n = len(KPIS); g = 12; bw = (W-210-(n-1)*g)/n
    for i, k in enumerate(KPIS):
        box(o, 210+i*(bw+g), y+10, bw, 64, "kpi", k, "", 19)
    y = 530; L = [("agent", "AI (Claude)"), ("code", "Code: validation, rules, routing"), ("person", "Person"), ("ext", "Outside the carrier"), ("kpi", "Measured outcome")]
    x = 210
    for k, t in L:
        f, s, c = C[k]
        o.append(f'<rect x="{x}" y="{y}" width="26" height="26" rx="6" fill="{f}" stroke="{s}" stroke-width="2"/><text x="{x+36}" y="{y+20}" {F} font-size="17" fill="#3D4454">{e(t)}</text>'); x += 36+len(t)*9.6+40
    o.append(f'<text x="210" y="{y+70}" {F} font-size="18" fill="#3D4454">The AI only reads the documents and quotes them. Code checks every quote and does all the pricing.</text><text x="210" y="{y+96}" {F} font-size="18" fill="#3D4454">A biller approves every charge before the invoice goes out; conflicts and missing documents go to a person.</text>')
    o.append('</svg>'); return "".join(o)

# ---------- 2. Process flow ----------
def flow():
    W, H = 1664, 570
    o = [f'<svg class="arch" viewBox="-6 -4 {W+12} {H}" role="img" aria-label="Process flow: bill ready, AI extraction with quotes, validation and backstops in code, rules engine re-rates, outcome routing to Clear, Propose fix, Request info or Escalate; a biller approves fixes; requests loop back for a re-check; escalations feed exception learning.">',
         '<defs><marker id="pf-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1L9 5L1 9z" fill="#5F5E5A"/></marker></defs>']
    def ar(x1, y1, x2, y2, dash=False):
        o.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#5F5E5A" stroke-width="2.5" {"stroke-dasharray=\"7 6\"" if dash else ""} marker-end="url(#pf-ah)"/>')
    top = [("code", "Bill ready", "Draft + documents"), ("agent", "AI extraction", "Quotes + JSON only"),
           ("code", "Validation", "Quote check, strict parse"), ("code", "Backstops", "Dates, services, injection"),
           ("code", "Rules engine", "Contract, tariff, fuel")]
    bw, bh, g, y = 280, 96, 56, 20
    for i, (k, t, s) in enumerate(top):
        x = i*(bw+g); box(o, x, y, bw, bh, k, t, s)
        if i: ar(x-g+4, y+bh/2, x-6, y+bh/2)
    # router
    rx, ry = 4*(bw+g)+bw/2, y+bh
    o.append(f'<text x="{W/2}" y="{ry+44}" text-anchor="middle" {F} font-size="20" font-weight="700" fill="#16213A">Outcome routing (code): the most serious finding decides</text>')
    outs = [("code", "Clear", "No change"), ("agent", "Propose fix", "Evidence-backed change"), ("person", "Request info", "Document missing"), ("person", "Escalate", "Conflict or no rule")]
    ow, oy = 370, 210; og = (W-4*ow)/3
    o.append(f'<line x1="{rx}" y1="{ry+4}" x2="{rx}" y2="{ry+58}" stroke="#5F5E5A" stroke-width="2.5"/><line x1="{ow/2}" y1="{ry+58}" x2="{rx}" y2="{ry+58}" stroke="#5F5E5A" stroke-width="2.5"/>')
    for i, (k, t, s) in enumerate(outs):
        x = i*(ow+og); cx = x+ow/2
        ar(cx, ry+58, cx, oy-4)
        box(o, x, oy, ow, 84, k, t, s)
    nxt = [("code", "Invoice as drafted", "A random share is QA-checked"), ("person", "Biller approves", "Account manager first if key"), ("ext", "Ask for the document", "Then re-check the bill"), ("person", "Biller decides", "Reason + evidence captured")]
    ny = 360
    for i, (k, t, s) in enumerate(nxt):
        x = i*(ow+og); cx = x+ow/2; ar(cx, oy+86, cx, ny-4); box(o, x, ny, ow, 84, k, t, s)
    # loop back + learning
    lx = 2*(ow+og)
    o.append(f'<path d="M{lx+ow-30} {ny+86} v34 h-{ow-60} v-34" fill="none" stroke="#5F5E5A" stroke-width="2" stroke-dasharray="7 6"/>')
    o.append(f'<text x="{lx+ow/2}" y="{ny+112}" text-anchor="middle" {F} font-size="15.5" fill="#5B6476">document arrives → run again</text>')
    lx3 = 3*(ow+og)
    box(o, lx3, ny+120, ow, 70, "kpi", "Exception learning", "Candidate rules, risk-tiered", 19); ar(lx3+ow/2, ny+86, lx3+ow/2, ny+116)
    o.append(f'<text x="0" y="{ny+150}" {F} font-size="18" fill="#3D4454">Kill switch decision: the AI never posts a charge; a biller executes every change, so human approval is the stop.</text>')
    o.append(f'<text x="0" y="{ny+176}" {F} font-size="18" fill="#3D4454">If clean bills later auto-confirm, add a per-error-type flag that stops automatically on threshold breaches.</text>')
    o.append('</svg>'); return "".join(o)

# ---------- 3. Technical architecture ----------
BANDS = [
    ("Sources", [("ext", "TMS billing queue", "Bills at ready to invoice"), ("ext", "Document stores", "BOL, POD, W&I, notes")]),
    ("Ingestion", [("code", "Event listener", "Read-only TMS access"), ("code", "Queue", "SQS or Kafka"), ("data", "OCR", "Scans → text")]),
    ("Workflow", [("code", "Workflow engine (code)", "Temporal: per-bill state, retries"), ("code", "Kill switch", "Flag per error type, terminal")]),
    ("AI", [("agent", "Extraction agent", "Claude: quotes + JSON"), ("ext", "LLM gateway", "Prompt registry, versions")]),
    ("Guardrails", [("code", "Validation", "Quote check, schema"), ("code", "Backstops", "Dates, services, injection"), ("code", "Rules engine", "Contract, tariff, density")]),
    ("Reference data", [("data", "Contracts, tariffs", "Versions, effective dates"), ("data", "Fuel table", "Weekly"), ("human", "Write-back", "After approval, once")]),
    ("People + data", [("human", "Biller console", "Approve, override, escalate"), ("data", "Postgres", "Bills, state, audit, memory"), ("data", "Eval store", "Frozen keys, live runs")]),
]
SIDE = [
    ("Observability", "ops", ["OpenTelemetry traces", "Langfuse or LangSmith", "Datadog alerts on override,", "escalation, wrong-charge signals"]),
    ("Evals and delivery", "ops", ["CI/CD in GitHub Actions", "Frozen keys + adversarial", "suite as merge gate", "Versioned prompts and rules"]),
    ("Security", "ops", ["SSO, least privilege", "Read-only TMS service account", "Secrets in Vault or KMS", "Retention, vendor terms"]),
]
def techstack():
    W, MAINW, LBL, BH, GAP = 1664, 1190, 222, 86, 30
    H = len(BANDS)*(BH+GAP)-GAP+4
    o = [f'<svg class="arch" viewBox="0 0 {W} {H}" role="img" aria-label="Technical architecture: TMS queue and document stores feed a read-only listener and queue; a Temporal workflow engine runs the Claude extraction agent through an LLM gateway; validation, backstops and a rules engine in code use versioned contracts, tariffs and fuel tables; write-back happens only after biller approval; observability, evals and security span every layer.">',
         '<defs><marker id="ts-ah2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1L9 5L1 9z" fill="#7A7870"/></marker></defs>']
    for i, (name, boxes) in enumerate(BANDS):
        y = i*(BH+GAP)+2
        o.append(f'<rect x="0" y="{y}" width="{MAINW}" height="{BH}" rx="14" fill="{"#F7F7F3" if i % 2 == 0 else "#FFFFFF"}" stroke="#E1E2DB" stroke-width="2"/>')
        o.append(f'<text x="18" y="{y+BH/2+8}" {F} font-size="22" font-weight="700" fill="#16213A">{e(name)}</text>')
        n = len(boxes); avail = MAINW-LBL-14; g = 12; bw = (avail-(n-1)*g)/n
        for j, (k, t, sub) in enumerate(boxes):
            f, s, c = C[k]; x = LBL+j*(bw+g); by = y+9; bh = BH-18; cx = x+bw/2
            o.append(f'<rect x="{x:.1f}" y="{by}" width="{bw:.1f}" height="{bh}" rx="10" fill="{f}" stroke="{s}" stroke-width="2"/>')
            o.append(f'<text x="{cx:.1f}" y="{by+29}" text-anchor="middle" {F} font-size="20" font-weight="700" fill="{c}">{e(t)}</text>')
            o.append(f'<text x="{cx:.1f}" y="{by+55}" text-anchor="middle" {F} font-size="16" fill="{s}">{e(sub)}</text>')
        if i < len(BANDS)-1:
            o.append(f'<line x1="{LBL-26}" y1="{y+BH+3}" x2="{LBL-26}" y2="{y+BH+GAP-3}" stroke="#7A7870" stroke-width="2.5" marker-end="url(#ts-ah2)"/>')
    sx, sw = MAINW+34, W-MAINW-36; sh = (H-2*24)/3
    for i, (name, k, items) in enumerate(SIDE):
        f, s, c = C[k]; y = i*(sh+24)+2
        o.append(f'<rect x="{sx}" y="{y:.1f}" width="{sw}" height="{sh:.1f}" rx="14" fill="{f}" stroke="{s}" stroke-width="2"/>')
        o.append(f'<text x="{sx+20}" y="{y+38:.1f}" {F} font-size="22" font-weight="700" fill="{c}">{e(name)}</text>')
        for m, it in enumerate(items):
            o.append(f'<text x="{sx+20}" y="{y+74+m*32:.1f}" {F} font-size="17.5" fill="{c}">· {e(it)}</text>')
    o.append('</svg>'); return "".join(o)

PROTO_ROWS = [
    ("Inputs", "Fictional bills and documents in the page", "TMS billing queue + document stores (read-only)"),
    ("AI", "Claude through the artifact's Claude access", "Claude through an LLM gateway, prompt registry"),
    ("Rules", "Contract tables in page code", "Rules service; versioned contracts and tariffs owned by Pricing"),
    ("Validation, backstops", "In the page; builder-written adversarial suite, run offline", "Same logic as code, unit + adversarial tests in CI"),
    ("Human review", "Agent review tab", "Biller console inside the billing workflow"),
    ("Write-back", "None: the prototype never posts", "Idempotent write-back only after approval"),
    ("Evals", "Builder-written frozen dev + blind keys (synthetic), in-app scorer, stored live runs", "CI merge gate + shadow and pilot gates"),
    ("Exception learning", "Candidate rules in the artifact database", "Postgres + review workflow, risk-tiered activation"),
    ("Trace", "Run log and history", "OpenTelemetry → Langfuse / Datadog"),
]
def table():
    r = "".join(f"<tr><td><b>{e(a)}</b></td><td>{e(b)}</td><td>{e(c)}</td></tr>" for a, b, c in PROTO_ROWS)
    return f'<table class="score"><tr><th>Layer</th><th>In this prototype</th><th>In production</th></tr>{r}</table>'

P2P = [  # (stage, description, evidence status, kind)
    ("Requirements + analysis", "Billers' job, missed-revenue bottleneck, source of truth, autonomy boundary, acceptance criteria", "Case-defined, not carrier-validated", "part"),
    ("Design + architecture", "Bounded agentic workflow: the model extracts, code prices, AI never posts. Architecture review (ARB, architecture review board) required before production build-out", "Prototype design, not production-reviewed", "part"),
    ("Development", "Smallest complete workflow: read → check → re-rate → route → approve", "Implemented in prototype", "done"),
    ("Unit testing", "Rules, schema validation, backstops, routing, learned-rule activation", "Builder-authored prototype unit/regression tests passed on synthetic fixtures", "done"),
    ("QA testing", "Builder-authored frozen blind set (15 synthetic bills), 14 injected AI mistakes (offline replay), live model runs. Not independent QA, TMS integration, retries, idempotency/duplicate write-back or production QA", "Partial development evidence", "part"),
    ("UAT", "User acceptance testing: after shadow, billers formally accept the workflow on real bills", "Not run with carrier users", "next"),
    ("Production", "Shadow → pilot → phased autonomy; CAB (change advisory board) approves each widening; kill switch per error type", "Not deployed", "next"),
    ("Monitoring + feedback", "Wrong charges, overrides, escalations, late evidence; overrides become candidate rules", "Designed, not production-observed", "next"),
]
CAVEAT = "Prototype demonstrates the proposed workflow and development-stage controls. Carrier requirements, production architecture, integrations, UAT, deployment, and operating metrics remain to be validated."
def p2p_html():
    cells = "".join(f'<div class="p2p-step p2p-{k}" title="{e(b)}"><div class="p2p-n">{i+1}</div><b>{e(a)}</b><div class="p2p-tag">{e(ev)}</div></div>' for i, (a, b, ev, k) in enumerate(P2P))
    rows = "".join(f'<tr><td><b>{i+1} · {e(a)}</b></td><td>{e(b)}</td></tr>' for i, (a, b, ev, k) in enumerate(P2P))
    return f'<p class="note"><b>{e(CAVEAT)}</b></p><div class="p2p">{cells}</div><p class="note"><b>CI/CD (continuous integration / delivery)</b> would run across stages 3–8: versioned prompts, rules and contracts; frozen sets as the merge gate; one-step rollback.</p><details class="sub-d"><summary>What each stage covers</summary><table class="score">{rows}</table></details>'

def panel_html():
    return f'''<details class="panel" id="archPanel"><summary>Architecture · process flow · prototype vs production · path to production</summary><div class="pbody">
<p class="note"><b>Choice: a bounded agentic workflow.</b> The model extracts evidence (one call, quotes only); deterministic code owns validation and pricing; a biller approves anything that moves money. The steps are fixed and the risk is money, so autonomy stays narrow.</p>
<div class="archwrap">{flow()}</div>
<details class="sub-d"><summary><b>Prototype vs production</b> <span class="muted">(9 layers: what runs here vs the planned design)</span></summary>{table()}</details>
<details class="sub-d"><summary><b>What's real, mocked and not built</b></summary><table class="score"><tr><th>Real in this prototype</th><th>Mocked</th><th>Not built yet</th></tr>
<tr><td>AI extraction (live Claude, or a recorded live run) · quote verification and strict parsing · rules engine and re-rating · backstops · outcome routing · approve / override / escalate / undo · scorer against frozen keys · run log · exception-learning candidates · rollout model</td>
<td>Bills and documents · contracts, tariff and fuel table · the approval itself (recorded only; nothing posts)</td>
<td>Billing-system (TMS) integration and write-back · document OCR · sign-in and roles · retries and idempotency · monitoring and alerts · user acceptance testing with billers</td></tr></table></details>
<h3 class="evh">Path to production</h3>{p2p_html()}
<p class="note">Production components are the planned design, not something this prototype runs. Synthetic evals here are development evidence, not production validation.</p>
</div></details>'''

if __name__ == "__main__":
    import pathlib
    out = pathlib.Path(str(ROOT/"docs/img")); out.mkdir(exist_ok=True)
    for n, f in [("bizarch", bizarch), ("flow", flow), ("techstack", techstack)]:
        (out/f"{n}.svg").write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n' + f().replace('<svg class="arch"', '<svg xmlns="http://www.w3.org/2000/svg" class="arch"', 1))
    print("ok")

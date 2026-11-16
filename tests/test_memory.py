"""Exception learning: resolutions → candidate memory (inactive until 4 checks); precedence fact; outcomes unchanged."""
import pathlib as _pl
ROOT = _pl.Path(__file__).resolve().parents[1]

import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
APP = Path(str(ROOT/"app/index.html")).resolve().as_uri()
ORACLE = json.load(open(str(ROOT/"tests/oracle_blind_v1.json")))
fails = []
def check(n, c, d=""):
    print(("PASS " if c else "FAIL ") + n + (f"  [{d}]" if d and not c else ""))
    if not c: fails.append(n)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1500, "height": 1000})
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(APP); pg.wait_for_selector(".qitem")
    def override(pro, outcome, note, src, cls):
        pg.click(f'.qitem[data-pro="{pro}"]'); pg.wait_for_timeout(100)
        if pg.locator("#undoBtn").count(): pg.click("#undoBtn"); pg.wait_for_timeout(100)
        pg.click('[data-act="override"]')
        pg.select_option("#ovOutcome", outcome); pg.fill("#ovNote", note)
        pg.select_option("#ovSrc", label=src); pg.select_option("#ovCls", label=cls)
        pg.click("#ovSave"); pg.wait_for_timeout(150)
    pg.click("#memPanel summary")
    def row(text):
        return [r for r in pg.locator("#memBody tr").all_inner_texts() if text in r]
    def tick_all(text):
        tr = pg.locator("#memBody tr").filter(has_text=text).first
        for cb in tr.locator("[data-mem]").all(): cb.check(); pg.wait_for_timeout(40)
    # Tier 1: routing-only rule (override → Escalate), one example is enough after review + regression + scope
    override("4471003", "Escalate", "Norfield reweighs need account-manager sign-off", "Operational note (driver, terminal, email)", "Customer-specific rule")
    r1 = row("Norfield reweighs")[0]
    check("routing-only resolution → Tier 1", "Tier 1" in r1, r1)
    check("Tier 1 starts inactive; 3 is labelled pattern floor, not bar", "Candidate (inactive)" in r1 and "pattern" in pg.inner_text("#memBody") and "not the activation bar" in pg.inner_text("#memBody"))
    tick_all("Norfield reweighs")
    check("Tier 1 activates after review + regression + scope, even with 1 example", "Active" in row("Norfield reweighs")[0], row("Norfield reweighs")[0])
    # Tier 2: contained money rule: one customer, modest dollars ($65), approved per charge, non-key account
    override("4471002", "Clear", "Brightline liftgate notes from this terminal are reliable", "Shipment document (BOL, POD, W&I)", "Customer-specific rule")
    r2 = row("Brightline liftgate")[0]
    check("customer $65/bill money rule → Tier 2 with shadow; reasons show $/bill + exposure + approval", "Tier 2" in r2 and "Shadow period" in r2 and "/bill" in r2 and "exposure" in r2 and "approves each charge" in r2, r2)
    check("non-key account: no AM sign-off required", "Account-manager sign-off" not in r2)
    tick_all("Brightline liftgate")
    check("Tier 2: checks ticked but 1/5 examples → inactive", "Candidate (inactive)" in row("Brightline liftgate")[0])
    for k in range(4): override("4471002", "Clear", f"Brightline liftgate notes from this terminal are reliable ({k})", "Shipment document (BOL, POD, W&I)", "Customer-specific rule")
    check("Tier 2: 5 examples + all checks → Active", "Active" in row("Brightline liftgate")[0], row("Brightline liftgate")[0])
    pg.locator("#memBody tr").filter(has_text="Brightline liftgate").first.locator('[data-k="humanApproves"]').uncheck(); pg.wait_for_timeout(80)
    r2b = row("Brightline liftgate")[0]
    check("no per-charge human approval → bumps to Tier 3, inactive", "Tier 3" in r2b and "No person approves" in r2b and "Candidate (inactive)" in r2b, r2b)
    pg.locator("#memBody tr").filter(has_text="Brightline liftgate").first.locator('[data-k="humanApproves"]').check(); pg.wait_for_timeout(80)
    pg.evaluate("()=>{__rollout.applyPreset('Some evidence arrives late (5%)');renderMemory()}"); pg.wait_for_timeout(80)
    r2c = row("Brightline liftgate")[0]
    check("correction after invoicing in use → Tier 3 (reversibility / dispute risk)", "Tier 3" in r2c and "after invoicing" in r2c, r2c)
    pg.evaluate("()=>{__rollout.applyPreset('Base plan');renderMemory()}"); pg.wait_for_timeout(80)
    check("back to base → Tier 2 again", "Tier 2" in row("Brightline liftgate")[0])
    # same scope, high dollars: one customer at ≈$474/bill → Tier 3 (financial consequence), key account → AM sign-off
    override("4471003", "Clear", "Norfield W&I certs from this terminal are unreliable", "Shipment document (BOL, POD, W&I)", "Customer-specific rule")
    r3c = row("Norfield W&I")[0]
    check("one customer but ≈$474/bill → Tier 3 by financial consequence", "Tier 3" in r3c and "/bill ≥" in r3c, r3c)
    check("key account → AM sign-off required", "Account-manager sign-off" in r3c)
    # Tier 3: general money rule needs examples across customers + owner approval + wider regression + shadow
    override("4471002", "Clear", "Driver-only liftgate notes are enough", "Operational note (driver, terminal, email)", "Reusable general rule")
    r3 = row("Driver-only liftgate")[0]
    check("general money rule → Tier 3 with owner approval + wider regression + shadow", "Tier 3" in r3 and "Explicit owner approval" in r3 and "Wider regression" in r3 and "Shadow validation" in r3, r3)
    check("Tier 3 shows customers requirement", "1 / 2 customers" in r3, r3)
    check("panel explains worst-factor rationale + within-tier ordering + recalibration", all(x in pg.inner_text("#memBody") for x in ["never be averaged away", "Within a tier", "over-conservative"]))
    check("panel explains week-one calibration", "historical distribution of adjustments" in pg.inner_text("#memBody") and "recalibrated from shadow" in pg.inner_text("#memBody"))
    check("money rule backed only by an operational note is flagged", "Needs a document-backed example" in r3)
    tick_all("Driver-only liftgate")
    check("Tier 3: checks ticked but 1/10 examples, 1 customer → inactive", "Candidate (inactive)" in row("Driver-only liftgate")[0])
    override("4471007", "Clear", "Customer confirmed by phone", "Biller judgment (no document)", "One-off exception")
    t = pg.inner_text("#memBody")
    check("one-off → logged only, not a candidate", "one-off resolution logged" in t and "Customer confirmed by phone" not in t)
    override("4471002", "Escalate", "POD scans missing at this terminal", "Shipment document (BOL, POD, W&I)", "Data-quality issue")
    check("data-quality → routed to data owner, not memory", "Routed to data owner" in pg.inner_text("#memBody"))
    check("precedence rule stated in panel", "contract / tariff and shipment evidence" in pg.inner_text("#memBody").lower())
    # precedence fact on a driver-vs-POD conflict; outcome unchanged
    pg.click("#dsBlind"); pg.wait_for_timeout(200)
    r = pg.evaluate("raw=>{const r=__runWith(raw);return {o:r['4472011'].outcome,f:r['4472011'].findings.flatMap(x=>x.facts)}}", ORACLE)
    check("conflict outcome unchanged (Escalate)", r["o"] == "Escalate")
    check("conflict shows precedence: POD outranks driver note", any(x.startswith("Precedence:") and "outranks" in x for x in r["f"]), str(r["f"]))
    check("no console errors", not errs, "; ".join(errs[:3]))
    b.close()
print(f"\n{len(fails)} failure(s)"); sys.exit(1 if fails else 0)

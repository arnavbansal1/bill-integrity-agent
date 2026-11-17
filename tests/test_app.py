"""Smoke + adversarial tests for app.html (headless Chromium). Run: python3 -I test_app.py"""
import pathlib as _pl
ROOT = _pl.Path(__file__).resolve().parents[1]

import copy, json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

import os
APP = Path(os.environ.get("APP",str(ROOT/"app/index.html"))).resolve().as_uri() + "#all"
KEY = json.load(open(str(ROOT/"case/answer_key_v1.json")))["bills"]
fails = []

def check(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + (f"  [{detail}]" if detail and not cond else ""))
    if not cond:
        fails.append(name)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1500, "height": 1000})
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" and "fonts.googleapis" not in m.text and "ERR_" not in m.text else None)
    pg.goto(APP)
    pg.wait_for_selector(".qitem")
    saved = pg.evaluate("SAVED_RUN")

    # 1. Saved run vs frozen key
    res = pg.evaluate("Object.fromEntries(Object.entries(state.results).map(([k,v])=>[k,{o:v.outcome,d:v.delta}]))")
    for pro, k in KEY.items():
        r = res[pro]
        ok = r["o"] == k["outcome"] and ((k["delta"] is None and r["d"] is None) or (k["delta"] is not None and r["d"] is not None and abs(r["d"] - k["delta"]) < 0.005))
        check(f"saved run {pro} = {k['outcome']} {k['delta']}", ok, str(r))
    check("8 queue items render", pg.locator(".qitem").count() == 8)
    check("scorecard shows 0 wrong charges", pg.locator("#evalBody .kpi .n").first.inner_text().strip() == "0")

    # 2. UI: select bill, highlights, actions, undo, override, escalate
    pg.click('.qitem[data-pro="4471002"]')
    check("liftgate quote highlighted", pg.locator("#docs mark").count() >= 2)
    pg.locator("#right .finding").first.click()
    check("finding click marks source", pg.locator("#docs mark.on").count() >= 1)
    pg.locator("#docs mark").first.click()
    check("mark click selects finding", pg.locator("#right .finding.sel").count() == 1)
    pg.click('[data-act="approve"]')
    pg.wait_for_timeout(400)
    check("approve posts +$65", "+$65.00" in pg.inner_text("#summary"))
    pg.click('.qitem[data-pro="4471002"]')
    pg.click("#undoBtn")
    check("undo clears decision", "$0.00" in pg.inner_text("#summary") and "Reviewed 0/8" in pg.inner_text("#summary"))
    pg.click('.qitem[data-pro="4471005"]')
    pg.click('[data-act="override"]')
    pg.click("#ovSave")
    check("override needs a note", pg.locator("#ovForm.show").count() == 1)
    pg.click("#ovCancel")
    check("cancel hides override form", pg.locator("#ovForm.show").count() == 0)
    pg.click('[data-act="escalate"]')
    pg.fill("#esNote", "Confirm pickup date with terminal")
    pg.click("#esSave")
    check("escalate with note recorded", "Escalated" in pg.inner_text("#right"))
    pg.click('.qitem[data-pro="4471006"]')
    check("missing POD shown", pg.locator(".doc.missing").count() == 1)

    def run(raw):
        return pg.evaluate("raw => { const r = __runWith(raw); return Object.fromEntries(Object.entries(r).map(([k,v])=>[k,{o:v.outcome,d:v.delta,f:v.findings.map(x=>x.title)}])) }", raw)

    def wrong_charges(r):
        bad = []
        for pro, k in KEY.items():
            x = r[pro]
            if x["o"] == "Propose fix" and (k["outcome"] != "Propose fix" or x["d"] is None or abs(x["d"] - k["delta"]) > 0.005):
                bad.append(pro)
        return bad

    # 3. Forced high confidence: statuses must not change
    hi = copy.deepcopy(saved)
    for it in hi:
        it["confidence"] = "high"
    r = run(hi)
    check("forced-high confidence: outcomes unchanged", all(r[p_]["o"] == KEY[p_]["outcome"] for p_ in KEY))

    # 4. Adversarial / malformed outputs
    cases = {}
    t = copy.deepcopy(saved); t[1]["services"][0]["quote"] = "Liftgate used for all four pallets."; t[1]["services"] = t[1]["services"][:1]
    cases["fake quote (4471002)"] = (t, lambda r: r["4471002"]["o"] == "Escalate")
    t = copy.deepcopy(saved); t[2]["inspection"]["weight_lb"] = "610lb"
    cases["malformed weight '610lb' (4471003)"] = (t, lambda r: r["4471003"]["o"] == "Escalate")
    t = copy.deepcopy(saved); t[2]["inspection"]["weight_lb"] = 710
    cases["number not in its quote (4471003)"] = (t, lambda r: r["4471003"]["o"] == "Escalate")
    t = copy.deepcopy(saved); t[2]["inspection"] = None
    cases["AI misses inspection cert (4471003)"] = (t, lambda r: r["4471003"]["o"] == "Escalate")
    t = copy.deepcopy(saved); t[4]["pickup_dates"] = t[4]["pickup_dates"][:1]
    cases["AI misses the conflicting date (4471005)"] = (t, lambda r: r["4471005"]["o"] == "Escalate")
    t = copy.deepcopy(saved); t[5]["services"] = []
    cases["AI misses requested inside delivery (4471006)"] = (t, lambda r: r["4471006"]["o"] == "Request info")
    t = copy.deepcopy(saved); t[6]["services"] = [{"code": "LIFTGATE", "performed": "yes", "quote": "Consignee had a dock; liftgate not needed.", "doc": "driver"}]
    cases["AI misreads 'not needed' as yes (4471007)"] = (t, lambda r: r["4471007"]["o"] == "Escalate")
    t = copy.deepcopy(saved); t[1]["services"].append({"code": "HAZMAT", "performed": "yes", "quote": "Liftgate delivery.", "doc": "pod"})
    cases["unsupported service type"] = (t, lambda r: r["4471002"]["o"] == "Escalate" and any("Unsupported" in f for f in r["4471002"]["f"]))
    t = copy.deepcopy(saved); t.append(copy.deepcopy(saved[0])); t[-1]["notes"] = "dup"
    cases["duplicate PRO"] = (t, lambda r: r["4471001"]["o"] == "Escalate")
    t = copy.deepcopy(saved); del t[7]
    cases["dropped bill (4471008)"] = (t, lambda r: r["4471008"]["o"] == "Escalate")
    t = copy.deepcopy(saved); t[0]["pro"] = "9999999"
    cases["unknown PRO"] = (t, lambda r: r["4471001"]["o"] == "Escalate")
    cases["not a list"] = ({"oops": True}, lambda r: all(v["o"] == "Escalate" for v in r.values()))
    t = copy.deepcopy(saved); t[0]["pickup_dates"][0]["date"] = "11/04/2026"
    cases["non-ISO date"] = (t, lambda r: r["4471001"]["o"] == "Escalate")
    t = copy.deepcopy(saved); t[3]["inspection"]["dims_in"] = [48, 40]
    cases["2-number dimensions"] = (t, lambda r: r["4471004"]["o"] == "Escalate")
    t = copy.deepcopy(saved); t[1]["services"][0]["performed"] = "definitely"
    cases["unknown performed value"] = (t, lambda r: r["4471002"]["o"] == "Escalate")
    t = copy.deepcopy(saved)
    for it in t:
        for s in it["services"]:
            s["quote"] = s["quote"].replace("'", "’")
    cases["curly quotes still verify"] = (t, lambda r: all(r[p_]["o"] == KEY[p_]["outcome"] for p_ in KEY))

    for name, (raw, pred) in cases.items():
        r = run(raw)
        wc = wrong_charges(r)
        check(f"adversarial: {name}", pred(r) and not wc, f"{ {k: v['o'] for k, v in r.items()} } wrong={wc}")

    # 5. Rule-vs-AI attribution: which traps a rule catches even if the AI says nothing
    pg.screenshot(path=str(ROOT/"tests/shots/shot_main.png"), full_page=False)
    check("no console errors", not errors, "; ".join(errors[:3]))
    b.close()

print(f"\n{len(fails)} failure(s)")
sys.exit(1 if fails else 0)

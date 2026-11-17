"""Demo layer: Start demo overlay, drill, recorded live run, 'Your next step', compact findings, Advanced menu. Run: python3 -I test_demo.py"""
import pathlib as _pl
ROOT = _pl.Path(__file__).resolve().parents[1]

import os
from playwright.sync_api import sync_playwright
APP = "file://" + os.environ.get("APP_PATH", str(ROOT/"app/index.html")) + "#all"
fails = []
def check(n, c, d=""):
    print(("PASS " if c else "FAIL ") + n + ("" if c else f"  [{d}]"))
    if not c: fails.append(n)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1440, "height": 900})
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "ERR_" not in m.text else None)
    pg.goto(APP); pg.wait_for_selector(".qitem")
    tb = pg.locator(".controls > :visible").all_inner_texts()
    check("toolbar: Start demo, views, sets, run, drill, Advanced", all(any(x in t for t in tb) for x in ["Start demo", "Run check", "Drill", "Advanced"]), tb)
    check("rare controls hidden under Advanced", not pg.is_visible("#run3Btn") and not pg.is_visible("#modeLive"))
    pg.click(".adv>summary"); check("Advanced opens", pg.is_visible("#themeBtn"))
    pg.click("h1, header"); check("Advanced closes on outside click", not pg.is_visible("#themeBtn"))
    # next step on every dev bill
    ok = True
    for pro in pg.eval_on_selector_all(".qitem", "els=>els.map(e=>e.dataset.pro)"):
        pg.click(f'.qitem[data-pro="{pro}"]')
        if not pg.is_visible(".nextstep") or len(pg.inner_text(".nextstep")) < 20: ok = False
    check("'Your next step' on every bill", ok)
    pg.click('.qitem[data-pro="4471003"]')
    check("key-account fix: approve amount + account manager", "+$474.20" in pg.inner_text(".nextstep") and "Account manager" in pg.inner_text(".nextstep"), pg.inner_text(".nextstep"))
    check("findings: quotes collapsed by default", pg.locator("details.fmore").count() > 0 and not pg.locator("details.fmore[open]").count())
    # drill
    pg.click("#drillBtn"); pg.wait_for_timeout(200)
    r = pg.evaluate("[state.results['4472012'].outcome, state.results['4472012'].delta, state.results['4472012'].findings.map(f=>f.basis).join('|')]")
    check("drill: injected AI mistake → Escalate, no charge", r[0] == "Escalate" and not r[1], r)
    check("drill: caught by the injection scan (a rule)", "injection scan" in r[2], r[2])
    check("drill banner explains v1 +$65 vs now", "+$65" in pg.inner_text("#drillNote") and "not a live run" in pg.inner_text("#drillNote"))
    check("drill not added to run history", pg.evaluate("state.runs.every(r=>r.mode!=='drill')"))
    pg.click("#drillBack"); pg.wait_for_timeout(200)
    check("back to recorded live run", "recorded live run" in pg.inner_text("#status") and pg.evaluate("state.results['4472012'].outcome") == "Escalate")
    rec = pg.evaluate("[state.viewing.id, state.viewing.at]")
    check("recorded run carries its real id and time", rec[0].startswith("blind-v2-") and rec[1].startswith("2026-11-15T02:35"), rec)
    # guided demo
    pg.click("#demoBtn"); titles = []
    for i in range(6):
        pg.wait_for_timeout(250); titles.append(pg.inner_text("#dmT"))
        if i < 5: pg.click("#dmF")
    check("demo: 6 steps in story order", titles == ["Frontend · what the biller gets", "Backend · AI reads and drafts, code decides, a person approves", "Hardest case · recorded live run", "Most useful failure, and the fix", "Evidence · how the approach was chosen", "Path to production · before and after"], titles)
    check("demo step 6 lands on the rollout tab, before/after table first", pg.is_visible("#planDelta") and pg.is_visible("#r-phases"))
    pg.click("#dmF"); check("demo finishes and hides", not pg.is_visible("#demoBox"))
    pg.click("#viewReview"); pg.keyboard.press("Escape")
    check("evals panel lists runs and planned items", "Planned, not run" in pg.text_content("#evalsPanel") and "Why this one over the alternatives" in pg.text_content("#evalsPanel"))
    # layers and ground truth
    tags = pg.evaluate("[...document.querySelectorAll('body>details.panel')].every(d=>d.dataset.layer&&d.querySelector('summary .lay'))")
    check("every panel is tagged Frontend / Backend / Ground truth", tags and pg.locator("main h2 .lay.fe").count() == 3)
    pg.click('#laySeg [data-lay="fe"]')
    check("Frontend view: biller console only", pg.is_visible("main") and not pg.is_visible("#archPanel") and not pg.is_visible("#evalPanel"))
    pg.click('#laySeg [data-lay="be"]')
    check("Backend view: console hidden, backend and ground truth shown", not pg.is_visible("main") and pg.is_visible("#archPanel") and pg.is_visible("#gtPanel"))
    pg.click('#laySeg [data-lay="both"]')
    pg.click("#dsDev"); pg.wait_for_timeout(300); gt = pg.text_content("#gtPanel")
    check("ground truth panel: frozen key hash, never shown to the model, system of record, limits", "sha256 dcf92ced49da7009" in gt and "never shown to the model" in gt and "BRT-v4" in gt and "not labeled by billers" in gt, gt[:200])
    pg.click("#dsBlind"); pg.wait_for_timeout(300)
    check("ground truth follows the bill set", "sha256 e565e57102500730" in pg.text_content("#gtPanel") and "conflicting delivery documents" in pg.text_content("#gtPanel"))
    check("scorecard shows Expected (frozen key) vs Actual (this run)", "Expected (frozen key)" in pg.text_content("#evalPanel") and "Actual (this run)" in pg.text_content("#evalPanel"))
    check("real / mocked / not built table is one click away", "Not built yet" in pg.text_content("#archPanel"))
    check("no console errors", not errs, "; ".join(errs[:3]))
    b.close()
print(f"\n{len(fails)} failure(s)")

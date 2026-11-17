"""v3 part 2: handoff drafter, reviewer, dispute responder, coaching, team view. Offline with a stub model. Run: python3 -I test_team.py"""
import os
from playwright.sync_api import sync_playwright
import pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
APP = "file://" + os.environ.get("APP_PATH", str(ROOT/"app/index.html")) + "#all"
fails = []
def check(n, c, d=""):
    print(("PASS " if c else "FAIL ") + n + ("" if c else f"  [{d}]"))
    if not c: fails.append(n)
STUB = r"""
window.__stub={draft:"good",review:"pass",calls:[]};
(function(){
 const tool=async(tools,name,input)=>{const t=tools.find(x=>x.name===name);try{return {ok:true,out:await t.execute(input||{},{})}}catch(e){return {ok:false,err:String(e.message||e)}}};
 const json=async(prompt,opts)=>{
  opts=opts||{};const S=window.__stub;
  if(prompt.startsWith("You are an independent reviewer")){S.calls.push("review");
   if(S.review==="throw")throw Object.assign(new Error("down"),{code:"error"});
   if(S.review!=="lazy"){const ls=await tool(opts.tools,"list_documents");for(const d of ls.out)await tool(opts.tools,"read_document",{doc_id:d.doc_id})}
   return S.review==="block"?{verdict:"block",unsupported:[{claim:"x",reason:"not in documents"}]}:{verdict:"pass",unsupported:[]}}
  const pk=JSON.parse(prompt.slice(prompt.indexOf("<packet>")+8,prompt.indexOf("</packet>")));S.calls.push(pk.kind);
  if(S.draft==="throw")throw Object.assign(new Error("down"),{code:"error"});
  const q=pk.quotes[0];let body=`To ${pk.recipient}: PRO ${pk.pros[0]} needs attention. ${pk.facts[0]?pk.facts[0].issue:""}. `+(q?`The ${q.document} says "${q.text}". `:"")+Object.values(pk.amounts).filter(v=>v!=null).map(v=>"$"+Math.abs(v).toFixed(2)).join(" and ")+".";
  if(S.draft==="bad_amount")body+=" The customer owes $999.00.";
  if(S.draft==="bad_quote")body+=' The driver wrote "liftgate was definitely used at the dock door".';
  if(S.draft==="promise")body+=" We will credit the account today.";
  if(S.draft==="other_pro")body+=" See also PRO 4472001.";
  if(pk.kind==="dispute"){const T=opts.tools;const ls=await tool(T,"list_documents");for(const d of ls.out)await tool(T,"read_document",{doc_id:d.doc_id});await tool(T,"get_invoice");
   return {reason_code:S.reason||"RATE_OR_CONTRACT",evidence:S.draft==="unread_ev"?[{quote:"x",doc:"email"}]:[],reply:{subject:"Dispute on PRO "+pk.pros[0],body}}}
  return {subject:"PRO "+pk.pros[0]+" needs attention",body};
 };
 window.claude={use:async k=>k==="sample"?{json,limits:async()=>({tools:true})}:null};
})();
"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1440, "height": 900})
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "ERR_" not in m.text else None)
    pg.add_init_script(STUB); pg.goto(APP); pg.wait_for_selector(".qitem")
    check("team panel: roster, platform map, before/after, disputes, coaching", all(x in pg.text_content("#teamBody") for x in ["Investigator", "Handoff drafter", "Independent reviewer", "Dispute responder", "Connectors", "Agent builder with simulation", "Build time compressed; evidence time did not", "Disputes inbox"]))
    pg.evaluate("switchDataset('blind')"); pg.wait_for_timeout(200)
    # templates pass their own gate on every bill that has a handoff, and on every dispute
    t = pg.evaluate("""()=>{const bad=[];let n=0;for(const k of [...BILLS.map(b=>'h:'+b.pro),...__team.DISPUTES.map(d=>'d:'+d.id)]){const pk=__team.packetFor(k);if(!pk)continue;n++;const D={pk,d:__team.templateDraft(pk),out:null,tr:{opened:[]}};const g=__team.checkDraft(D);if(!g.pass)bad.push(k+': '+g.checks.filter(c=>!c.ok).map(c=>c.name+' '+c.detail).join('; '))}return {n,bad}}""")
    check(f"code-built template passes the gate on all {t['n']} handoffs and disputes", t["n"] >= 9 and not t["bad"], t["bad"][:3])
    check("no handoff for a Clear bill or a non-key fix", pg.evaluate("__team.packetFor('h:4472007')===null&&__team.packetFor('h:4472001')===null"))
    check("key-account fix goes to the account manager", "Account manager" in pg.evaluate("__team.packetFor('h:4472003').recipient"))
    rd = pg.evaluate("['h:4472015','h:4472003','d:D2','d:D4'].map(k=>{const D=__team.getDraft(k);return D?[k,D.src,D.gate.pass,__team.canApprove(D),D.gate.checks.filter(c=>!c.ok).map(c=>c.name)]:[k,null]})")
    check("4 recorded live drafts load on the recorded run and pass the code gate again", all(x[1] == "recorded" and x[2] for x in rd), rd)
    check("recorded: request to the terminal and the credit reply are approvable; the two reviewer blocks are not", [x[3] for x in rd] == [True, False, True, False], rd)
    for k in ['h:4472015','h:4472003','d:D2','d:D4']: pg.evaluate(f"delete __team.DR['{k}']")
    # disputes: code decision vs frozen key
    d = pg.evaluate("__team.DISPUTES.map(dp=>{const x=__team.disputeDecision(dp,state.results[dp.pro]);const k=__team.DISPUTE_KEY[dp.id];return [dp.id,x.rec,x.credit,k.decision,k.credit]})")
    check("5 disputes: code decision and credit equal the frozen key", all(x[1] == x[3] and ((x[2] or 0) == (x[4] or 0)) for x in d), d)
    check("dispute with an instruction and legal language goes to a person by code", d[4][1] == "Person decides")
    def run(key, draft="good", review="pass", reason=None):
        pg.evaluate(f"Object.assign(window.__stub,{{draft:'{draft}',review:'{review}',reason:{('null' if reason is None else repr(reason))},calls:[]}})")
        return pg.evaluate(f"""__team.runDraft('{key}').then(()=>{{const D=__team.DR['{key}'];return {{src:D.src,pass:D.gate.pass,failed:D.gate.checks.filter(c=>!c.ok).map(c=>c.name),review:D.review?[D.review.verdict,D.review.void]:null,ok:__team.canApprove(D),calls:window.__stub.calls,opened:D.tr.opened}}}})""")
    g = run("h:4472015"); check("handoff: good draft passes 6 code checks, reviewer reads all documents, approvable", g["src"] == "live" and g["pass"] and g["review"] == ["pass", False] and g["ok"], g)
    for mode, name in [("bad_amount", "Every dollar amount"), ("bad_quote", "Every quotation"), ("promise", "No promise"), ("other_pro", "Names this shipment")]:
        x = run("h:4472015", mode); check(f"gate blocks {mode}; reviewer not even called", (not x["pass"]) and any(name in f for f in x["failed"]) and not x["ok"] and "review" not in x["calls"], x)
    x = run("h:4472015", review="block"); check("reviewer block → not approvable", x["pass"] and not x["ok"], x)
    x = run("h:4472015", review="lazy"); check("reviewer that did not read → verdict discarded, not approvable", x["review"] == ["pass", True] and not x["ok"], x)
    x = run("h:4472015", review="throw"); check("reviewer down → not approvable (template still available)", not x["ok"], x)
    x = run("h:4472015", draft="throw"); check("drafter down → code-built template, passes gate, approvable without a model", x["src"] == "template" and x["pass"] and x["ok"], x)
    x = run("d:D2", reason="RATE_OR_CONTRACT"); check("dispute D2: agent opened documents, credit $78.86 stated, approvable", x["src"] == "live" and x["pass"] and x["ok"] and len(x["opened"]) == 3, x)
    amt = pg.evaluate("__team.DR['d:D2'].pk.amounts"); check("dispute D2 amounts come from the engine", amt.get("proposed_credit") == 78.86, amt)
    x = run("d:D2", draft="unread_ev"); check("dispute: evidence from a document never opened is blocked", not x["pass"] and any("Evidence is found" in f for f in x["failed"]), x)
    x = run("d:D1", draft="bad_amount"); check("dispute upheld: any invented amount is blocked", not x["pass"], x)
    # UI
    pg.click('.qitem[data-pro="4472015"]'); pg.evaluate("Object.assign(window.__stub,{draft:'good',review:'pass'})")
    pg.click('[data-draft="h:4472015"]'); pg.wait_for_selector('[data-approve="h:4472015"]:not([disabled])')
    check("UI: draft, checks and reviewer shown; approve enabled", "Ready for your approval" in pg.text_content(".agbox") and pg.locator(".chk li").count() >= 7)
    pg.click('[data-approve="h:4472015"]'); check("UI: approval recorded, nothing sent", "Nothing was sent" in pg.text_content(".agbox"))
    pg.click('.qitem[data-pro="4472006"]'); check("UI: dispute shown on its bill with the code decision", "Customer dispute D2" in pg.text_content(".agbox") and "Credit" in pg.text_content(".dispute") and "$78.86" in pg.text_content(".dispute"))
    c = pg.evaluate("__team.coachRows().map(c=>[c.cust,c.wc.length,c.svc.length,c.ours.length])"); check("coaching: our own contract error is not blamed on the shipper", any(x[0] == "HRB" and x[3] == 1 and x[1] == 0 and x[2] == 0 for x in c), c)
    pg.evaluate("__team.runDraft('c:BRT')"); pg.wait_for_function("__team.DR['c:BRT']&&__team.DR['c:BRT'].status==='done'")
    check("coaching draft runs through the same gate", pg.evaluate("__team.DR['c:BRT'].gate.checks.length") >= 6)
    # demo + rollout
    check("guided demo has 6 steps; step 2 shows the agents", pg.evaluate("__demo.DEMO.length") == 6 and "AI reads and drafts" in pg.evaluate("__demo.DEMO[1].t") and all(len(c) < 330 for c in pg.evaluate("__demo.DEMO.map(s=>s.c)")))
    pg.evaluate("__demo.startDemo(1)"); pg.wait_for_timeout(300); check("demo step 2 highlights the agent block on the missing-document bill", pg.evaluate("state.sel") == "4472015" and pg.locator(".agbox.demo-hl").count() == 1)
    pg.evaluate("__demo.endDemo()"); pg.click("#viewRollout"); check("rollout tab opens with the before/after table", pg.is_visible("#planDelta") and "week 16–20" in pg.inner_text("#planDelta"))
    pg.click("#viewReview"); check("before/after hidden in the review view", not pg.is_visible("#planDelta"))
    pg.evaluate("__demo.startDemo(4)"); pg.wait_for_timeout(400); check("demo step 5 lands on the plain-language call in the bake-off panel", pg.is_visible("#bakeCall") and "No approach has earned" in pg.inner_text("#bakeCall")); pg.evaluate("__demo.endDemo()")
    pg2 = b.new_page(viewport={"width": 1440, "height": 900}); pg2.add_init_script(STUB); pg2.goto(APP.replace("#all", "")); pg2.wait_for_selector(".qitem")
    vis = pg2.evaluate("[...document.querySelectorAll('body>details.panel')].filter(d=>getComputedStyle(d).display!=='none').map(d=>d.id)")
    check("lean view by default: five panels, architecture first, scorecard last and collapsed", vis == ["archPanel", "teamPanel", "bakePanel", "evalsPanel", "evalPanel"] and not pg2.evaluate("document.getElementById('evalPanel').open"), vis)
    pg2.click('.qitem[data-pro="4471001"]'); check("lean view: no agent block on a clear bill", pg2.locator(".agbox").count() == 0)
    pg2.click("#leanBtn"); check("one click shows every panel", pg2.evaluate("[...document.querySelectorAll('body>details.panel')].every(d=>getComputedStyle(d).display!=='none')") and "fewer" in pg2.inner_text("#leanBtn"))
    check("architecture panel opens with the one-picture summary", pg2.locator("#archPanel .glance .g-box").count() == 7 and "AI for messy input" in pg2.text_content("#archPanel .glance"))
    pg2.click("#leanBtn"); check("and one more click returns to the short view", pg2.evaluate("document.body.classList.contains('lean')"))
    short = pg2.evaluate("""(()=>{const out={};for(const id of ['archPanel','teamPanel','bakePanel','evalsPanel']){const p=document.getElementById(id);p.open=true;out[id]=Math.round(p.getBoundingClientRect().height);p.open=false}return out})()""")
    check("lean view: every opened panel fits on one screen", all(h < 900 for h in short.values()), short)
    check("lean view: sub-sections start folded", pg2.locator("#teamPanel details[open], #bakePanel details[open], #archDetail[open]").count() == 0)
    check("lean view: evals table shows three columns until 'show why' is clicked", pg2.evaluate("(()=>{const p=document.getElementById('evalsPanel');p.open=true;const th=[...p.querySelectorAll('.evtab')[0].querySelectorAll('th')].filter(x=>getComputedStyle(x).display!=='none').length;document.getElementById('evMore').click();const th2=[...p.querySelectorAll('.evtab')[0].querySelectorAll('th')].filter(x=>getComputedStyle(x).display!=='none').length;return [th,th2]})()") == [3, 5])
    check("no console errors", not errs, errs[:3])
    b.close()
print("\nALL PASS" if not fails else f"\n{len(fails)} FAILED: {fails}")
raise SystemExit(1 if fails else 0)

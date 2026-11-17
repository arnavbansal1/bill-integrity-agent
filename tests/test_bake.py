"""v3 layer: swappable slot, candidates, investigator gates, bake-off. Offline, with a stub model. Run: python3 -I test_bake.py"""
import os, json
from playwright.sync_api import sync_playwright
import pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
APP = "file://" + os.environ.get("APP_PATH", str(ROOT/"app/index.html")) + "#all"
fails = []
def check(n, c, d=""):
    print(("PASS " if c else "FAIL ") + n + ("" if c else f"  [{d}]"))
    if not c: fails.append(n)
STUB = r"""
window.__stub={mode:"good",calls:0};
(function(){
 const tool=async(tools,name,input)=>{const t=tools.find(x=>x.name===name);try{return {ok:true,out:await t.execute(input,{})}}catch(e){return {ok:false,err:String(e.message||e)}}};
 const json=async(prompt,opts)=>{
  window.__stub.calls++;opts=opts||{};const m=window.__stub.mode;
  if(opts.tools&&"cache" in opts)throw Object.assign(new Error("cache with tools"),{code:"invalid_request"});
  if(m==="throw")throw Object.assign(new Error("boom"),{code:"error"});
  const inv=prompt.match(/investigator for one LTL freight bill, PRO (\d+)/);
  if(inv){const pro=inv[1];const T=opts.tools;const src=window.__stubExt(pro);
   const ls=await tool(T,"list_documents",{});
   if(m==="cross")await tool(T,"read_document",{pro:"4472002",doc_id:"bol"});
   if(m==="budget")for(let i=0;i<14;i++)await tool(T,"get_draft_invoice",{});
   for(const d of ls.out){if(m==="skip"&&d.doc_id==="pod")continue;await tool(T,"read_document",{doc_id:d.doc_id})}
   if(m==="wrongpro")return Object.assign({},src,{pro:"4472002"});
   return src}
  if(prompt.includes('"corrected_total"'))return window.__stubModelOnly();
  return window.__stubHybrid();
 };
 window.claude={use:async k=>k==="sample"?{json,limits:async()=>({tools:true})}:null};
})();
"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1440, "height": 900})
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "ERR_" not in m.text else None)
    pg.add_init_script(STUB); pg.goto(APP); pg.wait_for_selector(".qitem")
    # stub answers: the recorded live extraction for blind set 1
    pg.evaluate("""()=>{window.__stubExt=pro=>JSON.parse(JSON.stringify(REC.raw.find(x=>x.pro===pro)));
      window.__stubHybrid=()=>JSON.parse(JSON.stringify(REC.raw));
      window.__stubModelOnly=()=>BILLS.map(b=>({pro:b.pro,outcome:"Clear",corrected_total:null}))}""")
    check("bake-off panel present with decision rule", pg.locator("#bakePanel").count() == 1 and "fixed before any score existed" in pg.text_content("#bakeBody"))
    check("blind set 2 loaded: 12 bills, key frozen with sha", pg.evaluate("DATASETS.blind2.bills.length===12&&Object.keys(DATASETS.blind2.key).length===12&&DATASETS.blind2.sha.length===64"))
    pg.evaluate("__agent.bakeRules()")
    r = pg.evaluate("__agent.BK.results.filter(x=>x.cand==='rules'&&!x.rec).map(x=>[x.ds,x.score.correct,x.score.n,x.score.unsafe.length])")
    check("rules candidate scored on all three sets at load", len(r) == 4 and [x[2] for x in r] == [8, 15, 12, 12], r)
    print("   rules:", r)
    check("dataset restored after scoring", pg.evaluate("DATASET") == "dev" and pg.evaluate("BILLS.length") == 8)
    # scoring tightening
    s = pg.evaluate("""()=>{const key={a:{outcome:"Propose fix",delta:65},b:{outcome:"Clear",delta:0},c:{outcome:"Escalate",delta:null},d:{outcome:"Propose fix",delta:10},e:{outcome:"Clear",delta:0}};
      return __agent.bakeScore({a:{outcome:"Propose fix",delta:85},b:{outcome:"Propose fix",delta:5},c:{outcome:"Clear",delta:0},d:{outcome:"Escalate",delta:null},e:{outcome:"Clear",delta:0}},key)}""")
    check("score: wrong dollars, fix on a clear bill and release of a must-act bill are all unsafe", sorted(s["unsafe"]) == ["a", "b", "c"] and s["overCautious"] == ["d"] and s["correct"] == 1, s)
    # agent on blind set 1 via the slot
    pg.evaluate("switchDataset('blind')"); pg.wait_for_timeout(200)
    base = pg.evaluate("Object.fromEntries(BILLS.map(b=>[b.pro,[state.results[b.pro].outcome,state.results[b.pro].delta]]))")
    x = pg.evaluate("__agent.bakeOne('agent','blind',1).then(x=>({o:x.outputs,path:x.path,err:x.err}))")
    same = all(base[k][0] == x["o"][k]["outcome"] and base[k][1] == x["o"][k]["delta"] for k in base)
    check("agent candidate (good path): same outcomes and dollars as the recorded run, gates silent", same and not x["err"], [k for k in base if base[k][0] != x["o"][k]["outcome"]])
    check("agent path recorded: tool calls counted, none denied", x["path"]["calls"] >= 15 * 3 and x["path"]["denied"] == 0, x["path"])
    def one(mode, pro="4472001", opt="undefined"):
        pg.evaluate(f"window.__stub.mode='{mode}'")
        return pg.evaluate(f"""(async()=>{{const b=DATASETS.blind.bills.find(x=>x.pro==='{pro}');const {{ext,tr}}=await __agent.investigate(b,{opt});
          const o=__agent.outputsFrom('blind',ext?[ext]:[],{{['{pro}']:tr}});return {{out:o['{pro}'],tr,ext:!!ext}}}})()""")
    g = one("good"); check("investigate: good path proposes the fix (+$65)", g["out"]["outcome"] == "Propose fix" and g["out"]["delta"] == 65, g["out"])
    s1 = one("skip"); check("gate: a document never opened → Escalate, no charge", s1["out"]["outcome"] == "Escalate" and s1["out"]["delta"] is None and "pod" not in s1["tr"]["opened"], s1["out"])
    c = one("cross"); check("permissions: a read for another bill is denied in code and the bill goes to a person", c["out"]["outcome"] == "Escalate" and any(d["why"] == "scope" for d in c["tr"]["denied"]), c["tr"]["denied"])
    bu = one("budget"); check("budget: calls past 12 are refused", any(d["why"] == "budget" for d in bu["tr"]["denied"]) and len(bu["tr"]["calls"]) > 12, len(bu["tr"]["calls"]))
    t = one("throw"); check("task conservation: agent failure → no extraction → Escalate", (not t["ext"]) and t["out"]["outcome"] == "Escalate" and t["tr"]["err"], t)
    w = one("wrongpro"); check("answer for the wrong bill is discarded → Escalate", (not w["ext"]) and w["out"]["outcome"] == "Escalate", w["out"])
    f1 = one("good", opt="{fault:{doc:'pod',mode:'timeout_once'}}"); check("document store timeout once: code retries, result unchanged", f1["out"]["outcome"] == "Propose fix" and len(f1["tr"]["retries"]) == 1, f1["tr"]["retries"])
    f2 = one("good", opt="{fault:{doc:'pod',mode:'down'}}"); check("document store down: retried, then Escalate", f2["out"]["outcome"] == "Escalate" and len(f2["tr"]["retries"]) == 2, f2["out"])
    check("tools are never called with a cache option", pg.evaluate("window.__stub.calls") > 0)
    # per-bill live investigate in the UI
    pg.evaluate("window.__stub.mode='good'"); pg.click('.qitem[data-pro="4472001"]'); pg.click("#agInv"); pg.wait_for_selector(".ag-tr", state="attached")
    check("UI: investigator line and tool trace shown", "Opened 3 of 3 documents" in pg.text_content(".agbox") and pg.locator(".ag-tr li").count() >= 4, pg.text_content(".agbox"))
    check("UI: single-bill investigation stays out of run history", pg.evaluate("state.runs.every(r=>r.mode!=='agent')"))
    check("UI: other bills keep their results", pg.evaluate("state.results['4472011'].outcome") == "Escalate")
    # model-only parser
    pm = pg.evaluate("__agent.withSet('blind',()=>__agent.parseModelOnly([{pro:'4472001',outcome:'Propose fix',corrected_total:'abc'},{pro:'4472002',outcome:'Maybe'},{pro:'4472007',outcome:'Clear'}]))")
    check("model-only parser: malformed answers count as no answer", list(pm.keys()) == ["4472007"], pm)
    # bake live with stubs, table and pick
    pg.evaluate("__agent.bakeLive([['hybrid','blind',2],['model','blind2',1]])"); pg.wait_for_function("!__agent.BK.busy")
    pk = pg.evaluate("__agent.bakePick().pick"); 
    check("pick runs on the newest blind set with the kit's rule", pk["decideOn"] == "blind3" and "rows" in pk, pk.get("reason"))
    check("current-round table and round-1 history both render", pg.locator("table.bake").count() == 2 and pg.locator("table.bake tr").count() == 10)
    h = pg.text_content("#bakeBody")
    check("round 1 history: every approach unsafe, none chosen, findings stated", "Round 1" in h and "No approach chosen" in h and "no bill of lading on file" in h)
    r1 = pg.evaluate("(()=>{const r=BAKE_REC.rounds[0];const res=r.results.map(x=>withScore(Object.assign({},x)));const pk=__agent.bakePick(res,r.decide).pick;return {w:pk.winner,rows:pk.rows.map(x=>[x.name,x.worst,x.best,x.unsafe.length])}})()")
    check("round 1 recorded scores: rules 3/12, hybrid 7/12 ×3, model 10–11/12, agent 7/12; all unsafe", r1["w"] is None and r1["rows"] == [["rules", 3, 3, 3], ["hybrid", 7, 7, 3], ["model", 10, 11, 4], ["agent", 7, 7, 1]], r1)
    g = pg.evaluate("__agent.withSet('blind2',()=>['4473007','4473008','4473009'].map(p=>{const b=BILLS.find(x=>x.pro===p);const r=evaluate(b,{services:[],unsupported:[],inspection:null,pickup_dates:[],notes:'',confidence:''},[]);return [r.outcome,r.delta,r.findings.filter(f=>/v3 guard/.test(f.basis)).length]}))")
    check("v3 guards: the three bills round 1 released are now held by code even with an empty extraction", all(x[0] in ("Request info", "Escalate") and x[1] is None and x[2] >= 1 for x in g), g)
    g3 = pg.evaluate("__agent.withSet('blind3',()=>['4474003','4474004'].map(p=>{const b=BILLS.find(x=>x.pro===p);const r=evaluate(b,{services:[],unsupported:[],inspection:null,pickup_dates:[],notes:'',confidence:''},[]);return [r.outcome,r.delta,r.findings.filter(f=>/v3 guard/.test(f.basis)).map(f=>f.title)]}))")
    check("v3 guards from blind set 3: collect terms and a blank weight are held by code", g3[0][0] == "Escalate" and g3[1][0] in ("Request info", "Escalate") and all(x[1] is None and x[2] for x in g3), g3)
    same = pg.evaluate("(()=>{const out=[];for(const ds of ['dev','blind']){const o=__agent.withSet(ds,()=>BILLS.filter(b=>v3Guards(b).length).map(b=>b.pro));out.push(o.length)}return out})()")
    check("v3 guards fire on no bill in the dev set or blind set 1", same == [0, 0], same)
    pg.evaluate("document.getElementById('bakePanel').open=true"); pg.click("#bakeOpen"); pg.wait_for_timeout(300)
    check("newest blind set opens in the review view", pg.evaluate("DATASET") == "blind3" and pg.locator(".qitem").count() == 12)
    check("no console errors", not errs, errs[:3])
    
    b.close()
print("\nALL PASS" if not fails else f"\n{len(fails)} FAILED: {fails}")
raise SystemExit(1 if fails else 0)

/* ---------- Render ---------- */
const fmtN=x=>!isFinite(x)?"∞":Math.round(x).toLocaleString("en-US");
function cellEdit(path,val,cls){return`<td class="ed ${cls||""}" contenteditable="true" data-path="${path}">${esc(val)}</td>`}
function renderRollout(){
 const openK=new Set([...document.querySelectorAll("#rollout details[open]")].map(d=>d.dataset.k));const sy=window.scrollY;
 const p=R.plan,m=model(),G=gates(),F=flips(),E=R.evidence,act=F.filter(f=>f.on);
 const st=s=>`<span class="gs gs-${s.replace(/[^A-Za-z]/g,"")}">${s}</span>`;
 const phaseGates=ph=>G.filter(x=>x.phase===ph);
 const ready=ph=>{const gs=phaseGates(ph).filter(x=>x.status!=="N/A");return gs.every(x=>x.status==="Met")?"Ready":gs.some(x=>x.status==="Not met")?"Blocked":"Unproven"};
 const srcCls=s=>s.startsWith("Eval")?"src-eval":s==="Case"?"src-case":"src-asm";
 const notes=ph=>act.filter(f=>f.phase&&f.phase[ph]).map(f=>`<div class="ph-chg" title="${esc(f.title)}">↳ ${esc(f.phase[ph])}</div>`).join("");
 const pre=act.filter(f=>f.phase&&f.phase.pre);
 const flag=text=>{const h=hitFor(text);return h.length?`<span class="flag" title="Affected: ${esc(h.join("; "))}">⚑</span>`:""};
 const wks=x=>isFinite(x)?x.toFixed(1)+" wks":"never";
 const sorted=[...F].sort((a,b)=>b.on-a.on);
 const lm=lateMode();
 const KEYF=["bills","incidence","auditShare","keyShare","invoiceSla","podLatency","lateShare","shadowShare","pilotShare","deadline"];
 const KEYT=["contractsDigital","tmsWrite","preInvoice","archived","randomAvail","clustered"];
 const covOpen=m.gaps.length||T("clustered")||!m.joinOk;
 const ownHit=p.owners.filter(r=>hitFor(r.join(" ")).length).length+p.deps.filter(d=>hitFor(d[0]).length).length;
 $("rollout").innerHTML=`
 <div class="rbar"><div><h2 class="rh">Rollout control · shadow → pilot → scale</h2><div class="sub">Change a case fact or pick a scenario: the cards, phases, owners and dependencies update. Gates pass only on real-bill actuals.</div></div>
 <div class="controls"><select id="rPreset" class="btn" title="Try a case change">${Object.keys(PRESETS).map(k=>`<option ${p.preset===k?"selected":""}>${k}</option>`).join("")}${p.preset?"":"<option selected>Custom</option>"}</select>
 <button class="btn" id="rReset">Reset</button><button class="btn" id="rExport">Export / import JSON</button><button class="btn" id="rSave">Save plan</button><button class="btn" id="rLoad">Load saved</button></div></div>
 <nav class="rnav">${[["r-wedge","Wedge"],["r-facts","Case facts"],["r-flips","What changes the plan"],["r-phases","Phases"],["r-owners","Owners"],["r-risks","Risks"],["r-gates","Gates"]].map(([id,l])=>`<button data-jump="${id}">${l}</button>`).join("")}<span class="rnav-sp"></span><button data-expand="1">Expand all</button><button data-expand="0">Collapse all</button></nav>
 <section class="panel rcard" id="r-wedge"><h3>1 · Problem and chosen wedge</h3><div class="story story1">${p.story.map((r,i)=>i!==3?"":`<div><span>${esc(r[0])}</span><div class="ed" contenteditable="true" data-path="story.${i}.1">${esc(r[1])}</div>${i===3&&lm==="routine"?`<div class="ph-chg">↳ Changed: the root bottleneck is evidence availability. Wedge moves upstream: the same agent first finds and requests missing evidence, then runs the bill check.</div>`:i===3&&lm==="occasional"?`<div class="ph-chg">↳ Plus a controlled correction path for the few bills whose evidence arrives late.</div>`:""}</div>`).join("")}</div>
  <details class="sub-d" data-k="story"><summary>Current workflow, bottleneck and options weighed</summary><div class="story">${p.story.map((r,i)=>i===3?"":`<div><span>${esc(r[0])}</span><div class="ed" contenteditable="true" data-path="story.${i}.1">${esc(r[1])}</div></div>`).join("")}</div></details>
  <div class="evline">${E?`<b>Development evidence (synthetic bills):</b> <span class="${E.wrong?"fail":"pass"}">${E.wrong} wrong proposed charges</span> in ${E.runs} uncached live runs · ${E.mustCaught}/${E.mustTotal} must-act bills to a person · 0/14 injected AI mistakes reach money (offline replay). <span class="muted">Development evidence only, not real-world performance.</span>`:`<span class="muted">Evidence so far: no stored live runs in this view.</span>`}</div></section>
 <section class="panel rcard" id="r-facts"><h3>Case facts <span class="muted">(change these when the facts change)</span></h3><div class="facts">${KEYF.map(id=>{const a=p.assumptions.find(x=>x.id===id);return a?`<label>${esc(a.label)}<span><input type="number" step="any" data-as="${a.id}" value="${a.v}"> ${a.unit}</span></label>`:""}).join("")}</div>
  <div class="facts tg">${KEYT.map(id=>{const t=p.toggles.find(x=>x.id===id);return t?`<label class="tgl"><input type="checkbox" data-tg="${t.id}" ${t.v?"checked":""}> ${esc(t.label)}</label>`:""}).join("")}</div></section>
 <div class="status" id="rStatus">${act.length?`${act.length} assumption${act.length>1?"s":""} changing the plan: ${act.map(f=>esc(f.title)).join(" · ")}`:"Base plan: no plan-changing assumption is triggered."}</div>
 <section class="panel rcard" id="r-flips"><h3>2 · Assumptions that change the plan <span class="muted">(${act.length} active)</span></h3>${act.length?`<div class="flips">${act.map(f=>`<div class="flip on"><div class="ph-top"><b>${esc(f.title)}</b><span class="gs gs-Notmet">Active</span></div><p>${esc(f.change)}</p><p class="muted">Watch: ${esc(f.watch)}</p></div>`).join("")}</div>`:""}
  <div class="watching"><span class="muted">${act.length?"Also watching:":"Watching (none triggered):"}</span> ${F.filter(f=>!f.on).map(f=>`<span class="chip" title="${esc(f.change)}">${esc(f.title)}</span>`).join("")}</div></section>
 <section class="panel rcard" id="r-phases"><h3>3 · Phases</h3><div class="phases ${pre.length?"four":""}">${pre.length?`<div class="phase pre"><div class="ph-top"><b>0 · Prerequisite</b><span class="gs gs-Notmet">Added</span></div>${pre.map(f=>`<div class="ph-chg">↳ ${esc(f.phase.pre)}</div>`).join("")}</div>`:""}${p.phases.map((ph,i)=>`<div class="phase"><div class="ph-top"><b contenteditable="true" class="ed" data-path="phases.${i}.name">${esc(ph.name)}</b>${ph.id!=="scale"?`<span class="gs gs-${ready(ph.id)}">${ready(ph.id)}</span>`:""}</div>
  <div class="ph-row"><span>Scope</span><div class="ed" contenteditable="true" data-path="phases.${i}.scope">${esc(ph.scope)}</div></div>
  <div class="ph-row"><span>Autonomy</span><div class="ed" contenteditable="true" data-path="phases.${i}.autonomy">${esc(ph.autonomy)}</div></div>
  <div class="ph-row"><span>Gate to next</span><div class="ed" contenteditable="true" data-path="phases.${i}.exit">${esc(ph.exit)}</div></div>${notes(ph.id)}
  <details class="ph-more" data-k="ph${i}"><summary>Volume, owner, what it tests</summary>
  <div class="ph-row"><span>Volume</span><div>${ph.id==="shadow"?`${A("shadowShare")}% live (${fmtN(m.shadowBills)} bills/mo) + ${fmtN(m.backtest)} audited + ${fmtN(m.randomN)} random historical${m.histUsable?"":" (not usable for rates)"} · ~${wks(m.shadowWeeks)}`:ph.id==="pilot"?`${A("pilotShare")}% (${fmtN(m.pilotBills)} bills/mo)`:`100% (${fmtN(m.B)} bills/mo), in waves`}</div></div>
  <div class="ph-row"><span>Owner</span><div class="ed" contenteditable="true" data-path="phases.${i}.owner">${esc(ph.owner)}</div></div>
  <div class="ph-row"><span>Tests</span><div class="ed" contenteditable="true" data-path="phases.${i}.proves">${esc(ph.proves||"")}</div></div>
  <div class="ph-row"><span>Can't show</span><div class="ed" contenteditable="true" data-path="phases.${i}.not">${esc(ph.not||"")}</div></div></details></div>`).join("")}</div>
  <details class="sub-d" data-k="evm"><summary>Evidence strategy: which evidence answers which risk <span class="muted">(audited history = hard cases · random sample = rates · shadow = real workflow)</span></summary>
  <table class="score evm"><tr><th>Risk</th><th>Synthetic eval (done)</th><th>Audited history</th><th>Random historical sample</th><th>Live shadow</th><th>Pilot</th></tr>
  <tr><td>Catches known error types (recall, edge cases)</td><td>Traps only</td><td class="y">Yes: enriched for exactly these</td><td class="p">Few errors to test</td><td class="y">Yes</td><td class="y">Yes</td></tr>
  <tr><td>Wrong-charge rate on ordinary bills</td><td>Tested synthetic failures routed safely (0 / 14); no rate</td><td class="n">No: mix is selected</td><td class="${m.validatedShare>0?(m.validatedShare<1?"p":"y"):"n"}">${m.validatedShare>=1?"Yes: billers adjudicate every flagged bill":m.validatedShare>0?`Only for error types that cleared the historical-evidence gate (${fmtN(m.validatedShare*100)}% of fixes)`:"No (linkage)"}</td><td class="y">Yes</td><td class="y">On posted invoices</td></tr>
  <tr><td>Error prevalence, person rate, recovery $</td><td class="n">No</td><td class="n">No: overstates</td><td class="${m.histUsable?"y":"n"}">${m.histUsable?"Yes":"No (linkage)"}</td><td class="y">Yes</td><td class="y">Yes</td></tr>
  <tr><td>Missed errors on Clear bills (recall)</td><td class="n">No</td><td class="n">No</td><td class="${m.histUsable?"y":"n"}">${m.histUsable?`Separate human review of a random ${A("qaShare")}% of Clear bills (~${fmtN(m.qaFromRandom)})`:"No (linkage)"}</td><td class="y">QA sample</td><td class="y">QA sample</td></tr>
  <tr><td>Data freshness, document latency</td><td class="n">No</td><td class="n">No: archive is complete</td><td class="n">No</td><td class="y">Yes</td><td class="y">Yes</td></tr>
  <tr><td>Integration, handoffs, invoice cycle, disputes</td><td class="n">No</td><td class="n">No</td><td class="n">No</td><td class="p">Integration, handoffs</td><td class="y">Yes</td></tr>
  <tr><td>Volume and effort</td><td>Done</td><td>${T("archived")?`${fmtN(m.backtest)} bills → ~${fmtN(m.mustFromBack)} must-act`:"Not available"}</td><td>${m.randomN?(m.histUsable?`${fmtN(m.randomN)} bills (${A("joinRate")}% join) → ~${fmtN(m.fixFromBack)} proposals; ~${fmtN(m.adjudHours)} biller-hours`:(T("clustered")?"Clustered gaps: not usable for rates":`Joins ${A("joinRate")}% < ${R.plan.thresholds.joinMin}% bar: not usable for rates`)):"Not available"}</td><td>${wks(m.shadowWeeks)} (min ${A("minShadow")})</td><td>4+ wks</td></tr></table>
  <p class="note">${T("auditsRandom")||A("auditShare")>=95?"Audits here are random or near-total, so audited history also counts as representative. ":""}Audited bills test the hard cases but misstate rates. Rates come from a random sample or live shadow, and only if history joins. Billers adjudicate every flagged bill; recall is never claimed from flagged bills: missed errors are estimated from a separate human review of random Clear bills.</p></details>
  <details class="sub-d" data-k="coverage" ${covOpen?"open":""}><summary>Historical evidence coverage by error type ${covOpen?'<span class="gs gs-Notmet">gap</span>':'<span class="muted">(all pass)</span>'}</summary>
  <table class="score"><tr><th>Error type</th><th>Required evidence chain</th><th>Share of errors</th><th>Coverage</th><th>Bar</th><th>Cleared historical-evidence gate?</th></tr>
  <tr><td>Base linkage (all types)</td><td>Final invoice → shipment → contract version in force on the pickup date</td><td>–</td><td><input type="number" step="any" data-as="joinRate" value="${A("joinRate")}"> %</td><td><input type="number" step="any" data-th="joinMin" value="${p.thresholds.joinMin}"> %</td><td>${m.joinOk?(T("clustered")?'<span class="gs gs-Notmet">Clustered gaps</span>':'<span class="gs gs-Met">Passes</span>'):'<span class="gs gs-Notmet">Below bar</span>'}</td></tr>
  ${m.W.map((w,i)=>`<tr><td>${esc(w.name)}</td><td class="ed" contenteditable="true" data-path="workflows.${i}.chain">${esc(w.chain)}</td><td><input type="number" step="any" data-wf="${i}.share" value="${w.share}"> %</td><td><input type="number" step="any" data-wf="${i}.cov" value="${w.cov}"> %</td><td><input type="number" step="any" data-wf="${i}.bar" value="${w.bar}"> %</td><td>${w.validated?'<span class="gs gs-Met">Yes</span>':`<span class="gs gs-Notmet">${Number(w.cov)<Number(w.bar)?"No: chain gap":"No: base linkage"}</span> <span class="muted">live only</span>`}</td></tr>`).join("")}</table>
  <p class="note">All coverage numbers and bars are placeholders until ~200 sampled shipments are checked. An error type clears the historical-evidence gate only if its own evidence chain meets its bar; ${fmtN(m.validatedShare*100)}% of expected fixes are covered by history today.</p>
  </details>
 </section>
 <details class="panel rcard" id="r-owners" data-k="owners" ${ownHit?"open":""}><summary><b>4 · Owners and dependencies</b> <span class="muted">${p.owners.length} workstreams · ${p.deps.length} dependencies${ownHit?` · <b>${ownHit} affected by an active assumption ⚑</b>`:""}</span></summary>
 <div class="rgrid" style="margin-top:8px">
 <section class="rcard"><h3>Owners</h3>${editTable("owners",["Workstream","Owner","Decision rights"],p.owners,flag)}
  </section>
 <section class="rcard"><h3>Critical dependencies</h3><table class="score"><tr><th>Dependency</th><th>Owner</th><th>Needed by</th><th>Status</th></tr>${p.deps.map((d,i)=>`<tr class="${hitFor(d[0]).length?"hit":""}">${cellEdit(`deps.${i}.0`,d[0])}${cellEdit(`deps.${i}.1`,d[1])}<td>${!T("tmsWrite")&&/write-back|inside the billers/i.test(d[0])&&d[2]!=="Scale"?'<span class="ph-chg">→ now needed by Scale</span> ':""}<select data-dep="${i}.2">${["Pre-shadow","Shadow","Pilot","Scale"].map(o=>`<option ${d[2]===o?"selected":""}>${o}</option>`).join("")}</select></td><td><select class="dst dst-${d[3].replace(/ /g,"")}" data-dep="${i}.3">${["Unknown","At risk","On track","Done"].map(o=>`<option ${d[3]===o?"selected":""}>${o}</option>`).join("")}</select>${flag(d[0])}</td></tr>`).join("")}</table>
  <button class="btn" data-addrow="deps">+ dependency</button><p class="note">⚑ = affected by an active plan-changing assumption.</p></section>
 </div></details>
 <details class="panel rcard" id="r-risks" data-k="risks"><summary><b>Risks and early-warning signals</b> <span class="muted">${p.risks.length} risks, each with an early signal, trigger, response and owner</span></summary><div style="margin-top:8px">${editTable("risks",["Risk","Early signal","Trigger","Response","Owner"],p.risks)}</div></details>
 <section class="panel rcard" id="r-gates"><h3>5 · Metrics and gates</h3>
  <p class="gline">${(()=>{const gs=G.filter(x=>x.status!=="N/A");const c=k=>gs.filter(x=>x.status===k).length;return `${phaseGates("shadow").length} shadow → pilot gates · ${phaseGates("pilot").length} pilot → scale gates · <b>${c("Met")} met · ${c("Not met")} not met · ${c("Unproven")} waiting for real-bill data</b>`})()}</p>
  ${["shadow","pilot"].map(ph=>`<h4>${ph==="shadow"?"Shadow → pilot gates":"Pilot → scale gates"}</h4><table class="score"><tr><th>Gate</th><th>Target</th><th>Observed (real bills)</th><th>Status</th><th>Evidence today</th></tr>${phaseGates(ph).map(x=>`<tr title="${esc(x.why)}"><td>${esc(x.label)}</td><td>${esc(x.target)}</td><td>${x.obs==null?'<span class="muted">enter actuals ↓</span>':esc(x.obs)}</td><td>${st(x.status)}</td><td class="muted">${esc(x.ev)}</td></tr>`).join("")}</table>`).join("")}
  <details class="sub-d" data-k="actuals"><summary>Enter shadow and pilot actuals (leave blank until measured)</summary><div class="actuals">
   ${actualInputs("shadow",[["joinSampled","Historical shipments sampled for joinability"],["joinOk","… fully joined end to end"],["clusterSegs","Segments far below overall linkage"],["bills","Representative bills run (random sample + live)"],["proposals","… fixes proposed"],["wrong","… wrong, after adjudication"],["personBills","… sent to a person"],["audProposals","Audited history: fixes proposed"],["audWrong","… wrong, after adjudication"],["mustTotal","Must-act bills (audited history + live)"],["mustCaught","… sent to a person"],["qaChecked","Clear bills QA-checked (random)"],["qaMisses","… with a missed error"]])}
   ${actualInputs("pilot",[["fixesApproved","Fixes approved and posted"],["wrongReached","Wrong charges that reached a customer"],["rebills","Agent-changed invoices"],["disputes","… disputed"],["baselineDispute","Baseline dispute rate (%)"],["minPerBill","Biller minutes per bill now"],["baselineMin","Baseline minutes per bill"],["delayHrs","Added invoice cycle time (h)"],["lateObs","Bills corrected after invoicing (%)"],["overrides","Biller overrides of proposals"],["recovered","Realized recovery $ / month (net of disputes, credits)"]])}</div></details>
  <details class="sub-d" data-k="thresholds"><summary>Gate thresholds</summary><div class="actuals">${Object.entries({tol:"Max wrong-charge rate (%)",minRecall:"Min must-act recall (%)",maxPerson:"Max person rate (%)",maxClearMiss:"Max missed errors on Clear bills (%)",lateMax:"Late evidence that ends the correction path (%, set from pilot)",joinMin:"Min base linkage (%)",clusterGap:"Cluster gap (pts below overall)",disputeMargin:"Allowed dispute increase (pts)",targetSave:"Min biller time saved (%)",maxDelay:"Max added cycle time (h)",maxOverride:"Max override rate (%)",recoverTarget:"Recovery target at scale ($/mo)"}).map(([k,l])=>`<label>${l}<input type="number" step="any" data-th="${k}" value="${p.thresholds[k]}"></label>`).join("")}</div></details>
 </section>
 <details class="panel rcard" data-k="back"><summary><b>Back pocket: business case, evidence so far, confidence math, all inputs</b></summary><div class="rgrid" style="margin-top:10px"><div class="rgrid" style="margin-top:10px">
  <section class="rcard"><h3>Evidence so far (agent ${AGENT_VERSION})</h3>${E?`<div class="kpis"><div class="kpi"><div class="n ${E.wrong?"fail":"pass"}">${E.wrong}</div><div class="l">wrong charges in ${E.runs} live runs (${E.fixes} proposals)</div></div><div class="kpi"><div class="n">${E.mustCaught}/${E.mustTotal}</div><div class="l">must-act bills sent to a person</div></div><div class="kpi"><div class="n">0/14</div><div class="l">simulated AI mistakes that reach money (v2, offline replay)</div></div></div><p class="note">All on 23 synthetic bills I wrote. This is development evidence that the current safeguards routed the tested synthetic failure cases safely; it is not evidence of real-world recall or production safety.</p>`:`<p class="note">No stored live runs for agent ${AGENT_VERSION} in this view.</p>`}
   <p class="note"><b>Base-rate ceiling:</b> at ${A("incidence")}% error incidence, ≤ ${p.thresholds.tol}% wrong per proposal means false charges on clean bills must stay under ${(m.fpCleanMax*100).toFixed(3)}%; only representative bills can show that.</p>
   <p class="note"><b>Confidence math:</b> ≤ ${p.thresholds.tol}% wrong at 95% confidence needs ≈${m.needFix} proposals with 0 wrong (rule of three); ≥ ${p.thresholds.minRecall}% must-act needs ≈${m.needMust} must-act bills.</p></section>
  <section class="rcard"><h3>Business case at full scale (per month)</h3>
   <table class="score mtree"><tr><th>Agent quality</th><th>Operations</th><th>Business outcome</th></tr>
   <tr><td>Catches ${A("recall")}% of errors (${fmtN(m.fixes)} fixes)</td><td>Coverage ${m.coverageToday}% → 100% of bills</td><td><b>${money0(m.recovered)}</b> projected realized recovery · ${money0(m.credits)} credited</td></tr>
   <tr><td>Sends ${A("personRate")}% to a person (${fmtN(m.person)} bills)</td><td>Biller hours ${fmtN(m.hToday)} → ${fmtN(m.hAgent)}</td><td class="${m.laborSaved<0?"fail":""}">${money0(m.laborSaved)} labor ${m.laborSaved<0?"added":"saved"}</td></tr>
   <tr><td>Wrong charges ≤ ${p.thresholds.tol}% (gate)</td><td>Disputes ≤ baseline (gate)</td><td class="${m.net<0?"fail":"pass"}">Net ${money0(m.net)} after ${money0(A("runCost"))} run cost</td></tr>
   <tr><td>Misses ${100-A("recall")}% of errors</td><td>Today's audits already catch ${(m.already*100).toFixed(0)}% of errors</td><td>${money0(m.missed)} still leaks</td></tr></table></section>
 </div>
  <section class="rcard"><h3>All inputs</h3><table class="score"><tr><th>Assumption</th><th>Value</th><th>Source</th></tr>${p.assumptions.map(a=>`<tr><td>${esc(a.label)}${a.note?`<div class="muted">${esc(a.note)}</div>`:""}</td><td><input type="number" step="any" data-as="${a.id}" value="${a.v}"> <span class="muted">${a.unit}</span></td><td><span class="src ${srcCls(a.src)}">${esc(a.src)}</span></td></tr>`).join("")}
  ${p.toggles.map(t=>`<tr><td>${esc(t.label)}</td><td><label class="tg"><input type="checkbox" data-tg="${t.id}" ${t.v?"checked":""}> ${t.v?"Yes":"No"}</label></td><td><span class="src src-asm">Assumption</span></td></tr>`).join("")}</table></section></details>`;
 for(const d of $("rollout").querySelectorAll("details[data-k]"))if(openK.has(d.dataset.k))d.open=true;
 window.scrollTo(0,sy);
 wireRollout();
}
function actualInputs(ph,fields){return`<fieldset><legend>${ph==="shadow"?"Shadow actuals":"Pilot actuals"}</legend>${fields.map(([k,l])=>`<label>${l}<input type="number" step="any" data-act="${ph}.${k}" value="${esc(R.plan.actuals[ph][k])}"></label>`).join("")}</fieldset>`}
function editTable(key,heads,rows,flag){return`<table class="score"><tr>${heads.map(h=>`<th>${h}</th>`).join("")}<th></th></tr>${rows.map((r,i)=>`<tr class="${flag&&flag(r.join(" "))?"hit":""}">${r.map((c,j)=>cellEdit(`${key}.${i}.${j}`,c)).join("")}<td>${flag?flag(r.join(" ")):""}<button class="x" data-delrow="${key}.${i}" title="Remove">×</button></td></tr>`).join("")}</table><button class="btn" data-addrow="${key}">+ row</button>`}
function setPath(path,val){const ks=path.split(".");let o=R.plan;for(const k of ks.slice(0,-1))o=o[k];o[ks[ks.length-1]]=val}
function changed(rerender){R.plan.preset=null;savePlanLocal();if(rerender)renderRollout()}
function wireRollout(){
 for(const b of $("rollout").querySelectorAll("[data-jump]"))b.onclick=()=>{const t=document.getElementById(b.dataset.jump);if(t){if(t.tagName==="DETAILS")t.open=true;t.scrollIntoView({behavior:"smooth",block:"start"})}};
 for(const b of $("rollout").querySelectorAll("[data-expand]"))b.onclick=()=>{for(const d of $("rollout").querySelectorAll("details[data-k]"))if(d.dataset.k!=="back"||b.dataset.expand==="0")d.open=b.dataset.expand==="1"};
 const root=$("rollout");
 for(const el of root.querySelectorAll("[data-as]"))el.onchange=()=>{R.plan.assumptions.find(a=>a.id===el.dataset.as).v=Number(el.value);changed(true)};
 for(const el of root.querySelectorAll("[data-tg]"))el.onchange=()=>{R.plan.toggles.find(t=>t.id===el.dataset.tg).v=el.checked;changed(true)};
 for(const el of root.querySelectorAll("[data-th]"))el.onchange=()=>{R.plan.thresholds[el.dataset.th]=Number(el.value);changed(true)};
 for(const el of root.querySelectorAll("[data-act]"))el.onchange=()=>{const [ph,k]=el.dataset.act.split(".");R.plan.actuals[ph][k]=el.value;changed(true)};
 for(const el of root.querySelectorAll("[data-wf]"))el.onchange=()=>{const [i,k]=el.dataset.wf.split(".");R.plan.workflows[Number(i)][k]=Number(el.value);changed(true)};
 for(const el of root.querySelectorAll("[data-dep]"))el.onchange=()=>{setPath("deps."+el.dataset.dep,el.value);changed(true)};
 for(const el of root.querySelectorAll(".ed[data-path]"))el.onblur=()=>{setPath(el.dataset.path,el.textContent.trim());changed(false)};
 for(const el of root.querySelectorAll("[data-addrow]"))el.onclick=()=>{const k=el.dataset.addrow;R.plan[k].push(R.plan[k][0].map((_,j)=>k==="deps"&&j===2?"Pilot":k==="deps"&&j===3?"Unknown":"…"));changed(true)};
 for(const el of root.querySelectorAll("[data-delrow]"))el.onclick=()=>{const [k,i]=el.dataset.delrow.split(".");R.plan[k].splice(Number(i),1);changed(true)};
 $("rPreset").onchange=e=>{if(PRESETS[e.target.value])applyPreset(e.target.value)};
 $("rReset").onclick=()=>applyPreset("Base plan");
 $("rSave").onclick=savePlanDb;$("rLoad").onclick=loadPlanDb;
 $("rExport").onclick=()=>{const box=$("rJson");box.hidden=!box.hidden;$("rJsonText").value=JSON.stringify(R.plan,null,1)};
}
async function showRollout(on){
 document.body.classList.toggle("rollout-on",on);$("viewReview").classList.toggle("on",!on);$("viewRollout").classList.toggle("on",on);
 if(on){if(!R.plan)R.plan=loadPlan();renderRollout();await loadEvidence();renderRollout()}
}
$("viewReview").onclick=()=>showRollout(false);$("viewRollout").onclick=()=>showRollout(true);
$("rJsonApply").onclick=()=>{try{const p=JSON.parse($("rJsonText").value);if(!p.assumptions||!p.thresholds||!p.actuals)throw new Error("missing sections");R.plan=p;savePlanLocal();$("rJson").hidden=true;renderRollout();rStatus("Imported plan.")}catch(e){rStatus("Import failed: "+e.message)}};
$("rJsonClose").onclick=()=>{$("rJson").hidden=true};
window.__rollout={model,gates,flips,applyPreset,R,upper95,lower95};


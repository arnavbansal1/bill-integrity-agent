/* ---------------- Exception learning: human resolutions become CANDIDATE memory, never automatic truth ----------------
   Source-of-truth precedence: contract/tariff and shipment evidence > operational notes / free text > model inference.
   Validated memory sits below contract/tariff and shipment evidence: it can resolve ambiguity, never override them. */
/* Pattern maturity vs activation: ≥3 examples is a FLOOR for calling something a pattern (placeholder), not the activation
   bar. Activation is risk-tiered by scope, money / customer impact, reversibility and blast radius. All numbers below are
   placeholders that real operational data (error rates, dispute cost, volume per customer) would set. */
const MEM_MIN_EXAMPLES=3;
const TIERS={
 1:{name:"Tier 1 · routing / recommendation",why:"Only sends bills to a person or suggests; never changes a charge. Reversible, small blast radius.",examples:0,
    checks:[["reviewed","Reviewed by billing owner"],["regression","Regression on frozen sets"],["scopeOk","Scope confirmed"]]},
 2:{name:"Tier 2 · contained money rule",why:"One customer, modest dollars, a person approves each charge.",examples:5,
    checks:[["reviewed","Reviewed by billing owner"],["regression","Regression on frozen sets"],["scopeOk","Scope confirmed"],["shadow","Shadow period passed (~2 wks, 0 wrong; placeholder)"]]},
 3:{name:"Tier 3 · high-consequence money rule",why:"Broad scope, high dollars or exposure, hard to reverse, or no per-charge approval.",examples:10,customers:2,
    checks:[["reviewed","Reviewed by billing owner"],["regression","Wider regression: frozen sets + adversarial + random-sample replay per error type"],["scopeOk","Scope confirmed (workflow, error type)"],["ownerOk","Explicit owner approval (billing + pricing)"],["shadow","Shadow validation across scopes (~4 wks; placeholder)"]]}
};
/* Financial consequence (placeholders). Week one: set from the historical distribution of billing adjustments, dispute and
   override data, and the carrier's tolerance for financial and customer harm; recalibrate from shadow results. */
const MEM_FIN={perBillHigh:250,exposureHigh:10000,monthlyTouches:{customer:40,general:400}};
const MEM={items:[],loaded:false};
function memWorkflow(r){const f=r.findings.find(x=>!x.soft&&x.outcome===r.outcome)||r.findings[0];return f?f.title.replace(/\s*\([^)]*\$[^)]*\)/g,"").replace(/[+−-]?\$[\d,.]+/g,"").trim().slice(0,70):"General"}
async function memSave(c){const db=await getDb();if(!db)return;try{await db.collection("memory").doc(c.id).set(JSON.parse(JSON.stringify(c)))}catch(e){logLine("Could not store memory candidate: "+(e&&e.code||e))}}
async function memLoad(){if(MEM.loaded)return;MEM.loaded=true;const db=await getDb();if(!db)return;try{const snap=await db.collection("memory").get();for(const d of snap.docs){const x=d.data();if(!MEM.items.some(y=>y.id===x.id))MEM.items.push(x)}renderMemory()}catch(e){}}
/* A reused resolution moves money if it would let a charge change or a bill go out without review (new outcome Propose fix or Clear);
   it is routing if it only sends bills to a person (Escalate, Request info). */
const movesMoney=dec=>dec.type==="override"&&(dec.outcome==="Propose fix"||dec.outcome==="Clear");
function memFin(c){const v=c.examples.map(e=>e.usd).filter(x=>x!=null);const per=v.length?v.reduce((a,x)=>a+x,0)/v.length:null;
 const touches=c.cls==="Reusable general rule"?MEM_FIN.monthlyTouches.general:MEM_FIN.monthlyTouches.customer;return{per,exposure:per==null?null:per*touches,touches}}
function tierInfo(c){
 if(!c.money)return{tier:1,reasons:["Routing only: never changes a charge"]};
 const general=c.cls==="Reusable general rule";const reasons=[general?"Moves money for all customers":"Moves money for one customer"];let tier=general?3:2;
 const f=memFin(c);
 if(f.per!=null&&f.per>=MEM_FIN.perBillHigh){tier=3;reasons.push(`≈${money(f.per)}/bill ≥ ${money(MEM_FIN.perBillHigh)} (placeholder)`)}
 else if(f.exposure!=null&&f.exposure>=MEM_FIN.exposureHigh){tier=3;reasons.push(`~${money(f.exposure)}/mo exposure ≥ ${money(MEM_FIN.exposureHigh)} (placeholder)`)}
 else if(f.per!=null)reasons.push(`≈${money(f.per)}/bill, ~${money(f.exposure)}/mo exposure`);
 else reasons.push("Dollar impact unknown: treat as high until measured");
 if(f.per==null&&!general){tier=3}
 let postInv=false;try{if(!R.plan)R.plan=loadPlan();postInv=lateMode()!=="none"}catch(e){} /* rollout plan: is correction after invoicing in use? */
 if(postInv){tier=3;reasons.push("Applied after invoicing (rebills): harder to reverse, dispute risk")}
 if(!c.humanApproves){tier=3;reasons.push("No person approves each charge")}
 else reasons.push("A person still approves each charge");
 return{tier,reasons};
}
function tierOf(c){return tierInfo(c).tier}
function learnFrom(b,r,dec){
 const money=movesMoney(dec);
 const scope=dec.cls==="Customer-specific rule"?`Customer: ${CUSTOMERS[b.cust].name}`:dec.cls==="Reusable general rule"?`All customers · ${memWorkflow(r)}`:dec.cls==="Data-quality issue"?"Data owner (by evidence source)":`PRO ${b.pro} only`;
 const key=`${dec.cls}|${dec.cls==="Customer-specific rule"?b.cust:""}|${memWorkflow(r)}|${money?"money":"routing"}`;
 const example={pro:b.pro,cust:b.cust,usd:r.delta!=null?Math.abs(r.delta):null,decision:dec.type==="override"?`Override → ${dec.outcome}`:"Escalated",reason:dec.note,source:dec.src,at:new Date().toISOString()};
 if(dec.cls==="One-off exception"){const l={id:`log-${b.pro}-${Date.now()}`,kind:"log",key,workflow:memWorkflow(r),cls:dec.cls,scope,examples:[example]};MEM.items.push(l);memSave(l);return}
 const ex=MEM.items.find(x=>x.key===key&&x.kind!=="log");
 if(ex){ex.examples.push(example);memSave(ex);return}
 const c={id:`cand-${Date.now()}`,kind:dec.cls==="Data-quality issue"?"data":"candidate",key,workflow:memWorkflow(r),cls:dec.cls,scope,money,keyAcct:!!r.key,examples:[example],
  reviewed:false,scopeOk:false,regression:false,shadow:false,ownerOk:false,amOk:false,humanApproves:true,lowSource:dec.src.startsWith("Operational")||dec.src.startsWith("Biller")};
 MEM.items.push(c);memSave(c);
}
function memReq(c){const t=TIERS[tierOf(c)];const checks=[...t.checks];if(tierOf(c)>1&&c.keyAcct)checks.push(["amOk","Account-manager sign-off (key account)"]);return{t,checks}}
function memStatus(c){
 if(c.kind==="data")return"Routed to data owner";if(c.kind==="log")return"Logged (one-off)";
 const {t,checks}=memReq(c);const custs=new Set(c.examples.map(e=>e.cust)).size;
 const ok=checks.every(([k])=>c[k])&&c.examples.length>=t.examples&&(!t.customers||custs>=t.customers)&&!(c.money&&c.lowSource&&!c.examples.some(e=>!e.source.startsWith("Operational")&&!e.source.startsWith("Biller")));
 return ok?"Active":"Candidate (inactive)"}
function renderMemory(){
 const el=$("memBody");if(!el)return;
 const rows=MEM.items.filter(x=>x.kind!=="log"),logs=MEM.items.filter(x=>x.kind==="log");
 const base=(()=>{const live=state.runs.filter(r=>r.mode==="live"&&r.score&&r.version===AGENT_VERSION);if(!live.length)return"no stored live runs in this view";const w=live.reduce((a,r)=>a+r.score.summary.wrong,0),mc=live.reduce((a,r)=>a+r.score.summary.mustCaught,0),mn=live.reduce((a,r)=>a+r.score.summary.mustN,0);return `${w} wrong charges, ${mc}/${mn} must-act across ${live.length} live runs`})();
 el.innerHTML=`<p class="note"><b>Source-of-truth precedence:</b> contract / tariff and shipment evidence (BOL, POD, W&amp;I) &gt; operational notes and free text &gt; model inference. A learned rule sits below contract and shipment evidence: it can resolve ambiguity, never override them. A resolution that contradicts the contract is a contract or data issue for its owner, not memory.</p>
 <p class="note">Biller resolutions become <b>candidates</b>, never automatic truth. <b>${MEM_MIN_EXAMPLES} examples is a floor for calling it a pattern, not the activation bar.</b> Activation is tiered by the <b>worst factor</b>: scope / blast radius, dollars per bill and expected monthly exposure, reversibility and dispute risk, and whether a person still approves each charge. These are hard escalation factors on purpose: large financial impact, broad scope, post-invoice rebills or no per-charge approval should never be averaged away by a good score elsewhere, so tier assignment stays conservative, auditable and easy to explain. Within a tier, a lighter score (e.g. dollars × dispute risk) can order which rules get reviewed first. If production data shows the hard gates are over-conservative, recalibrate the thresholds or move a factor into within-tier scoring. Dollar thresholds, example counts and shadow lengths are placeholders: in week one they come from the historical distribution of adjustments, dispute and override data, and the carrier's tolerance for financial and customer harm, then get recalibrated from shadow results. <b>Tier 1</b> routing only: review + regression + scope. <b>Tier 2</b> customer-specific money rule with modest dollars, approved per charge: ≥${TIERS[2].examples} examples, a short shadow period, account-manager sign-off for key accounts. <b>Tier 3</b> general money rule, or any money rule with high dollars or exposure, applied after invoicing, or without per-charge approval: ≥${TIERS[3].examples} examples across ≥${TIERS[3].customers} customers, wider regression, explicit owner approval, shadow validation. Money rules also need at least one document-backed example. Regression baseline: ${base}.</p>
 ${rows.length?`<table class="score"><tr><th>Candidate</th><th>Type · scope</th><th>Risk tier</th><th>Examples</th><th>Evidence</th><th>Required before activation</th><th>Status</th></tr>${rows.map(c=>{const st=memStatus(c);if(c.kind==="data")return`<tr><td>${esc(c.workflow)}<div class="muted">“${esc(c.examples[c.examples.length-1].reason)}”</div></td><td>${esc(c.cls)}<div class="muted">${esc(c.scope)}</div></td><td>–</td><td>${c.examples.length}</td><td>${esc(c.examples[0].source.split(" (")[0])}</td><td class="muted">Not memory: fix the data at its source</td><td><span class="tag t-Request">${st}</span></td></tr>`;
  const {t,checks}=memReq(c);const custs=new Set(c.examples.map(e=>e.cust)).size;const need=Math.max(t.examples,0);const ti=tierInfo(c);
  return`<tr><td>${esc(c.workflow)}<div class="muted">“${esc(c.examples[c.examples.length-1].reason)}”</div></td><td>${esc(c.cls)}<div class="muted">${esc(c.scope)}</div></td><td><b>${esc(t.name)}</b><div class="muted">${ti.reasons.map(esc).join(" · ")}</div>${c.money?`<label class="muted"><input type="checkbox" data-mem="${c.id}" data-k="humanApproves" ${c.humanApproves?"checked":""}> A person approves each resulting charge</label>`:""}</td>
  <td class="${c.examples.length<need?"warn":""}">${c.examples.length}${need?` / ${need}`:""}${t.customers?`<div class="muted">${custs} / ${t.customers} customers</div>`:""}<div class="muted">${c.examples.length>=MEM_MIN_EXAMPLES?"pattern":"emerging"}</div></td>
  <td>${esc([...new Set(c.examples.map(e=>e.source.split(" (")[0]))].join(", "))}${c.lowSource&&c.money?'<div class="muted">Needs a document-backed example</div>':""}</td>
  <td class="memchk">${checks.map(([k,l])=>`<label><input type="checkbox" data-mem="${c.id}" data-k="${k}" ${c[k]?"checked":""}> ${esc(l)}</label>`).join("")}</td>
  <td><span class="tag ${st==="Active"?"t-Clear":"t-Escalate"}">${st}</span></td></tr>`}).join("")}</table>`:`<p class="note">No candidates yet. Override or escalate a bill and classify it as anything but a one-off.</p>`}
 ${logs.length?`<p class="note">${logs.length} one-off resolution${logs.length>1?"s":""} logged for audit only (not memory).</p>`:""}`;
 for(const cb of el.querySelectorAll("[data-mem]"))cb.onchange=()=>{const c=MEM.items.find(x=>x.id===cb.dataset.mem);c[cb.dataset.k]=cb.checked;memSave(c);renderMemory()};
}
function act(k){const pro=state.sel;if(k==="override"){$("esForm").classList.remove("show");$("ovForm").classList.add("show");return}if(k==="escalate"){$("ovForm").classList.remove("show");$("esForm").classList.add("show");return}state.decisions[pro]={type:k};const i=BILLS.findIndex(b=>b.pro===pro);const next=BILLS.slice(i+1).find(b=>!state.decisions[b.pro]);renderAll();if(next){state.sel=next.pro;state.selF=null;setTimeout(renderAll,250)}}

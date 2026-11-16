/* ---------------- Scoring vs the frozen key (metrics and order from EVAL_PLAN_blind_v1.md) ---------------- */
const PERSON=o=>o==="Escalate"||o==="Request info";
function scoreRun(R){
 const rows=[];const S={n:0,wrong:0,wrongUsd:0,mustN:0,mustCaught:0,exact:0,safe:0,dollarN:0,dollarOk:0,fixN:0,missedRecovery:0,overEscalated:0};
 for(const b of BILLS){const k=ANSWER_KEY[b.pro],r=R[b.pro];if(!k||!r)continue;S.n++;
  const exact=r.outcome===k.outcome;
  const dOk=k.outcome==="Propose fix"?(r.delta!=null&&Math.abs(r.delta-k.delta)<0.005):k.outcome==="Clear"?(r.delta==null||Math.abs(r.delta)<0.005):true;
  const wrong=r.outcome==="Propose fix"&&(k.outcome!=="Propose fix"||!dOk);
  const must=PERSON(k.outcome),caught=PERSON(r.outcome);
  const safe=!exact&&(k.safe_alt||[]).includes(r.outcome);
  let label;
  if(wrong){label="WRONG CHARGE";S.wrong++;S.wrongUsd+=Math.abs((r.delta||0)-(k.outcome==="Propose fix"?k.delta:0))}
  else if(must&&!caught)label="MISSED: should go to a person";
  else if(exact&&dOk)label="Pass";
  else if(must&&caught)label="Pass (person, other route)";
  else if(safe)label="Safe deviation (pre-registered)";
  else if(k.outcome==="Propose fix"&&r.outcome==="Clear")label="Missed recovery";
  else if(PERSON(r.outcome))label="Over-escalated (not pre-registered)";
  else label="Fail";
  if(must){S.mustN++;if(caught)S.mustCaught++}
  if(exact&&dOk||must&&caught)S.exact++;
  if(safe)S.safe++;
  if(k.outcome==="Propose fix"){S.fixN++;if(r.outcome==="Clear")S.missedRecovery++;if(r.outcome==="Propose fix"){S.dollarN++;if(dOk)S.dollarOk++}}
  if(label.startsWith("Over-escalated"))S.overEscalated++;
  const caughtBy=r.findings.filter(f=>!f.soft&&f.outcome===r.outcome).map(f=>f.basis).join("; ")||"–";
  rows.push({pro:b.pro,k,r:{outcome:r.outcome,delta:r.delta},label,caughtBy})}
 S.wrongUsd=r2(S.wrongUsd);return{summary:S,rows};
}
const short=o=>({"Clear":"Clear","Propose fix":"Fix","Request info":"Info","Escalate":"Esc"}[o]||o);
const cellTxt=(o,d)=>o?`${short(o)}${o==="Propose fix"&&d!=null?" "+money(d,true):""}`:"–";
function labelClass(l){return l==="WRONG CHARGE"||l.startsWith("MISSED")?"fail":l.startsWith("Pass")?"pass":"warn"}
function renderEval(){
 const R=state.results;const ds=DATASETS[DATASET];
 let cur="";
 if(Object.keys(R).length){
  const {summary:S,rows}=scoreRun(R);const v=state.viewing;
  cur=`<h3 class="evh">${v?`Run ${v.n} · ${v.mode}${v.version?" · agent "+v.version:""}`:"Current run"} · ${ds.label}</h3>
  <div class="kpis"><div class="kpi"><div class="n ${S.wrong?"fail":"pass"}">${S.wrong}</div><div class="l">Wrong proposed charges${S.wrong?" ("+money(S.wrongUsd)+" off)":""}</div></div>
  <div class="kpi"><div class="n ${S.mustCaught<S.mustN?"fail":"pass"}">${S.mustCaught}/${S.mustN}</div><div class="l">Must-act bills sent to a person</div></div>
  <div class="kpi"><div class="n">${S.exact}/${S.n}</div><div class="l">Routed as the key says${S.safe?` · +${S.safe} safe deviation${S.safe>1?"s":""}`:""}</div></div>
  <div class="kpi"><div class="n">${S.dollarOk}/${S.dollarN}</div><div class="l">Proposed fixes exact to the cent</div></div>
  <div class="kpi"><div class="n">${S.missedRecovery}/${S.fixN}</div><div class="l">Missed recovery (said Clear, key says fix)</div></div></div>
  <table class="score"><tr><th>PRO</th><th>Trap</th><th>Expected (frozen key)</th><th>Actual (this run)</th><th>Result</th><th>Caught by</th></tr>${rows.map(x=>`<tr><td>${x.pro}${PERSON(x.k.outcome)?" ★":""}</td><td>${esc(x.k.trap||"")}</td><td>${x.k.outcome}${x.k.outcome==="Propose fix"?" · "+money(x.k.delta,true):""}${x.k.safe_alt&&x.k.safe_alt.length?` <span class="muted">(safe alt: ${x.k.safe_alt.join(", ")})</span>`:""}</td><td>${x.r.outcome}${x.r.outcome==="Propose fix"&&x.r.delta!=null?" · "+money(x.r.delta,true):""}</td><td class="${labelClass(x.label)}">${x.label}</td><td>${esc(x.caughtBy)}</td></tr>`).join("")}</table>`;
 }else cur=`<p class="note">No run on the ${ds.label} yet.${DATASET==="blind"?" Click <b>Run 3× live</b>: the blind set only counts live AI runs.":""}</p>`;
 $("evalBody").innerHTML=cur+renderStability()+`<p class="note">★ = the key sends this bill to a person. The key was frozen before any AI run (sha256 ${ds.sha.slice(0,12)}…) and is never sent to the model. Decision rules: any wrong proposed charge or a must-act bill not sent to a person = fix before anything else; safe deviations cost automation, never money.</p>`;
 for(const a of $("evalBody").querySelectorAll("[data-view]"))a.onclick=e=>{e.preventDefault();viewRun(a.dataset.view)};
}
/* Run-to-run stability: does randomness in the AI ever change what money moves? */
function renderStability(){
 const live=state.runs.filter(r=>r.dataset===DATASET&&r.mode==="live"&&r.outcomes);if(!live.length)return"";
 const vers=[...new Set(live.map(r=>r.version))];
 return vers.map(ver=>{const L=live.filter(r=>r.version===ver);
  const runRows=L.map(r=>{const S=r.score.summary;return`<tr><td><a href="#" data-view="${r.id||String(r.n)+r.dataset}">Run ${r.n}</a></td><td>${r.at?new Date(r.at).toLocaleString():""}</td><td>${r.ms!=null?(r.ms/1000).toFixed(1)+" s":"–"}</td><td class="${S.wrong?"fail":"pass"}">${S.wrong}</td><td class="${S.mustCaught<S.mustN?"fail":"pass"}">${S.mustCaught}/${S.mustN}</td><td>${S.exact}/${S.n}${S.safe?" +"+S.safe+" safe":""}</td><td>${S.dollarOk}/${S.dollarN}</td><td>${S.missedRecovery}</td><td>${r.problems}</td></tr>`}).join("");
  let unstable=0,unstableMoney=0,everWrong=0;
  const billRows=BILLS.map(b=>{const k=ANSWER_KEY[b.pro];const cells=L.map(r=>({o:r.outcomes[b.pro],d:r.deltas[b.pro],lab:(r.score.rows.find(x=>x.pro===b.pro)||{}).label||""}));
   const sig=c=>c.o+"|"+(c.o==="Propose fix"?c.d:"");const same=cells.every(c=>sig(c)===sig(cells[0]));
   const money_=new Set(cells.map(c=>c.o==="Propose fix"?"post "+c.d:PERSON(c.o)?"person":"none"));
   if(!same)unstable++;if(money_.size>1)unstableMoney++;const wr=cells.some(c=>c.lab==="WRONG CHARGE"||c.lab.startsWith("MISSED"));if(wr)everWrong++;
   return`<tr><td>${b.pro}</td><td>${cellTxt(k.outcome,k.delta)}</td>${cells.map(c=>`<td class="${labelClass(c.lab)}" title="${esc(c.lab)}">${cellTxt(c.o,c.d)}</td>`).join("")}<td class="${same?"pass":"warn"}">${same?"Same":"Varies"}</td><td class="${money_.size>1?"warn":""}">${money_.size>1?"Yes":"No"}</td></tr>`}).join("");
  return`<h3 class="evh">Across ${L.length} live run${L.length>1?"s":""} · agent ${ver}</h3>
  <table class="score"><tr><th>Run</th><th>When</th><th>Time</th><th>Wrong charges</th><th>Must-act</th><th>Routed right</th><th>Dollars exact</th><th>Missed recovery</th><th>Validation problems</th></tr>${runRows}</table>
  ${L.length>1?`<p><b>Stability:</b> ${BILLS.length-unstable}/${BILLS.length} bills got the same outcome and amount in every run. Randomness changed what money would move on <b>${unstableMoney}</b> bill${unstableMoney===1?"":"s"}. Bills with a wrong charge or a missed must-act in any run: <b>${everWrong}</b>.</p>`:""}
  <table class="score"><tr><th>PRO</th><th>Key</th>${L.map(r=>`<th>Run ${r.n}</th>`).join("")}<th>Outcome</th><th>Money changes?</th></tr>${billRows}</table>`}).join("");
}
function renderLog(){
 const runs=state.runs.filter(r=>r.dataset===DATASET);
 $("logBody").innerHTML=`<table class="score"><tr><th>Run</th><th>Agent</th><th>Mode</th><th>Time</th><th>Output size</th><th>Validation problems</th><th>Outcomes</th></tr>${runs.map(r=>`<tr><td>${r.n}</td><td>${r.version||""}</td><td>${r.mode}${r.stored?" (stored)":""}</td><td>${r.ms!=null?(r.ms/1000).toFixed(1)+" s":"–"}</td><td>${r.size??"–"}</td><td>${r.problems}</td><td>${r.outcomes?BILLS.map(b=>(r.outcomes[b.pro]||"-")[0]).join(""):"–"}</td></tr>`).join("")}</table><pre class="raw">${esc(state.log.join("\n"))}</pre>`;
}
function renderRaw(){$("raw").textContent=state.raw==null?"No run yet.":JSON.stringify(state.raw,null,2)}
function renderAll(){renderControls();renderSummary();renderQueue();renderDocs();renderRight();renderEval();renderRaw();renderLog();renderMemory()}


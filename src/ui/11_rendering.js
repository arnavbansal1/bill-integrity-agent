/* ---------------- Rendering ---------------- */
function setStatus(s){$("status").textContent=s}
function tagClass(o){return"t-"+String(o).split(" ")[0]}
function renderControls(){const hasSaved=!!DATASETS[DATASET].saved;if(!hasSaved&&state.mode==="saved"&&state.sample)state.mode="live";$("dsDev").classList.toggle("on",DATASET==="dev");$("dsBlind").classList.toggle("on",DATASET==="blind");$("dsDev").disabled=$("dsBlind").disabled=state.busy;$("modeSaved").disabled=!hasSaved||state.busy;$("run3Btn").disabled=state.busy||!state.sample;$("run3Btn").title=state.sample?"Three independent live AI runs, cache off":"Live AI unavailable in this view";$("runBtn").disabled=state.busy;$("stopBtn").hidden=!state.busy;$("modeSaved").classList.toggle("on",state.mode==="saved");$("modeLive").classList.toggle("on",state.mode==="live");$("modeLive").disabled=!state.sample;$("modeLive").title=state.sample?"Call Claude live":"Live AI unavailable in this view"}
function renderSummary(){
 const R=Object.values(state.results);if(!R.length){$("summary").innerHTML="";return}
 const cnt=o=>R.filter(r=>r.outcome===o).length;
 const up=R.filter(r=>r.outcome==="Propose fix"&&r.delta>0).reduce((a,r)=>a+r.delta,0);
 const down=R.filter(r=>r.outcome==="Propose fix"&&r.delta<0).reduce((a,r)=>a+r.delta,0);
 let posted=0;for(const [pro,dec] of Object.entries(state.decisions)){if(dec.type==="approve"&&state.results[pro].delta)posted+=state.results[pro].delta}
 const reviewed=Object.keys(state.decisions).length;
 $("summary").innerHTML=`<span class="chip">Bills <b>${R.length}</b></span><span class="chip">Proposed fixes <b>${cnt("Propose fix")}</b> · identified <b>${money(up,true)}</b> under-billed, <b>${money(down,true)}</b> over-billed</span><span class="chip">Escalate <b>${cnt("Escalate")}</b></span><span class="chip">Request info <b>${cnt("Request info")}</b></span><span class="chip">Clear <b>${cnt("Clear")}</b></span><span class="chip">Approved to post <b>${money(r2(posted),true)}</b></span><span class="chip">Reviewed <b>${reviewed}/${R.length}</b></span>`;
}
function renderQueue(){
 $("queue").innerHTML=BILLS.map(b=>{const r=state.results[b.pro];const dec=state.decisions[b.pro];
  return`<li class="qitem${state.sel===b.pro?" sel":""}" data-pro="${b.pro}"><div class="qtop"><span class="qpro">PRO ${b.pro}</span>${r?`<span class="tag ${tagClass(r.outcome)}">${r.outcome}</span>`:""}</div><div class="qcust">${esc(CUSTOMERS[b.cust].name)}${CUSTOMERS[b.cust].key?" · key account":""}</div><div class="qmeta"><span>${r&&r.delta?money(r.delta,true):r&&r.outcome==="Clear"?"No change":r?"Pending":""}</span><span class="done${dec?" ok":""}">${dec?decLabel(dec):"To review"}</span></div></li>`}).join("");
 for(const li of $("queue").querySelectorAll(".qitem"))li.onclick=()=>{state.sel=li.dataset.pro;state.selF=null;renderAll()};
}
function decLabel(d){return{approve:"✓ Approved",confirm:"✓ Confirmed clear",request:"✓ Info requested",override:"✓ Overridden",escalate:"✓ Escalated"}[d.type]||"✓ Done"}
function renderDocs(){
 const b=BILLS.find(x=>x.pro===state.sel);const r=state.results[state.sel];if(!b){$("docs").innerHTML='<div class="empty">Select a bill.</div>';return}
 const marks={};if(r)for(const f of r.findings)for(const q of f.quotes)if(q.ok!==false&&q.text){(marks[q.doc]=marks[q.doc]||[]).push({text:q.text,fid:f.id})}
 const html=[];
 for(const d of DOC_ORDER){
  if(!b.docs[d]){if(["bol","driver","pod"].includes(d))html.push(`<div class="doc missing"><h3><span>${DOC_LABELS[d]}</span><span>not provided</span></h3><p>Referenced or expected, but not in the file. Findings that need it go to Request info.</p></div>`);continue}
  html.push(`<div class="doc" data-doc="${d}"><h3><span>${DOC_LABELS[d]}</span></h3><pre>${highlight(b.docs[d],marks[d]||[])}</pre></div>`);
 }
 $("docs").innerHTML=html.join("");
 for(const m of $("docs").querySelectorAll("mark"))m.onclick=()=>{state.selF=m.dataset.fid;renderRight();syncMarks();const el=$("right").querySelector(`[data-fid="${m.dataset.fid}"]`);if(el)el.scrollIntoView({block:"nearest",behavior:"smooth"})};
 syncMarks();
}
function highlight(text,ms){
 const nt=text;const ranges=[];
 for(const m of ms){const idx=findLoose(nt,m.text);if(idx)ranges.push({...idx,fid:m.fid})}
 ranges.sort((a,b)=>a.s-b.s);const out=[];let pos=0;
 for(const g of ranges){if(g.s<pos)continue;out.push(esc(nt.slice(pos,g.s)));out.push(`<mark data-fid="${g.fid}">${esc(nt.slice(g.s,g.e))}</mark>`);pos=g.e}
 out.push(esc(nt.slice(pos)));return out.join("");
}
function findLoose(text,q){
 const tn=norm(q).toLowerCase();if(!tn)return null;
 // map normalized index back to raw by scanning
 const lower=text.toLowerCase().replace(/[‘’]/g,"'").replace(/[“”]/g,'"');
 let i=lower.indexOf(tn);if(i>=0)return{s:i,e:i+tn.length};
 const words=tn.split(" ");const re=new RegExp(words.map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("\\s+"),"i");const m=re.exec(lower);return m?{s:m.index,e:m.index+m[0].length}:null;
}
function syncMarks(){for(const m of document.querySelectorAll("mark"))m.classList.toggle("on",m.dataset.fid===state.selF)}
function renderRight(){
 const b=BILLS.find(x=>x.pro===state.sel);const r=state.results[state.sel];if(!b||!r){$("right").innerHTML='<div class="empty">Run the check, then select a bill.</div>';return}
 const dec=state.decisions[b.pro];
 const rows=[];const dp=r.draftParams,ep=r.expParams,ex=r.expected,dr=r.draft;
 const cell=(a,bv,fmt)=>`<td>${fmt(a)}</td><td class="${ex&&a!==bv?"chg":""}">${ex?fmt(bv):"pending"}</td>`;
 rows.push(`<tr><td>Linehaul · ${dp.weight} lb, class ${dp.cls}${dr.eff!==dp.cls?" (rated "+dr.eff+")":""}${ex&&(ep.weight!==dp.weight||ep.cls!==dp.cls)?` → ${ep.weight} lb, class ${ep.cls}${ex.eff!==ep.cls?" (rated "+ex.eff+")":""}`:""}</td>${cell(dr.line,ex?ex.line:null,money)}</tr>`);
 rows.push(`<tr><td>Fuel surcharge · ${pct(dp.fsc)}${ex&&ep.fsc!==dp.fsc?" → "+pct(ep.fsc):""}</td>${cell(dr.fsc,ex?ex.fsc:null,money)}</tr>`);
 const accs=[...new Set([...dp.acc,...(ex?ep.acc:[])])];
 for(const a of accs)rows.push(`<tr><td>${SERVICE_NAMES[a]}</td>${cell(dr.acc[a]??0,ex?(ex.acc[a]??0):null,money)}</tr>`);
 rows.push(`<tr class="tot"><td>Total</td>${cell(dr.total,ex?ex.total:null,money)}</tr>`);
 const headline={"Clear":"No change needed","Propose fix":`Proposed change ${money(r.delta,true)}`,"Request info":"Waiting on a missing document","Escalate":"A person must decide"}[r.outcome];
 const actions=r.outcome==="Propose fix"?[["approve","Approve fix","primary"],["override","Override",""],["escalate","Escalate",""]]:r.outcome==="Clear"?[["confirm","Confirm clear","primary"],["override","Override",""],["escalate","Escalate",""]]:r.outcome==="Request info"?[["request","Send request","primary"],["override","Override",""],["escalate","Escalate",""]]:[["escalate","Escalate to billing owner","primary"],["override","Override",""]];
 $("right").innerHTML=`
 <div class="outcome"><div><div class="big">PRO ${b.pro} · ${headline}</div><p class="why">${esc(CUSTOMERS[b.cust].name)} · contract ${ex?ep.contract:dp.contract}${r.key?" · <b>key account: account manager sees any rebill first</b>":""}</p></div><span class="tag ${tagClass(r.outcome)}">${r.outcome}</span></div>
 ${dec?`<div class="decision"><b>${decLabel(dec)}</b>${dec.outcome?` → ${esc(dec.outcome)}`:""}${dec.note?` · “${esc(dec.note)}”`:""}${dec.cls?` · <span class="muted">${esc(dec.cls)}; evidence: ${esc(dec.src)}</span>`:""} <button class="btn" id="undoBtn" style="margin-left:6px;padding:3px 9px">Undo</button></div>`:`<div class="actions">${actions.map(([k,l,c])=>`<button class="btn ${c}" data-act="${k}">${l}</button>`).join("")}</div>`}
 <div class="form" id="ovForm"><label for="ovOutcome">New outcome</label><select id="ovOutcome"><option>Clear</option><option>Propose fix</option><option>Request info</option><option>Escalate</option></select><label for="ovNote">Reason (required)</label><input id="ovNote" placeholder="Why you are overriding"><label for="ovSrc">Supporting evidence</label><select id="ovSrc"><option>Contract / tariff</option><option selected>Shipment document (BOL, POD, W&amp;I)</option><option>Operational note (driver, terminal, email)</option><option>Biller judgment (no document)</option></select><label for="ovCls">This looks like</label><select id="ovCls"><option selected>One-off exception</option><option>Customer-specific rule</option><option>Reusable general rule</option><option>Data-quality issue</option></select><div class="actions"><button class="btn primary" id="ovSave">Save override</button><button class="btn" id="ovCancel">Cancel</button></div></div>
 <div class="form" id="esForm"><label for="esNote">Reason (required)</label><input id="esNote" placeholder="What the billing owner needs to decide"><label for="esSrc">Supporting evidence</label><select id="esSrc"><option>Contract / tariff</option><option selected>Shipment document (BOL, POD, W&amp;I)</option><option>Operational note (driver, terminal, email)</option><option>Biller judgment (no document)</option></select><label for="esCls">This looks like</label><select id="esCls"><option selected>One-off exception</option><option>Customer-specific rule</option><option>Reusable general rule</option><option>Data-quality issue</option></select><div class="actions"><button class="btn primary" id="esSave">Escalate</button><button class="btn" id="esCancel">Cancel</button></div></div>
 <table class="inv"><tr><th></th><th>Draft</th><th>Expected</th></tr>${rows.join("")}</table>
 ${r.findings.map(f=>`<div class="finding${state.selF===f.id?" sel":""}" data-fid="${f.id}"><div class="ftop"><span class="ftitle">${esc(f.title)}</span><span class="tag t-${f.status.split(" ")[0]}">${f.status}</span></div>
  ${f.quotes.length||f.facts.length?`<div class="lab">Source facts</div>${f.quotes.map(q=>`<div class="q${q.ok===false?" bad":""}">“${esc(q.text)}” <small>· ${DOC_LABELS[q.doc]||"unknown doc"}${q.ok===false?" · NOT FOUND in documents":""}</small></div>`).join("")}${f.facts.map(x=>`<div class="fl">${esc(x)}</div>`).join("")}`:""}
  <div class="lab">Assessment</div><div class="fl">${esc(f.why)}</div><div class="fl"><b>Next:</b> ${esc(f.next)}</div><div class="basis">Basis: ${esc(f.basis)}</div></div>`).join("")}`;
 for(const el of $("right").querySelectorAll(".finding"))el.onclick=()=>{state.selF=el.dataset.fid;for(const x of $("right").querySelectorAll(".finding"))x.classList.toggle("sel",x===el);syncMarks();const m=document.querySelector(`mark[data-fid="${el.dataset.fid}"]`);if(m)m.scrollIntoView({block:"center",behavior:"smooth"})};
 for(const btn of $("right").querySelectorAll("[data-act]"))btn.onclick=()=>act(btn.dataset.act);
 const u=$("undoBtn");if(u)u.onclick=()=>{delete state.decisions[b.pro];renderAll()};
 $("ovSave").onclick=()=>{const n=$("ovNote").value.trim();if(!n){$("ovNote").focus();$("ovNote").placeholder="A note is required";return}state.decisions[b.pro]={type:"override",outcome:$("ovOutcome").value,note:n,src:$("ovSrc").value,cls:$("ovCls").value};learnFrom(b,r,state.decisions[b.pro]);renderAll()};
 $("ovCancel").onclick=()=>$("ovForm").classList.remove("show");
 $("esSave").onclick=()=>{const n=$("esNote").value.trim();if(!n){$("esNote").focus();$("esNote").placeholder="A note is required";return}state.decisions[b.pro]={type:"escalate",note:n,src:$("esSrc").value,cls:$("esCls").value};learnFrom(b,r,state.decisions[b.pro]);renderAll()};
 $("esCancel").onclick=()=>$("esForm").classList.remove("show");
}

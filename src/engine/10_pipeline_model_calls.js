/* ---------------- Pipeline ---------------- */
function process(raw,meta){
 const {by,problems}=validate(raw);
 const results={};for(const b of BILLS)results[b.pro]=evaluate(b,by[b.pro]||null,problems);
 state.results=results;state.raw=raw;state.decisions={};
 const run={n:state.runs.filter(r=>r.dataset===DATASET).length+1,dataset:DATASET,version:AGENT_VERSION,at:new Date().toISOString(),mode:meta.mode,ms:meta.ms,size:meta.size,problems:problems.length,problemList:problems,outcomes:Object.fromEntries(BILLS.map(b=>[b.pro,results[b.pro].outcome])),deltas:Object.fromEntries(BILLS.map(b=>[b.pro,results[b.pro].delta]))};
 run.score=scoreRun(results);run.raw=raw;
 if(!state.sel||!results[state.sel])state.sel=BILLS[0].pro;
 if(meta.replay){state.viewing=meta.replay;renderAll();return results}
 state.viewing=run;state.runs.push(run);
 logLine(`Run ${run.n} (${meta.mode}): ${meta.ms!=null?meta.ms+" ms, ":""}${meta.size!=null?meta.size+" chars, ":""}${problems.length} validation problem(s)`);
 for(const pr of problems)logLine(`  · ${pr.pro}: ${pr.msg}`);
 if(!state.sel||!results[state.sel])state.sel=BILLS[0].pro;
 renderAll();
 return results;
}
window.__runWith=function(raw){return process(raw,{mode:"test",ms:null,size:null})};

function buildPrompt(){
 const docs=BILLS.map(b=>`<bill pro="${b.pro}">\n`+DOC_ORDER.filter(d=>b.docs[d]).map(d=>`<doc id="${d}" title="${DOC_LABELS[d]}">\n${b.docs[d]}\n</doc>`).join("\n")+`\n</bill>`).join("\n");
 return `<documents>\n${docs}\n</documents>

You are extracting evidence from LTL freight documents for a pre-invoice billing check. You do NOT compute charges, choose contracts or decide outcomes; fixed rules do that.

Instructions:
1. Return one object per bill in the documents, in the same order.
2. services: every accessorial service mentioned anywhere. code is one of LIFTGATE, INSIDE, RESIDENTIAL, APPT; if a service does not fit, use its own short name so it can be reviewed. performed is "yes" (a delivery document says it was done), "no" (a document says it was not done or not needed), "requested" (asked for, e.g. on the bill of lading) or "unclear". One entry per supporting quote.
3. inspection: if a weight and inspection certificate exists, give weight_lb, pieces, dims_in [length, width, height] in inches as plain numbers, weight_quote and dims_quote copied exactly, and doc "inspection". Otherwise null.
4. pickup_dates: EVERY pickup date stated in any document, each with its exact quote and doc id, as YYYY-MM-DD (year 2026 if not stated). Do not resolve conflicts; list them all.
5. quote: copy the exact words from the document, character for character. doc: the doc id the quote came from.
6. If something is ambiguous, say so with "unclear" or in notes. Never guess.

Output format: reply with only a JSON array, no prose:
[{"pro":"4471001","services":[{"code":"LIFTGATE","performed":"yes","quote":"...","doc":"driver"}],"inspection":null,"pickup_dates":[{"date":"2026-11-04","quote":"...","doc":"bol"}],"notes":"","confidence":"high|medium|low"}]`;
}

async function liveOnce(i,n){
 const prompt=buildPrompt();const t0=performance.now();
 setStatus(`Live run ${i}/${n}: thinking… (approve the Claude prompt if it appears)`);
 try{
  const raw=await state.sample.json(prompt,{cache:false,signal:state.ctl.signal,onText:({text})=>setStatus(`Live run ${i}/${n}: receiving AI output… ${text.length} chars`)});
  const ms=Math.round(performance.now()-t0);const size=JSON.stringify(raw).length;
  process(raw,{mode:"live",ms,size});await persistRun(state.runs[state.runs.length-1],raw,null);return true;
 }catch(e){
  const code=e&&e.code||"error";const ms=Math.round(performance.now()-t0);logLine(`Live run ${i} failed after ${ms} ms: ${code}${e&&e.message?" – "+e.message:""}`);
  if(code==="invalid_json"&&e.text){$("raw").textContent=e.text}
  if(code!=="cancelled"&&code!=="not_granted")await persistRun({dataset:DATASET,version:AGENT_VERSION,at:new Date().toISOString(),mode:"live",ms,failed:code},null,{code,message:String(e&&e.message||""),text:e&&e.text?String(e.text).slice(0,60000):null});
  throw e;
 }
}
async function runLive(n){
 n=n||1;
 if(!state.sample){setStatus("Live AI is not available in this view."+(DATASETS[DATASET].saved?" Showing the saved run.":""));if(DATASETS[DATASET].saved)runSaved();return}
 state.busy=true;renderControls();state.ctl=new AbortController();let done=0;
 try{for(let i=1;i<=n;i++){try{if(await liveOnce(i,n))done++}catch(e){const code=e&&e.code||"error";if(code==="cancelled"||code==="not_granted"){setStatus(code==="cancelled"?"Stopped.":"Claude was not allowed for this page.");break}}}
  if(done)setStatus(`${done}/${n} live run(s) done on the ${DATASETS[DATASET].label}. See the scorecard and the stability table below.`);
 }finally{state.busy=false;state.ctl=null;renderControls()}
}
/* Every live run is stored so results survive reloads and can be audited later */
async function getDb(){if(state.db!==undefined)return state.db;try{state.db=window.claude?await window.claude.use("db"):null}catch(e){state.db=null}return state.db}
async function persistRun(run,raw,err){
 const db=await getDb();if(!db){logLine("Run not stored (no database in this view).");return}
 const id=`${run.dataset}-${run.version}-${Date.now()}`;
 const body={dataset:run.dataset,version:run.version,at:run.at,mode:run.mode,ms:run.ms??null,size:run.size??null,failed:run.failed||null,
  keySha:DATASETS[run.dataset].sha,promptChars:buildPrompt().length,
  problems:(run.problemList||[]).map(p=>`${p.pro}: ${p.msg}`),outcomes:run.outcomes||null,deltas:run.deltas||null,score:run.score?run.score.summary:null,
  raw:raw!=null?JSON.stringify(raw):null,error:err};
 try{await db.collection("runs").doc(id).set(body);run.id=id;logLine(`Stored as runs/${id}`)}catch(e){logLine(`Could not store run: ${e&&e.code||e}`)}
}
async function loadStoredRuns(){
 const db=await getDb();if(!db)return;
 try{const snap=await db.collection("runs").where("dataset","==",DATASET).get();
  const known=new Set(state.runs.map(r=>r.id).filter(Boolean));let added=0;
  for(const d of snap.docs){const x=d.data();if(known.has(d.id)||x.failed||!x.raw)continue;
   const raw=JSON.parse(x.raw);const {by,problems}=validate(raw);const results={};for(const b of BILLS)results[b.pro]=evaluate(b,by[b.pro]||null,problems);
   state.runs.push({id:d.id,stored:true,raw,dataset:x.dataset,version:x.version===AGENT_VERSION?x.version:`${x.version} AI output replayed on ${AGENT_VERSION} rules`,at:x.at,mode:"live",ms:x.ms,size:x.size,problems:problems.length,problemList:problems,
    outcomes:Object.fromEntries(BILLS.map(b=>[b.pro,results[b.pro].outcome])),deltas:Object.fromEntries(BILLS.map(b=>[b.pro,results[b.pro].delta])),score:scoreRun(results),recorded:{outcomes:x.outcomes,deltas:x.deltas}});added++}
  state.runs.sort((a,b)=>String(a.at).localeCompare(String(b.at)));let k=0;for(const r of state.runs)if(r.dataset===DATASET)r.n=++k;
  if(added){logLine(`Loaded ${added} stored live run(s) for the ${DATASETS[DATASET].label}`);renderLog();renderEval()}
 }catch(e){logLine(`Could not read stored runs: ${e&&e.code||e}`)}
}
function viewRun(id){const r=state.runs.find(x=>(x.id||String(x.n)+x.dataset)===id);if(!r||!r.raw)return;process(JSON.parse(JSON.stringify(r.raw)),{mode:r.mode,replay:r});setStatus(`Showing live run ${r.n} (${r.version}, ${new Date(r.at).toLocaleString()}).`)}
function runSaved(quiet){const SR=DATASETS[DATASET].saved;if(!SR){state.results={};state.raw=null;state.viewing=null;renderAll();if(!quiet)setStatus("The blind set has no saved run on purpose: only live AI runs count. Click Run 3× live.");return}process(JSON.parse(JSON.stringify(SR)),{mode:"saved",ms:0,size:JSON.stringify(SR).length});if(!quiet)setStatus("Saved run loaded. Click a bill to see the evidence and the proposed fix.")}


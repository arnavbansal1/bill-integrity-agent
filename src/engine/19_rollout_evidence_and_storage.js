/* ---------- Evidence from the agent's stored live runs ---------- */
async function loadEvidence(){
 let runs=[];
 try{const db=await getDb();if(db){const snap=await db.collection("runs").get();runs=snap.docs.map(d=>d.data()).filter(x=>!x.failed&&x.score)}}catch(e){}
 if(!runs.length)runs=state.runs.filter(r=>r.mode==="live"&&r.score).map(r=>({dataset:r.dataset,version:r.version,score:r.score.summary}));
 const cur=runs.filter(r=>r.version===AGENT_VERSION);
 if(!cur.length){R.evidence=null;return}
 const blind=cur.filter(r=>r.dataset==="blind"),dev=cur.filter(r=>r.dataset==="dev");
 const sum=(arr,k)=>arr.reduce((a,r)=>a+(r.score[k]||0),0);
 const all=[...blind,...dev];
 const personN=blind.reduce((a,r)=>a+(r.score.mustCaught||0)+(r.score.safe||0)+(r.score.overEscalated||0),0),billN=sum(blind,"n");
 const pass=all.every(r=>r.score.wrong===0&&r.score.mustCaught===r.score.mustN);
 R.evidence={version:AGENT_VERSION,runs:all.length,fixes:sum(all,"dollarN"),wrong:sum(all,"wrong"),mustCaught:sum(all,"mustCaught"),mustTotal:sum(all,"mustN"),missedRecovery:sum(all,"missedRecovery"),
  personRate:billN?personN/billN:0,regressionPass:pass,regressionNote:`${blind.length} blind + ${dev.length} dev live runs, ${pass?"all":"NOT all"} with 0 wrong and every must-act caught`};
}
/* ---------- Persistence: this browser (try/catch) + optional save to the artifact database ---------- */
const RKEY="bia-rollout-v1";
function savePlanLocal(){try{localStorage.setItem(RKEY,JSON.stringify(R.plan))}catch(e){}}
function loadPlan(){try{const s=localStorage.getItem(RKEY);if(s){const p=JSON.parse(s);if(p&&p.version===ROLL_DEFAULT.version)return p}}catch(e){}return clone(ROLL_DEFAULT)}
async function savePlanDb(){const db=await getDb();if(!db){rStatus("No database in this view; the plan is kept in this browser only.");return}try{await db.doc("plans/current").set({at:new Date().toISOString(),plan:JSON.stringify(R.plan)});rStatus("Plan saved.")}catch(e){rStatus("Could not save: "+(e&&e.code||e))}}
async function loadPlanDb(){const db=await getDb();if(!db)return rStatus("No database in this view.");try{const d=await db.doc("plans/current").get();if(!d.exists)return rStatus("No saved plan yet.");R.plan=JSON.parse(d.data().plan);savePlanLocal();renderRollout();rStatus("Loaded the saved plan from "+new Date(d.data().at).toLocaleString()+".")}catch(e){rStatus("Could not load: "+(e&&e.code||e))}}
function rStatus(s){const el=$("rStatus");if(el)el.textContent=s}
function applyPreset(name){const p=PRESETS[name];if(!p)return;R.plan=clone(ROLL_DEFAULT);
 for(const [k,v] of Object.entries(p.assumptions||{})){const a=R.plan.assumptions.find(x=>x.id===k);if(a)a.v=v}
 for(const [k,v] of Object.entries(p.toggles||{})){const t=R.plan.toggles.find(x=>x.id===k);if(t)t.v=v}
 Object.assign(R.plan.thresholds,p.thresholds||{});
 for(const [k,v] of Object.entries(p.workflows||{})){const w=R.plan.workflows.find(x=>x.id===k);if(w)Object.assign(w,v)}R.plan.preset=name;savePlanLocal();renderRollout()}


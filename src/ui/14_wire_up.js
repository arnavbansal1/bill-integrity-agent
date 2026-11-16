/* ---------------- Wire up ---------------- */
function switchDataset(name){if(state.busy||name===DATASET)return;loadDataset(name);state.results={};state.raw=null;state.viewing=null;state.sel=BILLS[0].pro;state.selF=null;state.decisions={};
 $("keySha").textContent=DATASETS[name].sha.slice(0,12)+"…";$("trapsText").textContent=DATASETS[name].traps;
 if(DATASETS[name].saved){state.mode="saved";runSaved()}else{if(state.sample)state.mode="live";runSaved()}
 const last=state.runs.filter(r=>r.dataset===name&&r.raw).slice(-1)[0];if(last)viewRun(last.id||String(last.n)+last.dataset);
 renderAll();loadStoredRuns().then(()=>{if(!state.viewing){const l=state.runs.filter(r=>r.dataset===name&&r.raw).slice(-1)[0];if(l)viewRun(l.id||String(l.n)+l.dataset)}})}
$("dsDev").onclick=()=>switchDataset("dev");$("dsBlind").onclick=()=>switchDataset("blind");
$("run3Btn").onclick=()=>runLive(3);
$("keySha").textContent=DATASETS[DATASET].sha.slice(0,12)+"…";$("trapsText").textContent=DATASETS[DATASET].traps;
$("modeSaved").onclick=()=>{state.mode="saved";renderControls()};
$("modeLive").onclick=()=>{if(state.sample){state.mode="live";renderControls()}};
$("runBtn").onclick=()=>state.mode==="live"?runLive(1):runSaved();
$("stopBtn").onclick=()=>state.ctl&&state.ctl.abort();
$("themeBtn").onclick=()=>{const cur=document.documentElement.dataset.theme;const dark=cur?cur==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.dataset.theme=dark?"light":"dark"};
runSaved();
(async()=>{try{state.sample=window.claude?await window.claude.use("sample"):null}catch(e){state.sample=null}renderControls();loadStoredRuns();memLoad();if(state.sample&&DATASET==="dev")setStatus("Saved run loaded. Switch to Live AI and click Run check to have Claude read the documents, or open the Blind set and click Run 3× live.")})();

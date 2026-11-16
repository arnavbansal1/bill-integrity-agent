/* ================= Rollout control view =================
   Program plan for taking the Bill Integrity wedge from shadow → pilot → scale.
   Everything a case fact could change is DATA in ROLL_DEFAULT (editable in the UI, exportable as JSON).
   Gate logic and the business model are small pure functions below.
   Evidence comes from the agent's own stored live runs (db "runs"), never re-typed. */
const ROLL_DEFAULT={
 version:10,preset:"Base plan",
 assumptions:[
  {id:"bills",label:"Bills per month at full scale",v:20000,unit:"bills",src:"Assumption",note:"Replace with the case's volume."},
  {id:"incidence",label:"Bills with a billing error",v:8,unit:"%",src:"Assumption",note:"Measure on a random sample, never on audited history."},
  {id:"recall",label:"Errors the agent catches (real bills)",v:70,unit:"%",src:"Assumption",note:"Known error types: audited history. Overall: QA sample of Clear bills."},
  {id:"avgFix",label:"Average correction per caught error",v:102,unit:"$",src:"Eval (synthetic)",note:"Mean |change| of the 9 blind-set fixes."},
  {id:"underShare",label:"Errors that are under-billing (vs over-charge)",v:78,unit:"%",src:"Eval (synthetic)",note:"7 of 9 blind fixes raised the bill."},
  {id:"personRate",label:"Bills the agent sends to a person",v:5,unit:"%",src:"Assumption",note:"Measure on a random sample or live; audited history overstates it."},
  {id:"mustActRate",label:"Bills that truly need a person (conflicts, missing docs)",v:3,unit:"%",src:"Assumption",note:""},
  {id:"auditShare",label:"Bills a biller audits today",v:10,unit:"%",src:"Assumption",note:"Coverage today; agent covers 100%."},
  {id:"billerCatch",label:"Errors a biller catches when auditing a bill",v:90,unit:"%",src:"Assumption",note:"Agent recovery counts only what today's audits miss."},
  {id:"manualMin",label:"Biller minutes per manual audit",v:6,unit:"min",src:"Assumption",note:""},
  {id:"fixMin",label:"Minutes to approve a proposed fix",v:1.5,unit:"min",src:"Assumption",note:"Evidence is pre-highlighted."},
  {id:"sidecarMin",label:"Extra minutes to key a change by hand (no write-back)",v:3,unit:"min",src:"Assumption",note:"Only applies when the agent cannot write to the billing system."},
  {id:"personMin",label:"Minutes per escalation / info request",v:6,unit:"min",src:"Assumption",note:""},
  {id:"qaShare",label:"Clear bills spot-checked by QA",v:2,unit:"%",src:"Assumption",note:"Catches missed recovery."},
  {id:"hourCost",label:"Loaded biller cost",v:45,unit:"$/hr",src:"Assumption",note:""},
  {id:"runCost",label:"Program run cost (model, infra, support)",v:6000,unit:"$/mo",src:"Assumption",note:""},
  {id:"invoiceSla",label:"Hours from delivery to invoice (customer SLA)",v:24,unit:"hrs",src:"Assumption",note:"Pre-invoice hold must fit inside this."},
  {id:"podLatency",label:"Typical POD / W&I arrival after delivery",v:12,unit:"hrs",src:"Assumption",note:""},
  {id:"lateShare",label:"Bills whose evidence arrives after invoicing",v:0,unit:"%",src:"Assumption",note:"Measure in shadow. Occasional → controlled correction; routine → move the same workflow upstream."},
  {id:"keyShare",label:"Volume from key accounts",v:15,unit:"%",src:"Assumption",note:"Account manager sees key rebills first."},
  {id:"shadowShare",label:"Live shadow scope",v:10,unit:"%",src:"Assumption",note:"Nothing posts, so the limit is document integration, not customer risk."},
  {id:"pilotShare",label:"Pilot scope",v:10,unit:"%",src:"Assumption",note:"Limited by customer risk; e.g. 2 terminals, non-key accounts."},
  {id:"histMonths",label:"Months of audited history kept",v:6,unit:"months",src:"Assumption",note:"Backtest set = months × bills × audit share."},
  {id:"randomN",label:"Random historical bills the agent can run (unaudited)",v:10000,unit:"bills",src:"Assumption",note:"Billers adjudicate every flagged bill; a random sample of Clear bills is separately reviewed by a human to estimate missed errors."},
  {id:"joinRate",label:"Base linkage: invoice → shipment → contract version",v:92,unit:"%",src:"Assumption",note:"Overall planning number. Each error type also needs its own evidence chain (see Phases)."},
  {id:"deadline",label:"Weeks until leadership needs a measurable result",v:16,unit:"weeks",src:"Assumption",note:"If the plan runs longer, narrow scope; never loosen the gates."},
  {id:"minShadow",label:"Minimum live shadow",v:4,unit:"weeks",src:"Assumption",note:"Covers weekly fuel changes and a month-end."}
 ],
 toggles:[
  {id:"contractsDigital",label:"Contracts and tariffs are machine-readable, with effective dates",v:true},
  {id:"tmsWrite",label:"Agent can hold and edit a draft invoice in the billing system",v:true},
  {id:"preInvoice",label:"Customer contracts allow a short pre-invoice hold",v:true},
  {id:"archived",label:"Audited bills are archived with their audit outcomes",v:true},
  {id:"randomAvail",label:"Unaudited historical bills are archived with their documents",v:true},
  {id:"clustered",label:"Unjoinable bills cluster (by terminal, customer, document type or error type)",v:false},
  {id:"auditsRandom",label:"Today's audits are random spot checks (not targeted at suspect bills)",v:false}
 ],
 story:[
  ["Current workflow","Draft invoice is rated from the shipper's BOL weight, class and the contract. Billers spot-audit a small share of bills; errors found after invoicing become rebills, credits or disputes."],
  ["Bottleneck","The evidence that changes the price (POD, driver notes, W&I certificates, the contract version on the pickup date) sits in scattered documents. Nobody can read it for every bill before the invoice goes out."],
  ["Options weighed","A) Post-invoice audit / dispute desk: money already left. B) Pre-invoice integrity check: chosen. C) Full auto-rating: too risky before proof."],
  ["Chosen wedge","Pre-invoice Bill Integrity check. AI extracts evidence with exact quotes, fixed rules re-rate, and a biller approves every charge. Outcomes: Clear, Propose fix, Request info, Escalate."]
 ],
 workflows:[
  {id:"reweigh",name:"Reweigh / reclass",chain:"W&I certificate (scale weight, dimensions per piece) linked to the PRO",share:33,cov:92,bar:90,owner:"Terminal ops (W&I capture)"},
  {id:"accessorial",name:"Accessorials (liftgate, inside, residential, appointment, detention)",chain:"POD and driver notes for the delivery, plus BOL requested services",share:55,cov:92,bar:90,owner:"Terminal ops (POD and notes)"},
  {id:"pricing",name:"Pricing, fuel, discount",chain:"Pickup date (BOL / driver note), contract version with effective dates, weekly fuel table, tariff",share:12,cov:92,bar:90,owner:"Pricing / contracts team"}
 ],
 thresholds:{lateMax:10,clusterGap:15,joinMin:90,tol:0.5,minRecall:98,maxPerson:15,maxClearMiss:5,disputeMargin:0,targetSave:30,maxDelay:2,maxOverride:10,recoverTarget:50000},
 actuals:{shadow:{joinSampled:"",joinOk:"",clusterSegs:"",bills:"",proposals:"",wrong:"",personBills:"",audProposals:"",audWrong:"",mustTotal:"",mustCaught:"",qaChecked:"",qaMisses:""},
          pilot:{lateObs:"",fixesApproved:"",wrongReached:"",rebills:"",disputes:"",baselineDispute:"",minPerBill:"",baselineMin:"",delayHrs:"",overrides:"",recovered:""}},
 phases:[
  {id:"shadow",name:"1 · Shadow",scope:"Pilot terminals, all bills. Agent proposes; nothing is posted. Billers work as today; we compare.",autonomy:"Observe only",owner:"PM + billing ops lead",exit:"All shadow gates met on real bills.",proves:"Accuracy on real bills: wrong-charge rate, must-act recall, person rate. Money identified (a leading indicator).",not:"Realized revenue, customer reaction, biller behavior under real approvals, integration."},
  {id:"pilot",name:"2 · Controlled pilot",scope:"Same terminals, non-key accounts first. Biller approves every fix before the invoice goes out.",autonomy:"Propose, a human approves every charge",owner:"Billing ops lead (accountable)",exit:"All pilot gates met for 4 straight weeks.",proves:"Realized recovery (invoiced, net of disputes and credits), dispute rate, invoice cycle, real biller time.",not:"Economics across all terminals, key-account response, long-run drift."},
  {id:"scale",name:"3 · Scale",scope:"Add terminals in waves, then key accounts with account-manager review. Clear bills auto-confirm with a QA sample.",autonomy:"Auto-clear low-risk; a human approves every charge",owner:"VP billing / revenue ops",exit:"Guardrails stay green; any trip rolls back one phase.",proves:"Sustained realized value and drift control at full volume.",not:"New error types or customers without their own validation."}
 ],
 owners:[
  ["Program and gates","PM (me)","Owns the plan, metrics, go/no-go recommendation"],
  ["Billing process and approvals","Billing ops lead","Accountable for pilot outcomes; approves every charge"],
  ["Contracts, tariffs, fuel table","Pricing / contracts team","Data owner; signs off rate logic"],
  ["Key-account rebills","Account managers","See key rebills first; can veto"],
  ["POD and W&I capture","Terminal ops","Document completeness and latency"],
  ["Billing-system integration","Engineering (customer IT + vendor)","Draft-invoice hold, write-back, audit trail"],
  ["Model, prompt, regression set, learned rules","AI engineering","No change ships unless frozen keys pass; learned rules activate by risk tier (routing-only → customer money rules → general money rules need progressively more evidence, shadow and approval)"],
  ["Recovery and disputes","Finance / AR","Tracks recovered $, credits, disputes"],
  ["Data and security review","Security / compliance","Approves document flow to the model"]
 ],
 deps:[
  ["Machine-readable contracts with versions and effective dates","Pricing","Shadow","Unknown"],
  ["Weekly fuel surcharge table","Pricing","Shadow","Unknown"],
  ["POD, driver notes, W&I certificates available within the invoice SLA","Terminal ops","Pilot","Unknown"],
  ["Historical audited bills for backtest and ground truth","Billing ops","Shadow","Unknown"],
  ["Historical linkage: invoice ↔ shipment ↔ contract version ↔ documents","Engineering + billing ops","Shadow","Unknown"],
  ["Draft-invoice hold and write-back API","Engineering","Pilot","Unknown"],
  ["Approval UI inside the billers' workflow","Engineering + PM","Pilot","Unknown"],
  ["Security review of the model vendor","Security","Shadow","Unknown"]
 ],
 risks:[
  ["A wrong charge reaches a customer","Override of an approved fix; dispute on an agent rebill","Any 1 on a key account, or above tolerance","Drop back to shadow for that charge type; root-cause; add a rule","Billing ops lead"],
  ["Escalation flood erodes the time savings","Person rate by terminal, weekly","Above the person-rate gate for 2 weeks","Tune keyword backstops on real notes; review the top 3 escalation reasons","PM"],
  ["Billers rubber-stamp proposals","Median approval time; approve rate","Under 10 s median or 100% approve","Seed known-bad canary bills; coach","Billing ops lead"],
  ["Holds delay invoices","Info-request aging; invoice cycle time","Aging over 48 h or cycle time up 2 h","Release the invoice and correct later; chase the POD","Terminal ops"],
  ["Stale contract data","QA finds rate mismatches on Clear bills","Any version mismatch","Freeze that customer; Pricing fixes the source","Pricing"],
  ["A model or prompt change regresses quality","Frozen-key regression run","Any wrong charge or missed must-act","Block the deploy","AI engineering"],
  ["A learned rule is wrong or too broad","Overrides and wrong charges on bills a learned rule touched","Any wrong charge traced to a learned rule","Deactivate it, narrow its scope, add the case to the frozen set","AI engineering"],
  ["Adversarial or odd documents","Injection and unsupported-charge flags","Spike above baseline","Review flagged docs; extend the scans","AI engineering"]
 ]
};
const PRESETS={
 "Base plan":{},
 "Some evidence arrives late (5%)":{assumptions:{lateShare:5}},
 "Invoices must go out same day":{assumptions:{invoiceSla:8,podLatency:12}},
 "Contracts are PDFs, no API":{toggles:{contractsDigital:false,tmsWrite:false}},
 "Key accounts are 40% of volume":{assumptions:{keyShare:40}},
 "Zero tolerance for wrong charges":{thresholds:{tol:0.1}},
 "Errors are rare (1%)":{assumptions:{incidence:1}},
 "No audited history to backtest":{toggles:{archived:false}},
 "Only audited bills were archived":{toggles:{randomAvail:false}},
 "History only partly joinable (60%)":{assumptions:{joinRate:60}},
 "W&I certificates rarely linked (60%)":{workflows:{reweigh:{cov:60}}},
 "Missing data clusters by terminal":{toggles:{clustered:true}},
 "Leadership wants results in 6 weeks":{assumptions:{deadline:6}},
 "Audits are random spot checks":{toggles:{auditsRandom:true,randomAvail:false}},
 "Small carrier (3,000 bills/mo)":{assumptions:{bills:3000}},
 "Billers already audit every bill":{assumptions:{auditShare:100}},
 "Agent escalates 30%":{assumptions:{personRate:30}}
};
const R={plan:null,evidence:null,dirty:false,db:null};
const money0=x=>x==null||isNaN(x)?"–":(x<0?"−":"")+"$"+Math.round(Math.abs(x)).toLocaleString("en-US");
const clone=o=>JSON.parse(JSON.stringify(o));
const A=id=>{const a=R.plan.assumptions.find(x=>x.id===id);return a?Number(a.v):NaN};
const T=id=>{const t=R.plan.toggles.find(x=>x.id===id);return t?!!t.v:false};
const num=v=>v===""||v==null||isNaN(Number(v))?null:Number(v);
/* 95% bounds for a rate from k events in n trials: rule of three at k=0, Wilson otherwise */
function upper95(k,n){if(!n)return null;if(k===0)return 3/n;const z=1.96,p=k/n,d=1+z*z/n;return Math.min(1,(p+z*z/(2*n)+z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n)))/d)}
function lower95(k,n){if(!n)return null;if(k===n)return 1-3/n;const z=1.96,p=k/n,d=1+z*z/n;return Math.max(0,(p+z*z/(2*n)-z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n)))/d)}

/* ---------- Business model: agent quality → operations → money ---------- */
function model(){
 const B=A("bills"),i=A("incidence")/100,r=A("recall")/100,a=A("avgFix"),u=A("underShare")/100,pr=A("personRate")/100;
 const fixRate=i*r,fixes=B*fixRate,person=B*pr,clear=Math.max(0,B-fixes-person);
 const already=Math.min(1,A("auditShare")/100*A("billerCatch")/100); /* share of errors today's audits already catch */
 const recovered=fixes*a*u*(1-already),credits=fixes*a*(1-u)*(1-already),missed=B*i*(1-r)*a*u*(1-already);
 const backtest=T("archived")?A("histMonths")*B*A("auditShare")/100:0;
 const hToday=B*A("auditShare")/100*A("manualMin")/60;
 const fixMinEff=A("fixMin")+(T("tmsWrite")?0:A("sidecarMin")); /* side-car: billers re-key every approved change */
 const hAgentWB=(fixes*A("fixMin")+person*A("personMin")+clear*A("qaShare")/100*A("manualMin"))/60;
 const hAgent=(fixes*fixMinEff+person*A("personMin")+clear*A("qaShare")/100*A("manualMin"))/60;
 const hoursSaved=hToday-hAgent,laborSaved=hoursSaved*A("hourCost");
 const net=recovered+laborSaved-A("runCost");
 const tol=R.plan.thresholds.tol/100,minRec=R.plan.thresholds.minRecall/100;
 const scope=B*A("shadowShare")/100,wk=4.33;
 const needFix=Math.ceil(3/tol),needMust=Math.ceil(3/Math.max(1e-9,1-minRec));
 const randomN=T("randomAvail")?Math.min(A("randomN"),A("histMonths")*B*(1-A("auditShare")/100)):0;
 /* Wrong-charge rate per proposal must be measured on REPRESENTATIVE bills (random sample + live): audited bills are
    selected, so their mix of clean vs error bills (and the false-positive exposure on clean bills) is not production's. */
 const audRep=T("auditsRandom")||A("auditShare")>=95; /* random or near-total audits ARE representative */
 const join=Math.max(0,Math.min(1,A("joinRate")/100)),joinOk=join*100>=R.plan.thresholds.joinMin;
 /* History is usable for RATES only if base linkage passes AND missingness is not clustered (a clustered gap means the
    joined subset is a different population; we do not silently shrink the denominator). Then each error type counts only
    if its own evidence chain clears its bar: high overall linkage must not hide a gap for one error type. */
 const histUsable=joinOk&&!T("clustered");
 const W=R.plan.workflows.map(w=>({...w,validated:histUsable&&(T("randomAvail")||audRep)&&Number(w.cov)>=Number(w.bar)}));
 const shareTot=W.reduce((a,w)=>a+Number(w.share||0),0)||1;
 const validatedShare=W.filter(w=>w.validated).reduce((a,w)=>a+Number(w.share||0),0)/shareTot;
 const gaps=W.filter(w=>Number(w.cov)<Number(w.bar));
 /* Bills that fail to join are likely the messy, error-prone ones, so a poorly joined history is NOT representative:
    below the readiness bar it contributes nothing to rate evidence. */
 const fixFromBack=histUsable?(randomN+(audRep?backtest:0))*join*fixRate*validatedShare:0;
const qaFromRandom=histUsable?randomN*join*Math.max(0,1-fixRate-pr)*A("qaShare")/100:0;
 /* Must-act recall on known edge cases can use audited history (it is enriched for exactly those cases). */
 const mustFromBack=backtest*join*A("mustActRate")/100; /* joined audited bills still prove edge cases, one by one */
 const adjudHours=randomN*((fixRate+pr)*A("manualMin")+(1-fixRate-pr)*A("qaShare")/100*A("manualMin"))/60;
 /* Base-rate trap: per-proposal wrong rate = FP rate on clean bills x clean share / proposal rate */
 const fpCleanMax=tol*fixRate/Math.max(1e-9,1-i);
 const fixPerWk=scope*fixRate/wk,mustPerWk=scope*A("mustActRate")/100/wk;
 const wFix=fixPerWk>0?Math.max(0,(needFix-fixFromBack)/fixPerWk):Infinity,wMust=mustPerWk>0?Math.max(0,(needMust-mustFromBack)/mustPerWk):Infinity;
 const wNeed=Math.max(wFix,wMust),floor=A("minShadow")||0;
 return{B,fixes,person,clear,recovered,credits,missed,hToday,hAgent,hoursSaved,laborSaved,net,needFix,needMust,fixPerWk,mustPerWk,shadowWeeks:Math.max(wNeed,floor),bindBy:wNeed<=floor?"minimum live shadow":wFix>=wMust?"wrong-charge sample":"must-act sample",coverageToday:A("auditShare"),shadowBills:scope,pilotBills:B*A("pilotShare")/100,backtest,randomN,fixFromBack,mustFromBack,already,adjudHours,fpCleanMax,join,joinOk,qaFromRandom,hAgentWB,histUsable,W,validatedShare,gaps};
}
/* Late evidence: occasional → a tightly controlled post-invoice correction path; routine → rebills would become the
   normal workflow (automating a broken process), so the same workflow moves upstream to evidence completeness. The threshold is a
   placeholder to be set from the pilot: late-evidence prevalence × dispute cost per rebill × customer impact. */
function lateMode(){const routine=A("podLatency")>=A("invoiceSla")||A("lateShare")>R.plan.thresholds.lateMax;
 return routine?"routine":(A("lateShare")>0||!T("preInvoice"))?"occasional":"none"}
/* ---------- Gates: threshold (editable) vs observed actuals (editable) vs evidence (from stored live runs) ---------- */
function gates(){
 const t=R.plan.thresholds,s=R.plan.actuals.shadow,p=R.plan.actuals.pilot,m=model(),E=R.evidence;
 const pct=x=>x==null?"–":(x*100).toFixed(x<0.01?2:1)+"%";
 const g=[];
 const add=(phase,label,target,obs,met,ev,why)=>g.push({phase,label,target,obs,status:obs==null?"Unproven":met?"Met":"Not met",ev,why});
 const JS=num(s.joinSampled),JO=num(s.joinOk);const jlb=JS&&JO!=null?lower95(JO,JS):null;
 add("shadow","Historical data readiness: sampled shipments that join end to end",`≥ ${t.joinMin}% at 95% confidence (sample ~200 first)`,jlb==null?null:pct(jlb),jlb!=null&&jlb>=t.joinMin/100,`assumed ${A("joinRate")}%`,"Below this, history is partial: edge cases only, rates move to live.");
 const CS=num(s.clusterSegs);
 add("shadow","Missingness is not clustered",`0 terminals / customers / doc types / error types more than ${t.clusterGap} pts below overall linkage`,CS==null?null:`${CS} segment${CS===1?"":"s"}`,CS===0,T("clustered")?"assumed clustered":"assumed not clustered","A clustered gap means the joined subset is a different population.");
 const P=num(s.proposals),W=num(s.wrong);const ub=P!=null&&W!=null?upper95(W,P):null;
 add("shadow","Wrong proposed charges (random sample + live)",`≤ ${t.tol}% at 95% confidence (≈${m.needFix} representative proposals, 0 wrong)`,ub==null?null:pct(ub),ub!=null&&ub<=t.tol/100,E?`${E.wrong} wrong / ${E.fixes} proposals in ${E.runs} live runs (synthetic)`:"–","The one number we never trade away.");
 const MT=num(s.mustTotal),MC=num(s.mustCaught);const lb=MT!=null&&MC!=null?lower95(MC,MT):null;
 add("shadow","Must-act bills sent to a person (audited history + live)",`≥ ${t.minRecall}% at 95% confidence (≈${m.needMust} must-act bills)`,lb==null?null:pct(lb),lb!=null&&lb>=t.minRecall/100,E?`${E.mustCaught}/${E.mustTotal} (synthetic)`:"–","A miss here means a bad invoice goes out silently.");
 const SB=num(s.bills),PB=num(s.personBills);const prr=SB&&PB!=null?PB/SB:null;
 add("shadow","Bills sent to a person (random sample + live)",`≤ ${t.maxPerson}%`,prr==null?null:pct(prr),prr!=null&&prr<=t.maxPerson/100,E?`${pct(E.personRate)} on a trap-dense set (not representative)`:"–","Sets the time saved; too high and the agent creates work.");
 const AP=num(s.audProposals),AW=num(s.audWrong);const aub=AP!=null&&AW!=null?upper95(AW,AP):null;
 add("shadow","Wrong proposals on audited history (edge cases)",`≤ ${t.tol}% after adjudication`,aub==null?null:pct(aub),aub!=null&&aub<=t.tol/100,"–","Safety on the hard cases; not a production rate.");
 const QC=num(s.qaChecked),QM=num(s.qaMisses);const qub=QC&&QM!=null?upper95(QM,QC):null;
 add("shadow","Clear bills with a missed error (QA sample)",`≤ ${t.maxClearMiss}% at 95% confidence`,qub==null?null:pct(qub),qub!=null&&qub<=t.maxClearMiss/100,E?`${E.missedRecovery} missed recovery (synthetic)`:"–","Revenue left on the table, not a customer harm.");
 const reg=E?E.regressionPass:null;
 add("shadow","Frozen-key regression set passes",`0 wrong, all must-act, on dev + blind`,reg==null?null:(reg?"Pass":"Fail"),!!reg,E?`agent ${E.version}: ${E.regressionNote}`:"–","Re-run on every model, prompt or rule change.");
 const FA=num(p.fixesApproved),WR=num(p.wrongReached);const pub=FA!=null&&WR!=null?upper95(WR,FA):null;
 add("pilot","Wrong charges reaching customers",`≤ ${t.tol}% at 95% confidence`,pub==null?null:pct(pub),pub!=null&&pub<=t.tol/100,"–","Measured on posted invoices, not proposals.");
 const RB=num(p.rebills),DS=num(p.disputes),BD=num(p.baselineDispute);const dr=RB&&DS!=null?DS/RB:null;
 add("pilot","Dispute rate on agent-changed invoices",BD!=null?`≤ ${(BD+t.disputeMargin).toFixed(1)}% (baseline + ${t.disputeMargin} pts)`:`≤ baseline + ${t.disputeMargin} pts (enter baseline)`,dr==null||BD==null?null:pct(dr),dr!=null&&BD!=null&&dr*100<=BD+t.disputeMargin,"–","Customer trust: rebills must not create more disputes.");
 const MPB=num(p.minPerBill),BM=num(p.baselineMin);const sv=MPB!=null&&BM?1-MPB/BM:null;
 if(!T("tmsWrite"))g.push({phase:"pilot",label:"Biller minutes per bill vs baseline",target:"n/a in side-car: measured, not gating; the time gate moves to scale (after write-back)",obs:MPB==null?null:MPB+" min",status:"N/A",ev:`side-car ${fmtN(m.hAgent)} h vs write-back ${fmtN(m.hAgentWB)} h/mo (model)`,why:"Keying time is the integration business case."});
 else add("pilot","Biller minutes per bill vs baseline",`≥ ${t.targetSave}% fewer`,sv==null?null:pct(sv),sv!=null&&sv>=t.targetSave/100,`model: ${m.hToday>0?pct(m.hoursSaved/m.hToday):"–"} fewer hours`,"Operations: does the agent save time?");
 const DH=num(p.delayHrs);const lm=lateMode();
 const LO=num(p.lateObs);
 add("pilot","Late evidence: bills corrected after invoicing",`≤ ${t.lateMax}% (placeholder; set from late share × dispute cost × customer impact)`,LO==null?null:LO+"%",LO!=null&&LO<=t.lateMax,`assumed ${A("lateShare")}%`,"Above this, rebills become the workflow: stop scaling correction, move the workflow upstream to evidence completeness.");
 if(lm==="routine"||!T("preInvoice"))g.push({phase:"pilot",label:"Added invoice cycle time",target:lm==="routine"?"n/a: workflow moved upstream to evidence completeness":"n/a: invoices are not held (post-invoice correction)",obs:null,status:"N/A",ev:"–",why:"Delay risk moves to disputes."});
 else add("pilot","Added invoice cycle time",`≤ ${t.maxDelay} h`,DH==null?null:DH+" h",DH!=null&&DH<=t.maxDelay,`POD latency ${A("podLatency")} h vs SLA ${A("invoiceSla")} h`,"The hold must not slow cash.");
 const OV=num(p.overrides);const orr=FA&&OV!=null?OV/FA:null;
 add("pilot","Biller overrides of proposed fixes",`≤ ${t.maxOverride}%`,orr==null?null:pct(orr),orr!=null&&orr<=t.maxOverride/100,"–","Leading indicator of a wrong charge.");
 const RC=num(p.recovered);
 add("pilot","Realized recovery (invoiced, net of disputes and credits; pilot scope, per month)",`≥ ${money0(t.recoverTarget*A("pilotShare")/100)} (${A("pilotShare")}% of ${money0(t.recoverTarget)} target)`,RC==null?null:money0(RC),RC!=null&&RC>=t.recoverTarget*A("pilotShare")/100,`model at scale: ${money0(m.recovered)}/mo`,"Business outcome.");
 return g;
}
/* ---------- Assumptions that would change the plan ---------- */
function flips(){
 const m=model(),t=R.plan.thresholds,laborLed=m.laborSaved>m.recovered;
 const preW=(!T("contractsDigital")||(T("randomAvail")&&!m.joinOk)||(m.joinOk&&m.gaps.length>0)||T("clustered"))?5:0;
 const planned=preW+(isFinite(m.shadowWeeks)?m.shadowWeeks:99)+4; /* prerequisite + shadow + 4-week pilot gate window */
 const F=[
  {on:planned>A("deadline"),title:"Leadership needs results sooner than the plan delivers",change:`The plan reaches a pilot result in ~${Math.ceil(planned)} weeks vs ${A("deadline")} needed. Narrow scope; never loosen the gates. (1) Report shadow results within weeks: precision on real bills and money identified. Money identified is a leading indicator, not realized revenue; realized recovery only comes from the pilot. (2) Pilot only error types with sufficient historical evidence to enter the pilot, at 1–2 terminals. (3) Widen live shadow scope to reach sample sizes faster. (4) Wrong-charge tolerance stays at ${t.tol}%.`,watch:`Weeks to pilot result: ${preW?preW+" prerequisite + ":""}${isFinite(m.shadowWeeks)?m.shadowWeeks.toFixed(1):"∞"} shadow + 4 pilot`,
   phase:{shadow:"Weekly shadow report: precision + money identified (leading indicator, not realized revenue).",pilot:"Narrowed: only error types that cleared the historical-evidence gate, 1–2 terminals; gates unchanged."},hits:["Program and gates"]},
  {on:lateMode()==="occasional",title:"Some evidence arrives after invoicing",change:"Keep the pre-invoice check for most bills. For the late ones, use a tightly controlled correction path: credits for over-charges go out immediately; rebills only with the evidence attached, non-key accounts first, inside a set correction window. Track late-evidence share and dispute cost per rebill; if late evidence becomes the norm, stop scaling this path and move the same workflow upstream to evidence completeness.",watch:`Late-evidence share ${A("lateShare")}% vs ${R.plan.thresholds.lateMax}% (set from pilot)`,
   phase:{pilot:"Late-evidence bills: controlled post-invoice correction; dispute rate on rebills gates it."},hits:["Recovery and disputes"]},
  {on:lateMode()==="routine",title:"Late evidence is the norm: move the same workflow upstream",change:"If evidence routinely arrives after invoicing, rebills become the workflow, which automates a broken process and buys disputes. Don't scale post-invoice correction. The bottleneck is now evidence availability, so the same agent moves upstream: it flags shipments missing required evidence, requests or retrieves it through existing systems and channels, and runs the billing check once the evidence is in. No new product; ownership follows the evidence source (e.g. terminal ops for W&I, the carrier or driver for POD, pricing for contract data).",watch:`POD latency ${A("podLatency")} h vs SLA ${A("invoiceSla")} h · late share ${A("lateShare")}% vs ${R.plan.thresholds.lateMax}%`,
   phase:{pre:"Upstream wedge: the same agent checks evidence completeness first and requests what is missing through existing channels; owners by evidence source. Track late-evidence share weekly.",pilot:"Post-invoice correction limited to a small capped test; not scaled."},hits:["POD","Recovery and disputes"]},
  {on:!T("contractsDigital"),title:"Contracts are not machine-readable",change:"Add a contract-digitization step before shadow (Pricing owns it and signs off every rate table). Shadow covers only customers whose contracts are digitized. Expect +4 to 6 weeks.",watch:"Rate mismatches in the QA sample",
   phase:{pre:"Digitize contracts and tariffs for pilot customers; Pricing signs off each table (+4–6 wks).",shadow:"Only customers with digitized contracts."},hits:["contracts","Contracts"]},
  {on:!T("tmsWrite"),title:"No hold or write-back in the billing system",change:`Run the pilot as a side-car worklist: billers key changes by hand. The pilot still measures customer-facing accuracy, dispute impact, and realized recovery; it does not measure time savings. Measure keying time honestly: the gap between side-car and write-back time is the business case for integration, and write-back becomes the gate to scale.`,watch:`Biller hours/mo: ${fmtN(m.hAgent)} side-car vs ${fmtN(m.hAgentWB)} with write-back vs ${fmtN(m.hToday)} today`,
   phase:{pilot:"Side-car worklist; billers key changes manually. Still measures customer-facing accuracy, dispute impact, realized recovery; NOT time savings.",scale:"Gated on write-back integration; the time gate is tested here."},hits:["write-back","integration","Approval UI"]},
  {on:A("keyShare")>30,title:"Key accounts are a large share of volume",change:"Pilot on non-key accounts first. Key-account rebills go through account-manager approval with their own dispute gate. Account managers join from shadow.",watch:"Account-manager vetoes per week",
   phase:{pilot:"Non-key accounts only.",scale:"Key accounts in a separate wave, account-manager approval on every rebill."},hits:["Key-account","Account managers"]},
  {on:!T("archived"),title:"No audited history to backtest",change:"Nothing tests performance on known hard cases quickly. Must-act recall has to be shown live: widen live shadow scope (nothing posts) or seed known-error canary bills. The random sample still covers wrong-charge and person rates.",watch:`Live shadow needs ${isFinite(m.shadowWeeks)?m.shadowWeeks.toFixed(1):"∞"} weeks at ${A("shadowShare")}% scope`,
   phase:{shadow:"Edge-case recall tested live: widen scope, seed canary bills."},hits:["Historical audited bills"]},
  {on:!T("randomAvail"),title:"Only audited bills were archived",change:"Audited history can test performance on known hard cases, but not how often it raises a false charge on ordinary bills. That rate, and the person rate, must come from live shadow, so live shadow gets longer.",watch:`${fmtN(m.fixFromBack)} representative proposals from history; the rest from live`,
   phase:{shadow:"False-charge rate and person rate measured live only."},hits:["Historical audited bills"]},
  {on:T("randomAvail")&&!m.joinOk,title:"Historical data doesn't join cleanly",change:`Only ${A("joinRate")}% of sampled shipments link invoice → shipment → contract version → documents. Bills that fail to join are likely the messy ones, so history is partial: joined audited bills test known hard cases one by one, but no rates come from history. Start a linkage workstream and move rate evidence to live shadow.`,watch:`Join rate ${A("joinRate")}% vs ${R.plan.thresholds.joinMin}% bar`,
   phase:{pre:"Linkage workstream: join history (invoice ↔ shipment ↔ contract ↔ documents); re-sample until ≥ bar.",shadow:"Rates measured live only; history used for edge cases."},hits:["linkage","Historical audited bills"]},
  {on:m.joinOk&&m.gaps.length>0,title:m.gaps.length?`Evidence gap for ${m.gaps.map(w=>w.name.split(" (")[0]).join(", ")}`:"Evidence gap for one error type",change:`Overall linkage looks fine, but ${m.gaps.map(w=>`${w.name.split(" (")[0]} (${w.cov}% vs ${w.bar}%)`).join(", ")} lacks its evidence chain. Validate ${m.gaps.length>1?"these":"it"} live only; in the pilot the agent routes ${m.gaps.length>1?"those error types":"that error type"} to a person instead of proposing a fix until live evidence passes. Start a document workstream for the missing chain.`,watch:m.gaps.map(w=>`${w.name.split(" (")[0]}: ${w.chain}`).join(" · "),
   phase:{pre:`Document workstream: ${m.gaps.map(w=>w.chain).join("; ")}.`,shadow:`${m.gaps.map(w=>w.name.split(" (")[0]).join(", ")}: no historical evidence, so tested in live shadow only.`,pilot:`${m.gaps.map(w=>w.name.split(" (")[0]).join(", ")} routed to a person, not proposed, until they clear the live shadow gates.`},hits:m.gaps.flatMap(w=>w.id==="reweigh"?["W&I"]:w.id==="accessorial"?["POD"]:["contracts","fuel"])},
  {on:T("clustered"),title:"Unjoinable bills cluster",change:"The joined subset is not representative, so don't shrink the denominator. Start a data-readiness workstream: profile missingness by terminal, customer, document type and error type; fix the gaps or stratify the sample. Until then no rates come from history, and live shadow must include the under-covered segments.",watch:"Linkage rate by terminal, customer, document type, error type",
   phase:{pre:"Data-readiness workstream: profile and fix clustered missingness, or stratify.",shadow:"Must include the under-covered segments; rates measured live."},hits:["linkage"]},
  {on:m.shadowWeeks>8,title:"Not enough evidence to meet the safety gates quickly",change:`The sample is bound by the ${m.bindBy}. Options: a larger random historical sample, a wider live shadow (it posts nothing), or seeded canaries. More audited history does not help the wrong-charge gate. Don't loosen the gate.`,watch:`${isFinite(m.shadowWeeks)?m.shadowWeeks.toFixed(1):"∞"} weeks needed`,
   phase:{shadow:`Runs ~${isFinite(m.shadowWeeks)?Math.ceil(m.shadowWeeks):"∞"} weeks unless scope widens.`},hits:[]},
  {on:m.hAgentWB>=m.hToday,title:"The agent creates more review work than today",change:"Stay in shadow. Lead with coverage and recovery, not time saved. Tune the top escalation reasons until the person rate is under the gate.",watch:`Person rate ${A("personRate")}% → ${m.hAgentWB.toFixed(0)} h (with write-back) vs ${m.hToday.toFixed(0)} h today`,
   phase:{shadow:"Exit also requires the person rate under the gate."},hits:[]},
  {on:m.recovered<A("runCost")*3,title:"Incremental recovered revenue is thin",change:laborLed?"Today's audits already catch most errors, so the value is biller time and coverage, not new revenue. Lead the pilot with minutes per bill; finance owner changes to billing ops.":"The case becomes accuracy and customer trust (credits, fewer disputes), not revenue. Narrow scope to the error types that pay (reweigh, reclass, missed accessorials).",watch:`${money0(m.recovered)}/mo incremental recovery vs ${money0(A("runCost"))}/mo run cost`,
   phase:{pilot:laborLed?"Lead metric: biller minutes per bill.":"Narrow to high-value error types."},hits:[]},
  {on:A("underShare")<50,title:"Most errors are over-charges",change:"The agent mostly issues credits. Position it as a customer-trust feature; the sales story and the finance owner change.",watch:`${A("underShare")}% under-billing`,phase:{},hits:["Recovery and disputes"]}
 ];
 return F;
}
function activeHits(){const out=[];for(const f of flips().filter(f=>f.on))for(const h of f.hits)out.push({h:h.toLowerCase(),title:f.title});return out}
function hitFor(text){const t=String(text).toLowerCase();return activeHits().filter(x=>t.includes(x.h)).map(x=>x.title)}
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

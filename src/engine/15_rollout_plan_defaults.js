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

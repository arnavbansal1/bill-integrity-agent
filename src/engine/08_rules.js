/* ---------------- Deterministic rules ---------------- */
const RANK={"Clear":0,"Propose fix":1,"Request info":2,"Escalate":3};
function evaluate(bill,ext,problems){
 const F=[];let fid=0;const add=f=>{f.id=bill.pro+"-"+(++fid);F.push(f);return f};
 const d=bill.draft;const p={weight:d.weight,cls:d.cls,contract:d.contract,fsc:d.fsc,acc:[...d.acc]};
 const draftRate=rate(d);
 const myProblems=problems.filter(x=>x.pro===bill.pro);
 if(!ext){add({title:"AI returned nothing for this bill",status:"Needs review",outcome:"Escalate",quotes:[],facts:[],why:"No extraction came back, so no rule can run safely.",next:"Re-run, or a biller checks the documents by hand.",basis:"Rule"});}
 if(ext&&ext.dup)add({title:"Duplicate AI entries for this PRO",status:"Needs review",outcome:"Escalate",quotes:[],facts:[],why:"Two different extractions came back for one bill.",next:"Biller checks which is right.",basis:"Rule"});
 for(const pr of myProblems.filter(x=>/not a plain number|malformed|not YYYY|unknown performed|not a list|not an object/.test(x.msg)))
  add({title:"AI output problem",status:"Needs review",outcome:"Escalate",quotes:[],facts:[pr.msg],why:"Malformed values are flagged, never silently converted.",next:"Biller checks the source document.",basis:"Rule (validation)"});
 if(ext)for(const u of ext.unsupported)add({title:`Unsupported service: ${u.code}`,status:"Needs review",outcome:"Escalate",quotes:u.quote?[{doc:u.doc,text:u.quote,...verifyQuote(bill,u.doc,u.quote)}]:[],facts:["Detected but not in the supported list, so no price rule exists."],why:"Listed instead of dropped.",next:"Biller decides whether it is billable.",basis:"Rule (validation)"});
 const missing=["bol","driver","pod"].filter(k=>!bill.docs[k]);

 /* 1. Pickup date → contract version and fuel week */
 const ruleDates=scanPickupDates(bill);
 const aiDates=ext?ext.pickup_dates.map(x=>({...x,...verifyQuote(bill,x.doc,x.quote)})):[];
 for(const x of aiDates.filter(x=>!x.ok))add({title:"Pickup-date quote not found in documents",status:"Needs review",outcome:"Escalate",quotes:[{doc:x.doc,text:x.quote,ok:false}],facts:[`AI said ${x.date}`],why:"Every fact must trace to an exact quote.",next:"Biller checks the date.",basis:"Rule (grounding)"});
 const allDates=[...ruleDates,...aiDates.filter(x=>x.ok)];
 const distinct=[...new Set(allDates.map(x=>x.date))].sort();
 let date=null;
 if(distinct.length===0)add({title:"No pickup date found",status:"Needs review",outcome:"Escalate",quotes:[],facts:[],why:"Contract version and fuel surcharge both depend on the pickup date.",next:"Biller confirms the pickup date.",basis:"Rule"});
 else if(distinct.length>1){
  const vers=[...new Set(distinct.map(x=>versionFor(bill.cust,x)))];const weeks=[...new Set(distinct.map(weekStart))];
  if(vers.length>1||weeks.length>1){
   const qs=dedupeQuotes(allDates.map(x=>({doc:x.doc,text:x.quote,ok:true})));
   add({title:"Conflicting pickup dates change the price",status:"Needs review",outcome:"Escalate",quotes:qs,
    facts:[`Dates found: ${distinct.join(", ")}`, vers.length>1?`They fall under different contracts: ${vers.join(" vs ")}`:`They fall in different fuel weeks: ${weeks.join(" vs ")}`],
    why:"The rules will not pick a date when the choice changes the charge.",next:"Billing owner confirms the actual pickup date, then re-rate.",basis:ruleDates.length>1?"Rule (backstop date scan) + AI":"AI evidence + rule"});
  }else date=distinct[0];
 }else date=distinct[0];
 if(date){
  const ver=versionFor(bill.cust,date);
  if(ver&&ver!==d.contract){p.contract=ver;add({title:"Wrong contract version on draft",status:"Gap",outcome:"Propose fix",quotes:[],facts:[`Pickup ${date} → ${ver} (draft used ${d.contract})`],why:"Contract version is chosen by pickup date.",next:"Re-rate on the correct version.",basis:"Rule"})}
  const f=FSC[weekStart(date)];
  if(f==null)add({title:"No fuel surcharge rate for that week",status:"Needs review",outcome:"Escalate",quotes:[],facts:[`Week of ${weekStart(date)}`],why:"Missing reference data fails safe.",next:"Pricing adds the weekly rate.",basis:"Rule"});
  else if(Math.abs(f-d.fsc)>1e-9){p.fsc=f;const q=allDates.filter(x=>x.date===date).slice(0,1).map(x=>({doc:x.doc,text:x.quote,ok:true}));
   add({title:"Fuel surcharge from the wrong week",status:"Gap",outcome:"Propose fix",quotes:q,facts:[`Pickup ${date}, week of ${weekStart(date)}: ${pct(f)}`,`Draft used ${pct(d.fsc)}`],why:"Fuel surcharge follows the week of pickup.",next:"Apply the correct weekly rate.",basis:"Rule"})}
 }

 /* 2. Inspection certificate → reweigh and density reclass */
 if(bill.docs.inspection&&!(ext&&ext.inspection))add({title:"Inspection certificate present but not extracted",status:"Needs review",outcome:"Escalate",quotes:[],facts:["A W&I certificate is in the file."],why:"Backstop: the rules know the document exists even if the AI missed it.",next:"Biller reads the certificate.",basis:"Rule (backstop)"});
 if(ext&&ext.inspection&&!bill.docs.inspection)add({title:"Inspection data with no certificate",status:"Needs review",outcome:"Escalate",quotes:[],facts:["AI returned inspection values, but no certificate was provided."],why:"Nothing to verify against.",next:"Biller checks the source.",basis:"Rule (grounding)"});
 if(ext&&ext.inspection&&bill.docs.inspection){
  const x=ext.inspection;const wq=verifyQuote(bill,"inspection",x.weight_quote),dq=verifyQuote(bill,"inspection",x.dims_quote);
  const quotes=[{doc:"inspection",text:x.weight_quote,ok:wq.ok},{doc:"inspection",text:x.dims_quote,ok:dq.ok}];
  const numsOk=x.weight_lb!=null&&x.pieces!=null&&x.dims_in;
  const qTrip=dimsTriples(x.dims_quote||"");
  const numsInQuote=numsOk&&tokenIn(x.weight_lb,x.weight_quote)&&qTrip.some(t=>t.every((n,i)=>n===x.dims_in[i]))&&(tokenIn(x.pieces,x.dims_quote)||tokenIn(x.pieces,x.weight_quote));
  const certTrips=dimsTriples(bill.docs.inspection);const distinctSizes=new Set(certTrips.map(t=>t.join("x")));
  if(distinctSizes.size>1)add({title:"Pieces of different sizes on the certificate",status:"Needs review",outcome:"Escalate",quotes:[],facts:[`Sizes on certificate: ${[...distinctSizes].join(", ")}`],why:"One set of dimensions cannot rate pieces of different sizes, so density is not computed automatically.",next:"Biller computes total cube from the certificate.",basis:"Rule (v2 backstop: certificate scan)"});
  else
  if(!wq.ok||!dq.ok||!numsOk||!numsInQuote)add({title:"Inspection values could not be verified",status:"Needs review",outcome:"Escalate",quotes,facts:[`AI weight: ${x.rawWeight}`,`AI dims: ${JSON.stringify(x.rawDims)}`,`AI pieces: ${x.rawPieces}`],why:!wq.ok||!dq.ok?"A quote is not in the certificate.":"The numbers do not match their quotes or are malformed.",next:"Biller reads the certificate.",basis:"Rule (grounding)"});
  else{
   const cu=x.pieces*x.dims_in[0]*x.dims_in[1]*x.dims_in[2]/1728;const pcf=x.weight_lb/cu;const dc=densityClass(pcf);
   const before=ratedClass(d.cls,p.contract),after=ratedClass(dc,p.contract);
   const facts=[`Scale weight ${x.weight_lb} lb (BOL ${d.weight} lb)`,`${x.pieces} × ${x.dims_in.join(" × ")} in = ${cu.toFixed(1)} cu ft → ${pcf.toFixed(2)} lb/cu ft → class ${dc} (BOL class ${d.cls})`];
   if(CONTRACTS[p.contract].fak)facts.push(`Contract FAK: classes ${CONTRACTS[p.contract].fak.from}–${CONTRACTS[p.contract].fak.to} rate as ${CONTRACTS[p.contract].fak.as}`);
   if(x.weight_lb!==d.weight||after!==before){p.weight=x.weight_lb;p.cls=dc;
    add({title:"Reweigh and reclass from inspection",status:"Gap",outcome:"Propose fix",quotes,facts,why:"A verified W&I certificate overrides the shipper's BOL weight and class.",next:"Attach the certificate to the corrected invoice.",basis:"AI evidence + rule"});}
   else add({title:dc!==d.cls?"Reclass is price-neutral under FAK":"Inspection matches the BOL",status:"Met",outcome:"Clear",quotes,facts,why:dc!==d.cls?"Density says a different class, but the contract's FAK range rates it the same. No change.":"No change needed.",next:"None.",basis:"AI evidence + rule"});
  }
 }

 /* 3. Accessorial services */
 const requested=scanRequestedServices(bill);
 const svc=ext?ext.services.map(s=>({...s,...verifyQuote(bill,s.doc,s.quote)})):[];
 /* Backstop rule 3: a quote that reads as negative can never count as "performed" */
 const NEG=/\b(not|no|never|wasn'?t|didn'?t|without|declined|refused)\b/i;
 const negFor=s=>{const kw=SVC_KW[s.code];const cl=norm(s.quote).split(/[;,.]|\bbut\b|\bso\b/i);const hit=kw?cl.filter(c=>kw.test(c)):[];return(hit.length?hit:[norm(s.quote)]).some(c=>NEG.test(c))};
 for(const s of svc.filter(s=>s.ok&&s.performed==="yes"&&negFor(s))){s.ok=false;s.neg=true;
  add({title:`${SERVICE_NAMES[s.code]}: AI says performed, but the quote reads as negative`,status:"Needs review",outcome:"Escalate",quotes:[{doc:s.doc,text:s.quote,ok:true}],facts:["AI label: performed = yes"],why:"Backstop: negated wording never counts as proof a service was done.",next:"Biller reads the note and decides.",basis:"Rule (backstop negation check)"})}
 for(const s of svc.filter(s=>!s.ok&&!s.neg))add({title:`${SERVICE_NAMES[s.code]}: quote not found`,status:"Needs review",outcome:"Escalate",quotes:[{doc:s.doc,text:s.quote,ok:false}],facts:[`AI said performed = ${s.performed}`],why:"Every fact must trace to an exact quote.",next:"Biller checks the documents.",basis:"Rule (grounding)"});
 /* v2 backstop: instructions addressed to the system inside a document */
 for(const dk of DOC_ORDER){const t=bill.docs[dk];const m=t&&t.match(INJECTION_KW);if(m)add({title:"Document contains instructions to the billing system",status:"Needs review",outcome:"Escalate",quotes:[{doc:dk,text:m[0],ok:true}],facts:[`In ${DOC_LABELS[dk].toLowerCase()}`],why:"Text that tries to instruct the system is never evidence; a person checks the bill.",next:"Biller reviews the documents.",basis:"Rule (v2 backstop: injection scan)"})}
 /* v2 backstop: a service named in a delivery document that the AI did not extract */
 for(const [code,kw] of Object.entries(SVC_KW))for(const dk of ["driver","pod"]){const t=bill.docs[dk];const m=t&&t.match(kw);if(!m)continue;
  if(!svc.some(s=>s.code===code&&(s.ok||s.neg)&&s.doc===dk))add({title:`${SERVICE_NAMES[code]} mentioned in ${DOC_LABELS[dk].toLowerCase()} but not extracted`,status:"Needs review",outcome:missing.includes("pod")?"Request info":"Escalate",quotes:[{doc:dk,text:m[0],ok:true}],facts:["Keyword found by rule; no AI evidence from this document"],why:"A miss by the AI must land in review, never in a silent Clear.",next:"Biller reads the note.",basis:"Rule (v2 backstop: delivery-doc keyword scan)"})}
 /* v2 backstop: possible unsupported charge in delivery documents */
 for(const dk of ["driver","pod"]){const t=bill.docs[dk];const m=t&&t.match(UNSUPPORTED_KW);if(m&&!(ext&&ext.unsupported.length))add({title:`Possible unsupported charge mentioned: ${m[0]}`,status:"Needs review",outcome:"Escalate",quotes:[{doc:dk,text:m[0],ok:true}],facts:["Not in the supported list; AI did not report it"],why:"Listed instead of dropped.",next:"Biller decides whether it is billable.",basis:"Rule (v2 backstop: unsupported-service scan)"})}
 /* v2 guard: evidence for a performed service must name that service */
 for(const code of Object.keys(SVC_KW)){const ys=svc.filter(s=>s.ok&&s.performed==="yes"&&s.code===code);if(!ys.length||ys.some(s=>SVC_KW[code].test(norm(s.quote))))continue;
  for(const s of ys){s.ok=false;s.neg=true}
  add({title:`${SERVICE_NAMES[code]}: no quote names the service`,status:"Needs review",outcome:"Escalate",quotes:ys.map(s=>({doc:s.doc,text:s.quote,ok:true})),facts:["AI label: performed = yes"],why:"A charge needs wording that names the service; an AI label alone is not enough.",next:"Biller reads the note and decides.",basis:"Rule (v2 guard: service wording)"})}
 const codes=[...new Set([...d.acc,...svc.map(s=>s.code),...requested])];
 for(const code of codes){
  const ev=svc.filter(s=>s.code===code&&s.ok);
  const deliv=ev.filter(s=>(s.doc==="driver"||s.doc==="pod")&&(s.performed==="yes"||s.performed==="no"));
  const yes=deliv.filter(s=>s.performed==="yes"),no=deliv.filter(s=>s.performed==="no");
  const onDraft=d.acc.includes(code);const price=CONTRACTS[p.contract].acc[code];const name=SERVICE_NAMES[code];
  const quotes=dedupeQuotes(ev.map(s=>({doc:s.doc,text:s.quote,ok:true})));
  const basis=requested.includes(code)&&!ev.length?"Rule (backstop BOL scan)":"AI evidence + rule";
  const SHIP=d=>d==="pod"||d==="bol"||d==="inspection";
  const precFact=(()=>{const hi=[...yes,...no].filter(s=>SHIP(s.doc)),lo=[...yes,...no].filter(s=>!SHIP(s.doc));if(!hi.length||!lo.length)return null;const h=hi[0];return `Precedence: ${DOC_LABELS[h.doc]} (shipment evidence) outranks ${DOC_LABELS[lo[0].doc].toLowerCase()} (operational note). Suggested resolution follows the ${DOC_LABELS[h.doc]}: ${h.performed==="yes"?"performed":"not performed"}.`})();
  if(yes.length&&no.length)add({title:`${name}: delivery documents conflict`,status:"Needs review",outcome:"Escalate",quotes,facts:["One document says it was used, another says not."].concat(precFact?[precFact]:[]),why:"Conflicting evidence goes to a person.",next:"Biller confirms with the terminal.",basis});
  else if(yes.length){
   if(onDraft)add({title:`${name}: billed and confirmed`,status:"Met",outcome:"Clear",quotes,facts:[`Contract price ${money(price)}`],why:"Delivery documents confirm it.",next:"None.",basis});
   else if(price==null)add({title:`${name}: performed, but no contract price`,status:"Needs review",outcome:"Escalate",quotes,facts:[`${p.contract} has no ${name} rate`],why:"No price rule exists, so nothing is proposed.",next:"Pricing confirms the rate.",basis});
   else{p.acc.push(code);add({title:`Add ${name.toLowerCase()} (${money(price)})`,status:"Gap",outcome:"Propose fix",quotes,facts:[`Performed per ${yes.map(s=>DOC_LABELS[s.doc].toLowerCase()).join(" and ")}`,`Not on draft; ${p.contract} price ${money(price)}`],why:"Service was performed and the contract prices it.",next:"Add the charge with the delivery note attached.",basis});}
  }else if(no.length){
   if(onDraft){p.acc=p.acc.filter(c=>c!==code);add({title:`Credit ${name.toLowerCase()} (${money(-price)})`,status:"Gap",outcome:"Propose fix",quotes,facts:["Billed on draft","Delivery documents say it was not used"],why:"Billing a service that was not performed creates a dispute.",next:"Remove the charge before the invoice goes out.",basis});}
   else add({title:`${name}: requested, not used, not billed`,status:"Met",outcome:"Clear",quotes,facts:[],why:"Draft is already correct.",next:"None.",basis});
  }else{
   if(missing.includes("pod"))add({title:`${name}: requested, proof of delivery missing`,status:"Info",outcome:"Request info",quotes,facts:["Requested on the BOL","No delivery document confirms or denies it","POD not provided"],why:"Cannot confirm the service was performed.",next:"Request the POD from the terminal, then re-run.",basis});
   else add({title:`${name}: no confirmation either way`,status:"Needs review",outcome:"Escalate",quotes,facts:["Requested or mentioned, but delivery documents are silent"],why:"Silence is not evidence.",next:"Biller checks with the driver.",basis});
  }
 }
 if(missing.length)add({title:`Potentially incomplete: ${missing.map(m=>DOC_LABELS[m]).join(", ")} not provided`,status:"Info",outcome:F.some(f=>f.outcome!=="Clear")?"Clear":"Clear",quotes:[],facts:[],why:"Flagged so the review is not mistaken for complete.",next:"See other findings.",basis:"Rule",soft:true});

 let outcome="Clear";for(const f of F)if(!f.soft&&RANK[f.outcome]>RANK[outcome])outcome=f.outcome;
 const exp=(outcome==="Clear"||outcome==="Propose fix")?rate(p):null;
 const delta=exp?r2(exp.total-draftRate.total):null;
 return{outcome,findings:F,draft:draftRate,draftParams:d,expected:exp,expParams:p,delta,key:!!CUSTOMERS[bill.cust].key};
}
function dedupeQuotes(qs){const seen=new Set();return qs.filter(q=>{const k=q.doc+"|"+norm(q.text).toLowerCase();if(seen.has(k))return false;seen.add(k);return true})}


/* ---------------- Validate AI output: one bad item never breaks the run ---------------- */
const ALLOWED_CODES=Object.keys(SERVICE_NAMES), ALLOWED_PERF=["yes","no","requested","unclear"], ALLOWED_DOCS=DOC_ORDER;
function validate(raw){
 const problems=[];const by={};
 let arr=raw;
 if(arr&&!Array.isArray(arr)&&Array.isArray(arr.bills))arr=arr.bills;
 if(!Array.isArray(arr)){problems.push({pro:"*",msg:"Output is not a list of bills"});return{by,problems}}
 for(const [i,it] of arr.entries()){
  if(!it||typeof it!=="object"){problems.push({pro:"*",msg:`Item ${i} is not an object`});continue}
  const pro=String(it.pro??"").trim();
  if(!BILLS.some(b=>b.pro===pro)){problems.push({pro:"*",msg:`Item ${i}: unknown PRO "${pro}"`});continue}
  if(by[pro]){problems.push({pro,msg:"Duplicate entry for this PRO; first kept"});by[pro].dup=true;continue}
  const v={services:[],unsupported:[],inspection:null,pickup_dates:[],notes:typeof it.notes==="string"?it.notes:"",confidence:String(it.confidence??"")};
  for(const s of Array.isArray(it.services)?it.services:[]){
   if(!s||typeof s!=="object"){problems.push({pro,msg:"A service entry is not an object"});continue}
   const code=String(s.code??"").toUpperCase().trim();
   let perf=String(s.performed??"").toLowerCase().trim();
   const doc=ALLOWED_DOCS.includes(String(s.doc))?String(s.doc):null;
   if(!ALLOWED_CODES.includes(code)){v.unsupported.push({code:code||"(blank)",quote:String(s.quote??""),doc});problems.push({pro,msg:`Unsupported service type "${code||"(blank)"}"`});continue}
   if(!ALLOWED_PERF.includes(perf)){problems.push({pro,msg:`Service ${code}: unknown performed value "${perf}", treated as unclear`});perf="unclear"}
   v.services.push({code,performed:perf,quote:typeof s.quote==="string"?s.quote:String(s.quote??""),doc});
  }
  if(it.services!=null&&!Array.isArray(it.services))problems.push({pro,msg:"services is not a list"});
  if(it.inspection&&typeof it.inspection==="object"){
   const x=it.inspection;const dims=Array.isArray(x.dims_in)&&x.dims_in.length===3?x.dims_in.map(strictNum):null;
   v.inspection={weight_lb:strictNum(x.weight_lb),pieces:strictNum(x.pieces),dims_in:dims&&dims.every(n=>n!=null)?dims:null,weight_quote:String(x.weight_quote??""),dims_quote:String(x.dims_quote??""),doc:ALLOWED_DOCS.includes(String(x.doc))?String(x.doc):"inspection",rawWeight:x.weight_lb,rawDims:x.dims_in,rawPieces:x.pieces};
   if(v.inspection.weight_lb==null)problems.push({pro,msg:`Inspection weight "${x.weight_lb}" is not a plain number`});
   if(v.inspection.pieces==null)problems.push({pro,msg:`Inspection pieces "${x.pieces}" is not a plain number`});
   if(!v.inspection.dims_in)problems.push({pro,msg:"Inspection dimensions are missing or malformed"});
  }
  for(const p of Array.isArray(it.pickup_dates)?it.pickup_dates:[]){
   const d=strictDate(p&&p.date);if(!d){problems.push({pro,msg:`Pickup date "${p&&p.date}" is not YYYY-MM-DD`});continue}
   v.pickup_dates.push({date:d,quote:String(p.quote??""),doc:ALLOWED_DOCS.includes(String(p.doc))?String(p.doc):null,src:"ai"});
  }
  by[pro]=v;
 }
 return{by,problems};
}


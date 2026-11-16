/* Backstop rule 1: every pickup date stated in the BOL and driver notes, read by regex, not by the AI */
function scanPickupDates(bill){
 const out=[];const re=/pick(?:ed)?\s*up(?:\s*date)?:?\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/gi;
 for(const d of ["bol","driver"]){const t=bill.docs[d];if(!t)continue;let m;re.lastIndex=0;while((m=re.exec(t))){const y=m[3]||"2026";out.push({date:`${y}-${m[1].padStart(2,"0")}-${m[2].padStart(2,"0")}`,quote:m[0],doc:d,src:"rule"})}}
 return out;
}
/* v2 backstops: keyword tables used ONLY to send bills to a person, never to add a charge */
const SVC_KW={LIFTGATE:/\b(lift[- ]?gate|tail[- ]?lift)\b/i,INSIDE:/\binside\b/i,RESIDENTIAL:/\breside(nce|ntial)\b/i,APPT:/\b(appointment|appt)\b/i};
const UNSUPPORTED_KW=/\b(detention|wait(?:ing)? time|storage|redeliver(?:y|ed)?|reconsign\w*|layover|sort and segregate|limited access|lumper)\b/i;
const INJECTION_KW=/(ignore (?:all |any )?(?:prior|previous|above) instructions|note to (?:the )?(?:billing|ai|system)|disregard (?:the |all )?(?:rules|instructions)|you are an ai|system prompt)/i;
const DIMS_RE=/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/gi;
const tokenIn=(n,text)=>new RegExp("(^|[^\\d.])"+String(n).replace(".","\\.")+"(?![\\d.])").test(norm(text));
function dimsTriples(text){const out=[];let m;DIMS_RE.lastIndex=0;while((m=DIMS_RE.exec(text)))out.push([+m[1],+m[2],+m[3]]);return out}
/* Backstop rule 2: services requested on the BOL, read by keyword */
function scanRequestedServices(bill){
 const m=(bill.docs.bol||"").match(/Special services:\s*(.*)/i);if(!m)return[];const s=m[1].toLowerCase();const out=[];
 if(s.includes("liftgate"))out.push("LIFTGATE");if(s.includes("inside"))out.push("INSIDE");if(s.includes("residential"))out.push("RESIDENTIAL");if(s.includes("appointment"))out.push("APPT");
 return out;
}


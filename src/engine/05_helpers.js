/* ---------------- Helpers ---------------- */
const $=id=>document.getElementById(id);
const r2=x=>Math.round((x+1e-9)*100)/100;
const money=(x,sign)=>{if(x==null||isNaN(x))return"–";const s=Math.abs(x).toLocaleString("en-US",{style:"currency",currency:"USD"});return sign?(x>0?"+"+s:x<0?"−"+s:s):(x<0?"−"+s:s)};
const pct=x=>(x*100).toFixed(1)+"%";
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm=s=>String(s).replace(/[‘’‛′]/g,"'").replace(/[“”″]/g,'"').replace(/[–—]/g,"-").replace(/\s+/g," ").trim();
function weekStart(iso){const d=new Date(iso+"T12:00:00Z");const wd=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-wd);return d.toISOString().slice(0,10)}
function versionFor(cust,iso){let best=null;for(const [id,c] of Object.entries(CONTRACTS)){if(c.cust===cust&&c.effective<=iso&&(!best||c.effective>CONTRACTS[best].effective))best=id}return best}
function densityClass(pcf){const t=[[50,50],[35,55],[30,60],[22.5,65],[15,70],[13.5,77.5],[12,85],[10.5,92.5],[9,100],[8,110],[7,125],[6,150],[5,175],[4,200],[3,250],[2,300],[1,400]];for(const [lo,c] of t)if(pcf>=lo)return c;return 500}
function ratedClass(cls,cid){const f=CONTRACTS[cid].fak;return f&&cls>=f.from&&cls<=f.to?f.as:cls}
function rate(p){const c=CONTRACTS[p.contract];const eff=ratedClass(p.cls,p.contract);const line=Math.max(c.minimum,r2(p.weight/100*TARIFF[eff]*(1-c.discount)));const fsc=r2(line*p.fsc);const acc={};let a=0;for(const code of p.acc){acc[code]=c.acc[code];a+=c.acc[code]}return{line,fsc,acc,eff,total:r2(line+fsc+a)}}
function strictNum(v){if(typeof v==="number"&&isFinite(v))return v;if(typeof v==="string"&&/^\d+(\.\d+)?$/.test(v.trim()))return Number(v.trim());return null}
function strictDate(v){return typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v+"T00:00:00Z"))?v:null}

function verifyQuote(bill,doc,quote){
 if(typeof quote!=="string"||!quote.trim())return{ok:false,doc:null};
 const q=norm(quote).toLowerCase();
 const order=doc&&bill.docs[doc]?[doc,...DOC_ORDER.filter(d=>d!==doc)]:DOC_ORDER;
 for(const d of order){if(bill.docs[d]&&norm(bill.docs[d]).toLowerCase().includes(q))return{ok:true,doc:d}}
 return{ok:false,doc:null};
}

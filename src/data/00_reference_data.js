"use strict";
/* ---------------- Fixed reference data (fictional, illustrative) ---------------- */
const TARIFF={50:72,55:80,60:88,65:96,70:104,77.5:112,85:124,92.5:136,100:148,110:160,125:180,150:208,175:240,200:272,250:328,300:384,400:480,500:600};
const FSC={"2026-10-26":0.318,"2026-11-02":0.325,"2026-11-09":0.331};
const CONTRACTS={
 "BRT-v4":{cust:"BRT",effective:"2026-01-01",discount:0.72,minimum:125,fak:null,acc:{LIFTGATE:65,RESIDENTIAL:85,INSIDE:95,APPT:25}},
 "NOR-v1":{cust:"NOR",effective:"2025-09-01",discount:0.68,minimum:125,fak:null,acc:{LIFTGATE:65,INSIDE:95,APPT:25}},
 "CAS-v2":{cust:"CAS",effective:"2025-06-01",discount:0.70,minimum:125,fak:{from:70,to:100,as:70},acc:{LIFTGATE:65,APPT:25}},
 "HRB-v2":{cust:"HRB",effective:"2025-03-01",discount:0.70,minimum:125,fak:null,acc:{LIFTGATE:70,APPT:30}},
 "HRB-v3":{cust:"HRB",effective:"2026-11-01",discount:0.74,minimum:125,fak:null,acc:{LIFTGATE:70,APPT:30}}
};
const CUSTOMERS={BRT:{name:"Brightline Home Goods"},NOR:{name:"Norfield Electronics",key:true},CAS:{name:"Cascade Outdoor Supply"},HRB:{name:"Harbor Medical Distribution"}};
const SERVICE_NAMES={LIFTGATE:"Liftgate",INSIDE:"Inside delivery",RESIDENTIAL:"Residential delivery",APPT:"Delivery appointment"};
const DOC_LABELS={bol:"Bill of lading",driver:"Driver notes",pod:"Proof of delivery",inspection:"W&I certificate",email:"Email"};
const DOC_ORDER=["bol","driver","pod","inspection","email"];


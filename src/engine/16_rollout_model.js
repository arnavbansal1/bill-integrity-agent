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

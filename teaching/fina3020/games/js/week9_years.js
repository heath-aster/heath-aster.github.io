/* Ten-year game model; a port of design/week9-ten-years-2026-10-27/week9_years_key.py.
   Uses PortfolioModel (one-year statistics and limits) and WEEK9_YEARS (frozen path, rules). */
const TenYears=(()=>{
 const P=WEEK9.params,FP=WEEK9.forward_premium,G=WEEK9_YEARS.game,M=PortfolioModel;
 function assetReturns(stress,z){const r=stress?'S':'N',[e1,e2,b1,b2,x]=z,rho=P.rho_eq[r],rb=P.rho_bond;
  return {hke:P.hke[r][0]+P.hke[r][1]*e1,gle:P.gle[r][0]+P.gle[r][1]*(rho*e1+Math.sqrt(1-rho*rho)*e2),hkb:P.hkb[r][0]+P.hkb[r][1]*b1,
   jgb:P.jgb[r][0]+P.jgb[r][1]*(rb*b1+Math.sqrt(1-rb*rb)*b2),jpy:P.jpy[r][0]+P.jpy[r][1]*x};}
 function playYear(V,c,year){const r=assetReturns(year.stress,year.z),R=Math.min(c.reserve,V),E=c.equity*V,D=V-E-R;
  const hk=E*c.home,gl=E*(1-c.home),hb=D/2,jg=D/2,H=jg*c.hedge,settlement=H*(r.jpy-FP),shortfall=Math.max(0,settlement-R);
  const forcedCost=P.forced_sale_cost[year.stress?'S':'N']*shortfall;
  const end=hk*(1+r.hke)+gl*(1+r.gle-M.drag(c.wrapper))+hb*(1+r.hkb)+jg*(1+r.jgb+c.hedge*FP+(1-c.hedge)*r.jpy)+R*(1+P.cash_rate)-forcedCost;
  const cut=end<G.cut_threshold,grant=cut?G.cut_grant:G.grant;
  return {start:V,returns:r,hedged:H,reserve:R,settlement,shortfall,forcedCost,beforeGrant:end,grant,cut,end:end-grant,portfolioReturn:(end-V)/V};}
 const policyFor=(year,policies)=>policies[G.meetings.filter(m=>year>=m).length-1];
 // One-year statistics are expensive (bisection), so pass flags are cached per policy.
 const passCache=new Map(),passes=c=>{const k=[c.equity,c.home,c.hedge,c.reserve,c.wrapper].join('|');if(!passCache.has(k))passCache.set(k,M.passes(M.stats(c)));return passCache.get(k);};
 const breaches=policies=>policies.filter(c=>!passes(c)).length;
 // Plays the first `upTo` years; the score is defined once all ten are played.
 function run(policies,path,eventCost=0,fees=0,upTo=G.years){let V=G.start_value,grants=0,cuts=0,forced=0;const years=[];
  for(let i=1;i<=upTo;i++){const rec=playYear(V,policyFor(i,policies),path[i-1]);if(i===G.event_year)rec.end-=eventCost;V=rec.end;grants+=rec.grant;cuts+=rec.cut?1:0;forced+=rec.shortfall>0?1:0;years.push(rec);}
  const nb=breaches(policies.slice(0,G.meetings.filter(m=>upTo>=m).length||1));
  return {years,endValue:V,grants,cuts,forcedSales:forced,breaches:nb,fees,eventCost,score:V+grants-G.cut_penalty*cuts-G.breach_penalty*nb-fees};}
 function mulberry32(seed){let s=seed>>>0;return ()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
 let cached;
 function randomPaths(n=G.paths,seed=G.seed){if(cached&&n===G.paths&&seed===G.seed)return cached;const rnd=mulberry32(seed),normal=()=>Math.sqrt(-2*Math.log(Math.max(rnd(),1e-12)))*Math.cos(2*Math.PI*rnd()),out=[];
  for(let k=0;k<n;k++){const path=[];for(let y=0;y<G.years;y++){const stress=rnd()<P.p_stress;path.push({stress,z:Array.from({length:5},normal)});}out.push(path);}
  if(n===G.paths&&seed===G.seed)cached=out;return out;}
 function summary(runs){const s=runs.map(r=>r.score).sort((a,b)=>a-b),k=Math.max(1,Math.round(.05*s.length)),n=runs.length,sum=a=>a.reduce((v,x)=>v+x,0);
  return {mean:sum(s)/n,worst5_mean:sum(s.slice(0,k))/k,min:s[0],max:s[n-1],mean_cuts:sum(runs.map(r=>r.cuts))/n,p_any_cut:runs.filter(r=>r.cuts>0).length/n,mean_forced_sales:sum(runs.map(r=>r.forcedSales))/n};}
 function distribution(policies,eventCost=0,fees=0){const runs=randomPaths().map(p=>run(policies,p,eventCost,fees));return {scores:runs.map(r=>r.score),...summary(runs)};}
 function eventCost(choice,wrapper){return choice==='global'?WEEK9_YEARS.event.global[wrapper]:WEEK9_YEARS.event.hk_equity;}
 function bestEventCost(wrapper){const g=WEEK9_YEARS.event.global[wrapper];return g===null?WEEK9_YEARS.event.hk_equity:Math.min(WEEK9_YEARS.event.hk_equity,g);}
 return {G,assetReturns,playYear,policyFor,breaches,run,mulberry32,randomPaths,summary,distribution,eventCost,bestEventCost};
})();

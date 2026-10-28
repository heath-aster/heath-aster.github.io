/* Exact analytical model; assumptions are generated from the Python reference. */
const PortfolioModel=(()=>{
 const P=WEEK9.params, FP=WEEK9.forward_premium;
 const phi=x=>Math.exp(-x*x/2)/Math.sqrt(2*Math.PI);
 // Composite Simpson integration of the normal density. 128 intervals on
 // [0, |x|] and saturation beyond 9 give better than 1e-7 erf accuracy.
 function Phi(x){if(x===0)return .5;if(Math.abs(x)>=9)return x<0?0:1;const z=Math.abs(x),h=z/128;let sum=phi(0)+phi(z);for(let i=1;i<128;i++)sum+=(i%2?4:2)*phi(i*h);return .5+(x<0?-1:1)*sum*h/3;}

 function drag(w){return WEEK9.wrappers[w].fee+WEEK9.wrappers[w].wht*WEEK9.div_yield;}
 function cash(reg,c){const H=P.size*(1-c.equity-c.reserve/P.size)/2*c.hedge;return [H*(P.jpy[reg][0]-FP),H*P.jpy[reg][1]];}
 function excess(m,s,R){if(!s)return Math.max(0,m-R);const z=(m-R)/s;return (m-R)*Phi(z)+s*phi(z);}
 function moments(reg,c){const a=c.equity*c.home,b=c.equity*(1-c.home),d=(1-c.equity-c.reserve/P.size)/2,h=c.hedge;
 const [me,se]=P.hke[reg],[mg,sg]=P.gle[reg],[mb,sb]=P.hkb[reg],[mj,sj]=P.jgb[reg],[mx,sx]=P.jpy[reg];
 const [cm,cs]=cash(reg,c);
 const m=a*me+b*(mg-drag(c.wrapper))+d*mb+d*(mj+h*FP+(1-h)*mx)+c.reserve/P.size*P.cash_rate-P.forced_sale_cost[reg]*excess(cm,cs,c.reserve)/P.size;
 const v=(a*se)**2+(b*sg)**2+2*a*b*P.rho_eq[reg]*se*sg+(d*sb)**2+(d*sj)**2+2*d*d*P.rho_bond*sb*sj+(d*(1-h)*sx)**2;return [m,Math.sqrt(v)];}
 function distribution(comps){const mean=comps.reduce((v,[p,m])=>v+p*m,0),vol=Math.sqrt(comps.reduce((v,[p,m,s])=>v+p*(s*s+m*m),0)-mean*mean);
 const cdf=x=>comps.reduce((v,[p,m,s])=>v+p*(s?Phi((x-m)/s):Number(x>=m)),0);
 let lo=-2,hi=2;for(let i=0;i<200;i++){const mid=(lo+hi)/2;if(cdf(mid)<.05)lo=mid;else hi=mid;}
 const var5=(lo+hi)/2,es5=comps.reduce((v,[p,m,s])=>v+p*(m*Phi((var5-m)/s)-s*phi((var5-m)/s)),0)/.05;
 return {mean,vol,var5,es5,var5_single_normal:mean-1.6449*vol,es5_single_normal:mean-vol*phi(1.6449)/.05,p_loss_gt_25:cdf(-.25),p_loss_gt_25_single_normal:Phi((-.25-mean)/vol)};}
 function stats(c){const [mN,sN]=moments('N',c),[mS,sS]=moments('S',c),p=P.p_stress;
 const calls=['N','S'].reduce((v,r,i)=>{const [m,s]=cash(r,c);return v+(i?p:1-p)*(s?1-Phi((c.reserve-m)/s):Number(m>c.reserve));},0);
 return {normal_mean:mN,normal_vol:sN,stress_mean:mS,stress_vol:sS,...distribution([[1-p,mN,sN],[p,mS,sS]]),p_cashcall_gt_reserve:calls};}
 const rounded=x=>Math.round(x*1000)/10;
 const flags=(s,normal=false)=>({es:rounded(s[normal?'es5_single_normal':'es5'])>=rounded(WEEK9.limits.es5_min),cash:rounded(s.p_cashcall_gt_reserve)<=rounded(WEEK9.limits.p_cashcall_max)});
 function passes(s,normal=false){const f=flags(s,normal);return f.es&&f.cash;}
 function grid(){const rows=[];for(const equity of [.5,.6,.7])for(const home of [1,.5,.1])for(const hedge of [0,.5,1])for(const reserve of [1,3,5])for(const wrapper of Object.keys(WEEK9.wrappers)){const c={equity,home,hedge,reserve,wrapper},s=stats(c);rows.push({...c,...s,passes:passes(s),passes_if_single_normal:passes(s,true)});}return rows;}
 return {P,FP,phi,Phi,drag,cash,moments,distribution,stats,flags,passes,grid};
})();

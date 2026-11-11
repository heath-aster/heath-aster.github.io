/* Week 11: the October policy equations, unchanged. USD billions throughout.
   Two independent illustrative scenarios; no draws, probabilities or welfare score. */
(function(root) {
  'use strict';
  function outcome(res, rate, cap, imf, shock=false) {
    const outflow=shock?20:10, h=rate/100, c=cap/100;
    const afterPolicy=Math.max(0,outflow*(1-.6*c)-.8*h);
    const excess=Math.max(0,res+imf-afterPolicy), net=Math.max(0,afterPolicy-res-imf);
    const reserves=20-res+excess, debt=40+imf, fx=-net*(shock?1.6:1.5);
    const npl=shock?4.5+1.2*h+.3*Math.abs(fx):4+.9*h+(fx < -10?3:0);
    const consumption=-(shock?2+.8*h+.25*Math.abs(fx):1.5+.6*h+.2*Math.abs(fx));
    return {outflow,afterPolicy,excess,net,reserves,debt,fx,npl,consumption};
  }
  const example=[4,200,30,2];
  const alternatives=[
    {name:'No intervention',values:[0,0,0,0]},
    {name:'Reserve emphasis',values:[10,0,0,0]},
    {name:'Rate emphasis',values:[0,600,0,0]},
    {name:'Controls emphasis',values:[0,0,100,0]},
    {name:'IMF emphasis',values:[0,0,0,5]},
    {name:'Example mix',values:example}
  ];
  // Preserve the old demonstration, including its possible value of 110.
  // These are ad hoc indexes, NOT estimated sector losses or the model's NPLs.
  function sector([res,rate,cap,imf]) {
    return [res/10*90+(10-imf)*2,rate/600*95,rate/600*50+cap/100*45,rate/600*40+(100-cap)*.3+30];
  }
  const questions=[
    {id:'rate',title:'Convert basis points',question:'The example raises the policy rate by 200 basis points. How many percentage points is that?',unit:'percentage points',answer:2,tolerance:.005,
      hint:'100 basis points (bps) equals one percentage point (pp).',formula:'h = rate increase in bps ÷ 100 = 200 ÷ 100.',solution:'200 ÷ 100 = 2 percentage points. Starting at 5%, the rate becomes 7%. This is a 2 pp rise, not a 2% proportional increase. Use h = 2 in the flow and bank-cost formulas.',mistake:'Enter the change in percentage points: 2, rather than 0.02 or 200.'},
    {id:'flow',title:'Find the outflow after controls and rates',question:'Use outflow O = USD 10B, controls c = 30% = 0.30, and rate rise h = 2 pp. What outflow remains after these two policies?',unit:'USD billions',answer:6.6,tolerance:.01,
      hint:'Controls stop 60% of the covered outflow. Rates reduce outflow by USD 0.8B per percentage point.',formula:'A = max(0, O × (1 − 0.6c) − 0.8h) = max(0, 10 × (1 − 0.6 × 0.30) − 0.8 × 2).',solution:'Controls stop 10 × 0.6 × 0.30 = USD 1.8B. Rates stop 0.8 × 2 = USD 1.6B. A = 10 − 1.8 − 1.6 = USD 6.6B. The 30% covers one part of the original outflow. It does not stop 30% of all outflows. Reserve sales and IMF funding must meet the remaining 6.6B.',mistake:'Use 0.30 for the control share, and multiply it by 0.6. Do not subtract reserve sales yet.'},
    {id:'gap',title:'Find the financing gap',question:'The remaining outflow A is USD 6.6B. Reserve sales R = USD 4B and IMF borrowing M = USD 2B. How much pressure remains?',unit:'USD billions',answer:.6,tolerance:.01,
      hint:'Use foreign currency from both sources once. The gap cannot be negative.',formula:'G = max(0, A − R − M) = max(0, 6.6 − 4 − 2).',solution:'G = USD 0.6B. The supplied USD 6B is spent once meeting outflows. The residual gap drives currency depreciation in the next calculation.',mistake:'Subtract both sources from 6.6, not from the original 10. A negative result would be floored at zero.'},
    {id:'fx',title:'Translate the gap into a currency change',question:'In the USD 10B scenario, each USD 1B gap reduces the currency value by 1.5%. With G = USD 0.6B, what is the signed currency change?',unit:'% change',answer:-.9,tolerance:.01,
      hint:'A depreciation is a negative change in the USD value of one unit of domestic currency.',formula:'f = −1.5 × G = −1.5 × 0.6.',solution:'f = −0.90%. One unit of domestic currency buys 0.9% fewer dollars. The absolute depreciation d = 0.90 is used in the NPL and consumption formulas. A domestic-currency-per-USD quote would rise by about 0.91%, not exactly 0.90%.',mistake:'Keep the minus sign and enter percentage units (−0.90), not the decimal return −0.009.'},
    {id:'reserves',title:'Account for unused foreign currency',question:'A small variation: raise reserve sales to R = USD 5B, keep M = USD 2B and A = USD 6.6B. Starting reserves are USD 20B. What are ending reserves?',unit:'USD billions',answer:15.4,tolerance:.01,
      hint:'Any excess of available funds over the remaining outflow returns to reserves.',formula:'U = max(0, R + M − A). Reserves = 20 − R + U. Here U = max(0, 5 + 2 − 6.6).',solution:'U = USD 0.4B, so reserves = 20 − 5 + 0.4 = USD 15.4B. IMF funds used for outflows cannot also be counted in reserves. Extra financing after the gap reaches zero builds reserves rather than appreciating the currency in this model.',mistake:'Include unused funds, but do not add the whole IMF loan again. Only USD 0.4B is unspent.'},
    {id:'debt',title:'Update external debt',question:'Return to the example. Initial external debt is USD 40B and new IMF borrowing is USD 2B. What is ending external debt?',unit:'USD billions',answer:42,tolerance:.01,
      hint:'Borrowing supplies cash now and creates a liability.',formula:'D = initial debt + new IMF borrowing = 40 + 2.',solution:'D = USD 42B. This is a dollar-denominated stock, not an immediate payment or a measured welfare loss. The model does not revalue it when the domestic currency falls. The domestic-currency burden would rise.',mistake:'Add the loan to debt even when its cash has already been used to meet outflows.'},
    {id:'npl',title:'Apply the baseline bank-stress threshold',question:'A threshold check: in the USD 10B scenario, suppose h = 2 pp and depreciation d = 12%. What is the NPL share? Use the baseline formula below.',unit:'% of loans',answer:8.8,tolerance:.01,
      hint:'The baseline adds 3 percentage points only when depreciation exceeds 10%.',formula:'NPL = 4 + 0.9h + 3 if d > 10. Otherwise NPL = 4 + 0.9h. With h = 2 and d = 12, use the extra 3.',solution:'NPL = 4 + 0.9 × 2 + 3 = 8.80% of loans. The increments are percentage points, not percentage changes. At exactly 10% depreciation there is no extra 3. In the original example d = 0.90%, so NPL = 5.80%. This threshold is an illustrative teaching rule.',mistake:'Add 3 percentage points to the share. Do not multiply the share by 1.03.'},
    {id:'stress-npl',title:'Use the stress-case bank equation',question:'With the same example policy in the separate USD 20B scenario, A = 14.8B, G = 8.8B and depreciation d = 14.08%. With h = 2 pp, what is the NPL share?',unit:'% of loans',answer:11.124,tolerance:.011,
      hint:'The stress scenario uses a continuous depreciation term and different coefficients.',formula:'NPL = 4.5 + 1.2h + 0.3d = 4.5 + 1.2 × 2 + 0.3 × 14.08.',solution:'NPL = 4.5 + 2.4 + 4.224 = 11.124%, or 11.12% of loans. Do not also add the baseline threshold term. Both the larger outflow and different sensitivity assumptions distinguish these two scenarios.',mistake:'Use the positive depreciation magnitude 14.08 in this formula. Use 2 for h. Do not reuse the baseline 3 pp threshold.'},
    {id:'consumption',title:'Translate stress into consumption',question:'In that same USD 20B scenario, h = 2 pp and depreciation d = 14.08%. What is the signed consumption change?',unit:'% change',answer:-7.12,tolerance:.011,
      hint:'Rates and depreciation add to the consumption decline. Put a minus sign on the total.',formula:'k = −(2 + 0.8h + 0.25d) = −(2 + 0.8 × 2 + 0.25 × 14.08).',solution:'k = −(2 + 1.6 + 3.52) = −7.12%. Consumption is 7.12% below the pre-shock level in this scenario. The baseline uses the same calculation with coefficients 1.5, 0.6 and 0.2: −(1.5 + 1.2 + 0.18) = −2.88%. Compare this cost with reserves, debt and currency stability.',mistake:'The output is a signed percentage change. Add the terms first, then apply the negative sign.'}
  ];
  function parseNumber(value) {
    const s=String(value).trim().replace(/−/g,'-').replace(/%\s*$/,'').trim();
    if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s) && !/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d*)?$/.test(s)) return NaN;
    return Number(s.replace(/,/g,''));
  }
  const api={outcome,example,alternatives,sector,questions,parseNumber};
  if(typeof module!=='undefined')module.exports=api;
  root.Week11Model=api;
})(typeof window==='undefined'?globalThis:window);

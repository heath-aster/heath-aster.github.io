/* Guided Week 9 exercise: one allocation, three assets, two market conditions.
   Returns and correlations come from the course's existing WEEK9 assumptions.
   HKD bonds are the safer asset; fees, FX and hedging are outside this exercise. */
const GuidedPortfolio = (() => {
    const size = WEEK9.params.size, pStress = WEEK9.params.p_stress;
    const assets = [
        {key:'hk', name:'Hong Kong equity', source:'hke'},
        {key:'global', name:'Global equity', source:'gle'},
        {key:'bonds', name:'HKD bonds', source:'hkb'}
    ];
    const choices = {equity:[.3,.5,.7], home:[1,.5,.1]};
    function weights(c) {
        if (!choices.equity.includes(c.equity) || !choices.home.includes(c.home)) throw Error('Choose a listed allocation.');
        return [c.equity*c.home, c.equity*(1-c.home), 1-c.equity];
    }
    function scenario(c, state) {
        if (!['N','S'].includes(state)) throw Error('Unknown market condition.');
        const w=weights(c), rows=assets.map((a,i)=>({
            ...a, weight:w[i], amount:size*w[i],
            mean:WEEK9.params[a.source][state][0], vol:WEEK9.params[a.source][state][1]
        }));
        rows.forEach(r=>r.change=r.amount*r.mean);
        const mean=rows.reduce((sum,r)=>sum+r.weight*r.mean,0);
        // Bonds have zero correlation with both equity markets in this teaching model.
        const variance=rows.reduce((sum,r)=>sum+(r.weight*r.vol)**2,0)
            +2*w[0]*w[1]*rows[0].vol*rows[1].vol*WEEK9.params.rho_eq[state];
        return {state, rows, mean, change:size*mean, end:size*(1+mean), vol:Math.sqrt(variance)};
    }
    function evaluate(c) {
        const normal=scenario(c,'N'), stress=scenario(c,'S');
        const mean=(1-pStress)*normal.mean+pStress*stress.mean;
        return {weights:weights(c),normal,stress,mean};
    }
    function random(seed) {
        let x=seed>>>0;
        return ()=>{x=(x+0x6D2B79F5)>>>0;let t=x;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
    }
    function market(stress,z) {
        const state=stress?'S':'N',rho=WEEK9.params.rho_eq[state];
        return {stress,returns:[WEEK9.params.hke[state][0]+WEEK9.params.hke[state][1]*z[0],
            WEEK9.params.gle[state][0]+WEEK9.params.gle[state][1]*(rho*z[0]+Math.sqrt(1-rho*rho)*z[1]),
            WEEK9.params.hkb[state][0]+WEEK9.params.hkb[state][1]*z[2]]};
    }
    // Practice deliberately includes two stress years; it is not a random sample.
    const practice=[market(false,[.3,.2,.2]),market(false,[-.6,.4,-.3]),
        market(true,[-.1,0,.3]),market(false,[.8,.1,-.2]),market(true,[.2,.1,-.2])];
    function drawMarkets(n=1000,seed=20261102) {
        const rnd=random(seed),normal=()=>Math.sqrt(-2*Math.log(Math.max(rnd(),1e-12)))*Math.cos(2*Math.PI*rnd());
        return Array.from({length:n},()=>market(rnd()<pStress,[normal(),normal(),normal()]));
    }
    const comparisonMarkets=drawMarkets();
    const allChoices=choices.equity.flatMap(equity=>choices.home.map(home=>({equity,home})));
    function outcome(c,m){const w=weights(c),ret=w.reduce((sum,v,i)=>sum+v*m.returns[i],0);return {ret,end:size*(1+ret)};}
    function comparison(c){const returns=comparisonMarkets.map(m=>outcome(c,m).ret).sort((a,b)=>a-b);
        return {mean:returns.reduce((a,b)=>a+b,0)/returns.length,worst5:returns.slice(0,50).reduce((a,b)=>a+b,0)/50,
            lossChance:returns.filter(r=>r<0).length/returns.length,practiceMean:practice.reduce((a,m)=>a+outcome(c,m).ret,0)/practice.length};}
    // One common horizontal scale makes changes in dispersion visible across choices.
    const allReturns=allChoices.flatMap(c=>comparisonMarkets.map(m=>100*outcome(c,m).ret));
    const binWidth=5,binMin=binWidth*Math.floor(Math.min(...allReturns)/binWidth),binMax=binWidth*Math.ceil(Math.max(...allReturns)/binWidth);
    function distribution(c){
        const bins=Array.from({length:Math.round((binMax-binMin)/binWidth)},(_,i)=>({lo:binMin+i*binWidth,hi:binMin+(i+1)*binWidth,normal:0,stress:0}));
        const returns=comparisonMarkets.map(m=>{const r=outcome(c,m).ret;const i=Math.min(bins.length-1,Math.max(0,Math.floor((100*r-binMin)/binWidth)));bins[i][m.stress?'stress':'normal']++;return r;}).sort((a,b)=>a-b);
        return {...comparison(c),bins,min:binMin,max:binMax,q5:returns[49],count:returns.length,normalCount:comparisonMarkets.filter(m=>!m.stress).length,stressCount:comparisonMarkets.filter(m=>m.stress).length};
    }
    return {size,pStress,assets,choices,weights,scenario,evaluate,market,practice,drawMarkets,allChoices,outcome,comparison,distribution};
})();

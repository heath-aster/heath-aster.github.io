/* Week 12 external guarantee model. Dollar amounts are USD millions; one illustrative
   project period. Loss is loan loss BEFORE the external guarantee, AFTER sponsor equity.
   Keep this distinct from junior capital replacing senior principal. */
const Week12Model = (() => {
    const scenarios = Object.freeze([
        Object.freeze({name:'Baseline',p:0.10,loss:60,limit:2}),
        Object.freeze({name:'Stress',p:0.15,loss:70,limit:2.5})
    ]);
    function outcome(fl, sub, grant, shock=false) {
        for(const v of [fl,sub,grant]) if(!Number.isFinite(v)||v<0) throw Error('Support must be a nonnegative amount in USD millions.');
        const {p,loss,limit}=scenarios[shock?1:0], budget=fl+sub+grant;
        const publicLoss=Math.min(loss,fl), seniorLoss=Math.max(0,loss-fl), expectedLoss=p*seniorLoss;
        const lossRate=100*expectedLoss/80, requiredProtection=Math.max(0,loss-(limit/100*80)/p);
        const feasible=budget<=20+1e-9, mobilized=feasible&&lossRate<=limit+1e-9;
        return {budget,p,loss,limit,publicLoss,seniorLoss,expectedPublicLoss:p*publicLoss,expectedLoss,lossRate,requiredProtection,feasible,mobilized,privateCapital:mobilized?80:0,leverage:budget>0?(mobilized?80:0)/budget:null};
    }
    function junior(J,shock=false) {
        if(!Number.isFinite(J)||J<0||J>=100)throw Error('Junior capital must lie from 0 to less than 100.');
        const {p,loss}=scenarios[shock?1:0],senior=100-J,seniorLoss=Math.max(0,loss-J);
        return {senior,seniorLoss,lossRate:100*p*seniorLoss/senior,required:(p*loss-2)/(p-.02)};
    }
    function parse(text) {
        // Accept standard thousands separators and a trailing percent sign, not partial numbers.
        const s=String(text).trim().replace(/%\s*$/,'').trim();
        if(!/^[+-]?(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?|\.\d+)$/.test(s))return NaN;
        return Number(s.replace(/,/g,''));
    }
    return {scenarios,outcome,junior,parse};
})();
if(typeof module!=='undefined')module.exports=Week12Model;

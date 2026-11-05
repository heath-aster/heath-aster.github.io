/* Week 10 cash-ledger model. Pure functions; no page code.
   Reference: design/week10-ledger-2026-11-04/week10_ledger_key.py (tests compare both).
   One USD account. Monday opening balance 400,000. The supplier must receive 1,000,000
   by the end of Wednesday. A customer pays 1,200,000 on Thursday (next Monday if held).
   Payroll of 300,000 leaves on Friday. Interest is 0.02% a day on a negative end-of-day
   balance, including Saturday and Sunday. The bank holds any payment that would take the
   balance below minus the credit line and retries it on the next business day.
   Receipts post before payments on the same day.
   Two markets. The market sets the correspondent route's fee and timing, the probability
   of each week and the probability that the customer never pays. The default market is
   'em' (the week that students play). */
const PaymentLedger = (() => {
 const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun','Next Mon'];
 const DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday','next Monday'];
 const BUSINESS = [true,true,true,true,true,false,false,true];
 const P = {opening:400000, supplier:1000000, customer:1200000, payroll:300000, deadline:2, customerDay:3, heldCustomerDay:7, payrollDay:4,
  ratePerDay:0.0002, lateSupplierPerDay:1000, latePayroll:5000, urgentFee:1000, urgentLimit:1000000};
 const ROUTES = {
  corr:{key:'corr', name:'Correspondent banks', short:'Correspondent',
   how:'Your bank sends a SWIFT message. The money moves through USD accounts that banks hold with each other in New York.'},
  stable:{key:'stable', name:'Stablecoin bridge', short:'Stablecoin',
   how:'Your firm buys USD stablecoins (on-ramp), sends them on a blockchain, and an off-ramp provider pays USD into the supplier’s bank account.'}
 };
 const LINES = {
  small:{key:'small', name:'Small line', limit:600000, fee:300},
  large:{key:'large', name:'Large line', limit:1000000, fee:500}
 };
 const MARKETS = {
  dm:{key:'dm', name:'Developed-market partners', short:'Developed market', adj:'developed-market',
   supplier:'a component maker in the United States', customer:'a retailer in Europe',
   routes:{
    corr:{fee:100, send:2, transit:0, timing:'Your bank and the supplier’s bank both hold USD accounts at New York banks. The payment leaves on Wednesday and arrives the same day.'},
    stable:{fee:300, send:2, transit:0, timing:'The payment leaves on Wednesday morning and arrives within one hour.'}},
   prob:{normal:.90, held:.05, pause:.05}, nonpay:.0005},
  em:{key:'em', name:'Emerging-market partners', short:'Emerging market', adj:'emerging-market',
   supplier:'a component maker in an emerging market', customer:'a retailer in an emerging market',
   routes:{
    corr:{fee:200, send:0, transit:2, timing:'The supplier’s small local bank has no USD account in New York, so one more bank joins the chain. The payment takes 2 business days: to arrive on Wednesday, it must leave on Monday.'},
    stable:{fee:300, send:2, transit:0, timing:'The payment leaves on Wednesday morning and arrives within one hour.'}},
   prob:{normal:.50, held:.20, corrdelay:.15, pause:.10, class:.05}, nonpay:.005}
 };
 const WEEKS = [
  {key:'normal', name:'Normal week', held:false, corrDelay:false, rampPause:false,
   text:'All payments arrive on time.'},
  {key:'held', name:'Customer payment held', held:true, corrDelay:false, rampPause:false,
   text:'The customer’s USD 1,200,000 arrives next Monday, not Thursday. A bank holds it for a compliance check, or the customer’s bank cannot buy enough USD this week.'},
  {key:'corrdelay', name:'Correspondent delay', held:false, corrDelay:true, rampPause:false,
   text:'An intermediary bank in the supplier payment chain closes on Tuesday for a local holiday. A correspondent payment sent on Monday arrives on Thursday.'},
  {key:'pause', name:'Off-ramp pause', held:false, corrDelay:false, rampPause:true,
   text:'The stablecoin off-ramp stops USD payouts on Wednesday. A stablecoin payment sent on Wednesday arrives on Thursday.'},
  {key:'class', name:'Held payment and correspondent delay', held:true, corrDelay:true, rampPause:false,
   text:'Both shocks: the customer’s payment arrives next Monday, and a correspondent payment sent on Monday arrives on Thursday. This is the week you play.'}
 ];
 const PLAN_KEYS = ['corr-small','corr-large','stable-small','stable-large'];
 const RESPONSES = {
  keep:{key:'keep', name:'Keep the current line'},
  urgent:{key:'urgent', name:'Buy an urgent line increase to USD 1,000,000'},
  delay:{key:'delay', name:'Pay the supplier next Monday, after the customer pays'}
 };
 const clean = x => Math.round(x * 1e6) / 1e6;
 const market = m => {if (!MARKETS[m]) throw Error('Unknown market'); return MARKETS[m];};
 const week = key => WEEKS.find(w => w.key === key);
 // The weeks that can happen with this market's partners, with their probabilities.
 const weeks = (m = 'em') => WEEKS.filter(w => market(m).prob[w.key] > 0).map(w => ({...w, prob:market(m).prob[w.key]}));
 const terms = (route, m = 'em') => ({...ROUTES[route], ...market(m).routes[route]});
 const creditLoss = (m = 'em') => clean(market(m).nonpay * P.customer);
 const split = plan => {const [route, line] = String(plan).split('-'); return ROUTES[route] && LINES[line] ? {route, line} : null;};
 const planName = plan => {const p = split(plan); return p ? ROUTES[p.route].name + ' + ' + LINES[p.line].name.toLowerCase() : '';};
 function addBusinessDays(day, n) {let d = day; while (n > 0) {d += 1; if (d >= BUSINESS.length || BUSINESS[d]) n -= 1;} return d;}
 function lateBusinessDays(arrival) {let n = 0; for (let d = P.deadline + 1; d <= arrival; d++) if (d >= BUSINESS.length || BUSINESS[d]) n++; return n;}
 const dayName = d => d < DAY_NAMES.length ? DAY_NAMES[d] : d === 8 ? 'next Tuesday' : 'later';
 // Tuesday responses in a week with a held customer payment. Delaying the supplier is
 // possible only if the payment has not left the account by Tuesday.
 function responses(route, weekKey, m = 'em') {return week(weekKey)?.held ? ['keep','urgent'].concat(terms(route, m).send > 1 ? ['delay'] : []) : ['keep'];}
 function simulate(plan, weekKey, response = 'keep', m = 'em') {
  const p = split(plan), w = week(weekKey); if (!p || !w) throw Error('Unknown plan or week');
  if (!(weekKey in market(m).prob)) throw Error('This week cannot happen in this market');
  const r = terms(p.route, m), line = LINES[p.line];
  if (!responses(p.route, weekKey, m).includes(response)) response = 'keep';
  let limit = line.limit, balance = P.opening, interest = 0, pending = [], supplierSent = null, payrollPaid = null;
  const supplierSend = response === 'delay' ? P.heldCustomerDay : r.send, customerDay = w.held ? P.heldCustomerDay : P.customerDay;
  const rows = [];
  for (let d = 0; d < DAYS.length; d++) {
   const start = balance, flows = [], held = [], notes = [];
   if (response === 'urgent' && d === 1) {limit = P.urgentLimit; notes.push('Urgent line increase to USD 1,000,000 (fee USD 1,000).');}
   if (d === customerDay) {balance += P.customer; flows.push({label:'Customer payment arrives', amount:P.customer});}
   if (d === supplierSend) pending.push({key:'supplier', label:'Supplier payment sent', amount:P.supplier});
   if (d === P.payrollDay) pending.push({key:'payroll', label:'Payroll', amount:P.payroll});
   if (BUSINESS[d]) {
    const still = [];
    for (const x of pending) {
     if (balance - x.amount >= -limit - 1e-9) {
      balance -= x.amount; flows.push({label:x.label + (x.key === 'payroll' && d > P.payrollDay ? ' (released late)' : x.key === 'supplier' && d > supplierSend ? ' (released late)' : ''), amount:-x.amount});
      if (x.key === 'supplier') supplierSent = d; else payrollPaid = d;
     } else {still.push(x); held.push({label:x.key === 'supplier' ? 'Supplier payment' : x.label, amount:x.amount});}
    }
    pending = still;
   }
   const dayInterest = clean(P.ratePerDay * Math.max(0, -balance));
   interest += dayInterest;
   rows.push({day:d, label:DAYS[d], name:DAY_NAMES[d], business:BUSINESS[d], start, flows, held, notes, end:balance, limit, interest:dayInterest});
  }
  if (pending.length) throw Error('Payment still held at the end of the horizon');
  let arrival = addBusinessDays(supplierSent, r.transit);
  if (p.route === 'corr' && w.corrDelay && supplierSent <= 1 && arrival > 1) arrival = addBusinessDays(arrival, 1);
  if (p.route === 'stable' && w.rampPause && supplierSent === 2) arrival = addBusinessDays(arrival, 1);
  const lateDays = lateBusinessDays(arrival);
  const costs = {routeFee:r.fee, lineFee:line.fee, urgentFee:response === 'urgent' ? P.urgentFee : 0, interest:clean(interest),
   lateSupplier:P.lateSupplierPerDay * lateDays, latePayroll:payrollPaid > P.payrollDay ? P.latePayroll : 0};
  costs.total = clean(Object.values(costs).reduce((s, v) => s + v, 0));
  return {plan, market:m, route:p.route, line:p.line, week:weekKey, response, rows, costs, supplierSent, supplierArrival:arrival, supplierArrivalName:dayName(arrival),
   supplierLateDays:lateDays, payrollPaid, payrollLate:payrollPaid > P.payrollDay, peakCredit:Math.max(0, ...rows.map(x => -x.end)),
   negativeDays:rows.filter(x => x.end < 0).length};
 }
 function best(plan, weekKey, m = 'em') {
  const p = split(plan);
  return responses(p.route, weekKey, m).map(x => simulate(plan, weekKey, x, m)).reduce((b, x) => x.costs.total < b.costs.total - 1e-9 ? x : b);
 }
 function expected(plan, m = 'em') {return clean(weeks(m).reduce((s, w) => s + w.prob * best(plan, w.key, m).costs.total, 0));}
 function table(m = 'em') {
  return PLAN_KEYS.map(plan => ({plan, name:planName(plan), weeks:Object.fromEntries(weeks(m).map(w => [w.key, best(plan, w.key, m)])), expected:expected(plan, m)}));
 }
 // A Tuesday decision is necessary only when keeping the line would leave a payment held.
 function tuesdayDecisionNeeded(plan, weekKey, m = 'em') {const s = simulate(plan, weekKey, 'keep', m); return week(weekKey).held && (s.payrollLate || s.rows.some(r => r.held.length));}
 return {DAYS, DAY_NAMES, BUSINESS, P, ROUTES, LINES, MARKETS, WEEKS, PLAN_KEYS, RESPONSES, split, planName, week, weeks, terms, creditLoss, responses, simulate, best, expected, table, tuesdayDecisionNeeded, addBusinessDays, lateBusinessDays};
})();
if (typeof module !== 'undefined') module.exports = PaymentLedger;

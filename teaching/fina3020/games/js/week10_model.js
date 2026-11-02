/* Week 10 payment-route cost model. Pure functions; no page code.
   One payment of USD principal P must reach the supplier in full within 2 business days.
   Every cost is in USD and is paid by the sender on top of P.
   Rate card (deck slide "In-Class Game"): carry USD 100 per day per USD 1M committed;
   settlement-risk charge 0.025% (2.5 bp) of principal per day of settlement gap.
   At P = USD 1M: A 1,650, B 820, C 755; A delayed to 5 days 2,700. */
const PaymentRoutes = (() => {
 const RATE = {carryPerDayPerMillion: 100, riskBpPerDay: 2.5, deadlineDays: 2};
 const ROUTES = [
  {key: 'A', name: 'Correspondent banks', fee: 150,
   legs: [{label: 'HKD to USD at the sending bank', bp: 8}],
   committedShare: 1, days: 2, delayedDays: 5, gapDays: 2, delayedGapDays: 5,
   riskRule: 'gap', arrival: '2 business days', arrivalDelayed: '5 business days (late)',
   how: 'Your bank sends a SWIFT message. The money moves through prefunded nostro and vostro accounts at one or more correspondent banks.',
   risk: 'No PvP. Your firm pays before the chain confirms delivery, so the full principal is exposed for 2 days.'},
  {key: 'B', name: 'PvP settlement', fee: 400,
   legs: [{label: 'HKD to USD in a PvP trade', bp: 4}],
   committedShare: 0.2, days: 1, gapDays: 0,
   riskRule: 'pvp', arrival: 'Same day, before the cut-off',
   how: 'A settlement system pays the USD leg only if the HKD leg is also paid (payment versus payment). Netting means the desk prefunds only 20% of the payment.',
   risk: 'PvP removes FX principal risk on the covered trade. Liquidity and operational risks remain.'},
  {key: 'C', name: 'Stablecoin bridge', fee: 50,
   legs: [{label: 'On-ramp: HKD to a USD stablecoin', bp: 3}, {label: 'Off-ramp: stablecoin to USD in the supplier’s bank', bp: 3}],
   committedShare: 1, days: 0.05, gapDays: 0,
   riskRule: 'redemption', redemptionBp: 1, arrival: 'About 1 hour',
   how: 'Your firm buys a USD stablecoin, sends the token on a blockchain, and an off-ramp provider sells it for USD paid into the supplier’s bank.',
   risk: 'Two conversion legs. The off-ramp price and the issuer’s redemption terms can change. The desk charges 1 bp of principal for this risk.'}
 ];
 const DEFAULTS = {principal: 1e6, delayProb: 0, lateLoss: 0, stablecoinAccepted: true, pvpEligible: true, offRampBp: 3};
 const PRINCIPALS = [20000, 100000, 250000, 1000000, 2000000, 5000000];
 const route = key => ROUTES.find(r => r.key === key);
 const clean = x => Math.round(x * 1e6) / 1e6;
 function inputs(raw = {}) {
  const x = {...DEFAULTS, ...raw};
  x.principal = Math.max(1, Number(x.principal) || DEFAULTS.principal);
  x.delayProb = Math.min(1, Math.max(0, Number(x.delayProb) || 0));
  x.lateLoss = Math.max(0, Number(x.lateLoss) || 0);
  x.offRampBp = Math.max(0, Number(x.offRampBp) || 0);
  x.stablecoinAccepted = x.stablecoinAccepted !== false;
  x.pvpEligible = x.pvpEligible !== false;
  return x;
 }
 // Spread in basis points of principal, summed over conversion legs. 1 bp = 0.01% = 0.0001.
 function legBp(r, x) { return r.legs.map((leg, i) => r.key === 'C' && i === 1 ? x.offRampBp : leg.bp); }
 // Cost lines for one payment, either on time or delayed (Route A only can be delayed).
 function lines(key, raw, delayed = false) {
  const r = route(key), x = inputs(raw), P = x.principal, late = delayed && r.key === 'A';
  const bp = legBp(r, x), days = late ? r.delayedDays : r.days, gap = late ? r.delayedGapDays : r.gapDays;
  const committed = r.committedShare * P;
  const fee = r.fee;
  const fx = clean(bp.reduce((s, b) => s + P * b / 10000, 0));
  const carry = clean(committed * days * RATE.carryPerDayPerMillion / 1e6);
  const risk = clean(r.riskRule === 'gap' ? P * RATE.riskBpPerDay * gap / 10000 : r.riskRule === 'redemption' ? P * r.redemptionBp / 10000 : 0);
  const lateLoss = late ? x.lateLoss : 0;
  return {key, fee, fx, carry, risk, late: lateLoss, total: clean(fee + fx + carry + risk + lateLoss),
   committed, days, gapDays: gap, bp, arrival: late ? r.arrivalDelayed : r.arrival, onTime: !late};
 }
 // Expected cost before the payer knows whether Route A is delayed: (1 - p) x on time + p x delayed.
 function evaluate(key, raw) {
  const x = inputs(raw), onTime = lines(key, x, false);
  const delayed = key === 'A' ? lines(key, x, true) : onTime, p = key === 'A' ? x.delayProb : 0;
  const mix = k => clean((1 - p) * onTime[k] + p * delayed[k]);
  const expected = {fee: mix('fee'), fx: mix('fx'), carry: mix('carry'), risk: mix('risk'), late: mix('late')};
  expected.total = clean(expected.fee + expected.fx + expected.carry + expected.risk + expected.late);
  const available = key === 'C' ? x.stablecoinAccepted : key === 'B' ? x.pvpEligible : true;
  const reason = available ? '' : key === 'C' ? 'The supplier’s bank does not accept a stablecoin off-ramp payout.' : 'This currency pair or payment size is not eligible for PvP settlement today.';
  return {key, name: route(key).name, onTime, delayed, expected, delayProb: p, available, reason};
 }
 function compare(raw) {
  const x = inputs(raw), rows = ROUTES.map(r => evaluate(r.key, x));
  const feasible = rows.filter(r => r.available);
  const best = feasible.reduce((m, r) => r.expected.total < m - 1e-9 ? r.expected.total : m, Infinity);
  const cheapest = feasible.filter(r => Math.abs(r.expected.total - best) < 1e-6).map(r => r.key);
  return {inputs: x, rows, cheapest, best};
 }
 // Delay probability at which Route A's expected cost equals another route's cost (null if none in [0, 1]).
 function breakEvenDelay(otherKey, raw) {
  const x = inputs(raw), a0 = lines('A', x, false).total, a1 = lines('A', x, true).total, o = evaluate(otherKey, x).expected.total;
  if (Math.abs(a1 - a0) < 1e-12) return null;
  const p = (o - a0) / (a1 - a0);
  return p >= 0 && p <= 1 ? p : null;
 }
 // Payment size at which two routes cost the same on time: fixed-fee gap / per-dollar cost gap.
 function breakEvenPrincipal(k1, k2, raw) {
  const x = inputs(raw), unit = k => {const a = lines(k, {...x, principal: 1e6}, false); return {fixed: a.fee, perDollar: (a.total - a.fee) / 1e6};};
  const a = unit(k1), b = unit(k2), slope = a.perDollar - b.perDollar;
  if (Math.abs(slope) < 1e-15) return null;
  const P = (b.fixed - a.fixed) / slope;
  return P > 0 ? P : null;
 }
 return {RATE, ROUTES, DEFAULTS, PRINCIPALS, route, inputs, lines, evaluate, compare, breakEvenDelay, breakEvenPrincipal};
})();
if (typeof module !== 'undefined') module.exports = PaymentRoutes;

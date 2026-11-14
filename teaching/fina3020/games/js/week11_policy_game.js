/* Week 11 controller: browser-only exploration, shared idempotent participation receiver. */
'use strict';
const W11=window.Week11Model, $=id=>document.getElementById(id);
const W11_VERSION='2026-11-02-learning-first-v1', W11_KEY='fina3020_week11_learning_v1';
const viewNames=['understand','example','practice','decide','compare','reflect','sectors','reference'];
const demo=window.FINA3020_READ_ONLY_DEMO===true;
const state={stage:1,maxStage:1,view:'understand',question:0,practice:{},reviewed:[false,false],compared:false,stress:false,submissionId:null,saved:[]};
const policyIds=['res','rate','cap','imf'].flatMap(k=>[k+'-slider',k+'-slider-s3']);
const identityIds=['student-id-input','student-name-input','student-section-input'];
const fieldIds=[...policyIds,...identityIds,'reflection-input'];
let busy=false, comparisonChart=null, sectorChart=null, started=false;
const fmt=x=>Number(x).toFixed(2), esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function policyOutcome(...args){return W11.outcome(...args);}
function policyValues(s=''){return ['res','rate','cap','imf'].map(k=>Number($(k+'-slider'+s).value));}
function validValues(v){return Array.isArray(v)&&v.length===4&&v.every((n,i)=>Number.isFinite(n)&&n>=0&&n<=[10,600,100,5][i]&&Math.abs(n/[.5,25,5,.5][i]-Math.round(n/[.5,25,5,.5][i]))<1e-8);}
function validatePolicy(s=''){return ['res','rate','cap','imf'].every(k=>$(k+'-slider'+s).value.trim()!=='')&&validValues(policyValues(s));}
function fields(){return Object.fromEntries(fieldIds.map(id=>[id,$(id).value]));}
function snapshot(){return {version:W11_VERSION,...state,fields:fields()};}
function record(){return FINA3020Utils._readHistory().find(r=>r.submissionId===state.submissionId);}
function save(){
  if(demo)return;
  FINA3020Storage.setItem(W11_KEY,JSON.stringify(snapshot()));
  $('draft-status').textContent=FINA3020Storage.available?'Saved on this device in this browser tab. Refresh is safe. Download a record before closing the tab.':'Storage unavailable: work is held only in this open page. Download a record before refreshing or leaving.';
}
function restore(draft){
  if(!draft||draft.version!==W11_VERSION)return false;
  for(const id of fieldIds)if(typeof draft.fields?.[id]==='string')$(id).value=draft.fields[id];
  if(!validatePolicy()||!validatePolicy('-s3')){for(const [s,v] of [['',W11.example],['-s3',W11.example]])setPolicy(v,s);}
  state.view=viewNames.includes(draft.view)?draft.view:'understand';
  state.question=Number.isInteger(draft.question)?Math.max(0,Math.min(W11.questions.length-1,draft.question)):0;
  state.practice=draft.practice&&typeof draft.practice==='object'?draft.practice:{};
  state.reviewed=[!!draft.reviewed?.[0],!!draft.reviewed?.[1]];state.compared=!!draft.compared;state.stress=!!draft.stress;
  state.submissionId=typeof draft.submissionId==='string'?draft.submissionId:null;
  state.saved=Array.isArray(draft.saved)?draft.saved.filter(p=>validValues(p.base)&&validValues(p.stress)).slice(-2):[];
  return true;
}
function showView(view,focus=true){
  if(!viewNames.includes(view))view='understand';
  state.view=view;state.stage=viewNames.indexOf(view)+1;state.maxStage=Math.max(state.maxStage,state.stage);
  for(const name of viewNames){$('view-'+name).hidden=name!==view;if(name===view)$('nav-'+name).setAttribute('aria-current','page');else $('nav-'+name).removeAttribute('aria-current');}
  $('view-title').textContent=$('view-'+view).querySelector('h2').textContent;
  $('game-message').textContent='';
  if(view==='practice')renderPractice();
  if(view==='decide')updatePolicy();
  if(view==='compare'){state.compared=true;renderComparison();}
  if(view==='sectors')renderSectors();
  if(view==='reflect'){renderCompletion();renderReceipt();}
  if(focus){$('view-title').focus({preventScroll:true});window.scrollTo?.({top:0,behavior:'instant'});}
  if(started&&!demo)window.history.replaceState(null,'','#'+view);
  save();
}
function renderPractice(){
  const q=W11.questions[state.question], entry=state.practice[q.id]||{};
  $('practice-progress').textContent=`${W11.questions.filter(x=>state.practice[x.id]?.attempted||state.practice[x.id]?.solution).length} of ${W11.questions.length} calculations attempted or reviewed. Hints are free.`;
  $('practice-tabs').innerHTML=W11.questions.map((x,i)=>`<button onclick="selectPractice(${i})" ${i===state.question?'aria-current="step"':''} aria-label="Calculation ${i+1}: ${esc(x.title)}">${i+1}${state.practice[x.id]?.attempted||state.practice[x.id]?.solution?' ✓':''}</button>`).join('');
  $('practice-card').innerHTML=`<h3 id="practice-title" tabindex="-1">${state.question+1}. ${esc(q.title)}</h3><p>${esc(q.question)}</p><label for="practice-answer">Answer in ${esc(q.unit)} (round to two decimals)</label><input id="practice-answer" class="input-field" inputmode="decimal" value="${esc(entry.entered||'')}" oninput="saveAnswer(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();checkPractice()}"><div class="game-actions"><button class="btn btn-primary" onclick="checkPractice()">Check answer</button><button class="btn btn-secondary" onclick="practiceHelp(1)">Hint 1: relationship</button><button class="btn btn-secondary" onclick="practiceHelp(2)">Hint 2: formula and inputs</button><button class="btn btn-secondary" onclick="practiceHelp(3)">Show solution</button></div><p id="practice-feedback" class="feedback" role="status" tabindex="-1">${esc(entry.feedback||'Enter a number in the stated units. Your answer stays here after an error.')}</p><div id="practice-help">${entry.solution?'<p>'+esc(q.formula)+'</p><p>'+esc(q.solution)+'</p>':''}</div>`;
}
function selectPractice(i){state.question=i;renderPractice();$('practice-title').focus();save();}
function saveAnswer(value){const id=W11.questions[state.question].id;state.practice[id]||={};state.practice[id].entered=value;save();}
function checkPractice(){
  const q=W11.questions[state.question], raw=$('practice-answer').value,n=W11.parseNumber(raw);
  const entry=state.practice[q.id]||={};entry.entered=raw;
  if(!Number.isFinite(n)){entry.feedback='Enter a number in '+q.unit+'. A trailing % sign and correctly grouped thousands commas are accepted. Your input has been kept.';}
  else {entry.attempted=true;entry.correct=Math.abs(n-q.answer)<=q.tolerance+1e-10;entry.feedback=(entry.correct?'Correct within the stated rounding. '+q.solution:'Not yet. '+q.mistake+' Use the hints or open the solution. You can continue without a perfect answer.');}
  renderPractice();$('practice-feedback').focus();save();
}
function practiceHelp(level){
  const q=W11.questions[state.question],entry=state.practice[q.id]||={};entry.entered=$('practice-answer').value;entry.hint=Math.max(entry.hint||0,level);
  if(level===3){entry.solution=true;renderPractice();}else $('practice-help').textContent=level===1?q.hint:q.formula;
  save();
}
function nextPractice(){if(state.question<W11.questions.length-1)selectPractice(state.question+1);else showView('decide');}
function setPolicy(v,s=''){['res','rate','cap','imf'].forEach((k,i)=>$(k+'-slider'+s).value=String(v[i]));}
function chooseScenario(stress){state.stress=stress;updatePolicy();save();}
function syncNumber(id){state.reviewed[id.endsWith('-s3')?1:0]=false;const v=Number($(id).value);if($(id).value!==''&&Number.isFinite(v))$(id+'-range').value=$(id).value;updatePolicy();}
function syncRange(id){$(id).value=$(id+'-range').value;state.reviewed[id.endsWith('-s3')?1:0]=false;updatePolicy();}
function updateCalculations(){updatePolicy();}function updateCalculationsS3(){updatePolicy();}
function updatePolicy(){
  const s=state.stress?'-s3':'';
  $('controls').hidden=state.stress;$('controls-s3').hidden=!state.stress;
  $('choose-base').setAttribute('aria-pressed',String(!state.stress));$('choose-stress').setAttribute('aria-pressed',String(state.stress));
  policyIds.forEach(id=>{if($(id+'-range'))$(id+'-range').value=$(id).value;});
  $('decision-context').textContent=(demo?'Example inputs for demonstration. ':'Your editable policy. ')+(state.stress?'USD 20B stress scenario. Starts afresh with 20B reserves and 40B debt.':'USD 10B outflow scenario. Starts with 20B reserves and 40B debt.');
  if(!validatePolicy(s)){$('policy-error').textContent='Enter all four values within the displayed limits and steps. Your input is preserved. Results update when it is valid.';$('policy-results').textContent='Awaiting valid policy inputs.';$('policy-arithmetic').textContent='';return false;}
  $('policy-error').textContent='';const [r,b,c,m]=policyValues(s),o=policyOutcome(r,b,c,m,state.stress),h=b/100;
  const metrics=[['Remaining outflow',o.afterPolicy,'USD B'],['Financing gap',o.net,'USD B'],['Unused funds',o.excess,'USD B'],['Ending reserves',o.reserves,'USD B'],['External debt',o.debt,'USD B'],['Currency change',o.fx,'%'],['NPL share',o.npl,'% of loans'],['Consumption change',o.consumption,'%']];
  $('policy-results').innerHTML=`<p>Policy rate after rise: <strong>${fmt(5+h)}%</strong> (5% + ${fmt(h)} pp). Controls cover ${c}% and stop ${fmt(.6*c)}% of the original outflow before the rate effect.</p><div class="cards">`+metrics.map(([n,v,u])=>`<article>${n}<span class="metric">${fmt(v)} ${u}</span></article>`).join('')+'</div>';
  $('policy-arithmetic').innerHTML=`<p>h = ${b} / 100 = ${fmt(h)} pp. c = ${c} / 100 = ${fmt(c/100)}.</p><p>A = max(0, ${o.outflow} × (1 − 0.6 × ${fmt(c/100)}) − 0.8 × ${fmt(h)}) = ${fmt(o.afterPolicy)}B.</p><p>G = max(0, ${fmt(o.afterPolicy)} − ${r} − ${m}) = ${fmt(o.net)}B. U = max(0, ${r} + ${m} − ${fmt(o.afterPolicy)}) = ${fmt(o.excess)}B.</p><p>Reserves = 20 − ${r} + ${fmt(o.excess)} = ${fmt(o.reserves)}B. Debt = 40 + ${m} = ${fmt(o.debt)}B.</p><p>f = −${state.stress?1.6:1.5} × ${fmt(o.net)} = ${fmt(o.fx)}%. d = ${fmt(Math.abs(o.fx))}%.</p><p>NPL = ${state.stress?`4.5 + 1.2 × ${fmt(h)} + 0.3 × ${fmt(Math.abs(o.fx))}`:`4 + 0.9 × ${fmt(h)} + ${o.fx< -10?3:0} (threshold term)`} = ${fmt(o.npl)}% of loans.</p><p>Consumption = −(${state.stress?`2 + 0.8 × ${fmt(h)} + 0.25 × ${fmt(Math.abs(o.fx))}`:`1.5 + 0.6 × ${fmt(h)} + 0.2 × ${fmt(Math.abs(o.fx))}`}) = ${fmt(o.consumption)}%.</p>`;
  save();return true;
}
function copyPolicy(){if(!updatePolicy())return;setPolicy(policyValues(state.stress?'-s3':''),state.stress?'':'-s3');state.reviewed[state.stress?0:1]=false;save();$('policy-error').textContent='Copied. Open the other scenario to inspect its outcomes.';}
function resetPolicy(){setPolicy(W11.example,state.stress?'-s3':'');state.reviewed[state.stress?1:0]=false;updatePolicy();}
function reviewDecision(){if(!updatePolicy())return;state.reviewed[state.stress?1:0]=true;if(!state.stress){chooseScenario(true);$('policy-error').textContent='USD 10B policy reviewed. Now inspect the separate stress case.';}else showView('compare');save();}
function comparisonRows(){return [{name:'Your USD 10B policy',values:policyValues()},{name:'Your USD 20B policy',values:policyValues('-s3')},...W11.alternatives,...state.saved.flatMap((p,i)=>[{name:`Saved pair ${i+1}: 10B policy`,values:p.base},{name:`Saved pair ${i+1}: 20B policy`,values:p.stress}])];}
const metrics=[['reserves','Ending reserves','USD B'],['debt','External debt','USD B'],['fx','Currency change','%'],['npl','NPL share','% of loans'],['consumption','Consumption change','%']];
const axisLimits={fx:[-35,0],reserves:[0,25],debt:[0,45],npl:[0,25],consumption:[-15,0]};
function renderComparison(){
  if(!validatePolicy()||!validatePolicy('-s3')){$('comparison-table').textContent='Correct the policy inputs in Decide before comparing.';return;}
  const rows=comparisonRows();
  $('comparison-table').innerHTML=rows.map(p=>{const a=policyOutcome(...p.values),b=policyOutcome(...p.values,true);return `<article class="comparison-card"><h3>${esc(p.name)}</h3><p>Reserve sales ${p.values[0]}B · rate +${p.values[1]} bps · controls ${p.values[2]}% · IMF ${p.values[3]}B</p><table><caption>Same policy, two independent scenarios</caption><thead><tr><th scope="col">Outcome</th><th scope="col">USD 10B</th><th scope="col">USD 20B</th></tr></thead><tbody>${metrics.map(([k,l,u])=>`<tr><th scope="row">${l} (${u})</th><td>${fmt(a[k])}</td><td>${fmt(b[k])}</td></tr>`).join('')}</tbody></table></article>`;}).join('');
  const metric=$('chart-metric').value||'fx', [,label,unit]=metrics.find(m=>m[0]===metric),narrow=window.innerWidth<650;
  if(comparisonChart)comparisonChart.destroy();
  if(typeof Chart!=='undefined')comparisonChart=new Chart($('comparison-chart'),{type:'bar',data:{labels:rows.map(x=>x.name),datasets:[{label:'USD 10B outflow',data:rows.map(x=>policyOutcome(...x.values)[metric]),backgroundColor:'#b07a24',borderColor:'#b07a24',borderWidth:1},{label:'USD 20B stress',data:rows.map(x=>policyOutcome(...x.values,true)[metric]),backgroundColor:'rgba(50,94,155,.18)',borderColor:'#325e9b',borderWidth:3}]},options:{responsive:true,maintainAspectRatio:false,animation:false,indexAxis:narrow?'y':'x',plugins:{legend:{labels:{color:'#173346',font:{size:14}}}},scales:{[narrow?'x':'y']:{min:axisLimits[metric][0],max:axisLimits[metric][1],title:{display:true,text:label+' ('+unit+')',color:'#173346',font:{size:14}},ticks:{color:'#4f6472',font:{size:13}},grid:{color:'#dde4e7'}},[narrow?'y':'x']:{ticks:{color:'#4f6472',font:{size:13},autoSkip:false},grid:{display:false}}}}});
  $('comparison-status').textContent=`${rows.length} feasible policies shown. ${state.saved.length} saved pair(s). The last two pairs are kept. On phones, the chart uses horizontal bars: policies on the vertical axis and the outcome on the horizontal axis.`;
}
function saveComparison(){if(!validatePolicy()||!validatePolicy('-s3'))return;state.saved.push({base:policyValues(),stress:policyValues('-s3')});state.saved=state.saved.slice(-2);renderComparison();save();}
function renderPolicySummary(){renderComparison();}
function renderSectors(){
  const v=validatePolicy('-s3')?policyValues('-s3'):W11.example,a=W11.sector(v),b=W11.sector(W11.example),labels=['Central bank','Banks','Firms','Households'];
  $('sector-values').innerHTML='<p>'+labels.map((l,i)=>`${l}: your stress policy ${fmt(a[i])}, example ${fmt(b[i])} index points`).join(' · ')+'</p>';
  if(sectorChart)sectorChart.destroy();
  if(typeof Chart!=='undefined')sectorChart=new Chart($('sector-chart'),{type:'radar',data:{labels,datasets:[{label:'Your stress policy',data:a,borderColor:'#b07a24',backgroundColor:'rgba(176,122,36,.12)',pointStyle:'circle',borderWidth:3},{label:'Example mix',data:b,borderColor:'#325e9b',backgroundColor:'transparent',pointStyle:'rect',borderDash:[7,5],borderWidth:3}]},options:{responsive:true,maintainAspectRatio:false,animation:false,scales:{r:{min:0,max:110,ticks:{stepSize:20,color:'#4f6472',backdropColor:'#ffffff'},pointLabels:{color:'#173346',font:{size:15}},grid:{color:'#ccd8dd'},angleLines:{color:'#ccd8dd'}}},plugins:{legend:{labels:{color:'#173346',font:{size:14}}}}}});
}
function completionMissing(){const missing=[];const left=W11.questions.filter(q=>!state.practice[q.id]?.attempted&&!state.practice[q.id]?.solution);if(left.length)missing.push(`${left.length} calculation(s): attempt them or review their solutions in Practise`);if(!state.reviewed[0]||!state.reviewed[1])missing.push('review both scenario policies using “Use this policy” in Decide');if(!state.compared)missing.push('open Compare');return missing;}
function renderCompletion(){const m=completionMissing();$('completion-status').textContent=m.length?'Before submitting: '+m.join('; ')+'.':'Learning steps complete. Explain your tradeoff below. Correctness and economic outcomes do not affect credit.';}
function renderReceipt(){
  const r=record();$('btn-submit-game').disabled=demo||busy||!!state.submissionId;$('retry-game').hidden=demo||!state.submissionId||!!r?.delivered;$('retry-game').disabled=busy;
  for(const id of [...identityIds,'reflection-input'])$(id).disabled=demo||!!state.submissionId;
  if(demo){$('submission-feedback').textContent='Demonstration only. No response can be submitted from this view.';return;}
  if(r?.delivered)$('submission-feedback').textContent='Confirmed by the server. Receipt: '+r.receiptId+'. Recorded '+r.serverTimestamp+'. Your submitted snapshot is fixed. Policies remain editable for exploration.';
  else if(state.submissionId)$('submission-feedback').textContent=(busy?'Submission in progress. ':'Submission status uncertain. ')+(FINA3020Storage.available?'The response is saved in this browser tab. ':'Storage is unavailable. Keep this page open and download the record. ')+'The server has not yet confirmed this response. Reconnect and check/retry the same submission, or keep the downloaded record for the instructor. ID: '+state.submissionId;
  else if(!$('submission-feedback').textContent)$('submission-feedback').textContent='Not submitted. Your draft is separate from a server-confirmed receipt.';
}
async function submitFinalGame(){
  if(demo||busy||state.submissionId)return;
  const missing=completionMissing();if(missing.length){$('game-message').textContent='Before submitting: '+missing.join('; ')+'.';renderCompletion();return;}
  if(!validatePolicy()||!validatePolicy('-s3')){$('game-message').textContent='Correct policy inputs in Decide before submitting.';return;}
  if(!FINA3020Utils.setStudentCredentials(...identityIds.map(id=>$(id).value))){$('game-message').textContent='Enter your full name, exactly 10 digits for CUHK ID, and section A, B or C. Your reflection has been kept.';return;}
  const text=$('reflection-input').value;if(!text.trim()){$('game-message').textContent='Write your reflection before submitting. Use the prompt above. No minimum word count is imposed.';return;}
  busy=true;$('game-message').textContent='';renderReceipt();
  try{
    const data={mode:'Sudden_Stop_Policy_Game',activityName:'Sudden-Stop Policy Council',week:11,targetTab:'Sudden_Stop',activityVersion:W11_VERSION,recordType:'final',question:'Compare policies under two independent outflow scenarios. Explain a tradeoff and omitted cost.',responseText:text,reflection:text,baselineOutcome:policyOutcome(...policyValues()),shockOutcome:policyOutcome(...policyValues('-s3'),true),practice:state.practice,gameProgress:snapshot()};
    for(const [k,label] of [['res','resSales'],['rate','rateHike'],['cap','capControl'],['imf','imfDraw']]){data[label+'S2']=$(k+'-slider').value;data[label+'S3']=$(k+'-slider-s3').value;}
    const r=FINA3020Utils.recordResponse(data);state.submissionId=r.submissionId;save();renderReceipt();await r.deliveryPromise;
  }catch(e){$('submission-feedback').textContent='Submission could not start: '+e.message+'. Your work has been kept. Correct the problem and submit again.';}
  finally{busy=false;renderReceipt();save();}
}
async function retrySubmission(){
  if(demo||busy||!state.submissionId)return;busy=true;renderReceipt();
  try{const p=FINA3020Utils._readPending().find(p=>p.submissionId===state.submissionId);if(p)await FINA3020Utils._deliver(p);else{const r=record();if(r&&!r.delivered){if(!FINA3020Utils.setStudentCredentials(r.studentId,r.fullName,r.section))throw Error('Saved identity is invalid');await FINA3020Utils._deliver({...r,accessCode:FINA3020Utils.getAccessCode()});}}}
  catch(e){$('game-message').textContent='Receipt check failed: '+e.message+'. Keep your record and try after reconnecting.';}
  finally{busy=false;renderReceipt();save();}
}
function activityRecord(){const r=record();return {format:'FINA3020-Week11-record',version:W11_VERSION,draft:snapshot(),submission:r?JSON.parse(JSON.stringify(r)):null};}
function downloadRecord(){const data=activityRecord();const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='Week11-activity-record.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
async function importRecord(file){
  if(!file||demo)return;
  try{
    if(state.submissionId||FINA3020Utils._readPending().some(p=>p.targetTab==='Sudden_Stop'))throw Error('This tab already has a submitted or pending Week 11 response. Keep its record. Use a fresh tab to inspect another file.');
    if(file.size>150000)throw Error('File is too large');const data=JSON.parse(await file.text());
    if(data.format!=='FINA3020-Week11-record'||data.version!==W11_VERSION||data.draft?.version!==W11_VERSION)throw Error('Choose a Week 11 activity record from this version');
    const r=data.submission;
    if(r){if(r.targetTab!=='Sudden_Stop'||r.activityVersion!==W11_VERSION||typeof r.submissionId!=='string'||!/^[A-Za-z0-9-]{10,100}$/.test(r.submissionId)||!/^\d{10}$/.test(r.studentId)||typeof r.fullName!=='string'||!['A','B','C'].includes(r.section)||typeof r.reflection!=='string'||r.responseText!==r.reflection||r.gameProgress?.version!==W11_VERSION)throw Error('Invalid submitted record');
      // A downloaded acknowledgement is not live confirmation. Revalidate on retry.
      const clean=JSON.parse(JSON.stringify(r));delete clean.accessCode;clean.delivered=false;delete clean.receiptId;delete clean.serverTimestamp;
      const history=FINA3020Utils._readHistory().filter(x=>x.submissionId!==clean.submissionId);history.push(clean);FINA3020Storage.setItem('fina3020_response_history',JSON.stringify(history.slice(-100)));
      restore(r.gameProgress);state.submissionId=r.submissionId;identityIds.forEach((id,i)=>$(id).value=[r.studentId,r.fullName,r.section][i]);$('reflection-input').value=r.reflection;
    }else{restore(data.draft);state.submissionId=null;}
    showView('reflect');$('game-message').textContent=r?'Record restored. Check/retry the same submission to obtain a fresh server confirmation.':'Draft restored. You can continue the activity.';save();
  }catch(e){$('game-message').textContent='Could not import: '+e.message;}
}
function start(){
  if(started)return;started=true;
  $('demo-banner').hidden=!demo;
  if(!demo){try{const saved=JSON.parse(FINA3020Storage.getItem(W11_KEY)||'null');if(!restore(saved)){
    const legacy=JSON.parse(FINA3020Storage.getItem('fina3020_game_Sudden_Stop_v1')||'null');if(legacy?.fields){for(const id of fieldIds)if(typeof legacy.fields[id]==='string')$(id).value=legacy.fields[id];state.submissionId=legacy.submissionId||null;}
  }}catch(e){$('game-message').textContent='The stored draft could not be read. Import your downloaded record if available.';}
  FINA3020Utils.onDeliveryChange(renderReceipt);}
  const params=new URLSearchParams(window.location.search||'');const requested=params.get('view')||(params.has('screen')?'understand':null);
  showView(requested||state.view,false);renderReceipt();
  document.addEventListener('input',event=>{if(policyIds.includes(event.target.id)){state.reviewed[event.target.id.endsWith('-s3')?1:0]=false;}save();});
  document.addEventListener('change',save);
}
// Retain the handler names consumed by course participation tests and earlier callers.
const gameSession={state,start,save,navigate:n=>showView(viewNames[n-1]||'understand'),jump:n=>showView(viewNames[n-1]||'understand'),retry:retrySubmission,locked:()=>!!state.submissionId};
document.addEventListener('DOMContentLoaded',start);

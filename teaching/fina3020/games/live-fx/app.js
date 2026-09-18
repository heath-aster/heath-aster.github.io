'use strict';
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const projector = params.get('view') === 'projector';
const apiBase = (window.LIVE_FX_API_BASE || '').replace(/\/$/, '');
const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const backendReady = Boolean(apiBase) || localHost || location.protocol === 'http:';
const storage = FINA3020Storage;
let room = (params.get('room') || '').toUpperCase();
const fragment = new URLSearchParams(location.hash.slice(1));
if (fragment.get('host')) storage.setItem('livefx_host', fragment.get('host'));
if (location.hash) history.replaceState(null, '', location.pathname + location.search);
const hostToken = projector ? '' : storage.getItem('livefx_host') || '';
let token = hostToken || (room && !projector ? storage.getItem('livefx_student_' + room) || '' : '');
let state = null, busy = false, online = false, charts = {}, renderedRound = null, chartKey = '', latestReflection = null, qrLink = '';
const money = n => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
const percent = n => (n * 100).toFixed(1) + '%';
function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return Array.from(crypto.getRandomValues(new Uint8Array(24)), x => x.toString(16).padStart(2,'0')).join('');
}
function message(text) { $('message').textContent = text; }
function save(key, value) { storage.setItem('livefx_' + key, JSON.stringify(value)); }
function read(key) { try { return JSON.parse(storage.getItem('livefx_' + key) || 'null'); } catch { return null; } }
async function api(path, body, auth = token) {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(apiBase + path, {method:body ? 'POST':'GET', headers:{'Content-Type':'application/json', ...(auth ? {'Authorization':'Bearer '+auth}:{})}, body:body ? JSON.stringify(body):undefined, signal:controller.signal});
        const value = await response.json();
        if (!response.ok || value.error) { const error = new Error(value.error || 'Request failed'); error.definitive = true; throw error; }
        return value;
    } finally { clearTimeout(timeout); }
}
function link(view = '') { return location.origin + location.pathname + '?room=' + room + (view ? '&view=' + view : ''); }
function renderQR() {
    if(qrLink===link())return;qrLink=link();
    const qr=qrcode(0,'M');qr.addData(qrLink);qr.make();
    const canvas=$('join-qr'),count=qr.getModuleCount(),scale=5,margin=4;
    canvas.width=canvas.height=(count+margin*2)*scale;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#000';
    for(let r=0;r<count;r++)for(let c=0;c<count;c++)if(qr.isDark(r,c))ctx.fillRect((c+margin)*scale,(r+margin)*scale,scale,scale);
}
function enter(code, auth) {
    room = code; token = auth;
    history.replaceState(null, '', location.pathname + '?room=' + room + (projector ? '&view=projector' : ''));
    $('welcome').hidden = true; $('setup').hidden = true;
    return refresh();
}
function node(tag, text, className) { const n=document.createElement(tag); if(text!==undefined)n.textContent=text; if(className)n.className=className; return n; }
function showLaw(container, distribution, prefix='') {
    container.replaceChildren();
    if(prefix) container.append(node('p',prefix,'small'));
    const row=node('div',undefined,'law');
    distribution.forEach(x=>{const box=node('div',undefined,'law-item');box.append(node('strong',percent(x.change)),node('span',percent(x.probability)+' probability'));row.append(box);});
    container.append(row);
}
function editor(id, distribution) {
    const table=node('table');const head=node('tr');head.append(node('th','FX change (%)'),node('th','Probability (%)'));table.append(head);
    distribution.forEach((x,i)=>{const row=node('tr');['change','probability'].forEach(k=>{const td=node('td'),input=node('input');input.type='number';input.step='any';input.value=String(x[k]*100);input.required=true;input.setAttribute('aria-label',`${id} outcome ${i+1} ${k}`);input.dataset.field=k;td.append(input);row.append(td);});table.append(row);});
    $(id).replaceChildren(table);
}
function editorValue(id) { const values=[...$(id).querySelectorAll('input')].map(n=>Number(n.value)/100);return [0,2,4].map(i=>({change:values[i],probability:values[i+1]})); }
async function setup() {
    $('welcome').hidden=true;$('game').hidden=true;$('setup').hidden=false;
    const [config,rooms]=await Promise.all([api('/api/config',null,hostToken),api('/api/rooms',null,hostToken)]);
    editor('known-editor',config.known);editor('shifted-editor',config.shifted);
    $('saved-rooms').replaceChildren();
    rooms.forEach(r=>{const b=node('button',r.code+' · '+r.title);b.onclick=()=>enter(r.code,hostToken).catch(e=>message(e.message));$('saved-rooms').append(b);});
    $('connection').textContent='Instructor connected';
}
function outcomes(h,c,x) { return {trade:state.notional*(h*state.forwardChange+(1-h)*x),financial:state.notional*c*((1+state.foreignRate)*(1+x)-1)}; }
function previews() {
    const h=Number($('hedge').value)/100,c=Number($('carry').value)/100;
    $('hedge-value').textContent=percent(h);$('carry-value').textContent=percent(c);
    if(!state)return;
    ['trade','financial'].forEach(k=>{
        if(state.phase==='uncertainty'&&!state.revealed){$(k+'-preview').textContent='Probability distribution unknown. Use observed shocks and your judgment; a reliable expected P&L cannot be calculated from the announced information.';return;}
        const distribution=state.phase==='risk'?state.known:state.shifted;
        const values=distribution.map(x=>outcomes(h,c,x.change)[k]);
        const expected=distribution.reduce((sum,x,i)=>sum+x.probability*values[i],0);
        $(k+'-preview').textContent=`Possible P&L: ${money(Math.min(...values))} to ${money(Math.max(...values))}. Expected P&L: ${money(expected)}.`;
    });
}
function stats(values) {
    if(!values.length)return 'No observations.';
    const v=[...values].sort((a,b)=>a-b),mid=Math.floor(v.length/2),median=v.length%2?v[mid]:(v[mid-1]+v[mid])/2;
    return `n = ${v.length} · Mean ${money(v.reduce((a,b)=>a+b,0)/v.length)} · Median ${money(median)} · Losing ${Math.round(100*v.filter(x=>x<0).length/v.length)}%`;
}
function histogram(values) {
    const minimum=Math.min(0,...values),maximum=Math.max(0,...values);
    const span=Math.max(1000,maximum-minimum),width=Math.max(100,Math.ceil(span/8/100)*100),lo=Math.floor(minimum/width)*width;
    const count=Math.max(1,Math.floor((maximum-lo)/width)+1),bins=Array(count).fill(0);
    values.forEach(v=>bins[Math.min(count-1,Math.floor((v-lo)/width))]++);
    return {labels:bins.map((_,i)=>`${money(lo+i*width)}–${money(lo+(i+1)*width)}`),bins};
}
function renderCharts() {
    if(!state?.rounds.length)return;
    const selected=Number($('result-round').value),r=state.rounds.find(x=>x.round===selected)||state.rounds.at(-1),view=$('chart-view').value;
    const key=[room,r.round,view,r.outcomes.length].join(':');
    if(key===chartKey)return;chartKey=key;
    $('shock-title').textContent=`Round ${r.round} · FX ${percent(r.shock)}`;
    $('result-note').textContent=`${r.phase==='risk'?'Known distribution':'After the policy shift'}. One common shock; differences across students reflect different allocations. These charts show realized outcomes, not the probability law.`;
    if(view==='cumulative')$('result-note').textContent+=' Totals include participants who played at least once; late joiners may have fewer rounds.';
    if(state.me){const mine=state.me.history.find(x=>x.round===r.round);$('personal-result').hidden=false;$('personal-result').textContent=mine?`Your round: trade ${money(mine.trade)} · financial ${money(mine.financial)}. Hedge ${percent(mine.hedge)} · carry ${percent(mine.carry)}.`:'You sat out this round; no submitted allocations were scored.';}
    ['trade','financial'].forEach(k=>{
        const data=view==='cumulative'?r.cumulative:r.outcomes,values=data.map(x=>x[k]);
        $(k+'-stats').textContent=stats(values);
        charts[k]?.destroy();
        const scatter=view==='allocation',hist=histogram(values),color=k==='trade'?'#b7e4b8':'#f5c877';
        charts[k]=new Chart($(k+'-chart'),{type:scatter?'scatter':'bar',data:scatter?{datasets:[{label:'Student allocation',data:r.outcomes.map(x=>({x:100*x[k==='trade'?'hedge':'carry'],y:x[k]})),backgroundColor:color,pointRadius:6}]}:{labels:hist.labels,datasets:[{label:'Students',data:hist.bins,backgroundColor:color,borderRadius:3}]},options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:false}},scales:{x:{min:scatter?0:undefined,max:scatter?100:undefined,title:{display:true,text:scatter?(k==='trade'?'Hedge proportion (%)':'Foreign allocation (%)'):'P&L bins (USD)',color:'#b0beba'},ticks:{color:'#b0beba',maxRotation:45},grid:{color:'#34444e'}},y:{beginAtZero:true,title:{display:true,text:scatter?'P&L (USD)':'Number of students',color:'#b0beba'},ticks:{color:'#b0beba',precision:scatter?undefined:0},grid:{color:'#34444e'}}}}});
        const rounds=view==='cumulative'?state.rounds.filter(x=>x.round<=r.round):[r];
        const refs=[0,.5,1].map(w=>money(rounds.reduce((sum,round)=>sum+outcomes(w,w,round.shock)[k],0)));
        $(k+'-benchmarks').textContent=`${view==='cumulative'?'All-round reference strategies':'Reference strategies'} · ${k==='trade'?'0 / 50 / 100% hedged':'0 / 50 / 100% foreign'}: ${refs.join(' / ')}.`;
    });
    $('history').replaceChildren();
    const table=node('table'),header=node('tr');header.append(node('th','Round'),node('th','Information'),node('th','FX change'),node('th','Submissions'));table.append(header);
    state.rounds.forEach(x=>{const row=node('tr');[x.round,x.phase==='risk'?'Known law':'Unknown law',percent(x.shock),x.outcomes.length].forEach(v=>row.append(node('td',v)));table.append(row);});$('history').append(table);
}
function render() {
    $('game').hidden=false;$('welcome').hidden=true;$('setup').hidden=true;
    $('room-label').textContent='ROOM '+state.code;$('session-title').textContent=state.title;
    $('round-label').textContent=state.round?`Round ${state.round} · ${state.status}`:'Waiting to begin';
    $('submission-count').textContent=`${state.submitted} submitted · ${state.joined} joined`;
    const uncertain=state.phase==='uncertainty';$('policy').classList.toggle('uncertainty',uncertain);
    $('phase-label').textContent=uncertain?'PART 2 · KNIGHTIAN UNCERTAINTY':'PART 1 · KNOWN RISK';
    $('policy-title').textContent=uncertain?'A structural policy shift has occurred.':'The exchange-rate distribution is known.';
    $('policy-text').textContent=uncertain?'The policy regime has changed. The old distribution no longer applies. The new possible outcomes and their probabilities have not been announced. You can observe realized shocks as play continues.':'Each round is an independent draw from this same distribution. A past draw does not change the probabilities for the next round. FX change is the change in domestic-currency value of one unit of foreign currency.';
    showLaw($('law-display'),uncertain&&state.revealed?state.shifted:state.known,uncertain?(state.revealed?'DEBRIEF · The instructor has now revealed the post-shift law.':'PRE-SHIFT REFERENCE ONLY · This law is no longer valid.'):'');
    $('host-controls').hidden=!state.instructor;
    if(state.instructor){
        const allowed={open:['lobby','results'].includes(state.status),lock:state.status==='open',draw:state.status==='locked'&&state.submitted>0,reopen:state.status==='locked',shift:state.status==='results'&&!uncertain,finish:state.status==='results',reveal:state.status==='finished'&&uncertain&&!state.revealed};
        document.querySelectorAll('[data-action]').forEach(b=>b.disabled=busy||!online||!allowed[b.dataset.action]);
        $('projector-link').href=link('projector');$('join-link').value=link();showLaw($('private-law'),state.shifted);
        $('host-hint').textContent=state.status==='open'?'Wait for submissions, then lock. Students may revise submitted allocations until you lock.':state.status==='locked'?'Allocations are locked. Draw once, or reopen if someone needs more time.':state.status==='results'?(uncertain?'Open the next round, or finish for reflection and optional reveal.':'Suggested pacing: four rounds with the known law, then announce the policy shift and open the next round.'):'Suggested pacing: four known-risk rounds and four uncertainty rounds. Project the separate screen, which has no instructor controls.';
    }
    $('projector-join').hidden=!projector;$('projector-url').textContent=link();if(projector)renderQR();
    $('student-panel').hidden=!state.me;
    if(state.me){
        $('student-name').textContent=`${state.me.fullName} · Section ${state.me.section}`;$('recovery-key').textContent=token;
        $('trade-terms').textContent=`Forward conversion locks in ${percent(state.forwardChange)} relative to initial spot. P&L measures the change from the receivable’s initial $100,000 value; it excludes the underlying operating margin.`;
        if(renderedRound!==state.round){
            const prior=state.me.choice||state.me.history.at(-1)||{hedge:.5,carry:.5};$('hedge').value=String(prior.hedge*100);$('carry').value=String(prior.carry*100);renderedRound=state.round;
        }
        ['hedge','carry','submit-allocation'].forEach(id=>$(id).disabled=state.status!=='open'||!online||busy);
        const c=state.me.choice;
        $('choice-receipt').textContent=c?`Saved for round ${state.round}: hedge ${percent(c.hedge)}, carry ${percent(c.carry)}. ${state.status==='open'?'You can update until allocations lock.':'Allocations are closed.'}`:state.status==='open'?'No allocation saved for this round. Previous sliders are suggestions; submit again to participate.':'Wait for the instructor to open a round.';
        $('reflection').hidden=state.status!=='finished';$('reflection-question').textContent=state.question;
        latestReflection=state.me.responses.at(-1)||null;
        if(latestReflection&&!$('reflection-input').value)$('reflection-input').value=latestReflection.responseText;
        $('sync-reflection').disabled=!latestReflection||busy;
        $('save-reflection').disabled=busy||!online;
        previews();
    }
    $('results').hidden=!state.rounds.length;
    if(state.rounds.length){
        const select=$('result-round'),old=Number(select.value),previousMax=Number(select.options[select.options.length-1]?.value||0),latest=state.rounds.at(-1).round;
        if(previousMax!==latest){select.replaceChildren();state.rounds.forEach(r=>{const o=node('option','Round '+r.round);o.value=r.round;select.append(o);});select.value=String(old===previousMax||!old?latest:old);}
        renderCharts();
    }
}
async function refresh() {
    if(!room)return;
    try{state=await api('/api/state?room='+encodeURIComponent(room));online=true;$('connection').textContent='Connected · updates every 2s';render();}
    catch(e){online=false;$('connection').textContent='Disconnected · retrying';if(state)render();else message(e.message);}
}
async function action(name, extra={}) {
    if(busy)return;busy=true;message('');if(state)render();
    const key='operation_'+room+'_'+name;
    const old=read(key),body=old||{room,action:name,operationId:uuid(),revision:state?.revision,...extra};save(key,body);
    try{const result=await api('/api/action',body);storage.removeItem('livefx_'+key);return result;}
    catch(e){if(e.definitive)storage.removeItem('livefx_'+key);message(e.definitive?e.message:'Connection interrupted. Retry the same button to recover the saved operation.');throw e;}
    finally{busy=false;if(name!=='join')await refresh();}
}
async function submitReflection() {
    const result=await action('reflect',{responseText:$('reflection-input').value});
    if(result){latestReflection=result.payload;$('reflection-receipt').textContent='Confirmed on classroom server · receipt '+result.receiptId+'. You can export your record below.';}
    return result;
}
function sheetPayload(payload) {
    return {...payload, classroomSubmissionId:payload.submissionId, activityVersion:'2026-09-18-live-fx'};
}
async function syncReflection() {
    if(!latestReflection)return;
    FINA3020Utils.setStudentCredentials(state.me.studentId,state.me.fullName,state.me.section);
    const key='sheet_'+latestReflection.submissionId;
    if(read(key)){
        await FINA3020Utils.flushPending();
        const prior=FINA3020Utils._readHistory().find(x=>x.submissionId===read(key));
        $('sheet-receipt').textContent=prior?.delivered?'Course Sheet confirmed.':'Course Sheet NOT confirmed. Retry here or export your record.';return;
    }
    const saved=FINA3020Utils.recordResponse(sheetPayload(latestReflection));save(key,saved.submissionId);
    $('sheet-receipt').textContent='Sending to course Sheet…';
    const confirmed=await saved.deliveryPromise;
    $('sheet-receipt').textContent=confirmed?'Course Sheet confirmed.':'Course Sheet NOT confirmed. Your classroom record is saved. Keep this tab open for retry or export your record.';
}
function download(content,filename,type){const url=URL.createObjectURL(new Blob([content],{type})),a=node('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
document.addEventListener('DOMContentLoaded',async()=>{
    document.body.classList.toggle('projector',projector);$('room-input').value=room;
    if (!backendReady) { $('connection').textContent='Website ready · live connection pending'; message('The live game page is ready. The classroom connection is being set up; your instructor will announce when rooms are available.'); document.querySelectorAll('#welcome button').forEach(b=>b.disabled=true); return; }
    $('join-form').onsubmit=async e=>{e.preventDefault();room=$('room-input').value.trim().toUpperCase();try{const result=await action('join',{studentId:$('id-input').value,fullName:$('name-input').value,section:$('section-input').value});if(result){storage.setItem('livefx_student_'+room,result.token);await enter(room,result.token);}}catch{}};
    $('recover-form').onsubmit=async e=>{e.preventDefault();const code=$('recover-room').value.trim().toUpperCase(),key=$('recover-key').value.trim();try{const s=await api('/api/state?room='+code,null,key);if(!s.me)throw Error('Recovery key does not match this room.');storage.setItem('livefx_student_'+code,key);await enter(code,key);}catch(err){message(err.message);}};
    $('create-form').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;try{const r=await api('/api/create',{title:$('title-input').value,known:editorValue('known-editor'),shifted:editorValue('shifted-editor'),seed:$('seed-input').value},hostToken);await enter(r.code,hostToken);}catch(err){message(err.message);}finally{busy=false;if(state)render();}};
    document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>action(b.dataset.action).catch(()=>{}));
    $('submit-allocation').onclick=()=>action('allocate',{round:state.round,hedge:Number($('hedge').value)/100,carry:Number($('carry').value)/100}).catch(()=>{});
    ['hedge','carry'].forEach(id=>$(id).oninput=previews);
    ['chart-view','result-round'].forEach(id=>$(id).onchange=renderCharts);
    $('save-reflection').onclick=()=>submitReflection().catch(()=>{});
    $('sync-reflection').onclick=()=>syncReflection().catch(e=>message(e.message));
    $('export-own').onclick=()=>download(JSON.stringify({room,student:state.me,pendingSheet:FINA3020Utils._readPending()},null,2),'live-fx-'+room+'-my-record.json','application/json');
    $('export-class').onclick=async()=>{try{const response=await fetch(apiBase+'/api/export?room='+room,{headers:{Authorization:'Bearer '+hostToken}});if(!response.ok)throw Error('Export failed');download(await response.text(),'live-fx-'+room+'.csv','text/csv');}catch(e){message(e.message);}};
    $('new-room').onclick=()=>{room='';state=null;history.replaceState(null,'',location.pathname);setup().catch(e=>message(e.message));};
    try{if(hostToken&&!room)await setup();else if(room&&(token||projector))await refresh();else $('connection').textContent='Ready to join';}catch(e){message(e.message);}
    // No overlapping polling requests; preserve student edits while updating server state.
    async function poll(){if(room&&(token||projector))await refresh();setTimeout(poll,2000);}setTimeout(poll,2000);
});

// No network calls: regressions for blocked storage, stalled connections, and receipts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const gameRoot = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const source = fs.readFileSync(path.join(gameRoot, 'js/common_utils.js'), 'utf8');
function fixture(blocked = false, quota = false) {
    const values = {};
    const storage = { getItem: k => values[k] ?? null, setItem: (k,v) => { if (quota) throw Error('QuotaExceededError'); values[k]=v; }, removeItem: k => delete values[k] };
    const timers = new Map(); let next = 0, seq = 0;
    const ctx = { console: {warn(){}}, crypto: {randomUUID:()=>`test-${++seq}`},
        setTimeout(fn, delay) { if (delay === 12000) { timers.set(++next, fn); return next; } return setTimeout(fn, 0); },
        clearTimeout(id) { timers.delete(id); }, AbortController,
        document: {addEventListener(){},querySelectorAll:()=>[]},
        window: {addEventListener(){}},
        fetch: async (_, options) => ({ok:true, text:async()=>JSON.stringify({ok:true,submissionId:JSON.parse(options.body).submissionId,receiptId:'receipt',serverTimestamp:'2026-09-09T00:00:00Z'})})
    };
    for (const key of ['sessionStorage','localStorage']) Object.defineProperty(ctx,key,{get(){if(blocked)throw Error('SecurityError');return storage;}});
    ctx.window.crypto=ctx.crypto;
    vm.createContext(ctx); vm.runInContext(source, ctx);
    return { ctx, timers, utils: vm.runInContext('FINA3020Utils',ctx), store: vm.runInContext('FINA3020Storage',ctx) };
}
(async()=>{
    for(const [blocked,quota] of [[false,false],[true,false],[false,true]]) {
        const {utils,store}=fixture(blocked,quota);
        utils.purgeLegacyStorage();
        assert(utils.setStudentCredentials('1155123456','Test Student','B'));
        assert.equal(utils.getStudentID(),'1155123456');
        assert.equal(await utils.recordResponse({mode:'CIP',reflection:'test'}).deliveryPromise,true);
        assert.equal(utils.getPendingCount(),0);
        assert.equal(utils._readHistory()[0].delivered,true);
        if(blocked||quota)assert.equal(store.available,false);
        utils.clearSensitiveData();assert.equal(utils.getStudentID(),'');
    }
    const restored=fixture();
    restored.store.setItem('fina3020_pending_submissions','[1]');
    restored.ctx.sessionStorage.setItem('fina3020_pending_submissions','[]');
    assert.equal(restored.store.getItem('fina3020_pending_submissions'),'[]','Back/Forward must read current tab storage');
    const {ctx,utils,timers}=fixture();
    const payload={submissionId:'receipt-test'};
    for(const [body,valid] of [
        ['Success',true],['unsuccessful',false],['Error: no successful write',false],['<html>Success</html>',false],
        ['{"ok":false,"error":"unsuccessful"}',false],['{"ok":true}',true],
        [JSON.stringify({ok:true,submissionId:'wrong',receiptId:'r',serverTimestamp:'2026-09-09T00:00:00Z'}),false],
        [JSON.stringify({ok:true,submissionId:'receipt-test',receiptId:'r',serverTimestamp:'2026-09-09T00:00:00Z'}),true]
    ]) {
        ctx.fetch=async()=>({ok:true,text:async()=>body});
        if(valid) { const ack=await utils._post(payload); if(body==='Success')assert.equal(ack.serverTimestamp,null); }
        else await assert.rejects(utils._post(payload));
        assert.equal(timers.size,0);
    }
    // Both a connection that never resolves and a stalled response body time out.
    for(const stalled of [()=>new Promise(()=>{}),async()=>({ok:true,text:()=>new Promise(()=>{})})]) {
        ctx.fetch=stalled;
        const waiting=utils._post(payload);
        const check=assert.rejects(waiting,/timed out/);
        for(const fn of timers.values())fn();
        await check;
    }
    utils.setStudentCredentials('1155123456','Test Student','A');
    let calls=0; ctx.fetch=async()=>{calls++;throw Error('offline');};
    const saved=utils.recordResponse({mode:'CIP'});
    // A reconnect/retry while sending must share the existing request.
    const retry=utils.flushPending();
    assert.equal(await saved.deliveryPromise,false); await retry;
    assert.equal(calls,3);assert.equal(utils.getPendingCount(),1);
    ctx.fetch=async()=>({ok:true,text:async()=> 'Success'});
    assert.equal(await utils.flushPending(),1);
    assert.equal(utils._readHistory().length,1);assert.equal(utils.getPendingCount(),0);
    for(const name of fs.readdirSync(gameRoot).filter(x=>/^\d.*\.html$/.test(x))) {
        const html=fs.readFileSync(path.join(gameRoot,name),'utf8');
        assert(html.includes('css/mobile.css?v='),name+' mobile rules');
        assert(html.includes('class="course-navigation"'),name+' stable return link');
        for(const [,script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(script,{filename:name});
    }
    console.log('PASS: blocked/full storage, identity/history, 8 receipt cases, connection/body timeouts, concurrent retries, offline recovery, all game scripts/navigation.');
})().catch(error=>{console.error(error);process.exitCode=1;});

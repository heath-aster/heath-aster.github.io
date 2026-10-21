/* Shared navigation and draft/receipt handling for the self-paced Weeks 8–12 games.
   Calculations stay in each game; delivery uses the existing course receiver. */
const FINA3020GameSession = {
    create(config) {
        const version='2026-10-04-later-games-v1', key='fina3020_game_'+config.tab+'_v1';
        const el=id=>document.getElementById(id);
        const state={stage:1,maxStage:1,submissionId:null};
        let busy=false;
        const message=text=>{ el('game-message').textContent=text; };
        const getFields=()=>Object.fromEntries(config.fields.map(id=>[id,el(id).value]));
        const snapshot=()=>({...state,version,fields:getFields(),choices:config.getChoices?.()||{}});
        function save() {
            FINA3020Storage.setItem(key,JSON.stringify(snapshot()));
            el('draft-status').textContent=FINA3020Storage.available
                ? 'Progress is saved in this tab. Click an unlocked tab to go back.'
                : 'Browser storage is unavailable. Keep this tab open and export your response before leaving.';
        }
        function identity() {
            if(!FINA3020Utils.setStudentCredentials(...config.identity.map(id=>el(id).value))) {
                message('Enter your name, one 10-digit CUHK ID, and section in Setup.'); return false;
            }
            return true;
        }
        function validate(n) {
            if(n>=2 && !identity()) return false;
            const error=config.validate?.(n);
            if(error) {message(error);return false;} return true;
        }
        function receipt() {
            const record=FINA3020Utils._readHistory().find(r=>r.submissionId===state.submissionId);
            el('btn-submit-game').disabled=busy||!!state.submissionId;
            el('retry-game').hidden=!state.submissionId||!!record?.delivered;
            el('retry-game').disabled=busy;
            if(record?.delivered) el('submission-feedback').textContent='Saved. Receipt: '+record.receiptId+'. You can now close this tab.';
            else if(state.submissionId) el('submission-feedback').textContent=busy
                ? 'Sending your saved response. You can still review the game.'
                : 'Your response is saved in this tab and queued. Keep the tab open, retry after reconnecting, or export a copy.';
        }
        function lock() {
            for(const id of config.fields) el(id).disabled=!!state.submissionId;
            // Numeric companions are inserted by the existing mobile controls utility.
            document.querySelectorAll('[data-game-choice], .exact-value-control input').forEach(b=>{
                b.disabled=!!state.submissionId;
                b.setAttribute('aria-disabled',String(!!state.submissionId));
            });
        }
        function show() {
            for(let i=1;i<=5;i++) {
                el('stage-'+i+'-panel').style.display=i===state.stage?'block':'none';
                const b=el('step-'+i); b.disabled=i>state.maxStage;
                b.className='stepper-step'+(i===state.stage?' active':i<=state.maxStage?' completed':'');
                if(i===state.stage)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');
            }
            config.onShow?.(state.stage); lock(); receipt();
        }
        function navigate(n,backTab=false) {
            if(!Number.isInteger(n)||n<1||n>5||n>(backTab?state.maxStage:state.maxStage+1)) return;
            if(n>state.stage&&!validate(n)) return;
            if(n===3 && state.maxStage<3) for(const [from,to] of config.copyToShock||[]) el(to).value=el(from).value;
            state.stage=n;state.maxStage=Math.max(state.maxStage,n);
            message('');show();save();window.scrollTo?.({top:0,behavior:'smooth'});
        }
        function restore(record) {
            if(!record||record.version!==version)return;
            for(const id of config.fields) if(typeof record.fields?.[id]==='string') {
                const input=el(id), v=record.fields[id];
                if(input.type==='range' && (!Number.isFinite(Number(v))||Number(v)<Number(input.min)||Number(v)>Number(input.max)))continue;
                input.value=v;
            }
            config.setChoices?.(record.choices||{});
            state.maxStage=Number.isInteger(record.maxStage)?Math.max(1,Math.min(5,record.maxStage)):1;
            state.stage=Number.isInteger(record.stage)?Math.max(1,Math.min(state.maxStage,record.stage)):1;
            state.submissionId=typeof record.submissionId==='string'?record.submissionId:null;
        }
        function start() {
            config.identity.forEach((id,i)=>{el(id).value=[FINA3020Utils.getStudentID(),FINA3020Utils.getFullName(),FINA3020Utils.getSection()][i];});
            try {restore(JSON.parse(FINA3020Storage.getItem(key)||'null'));} catch(_){message('The saved draft could not be read. You can start again.');}
            const latest=FINA3020Utils._readHistory().filter(r=>r.targetTab===config.tab&&r.activityVersion===version&&r.studentId===el(config.identity[0]).value).pop();
            if(!state.submissionId && latest?.gameProgress) {restore(latest.gameProgress);state.submissionId=latest.submissionId;state.stage=state.maxStage=5;}
            show();save();
            document.addEventListener('input',save);
            document.addEventListener('change',save);
            document.addEventListener('click',save);
            FINA3020Utils.onDeliveryChange(receipt);
        }
        async function submit(data) {
            if(busy||state.submissionId)return;
            if(state.maxStage<5){message('Complete the exercises before submitting.');return;}
            if(!validate(5))return;
            const text=el(config.reflection).value;
            if(!text.trim()){message('Write your reflection before submitting.');return;}
            busy=true;message('');receipt();
            try {
                const response=FINA3020Utils.recordResponse({...data,targetTab:config.tab,activityVersion:version,recordType:'final',responseText:text,reflection:text,gameProgress:snapshot()});
                state.submissionId=response.submissionId;save();lock();receipt();
                await response.deliveryPromise;
            } catch(error) {el('submission-feedback').textContent='Unable to submit: '+error.message;}
            finally {busy=false;receipt();}
        }
        async function retry() {
            if(busy||!state.submissionId)return;
            busy=true;receipt();
            try {await FINA3020Utils.flushPending();}finally{busy=false;receipt();}
        }
        return {state,start,save,navigate,jump:n=>navigate(n,true),submit,retry,locked:()=>!!state.submissionId};
    }
};

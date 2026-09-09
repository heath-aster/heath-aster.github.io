/**
 * Shared Financial & UI Utility Functions for FINA3020 (International Finance)
 * CUHK Business School - Prof. Henry Zhang
 */

// Google Apps Script Web App receiver for FINA3020 student game responses
window.FINA3020_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbzeZKisXKgqGokRHkvmxbUT0EHeX8GqlIRuGpmEVEkPrvuobBsOnvafTP0XEJwgW6TmBw/exec";
if (typeof window.FINA3020_REQUIRE_ACCESS_CODE === 'undefined') {
    window.FINA3020_REQUIRE_ACCESS_CODE = false;
}

const FINA3020Storage = {
    memory: Object.create(null),
    available: true,
    getItem(key) {
        if (!this.available && Object.prototype.hasOwnProperty.call(this.memory, key)) return this.memory[key];
        try {
            // A page restored from Back/Forward may have an older memory snapshot.
            const value = sessionStorage.getItem(key);
            this.memory[key] = value;
            return value;
        } catch (error) {
            this.available = false;
            return Object.prototype.hasOwnProperty.call(this.memory, key) ? this.memory[key] : null;
        }
    },
    setItem(key, value) {
        this.memory[key] = String(value);
        try { sessionStorage.setItem(key, String(value)); }
        catch (error) { this.available = false; }
    },
    removeItem(key) {
        this.memory[key] = null;
        try { sessionStorage.removeItem(key); }
        catch (error) { this.available = false; }
    },
    clearCourseData() {
        const keys = Object.keys(this.memory);
        try { keys.push(...Object.keys(sessionStorage)); } catch (error) { this.available = false; }
        keys.filter(key => key.startsWith('fina3020_')).forEach(key => this.removeItem(key));
    }
};

const FINA3020Utils = {
    /**
     * Format numbers as currency with symbol and commas
     */
    formatCurrency: function(amount, symbol = '$', decimals = 2) {
        if (isNaN(amount) || amount === null) return `${symbol}0.00`;
        const sign = amount < 0 ? '-' : '';
        const absVal = Math.abs(amount);
        return `${sign}${symbol}${absVal.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        })}`;
    },

    /**
     * Format rates as percentages
     */
    formatPercent: function(rate, decimals = 2) {
        if (isNaN(rate) || rate === null) return '0.00%';
        return `${(rate * 100).toFixed(decimals)}%`;
    },

    /**
     * Format raw numbers with commas
     */
    formatNumber: function(num, decimals = 4) {
        if (isNaN(num) || num === null) return '0.0000';
        return num.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    },

    /**
     * Theoretical Forward Rate (No-Arbitrage CIP)
     * F = S * (1 + r_d * t) / (1 + r_f * t)
     * Money-market convention: 360-day year. Note priceFXOption uses 365 (option convention).
     */
    calculateTheoreticalForward: function(spot, r_d, r_f, days = 360) {
        const t = days / 360;
        return spot * (1 + r_d * t) / (1 + r_f * t);
    },

    /**
     * Covered Interest Parity Profit/Loss per Million Base Currency
     *
     * NOTE: strategy1 borrows `notional` of DOMESTIC currency while strategy2 borrows
     * `notional` of FOREIGN currency, so the two trades are not the same size and their
     * profit magnitudes are not directly comparable. The direction (sign) is still
     * correct. Used by the Week 2 game; left unchanged pending a Week 2 review.
     */
    calculateCIPProfit: function(spot, forward, r_d, r_f, days = 360, notional = 1000000) {
        const t = days / 360;
        // Strategy 1: Borrow Domestic, Convert Spot, Invest Foreign, Sell Forward
        const repayDomestic = notional * (1 + r_d * t);
        const foreignProceeds = (notional / spot) * (1 + r_f * t);
        const domesticFromForward = foreignProceeds * forward;
        const profit1 = domesticFromForward - repayDomestic;

        // Strategy 2: Borrow Foreign, Convert Spot, Invest Domestic, Buy Forward
        const foreignNotional = notional;
        const repayForeign = foreignNotional * (1 + r_f * t);
        const domesticProceeds = (foreignNotional * spot) * (1 + r_d * t);
        const foreignFromForward = domesticProceeds / forward;
        const profit2 = (foreignFromForward - repayForeign) * spot; // in domestic currency

        return {
            strategy1Profit: profit1,
            strategy2Profit: profit2,
            bestStrategy: profit1 > profit2 ? (profit1 > 0 ? 'Borrow Domestic -> Invest Foreign' : 'No Arbitrage') : (profit2 > 0 ? 'Borrow Foreign -> Invest Domestic' : 'No Arbitrage'),
            maxProfit: Math.max(0, profit1, profit2)
        };
    },

    /**
     * Standard Normal Cumulative Distribution Function (CDF) for Option Pricing
     */
    normCDF: function(x) {
        const t = 1 / (1 + 0.2316419 * Math.abs(x));
        const d = 0.3989423 * Math.exp(-x * x / 2);
        const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
        return x > 0 ? 1 - prob : prob;
    },

    /**
     * Garman-Kohlhagen (Black-Scholes extension) FX Option Pricing
     * type: 'call' or 'put'
     */
    priceFXOption: function(type, spot, strike, days, r_d, r_f, vol) {
        const t = days / 365;
        if (t <= 0 || vol <= 0) {
            if (type === 'call') return Math.max(0, spot - strike);
            return Math.max(0, strike - spot);
        }
        const d1 = (Math.log(spot / strike) + (r_d - r_f + 0.5 * vol * vol) * t) / (vol * Math.sqrt(t));
        const d2 = d1 - vol * Math.sqrt(t);

        const discountD = Math.exp(-r_d * t);
        const discountF = Math.exp(-r_f * t);

        if (type === 'call') {
            return spot * discountF * this.normCDF(d1) - strike * discountD * this.normCDF(d2);
        } else {
            return strike * discountD * this.normCDF(-d2) - spot * discountF * this.normCDF(-d1);
        }
    },

    /**
     * Setup interactive tab switching
     */
    setupTabs: function() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.getAttribute('data-tab');
                const parent = btn.closest('.glass-panel') || document;

                parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

                btn.classList.add('active');
                const targetContent = parent.querySelector(`#${target}`);
                if (targetContent) targetContent.classList.add('active');
            });
        });
    },

    /**
     * Default Chart.js Configuration for Dark Glassmorphic Theme
     */
    getChartDefaults: function() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#F8FAFC',
                        font: { family: 'Outfit', size: 12, weight: '600' }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(19, 24, 34, 0.95)',
                    titleColor: '#DAA520',
                    bodyColor: '#F8FAFC',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono', size: 11 } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono', size: 11 } }
                }
            }
        };
    },

    /* ------------------------------------------------------------------ *
     * Student identity and device-local data
     *
     * Student PII is intentionally kept in sessionStorage, not localStorage.
     * It survives a reload in the current tab but is removed when that tab is
     * closed. This prevents one class or shared-computer user from leaving a
     * durable name, ID, or answer history for the next user.
     * ------------------------------------------------------------------ */
    getStudentID: function() {
        return FINA3020Storage.getItem('fina3020_student_id') || '';
    },

    setStudentID: function(id) {
        if (id && id.trim()) {
            const cleanId = id.trim().replace(/\s+/g, '');
            if (/^\d{10}$/.test(cleanId)) {
                FINA3020Storage.setItem('fina3020_student_id', cleanId);
                FINA3020Storage.removeItem('fina3020_identity_confirmed');
                return true;
            }
        }
        return false;
    },

    getFullName: function() {
        return FINA3020Storage.getItem('fina3020_student_name') || '';
    },

    setFullName: function(name) {
        if (name && name.trim()) {
            FINA3020Storage.setItem('fina3020_student_name', name.trim().slice(0, 160));
            FINA3020Storage.removeItem('fina3020_identity_confirmed');
            return true;
        }
        return false;
    },

    getSection: function() {
        return FINA3020Storage.getItem('fina3020_student_section') || '';
    },

    setSection: function(sec) {
        if (sec && ['A', 'B', 'C'].includes(sec.trim().toUpperCase())) {
            FINA3020Storage.setItem('fina3020_student_section', sec.trim().toUpperCase());
            FINA3020Storage.removeItem('fina3020_identity_confirmed');
            return true;
        }
        return false;
    },

    /**
     * Forget the stored identity. Needed on shared or lab machines, where the next
     * student would otherwise submit under the previous student's name and ID.
     */
    clearStudentCredentials: function() {
        FINA3020Storage.removeItem('fina3020_student_id');
        FINA3020Storage.removeItem('fina3020_student_name');
        FINA3020Storage.removeItem('fina3020_student_section');
        FINA3020Storage.removeItem('fina3020_identity_confirmed');
    },

    /** Remove all device-local course PII and response data for this tab. */
    clearSensitiveData: function() {
        FINA3020Storage.clearCourseData();
        this.purgeLegacyStorage();
    },

    /**
     * Validate and store a single student's complete identity in one operation.
     * Returns false without changing the active identity if any field is invalid.
     */
    setStudentCredentials: function(id, name, section) {
        const cleanId = String(id || '').trim().replace(/\s+/g, '');
        const cleanName = String(name || '').trim();
        const cleanSection = String(section || '').trim().toUpperCase();
        if (!/^\d{10}$/.test(cleanId) || !cleanName || cleanName.length > 160 ||
            !['A', 'B', 'C'].includes(cleanSection)) return false;
        FINA3020Storage.setItem('fina3020_student_id', cleanId);
        FINA3020Storage.setItem('fina3020_student_name', cleanName);
        FINA3020Storage.setItem('fina3020_student_section', cleanSection);
        this.markIdentityConfirmedForSession();
        return true;
    },

    getAccessCode: function() {
        return FINA3020Storage.getItem('fina3020_access_code') || '';
    },

    ensureAccessCode: function() {
        const existing = this.getAccessCode();
        if (/^[A-F0-9]{16}$/.test(existing)) return true;
        if (!window.FINA3020_REQUIRE_ACCESS_CODE) return true;
        const entered = prompt('Enter your private 16-character FINA3020 game access code:');
        if (entered === null) return false;
        const clean = entered.trim().replace(/[\s-]+/g, '').toUpperCase();
        if (!/^[A-F0-9]{16}$/.test(clean)) {
            alert('The access code must contain exactly 16 hexadecimal characters.');
            return false;
        }
        FINA3020Storage.setItem('fina3020_access_code', clean);
        return true;
    },

    /**
     * True once the student has confirmed, in this browser session, that the stored
     * identity is theirs. Cleared when the tab closes, so a shared machine always asks.
     */
    isIdentityConfirmedForSession: function() {
        return FINA3020Storage.getItem('fina3020_identity_confirmed') === this.getStudentID();
    },

    markIdentityConfirmedForSession: function() {
        FINA3020Storage.setItem('fina3020_identity_confirmed', this.getStudentID());
    },

    /**
     * Confirm a pre-existing identity before the first submission of a session.
     * Returns true to proceed, false if the student needs to re-enter their details.
     */
    confirmIdentityForSession: function() {
        const id = this.getStudentID();
        const name = this.getFullName();
        const section = this.getSection();

        if (!id || !name || !section) return this.ensureStudentCredentials(true);
        if (this.isIdentityConfirmedForSession()) return true;

        this.showIdentityForm();
        return false;
    },

    /**
     * Ensure student credentials are set before submitting game rounds.
     * Uses an in-page form for name, 10-digit CUHK ID, and section; cancellation preserves saved responses.
     */
    ensureStudentCredentials: function(forcePrompt = false) {
        if (!forcePrompt && this.getStudentID() && this.getFullName() && this.getSection()) {
            this.markIdentityConfirmedForSession();
            return true;
        }
        this.showIdentityForm();
        return false; // The student resumes the original action after saving the form.
    },

    showIdentityForm: function() {
        if (document.getElementById('course-identity')) return;
        const previousFocus = document.activeElement;
        const panel = document.createElement('div');
        panel.id = 'course-identity';
        panel.className = 'course-identity-overlay';
        panel.innerHTML = `<form class="course-identity-form" role="dialog" aria-modal="true" aria-labelledby="identity-title">
            <h2 id="identity-title">Your course details</h2>
            <p>Save your details, then tap your game choice again to continue.</p>
            <label>Full name<input name="fullName" autocomplete="name" maxlength="160" required></label>
            <label>10-digit CUHK ID<input name="studentId" type="text" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" required></label>
            <label>Section<select name="section" required><option value="">Choose section</option><option>A</option><option>B</option><option>C</option></select></label>
            <p role="status" id="identity-message"></p>
            <div class="header-actions"><button type="submit" class="btn btn-gold">Save details</button><button type="button" class="btn btn-secondary" id="identity-cancel">Cancel</button></div>
        </form>`;
        document.body.appendChild(panel);
        const form = panel.querySelector('form');
        form.elements.fullName.value = this.getFullName();
        form.elements.studentId.value = this.getStudentID();
        form.elements.section.value = this.getSection();
        const close = () => { panel.remove(); if (previousFocus) previousFocus.focus(); };
        panel.querySelector('#identity-cancel').onclick = close;
        panel.onkeydown = event => {
            if (event.key === 'Escape') close();
            if (event.key === 'Tab') {
                const fields = [...form.querySelectorAll('input,select,button')];
                if (event.shiftKey && document.activeElement === fields[0]) { event.preventDefault(); fields[fields.length - 1].focus(); }
                else if (!event.shiftKey && document.activeElement === fields[fields.length - 1]) { event.preventDefault(); fields[0].focus(); }
            }
        };
        form.onsubmit = event => {
            event.preventDefault();
            const id = form.elements.studentId.value.trim();
            const name = form.elements.fullName.value.trim();
            const section = form.elements.section.value;
            if (!/^\d{10}$/.test(id) || !name || !['A','B','C'].includes(section)) return;
            if (this.getStudentID() && id !== this.getStudentID()) {
                if (this.getPendingCount()) {
                    panel.querySelector('#identity-message').textContent = 'Responses are still unconfirmed. Close this form and retry or export them before changing students.';
                    return;
                }
                this.clearSensitiveData();
            }
            this.setStudentCredentials(id, name, section);
            const button = document.getElementById('btn-student-id');
            if (button) button.textContent = `ID: ${id} | ${name}`;
            close();
        };
        form.elements.fullName.focus();
    },

    purgeLegacyStorage: function() {
        try {
            Object.keys(localStorage).filter(key => key.startsWith('fina3020_'))
                .forEach(key => localStorage.removeItem(key));
        } catch (error) { /* Blocked legacy storage must not interrupt game startup. */ }
    },

    /* ------------------------------------------------------------------ *
     * Submission delivery
     *
     * Submissions are graded for participation and are time-stamped, so a
     * submission that fails must never look like one that succeeded. Every
     * response is written to sessionStorage first, then posted. Delivery is
     * confirmed by reading the response; anything unconfirmed stays queued
     * and is retried, and the UI is told so it can say so honestly.
     *
     * The `timestamp` below is the STUDENT'S OWN CLOCK and is not evidence of
     * when a response was submitted. The Apps Script receiving this payload
     * should stamp its own server-side time and treat this field as untrusted.
     * ------------------------------------------------------------------ */

    _deliveryListeners: [],

    /**
     * Subscribe to delivery-state changes. Callback receives
     * { state: 'sending'|'confirmed'|'unconfirmed', pending: <number>, error: <string|null> }
     */
    onDeliveryChange: function(cb) {
        if (typeof cb === 'function') this._deliveryListeners.push(cb);
    },

    _emitDelivery: function(state, error) {
        const detail = { state: state, pending: this.getPendingCount(), error: error || null };
        this._deliveryListeners.forEach(cb => {
            try { cb(detail); } catch (e) { console.warn('Delivery listener failed:', e); }
        });
    },

    _readPending: function() {
        try {
            const value = JSON.parse(FINA3020Storage.getItem('fina3020_pending_submissions') || '[]');
            return Array.isArray(value) ? value.slice(-50) : [];
        } catch (e) {
            return [];
        }
    },

    _writePending: function(queue) {
        FINA3020Storage.setItem('fina3020_pending_submissions', JSON.stringify(queue.slice(-50)));
    },

    getPendingCount: function() {
        return this._readPending().length;
    },

    /**
     * POST one payload. Uses text/plain, which is CORS-safelisted, so the request
     * needs no preflight AND the response stays readable -- unlike mode:'no-cors',
     * which returns an opaque response and hides every server-side rejection.
     */
    _post: function(payload) {
        const webhookUrl = window.FINA3020_WEBHOOK_URL;
        if (!webhookUrl) return Promise.reject(new Error('No submission endpoint is configured.'));
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        let timer;
        const timeout = new Promise((resolve, reject) => {
            timer = setTimeout(() => {
                reject(new Error('Connection timed out. Your response is still queued; retry when connected.'));
                if (controller) controller.abort();
            }, 12000);
        });
        const request = fetch(webhookUrl, {
            signal: controller ? controller.signal : undefined,
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload),
            credentials: 'omit',
            cache: 'no-store',
            redirect: 'follow',
            referrerPolicy: 'no-referrer'
        }).then(res => {
            if (!res.ok) throw new Error(`Submission endpoint returned HTTP ${res.status}.`);
            return res.text();
        }).then(text => {
            const cleanText = String(text || '').trim();
            if (cleanText === 'Success') {
                return {
                    ok: true,
                    submissionId: payload.submissionId,
                    receiptId: payload.submissionId,
                    serverTimestamp: null // Legacy receiver supplies no server timestamp.
                };
            }
            let ack;
            try { ack = JSON.parse(cleanText); } catch (e) {
                throw new Error('Submission endpoint did not return a valid receipt.');
            }
            if (!ack || ack.ok !== true) {
                throw new Error(ack && ack.error ? `Submission rejected: ${ack.error}` : 'Submission endpoint returned an invalid receipt.');
            }
            if (ack.submissionId && ack.submissionId !== payload.submissionId) {
                throw new Error('Submission endpoint returned a receipt for a different submission.');
            }
            return {
                ok: true,
                submissionId: ack.submissionId || payload.submissionId,
                receiptId: ack.receiptId || payload.submissionId,
                serverTimestamp: ack.serverTimestamp || null
            };
        });
        return Promise.race([request, timeout]).finally(() => clearTimeout(timer));
    },

    _markDelivered: function(submissionId, serverTimestamp, receiptId) {
        const history = this._readHistory();
        const entry = history.find(h => h.submissionId === submissionId);
        if (entry) {
            entry.delivered = true;
            entry.serverTimestamp = serverTimestamp || entry.serverTimestamp;
            entry.receiptId = receiptId || entry.receiptId;
            FINA3020Storage.setItem('fina3020_response_history', JSON.stringify(history.slice(-100)));
        }
        this._writePending(this._readPending().filter(p => p.submissionId !== submissionId));
    },

    /**
     * Try to deliver one payload, retrying with backoff. Resolves true if the
     * server confirmed receipt, false if it stays queued.
     */
    _inFlight: new Map(),
    _deliver: function(payload) {
        if (this._inFlight.has(payload.submissionId)) return this._inFlight.get(payload.submissionId);
        const promise = this._attemptDelivery(payload).finally(() => this._inFlight.delete(payload.submissionId));
        this._inFlight.set(payload.submissionId, promise);
        return promise;
    },

    _attemptDelivery: function(payload, attempt = 0) {
        const delays = [2000, 6000];
        this._emitDelivery('sending');
        return this._post(payload).then(ack => {
            this._markDelivered(payload.submissionId, ack.serverTimestamp, ack.receiptId);
            this._emitDelivery('confirmed');
            return true;
        }).catch(err => {
            if (attempt < delays.length) {
                return new Promise(resolve => setTimeout(resolve, delays[attempt]))
                    .then(() => this._attemptDelivery(payload, attempt + 1));
            }
            console.warn('Submission not confirmed:', err);
            this._emitDelivery('unconfirmed', err.message);
            return false;
        });
    },

    /**
     * Retry everything still queued. Called on load and when the browser regains
     * connectivity, so a student who dropped offline mid-class recovers silently.
     */
    flushPending: function() {
        const queue = this._readPending();
        if (queue.length === 0) return Promise.resolve(0);
        return queue.reduce(
            (chain, payload) => chain.then(n => this._deliver(payload).then(ok => n + (ok ? 1 : 0))),
            Promise.resolve(0)
        );
    },

    _readHistory: function() {
        try {
            const value = JSON.parse(FINA3020Storage.getItem('fina3020_response_history') || '[]');
            return Array.isArray(value) ? value.slice(-100) : [];
        } catch (e) {
            return [];
        }
    },

    /**
     * Record student response locally and submit to the Google Sheets endpoint.
     *
     * Identity and timestamp are applied AFTER the caller's data is spread in, so a
     * game cannot override who a response is attributed to or when it was recorded.
     *
     * Returns the stored payload. A non-enumerable `deliveryPromise` resolves to
     * true once the server confirms receipt, false if the response stays queued.
     */
    recordResponse: function(responseData) {
        const data = responseData || {};

        const studentId = this.getStudentID();
        const fullName = this.getFullName();
        const section = this.getSection();
        if (!studentId || !fullName || !section || !this.isIdentityConfirmedForSession()) {
            throw new Error('Confirm your name, CUHK ID, and section before submitting.');
        }
        if (!this.ensureAccessCode()) throw new Error('A valid private game access code is required.');

        // Map mode to exact Google Sheet tab names
        let modeTab = data.targetTab || data.mode || data.game || 'Course_Survey';
        const modeLower = String(modeTab).toLowerCase();
        if (modeLower.includes('survey') || modeLower.includes('icebreaker')) modeTab = 'Course_Survey';
        else if (modeLower.includes('order')) modeTab = 'Order_Book';
        else if (modeLower.includes('loc')) modeTab = 'Locational_Arb';
        else if (modeLower.includes('tri')) modeTab = 'Triangular_Arb';
        else if (modeLower.includes('cip')) modeTab = 'CIP';
        else if (modeLower.includes('carry')) modeTab = 'Carry_Trade';
        else if (modeLower.includes('cfo') || modeLower.includes('hedge')) modeTab = 'CFO_Hedge';
        else if (modeLower.includes('committee') || modeLower.includes('project')) modeTab = 'Project_Committee';
        else if (modeLower.includes('bop') || modeLower.includes('ledger') || modeLower.includes('relay')) modeTab = 'BOP_Ledger';
        else if (modeLower.includes('bank_run')) modeTab = 'Bank_Run';
        else if (modeLower.includes('funding') || modeLower.includes('basis')) modeTab = 'Bank_Funding';
        else if (modeLower.includes('payment') || modeLower.includes('route') || modeLower.includes('routing')) modeTab = 'Payment_Route';
        else if (modeLower.includes('sudden') || modeLower.includes('policy')) modeTab = 'Sudden_Stop';
        else if (modeLower.includes('blended') || modeLower.includes('finance')) modeTab = 'Blended_Finance';
        else throw new Error('This game is not configured for submissions.');

        const submissionId = (window.crypto && crypto.randomUUID)
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;

        // Caller-controlled identity, routing, and receipt fields are discarded.
        const protectedKeys = new Set([
            'submissionId', 'studentId', 'studentName', 'fullName', 'section',
            'timestamp', 'submittedAt', 'serverTimestamp', 'receiptId',
            'targetTab', 'delivered', 'accessCode'
        ]);
        const response = {};
        Object.keys(data).forEach(key => {
            if (!protectedKeys.has(key)) response[key] = data[key];
        });
        const responseJson = JSON.stringify(response);
        if (responseJson.length > 20000) throw new Error('Response is too large to submit.');

        const fullPayload = {
            schemaVersion: 2,
            ...response,
            submissionId: submissionId,
            studentId: studentId,
            fullName: fullName,
            section: section,
            timestamp: new Date().toISOString(), // student's clock; stamp server-side too
            targetTab: modeTab,
            delivered: false
        };
        const deliveryPayload = { ...fullPayload, accessCode: this.getAccessCode() };

        const history = this._readHistory();
        history.push(fullPayload);
        FINA3020Storage.setItem('fina3020_response_history', JSON.stringify(history.slice(-100)));

        const queue = this._readPending();
        queue.push(deliveryPayload);
        this._writePending(queue);

        const promise = this._deliver(deliveryPayload);

        const result = { ...fullPayload };
        Object.defineProperty(result, 'deliveryPromise', { value: promise, enumerable: false });
        return result;
    },

    /**
     * Download response history as CSV file. Columns are the union of all keys, so
     * rows with differing shapes stay aligned -- this file is a student's only
     * evidence of a submission the server never confirmed.
     */
    exportResponsesCSV: function() {
        const history = this._readHistory();
        if (history.length === 0) {
            alert('No response history found to export.');
            return;
        }

        const headers = [];
        history.forEach(row => Object.keys(row).forEach(k => {
            if (!headers.includes(k)) headers.push(k);
        }));

        const csvRows = [headers.join(',')];
        history.forEach(row => {
            const values = headers.map(header => {
                let val = row[header] !== undefined && row[header] !== null ? String(row[header]) : '';
                // Prevent spreadsheet-formula execution when a CSV is opened in Excel/Sheets.
                if (/^[\s]*[=+\-@]/.test(val)) val = `'${val}`;
                return `"${val.replace(/"/g, '""')}"`;
            });
            csvRows.push(values.join(','));
        });

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `FINA3020_Responses_${this.getStudentID() || 'all'}_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    },

    escapeHTML: function(value) {
        return String(value === undefined || value === null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
};

// Keep recovery visible on every game, including after returning from a phone lock screen.
document.addEventListener('DOMContentLoaded', () => {
    FINA3020Utils.purgeLegacyStorage();
    FINA3020Utils.setupTabs();
    FINA3020Storage.setItem('fina3020_storage_check', '1');
    FINA3020Storage.removeItem('fina3020_storage_check');
    const status = document.createElement('section');
    status.className = 'course-connection';
    status.hidden = true;
    status.innerHTML = '<p role="status" aria-live="polite"></p><button class="btn btn-secondary" type="button">Retry submissions</button> <button class="btn btn-secondary" type="button">Export responses</button>';
    document.body.appendChild(status);
    const buttons = status.querySelectorAll('button');
    buttons[0].onclick = () => FINA3020Utils.flushPending();
    buttons[1].onclick = () => FINA3020Utils.exportResponsesCSV();
    const update = (detail = {}) => {
        const pending = FINA3020Utils.getPendingCount();
        status.hidden = !pending && FINA3020Storage.available;
        status.querySelector('p').textContent =
            (!FINA3020Storage.available ? 'Browser storage is unavailable. Keep this page open until confirmation; reloading will lose unconfirmed responses. ' : '') +
            (pending ? `${pending} response(s) ${detail.state === 'sending' ? 'sending' : 'not yet confirmed'}. Keep this tab open. Retry after reconnecting, or export a copy for the TA.` : '');
        buttons[0].disabled = detail.state === 'sending';
    };
    FINA3020Utils.onDeliveryChange(update);
    update();
    const recover = () => { if (FINA3020Utils.getPendingCount()) FINA3020Utils.flushPending(); };
    window.addEventListener('online', recover);
    window.addEventListener('pageshow', recover);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) recover(); });
    setInterval(() => { if (!document.hidden) recover(); }, 30000);
    recover();
});

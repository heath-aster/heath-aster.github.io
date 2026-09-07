/**
 * Shared Financial & UI Utility Functions for FINA3020 (International Finance)
 * CUHK Business School - Prof. Henry Zhang
 */

// Google Apps Script Web App receiver for FINA3020 student game responses
window.FINA3020_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbzeZKisXKgqGokRHkvmxbUT0EHeX8GqlIRuGpmEVEkPrvuobBsOnvafTP0XEJwgW6TmBw/exec";
if (typeof window.FINA3020_REQUIRE_ACCESS_CODE === 'undefined') {
    window.FINA3020_REQUIRE_ACCESS_CODE = false;
}

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
        return sessionStorage.getItem('fina3020_student_id') || '';
    },

    setStudentID: function(id) {
        if (id && id.trim()) {
            const cleanId = id.trim().replace(/\s+/g, '');
            if (/^\d{10}$/.test(cleanId)) {
                sessionStorage.setItem('fina3020_student_id', cleanId);
                sessionStorage.removeItem('fina3020_identity_confirmed');
                return true;
            }
        }
        return false;
    },

    getFullName: function() {
        return sessionStorage.getItem('fina3020_student_name') || '';
    },

    setFullName: function(name) {
        if (name && name.trim()) {
            sessionStorage.setItem('fina3020_student_name', name.trim().slice(0, 160));
            sessionStorage.removeItem('fina3020_identity_confirmed');
            return true;
        }
        return false;
    },

    getSection: function() {
        return sessionStorage.getItem('fina3020_student_section') || '';
    },

    setSection: function(sec) {
        if (sec && ['A', 'B', 'C'].includes(sec.trim().toUpperCase())) {
            sessionStorage.setItem('fina3020_student_section', sec.trim().toUpperCase());
            sessionStorage.removeItem('fina3020_identity_confirmed');
            return true;
        }
        return false;
    },

    /**
     * Forget the stored identity. Needed on shared or lab machines, where the next
     * student would otherwise submit under the previous student's name and ID.
     */
    clearStudentCredentials: function() {
        sessionStorage.removeItem('fina3020_student_id');
        sessionStorage.removeItem('fina3020_student_name');
        sessionStorage.removeItem('fina3020_student_section');
        sessionStorage.removeItem('fina3020_identity_confirmed');
    },

    /** Remove all device-local course PII and response data for this tab. */
    clearSensitiveData: function() {
        Object.keys(sessionStorage)
            .filter(key => key.startsWith('fina3020_'))
            .forEach(key => sessionStorage.removeItem(key));
        // Purge data created by versions used before August 2026.
        Object.keys(localStorage)
            .filter(key => key.startsWith('fina3020_'))
            .forEach(key => localStorage.removeItem(key));
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
        sessionStorage.setItem('fina3020_student_id', cleanId);
        sessionStorage.setItem('fina3020_student_name', cleanName);
        sessionStorage.setItem('fina3020_student_section', cleanSection);
        this.markIdentityConfirmedForSession();
        return true;
    },

    getAccessCode: function() {
        return sessionStorage.getItem('fina3020_access_code') || '';
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
        sessionStorage.setItem('fina3020_access_code', clean);
        return true;
    },

    /**
     * True once the student has confirmed, in this browser session, that the stored
     * identity is theirs. Cleared when the tab closes, so a shared machine always asks.
     */
    isIdentityConfirmedForSession: function() {
        return sessionStorage.getItem('fina3020_identity_confirmed') === this.getStudentID();
    },

    markIdentityConfirmedForSession: function() {
        sessionStorage.setItem('fina3020_identity_confirmed', this.getStudentID());
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

        const ok = confirm(
            `This device will submit as:\n\n    ${name}\n    CUHK ID ${id}\n    Section ${section}\n\n` +
            `Click OK if this is you.\nClick Cancel to enter different details.`
        );
        if (ok) {
            this.markIdentityConfirmedForSession();
            return true;
        }
        this.clearStudentCredentials();
        return this.ensureStudentCredentials(true);
    },

    /**
     * Ensure student credentials are set before submitting game rounds.
     * Prompts for Full Name (Surname, Given name), 10-digit CUHK Student ID, and Course Section (A, B, C).
     */
    ensureStudentCredentials: function(forcePrompt = false, attempt = 0) {
        if (attempt > 5) {
            alert('Too many invalid attempts. Reload the page and try again.');
            return false;
        }

        let currentId = this.getStudentID();
        let currentName = this.getFullName();
        let currentSection = this.getSection();

        if (forcePrompt && (currentId || currentName || currentSection)) {
            if (this.getPendingCount() > 0) {
                alert('Changing students will clear unconfirmed responses from this tab. Export the CSV first if you need a copy.');
            }
            this.clearSensitiveData();
            currentId = '';
            currentName = '';
            currentSection = '';
        }

        if (forcePrompt || !currentId || !currentName || !currentSection) {
            const nameInput = prompt(
                'Enter your Full Name (Format: "Surname, Given name", e.g., "LOU, Seon"):',
                currentName
            );
            if (nameInput === null && !forcePrompt && currentId && currentName && currentSection) return true;
            if (nameInput && nameInput.trim()) {
                this.setFullName(nameInput.trim());
            }

            const idInput = prompt(
                'Enter your 10-digit CUHK Student ID (e.g., 1155123456):',
                currentId
            );
            if (idInput === null && !forcePrompt && currentId && currentName && currentSection) return true;
            if (idInput) {
                const cleanId = idInput.trim().replace(/\s+/g, '');
                if (!/^\d{10}$/.test(cleanId)) {
                    alert('Invalid CUHK Student ID! It must be exactly 10 digits (e.g. 1155123456).');
                    return this.ensureStudentCredentials(true, attempt + 1);
                }
                this.setStudentID(cleanId);
            }

            const secInput = prompt(
                'Enter your Course Section (A, B, or C):',
                currentSection || 'A'
            );
            if (secInput && ['A', 'B', 'C'].includes(secInput.trim().toUpperCase())) {
                this.setSection(secInput.trim().toUpperCase());
            } else if (!currentSection) {
                alert('Course Section must be A, B, or C.');
                return this.ensureStudentCredentials(true, attempt + 1);
            }
        }

        currentId = this.getStudentID();
        currentName = this.getFullName();
        currentSection = this.getSection();

        if (!currentId || !currentName || !currentSection) {
            alert('Full Name, 10-digit CUHK Student ID, and Course Section (A, B, or C) are required to submit.');
            return false;
        }
        this.markIdentityConfirmedForSession();
        return true;
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
            const value = JSON.parse(sessionStorage.getItem('fina3020_pending_submissions') || '[]');
            return Array.isArray(value) ? value.slice(-50) : [];
        } catch (e) {
            return [];
        }
    },

    _writePending: function(queue) {
        sessionStorage.setItem('fina3020_pending_submissions', JSON.stringify(queue.slice(-50)));
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
        return fetch(webhookUrl, {
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
    },

    _markDelivered: function(submissionId, serverTimestamp, receiptId) {
        const history = this._readHistory();
        const entry = history.find(h => h.submissionId === submissionId);
        if (entry) {
            entry.delivered = true;
            entry.serverTimestamp = serverTimestamp || entry.serverTimestamp;
            entry.receiptId = receiptId || entry.receiptId;
            sessionStorage.setItem('fina3020_response_history', JSON.stringify(history.slice(-100)));
        }
        this._writePending(this._readPending().filter(p => p.submissionId !== submissionId));
    },

    /**
     * Try to deliver one payload, retrying with backoff. Resolves true if the
     * server confirmed receipt, false if it stays queued.
     */
    _deliver: function(payload, attempt = 0) {
        const delays = [2000, 6000];
        this._emitDelivery('sending');
        return this._post(payload).then(ack => {
            this._markDelivered(payload.submissionId, ack.serverTimestamp, ack.receiptId);
            this._emitDelivery('confirmed');
            return true;
        }).catch(err => {
            if (attempt < delays.length) {
                return new Promise(resolve => setTimeout(resolve, delays[attempt]))
                    .then(() => this._deliver(payload, attempt + 1));
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
            const value = JSON.parse(sessionStorage.getItem('fina3020_response_history') || '[]');
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
        sessionStorage.setItem('fina3020_response_history', JSON.stringify(history.slice(-100)));

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

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    // Remove durable PII written by older versions of the games.
    Object.keys(localStorage)
        .filter(key => key.startsWith('fina3020_'))
        .forEach(key => localStorage.removeItem(key));
    FINA3020Utils.setupTabs();
    // Recover anything a previous session could not confirm.
    if (FINA3020Utils.getPendingCount() > 0) FINA3020Utils.flushPending();
});

window.addEventListener('online', () => {
    if (FINA3020Utils.getPendingCount() > 0) FINA3020Utils.flushPending();
});

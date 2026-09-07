/** Pair course-game sliders with exact numeric entry, using the same input handlers. */
(() => {
    'use strict';
    const attached = new WeakSet();
    const valueProperty = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

    function attach(slider) {
        if (attached.has(slider)) return;
        if (slider.parentElement?.querySelector?.('.control-value-input')) return;
        attached.add(slider);
        const row = document.createElement('label');
        row.className = 'exact-value-control';
        const caption = document.createElement('span');
        caption.textContent = 'Exact value';
        const number = document.createElement('input');
        number.type = 'number';
        number.id = `${slider.id}-exact`;
        number.inputMode = 'decimal';
        number.required = true;
        // Continuous financial quantities allow values between the original slider ticks.
        // Survey ratings remain discrete choices.
        const step = slider.dataset.discrete === 'true' ? slider.step || '1' : 'any';
        slider.step = step;
        number.step = step;
        const heading = slider.labels?.[0] || slider.parentElement.querySelector('.control-label, .slider-header, label');
        const name = slider.getAttribute('aria-label') || heading?.textContent.trim() || slider.id;
        number.setAttribute('aria-label', `${name}: exact value`);
        row.append(caption, number);
        slider.insertAdjacentElement('afterend', row);

        const sync = () => {
            number.min = slider.min || '0';
            number.max = slider.max || '100';
            number.disabled = slider.disabled;
            number.value = slider.value;
            number.removeAttribute('aria-invalid');
        };
        // Resets and newly generated rounds set .value directly without emitting events.
        Object.defineProperty(slider, 'value', {
            configurable: true,
            get() { return valueProperty.get.call(this); },
            set(value) { valueProperty.set.call(this, value); sync(); }
        });
        slider.addEventListener('input', sync);
        slider.addEventListener('change', sync);
        number.addEventListener('input', () => {
            const valid = number.validity.valid && Number.isFinite(number.valueAsNumber);
            number.setAttribute('aria-invalid', String(!valid));
            if (!valid) return; // Do not put a blank, out-of-range value, or NaN into the model.
            const typed = number.value;
            slider.value = typed;
            slider.dispatchEvent(new Event('input', { bubbles: true }));
            // Preserve trailing decimals while typing unless the game adjusted this value.
            if (Number(slider.value) === Number(typed)) number.value = typed;
        });
        number.addEventListener('change', () => {
            if (!number.validity.valid) number.reportValidity();
            else slider.dispatchEvent(new Event('change', { bubbles: true }));
        });
        number.addEventListener('blur', sync);
        number.addEventListener('keydown', event => {
            if (event.key === 'Enter') { event.preventDefault(); number.blur(); }
        });
        new MutationObserver(sync).observe(slider, {
            attributes: true, attributeFilter: ['min', 'max', 'disabled', 'value']
        });
        sync();
    }
    function scan(root) {
        if (root.matches?.('input[type="range"]')) attach(root);
        root.querySelectorAll?.('input[type="range"]').forEach(attach);
    }
    function init() {
        scan(document);
        // The triangular walkthrough rebuilds its books when a preset is selected.
        new MutationObserver(records => records.forEach(record => {
            record.addedNodes.forEach(node => { if (node.nodeType === 1) scan(node); });
        })).observe(document.body, { childList: true, subtree: true });
        document.addEventListener('reset', () => setTimeout(() => {
            document.querySelectorAll('input[type="range"]').forEach(slider => {
                slider.dispatchEvent(new Event('input', { bubbles: true }));
            });
        }, 0));
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

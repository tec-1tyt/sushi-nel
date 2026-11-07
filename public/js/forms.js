// Shared form sending: CSRF token, field errors, retries, optional Turnstile. The server re-checks everything.

const tokenState = { value: null, at: 0, siteKey: null, pending: null };
const isStatic = 'static' in document.documentElement.dataset;

async function fetchToken() {
  const r = await fetch('/api/csrf', { credentials: 'same-origin', cache: 'no-store' });
  if (!r.ok) throw new Error('csrf');
  const j = await r.json();
  tokenState.value = j.token;
  tokenState.at = Date.now();
  tokenState.siteKey = j.turnstileSiteKey;
  return j.token;
}

export function primeToken() {
  if (isStatic) return Promise.resolve(null);
  if (tokenState.value && Date.now() - tokenState.at < 3 * 3600e3) return Promise.resolve(tokenState.value);
  if (!tokenState.pending) tokenState.pending = fetchToken().finally(() => { tokenState.pending = null; });
  return tokenState.pending;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function postJson(url, body) {
  if (isStatic) return { status: 200, json: { ok: false, error: 'demo' } };
  await primeToken();
  const send = () => fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'x-csrf-token': tokenState.value },
    body: JSON.stringify(body),
  });
  let r = await send();
  if (r.status === 403) { await fetchToken(); await wait(1600); r = await send(); }
  else if (r.status === 429) {
    const peek = await r.clone().json().catch(() => ({}));
    if (peek.error === 'tooFast') { await wait(1700); r = await send(); }
  }
  const json = await r.json().catch(() => ({ ok: false, error: 'server' }));
  return { status: r.status, json };
}

let turnstileLoading = null;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (!turnstileLoading) {
    turnstileLoading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.onload = res;
      s.onerror = rej;
      document.head.append(s);
    });
  }
  return turnstileLoading;
}

async function mountTurnstile(form) {
  await primeToken();
  if (!tokenState.siteKey) return;
  const box = form.querySelector('[data-turnstile]');
  if (!box || box.dataset.ready) return;
  box.hidden = false;
  box.dataset.ready = '1';
  try {
    await loadTurnstile();
    window.turnstile.render(box, { sitekey: tokenState.siteKey, theme: 'dark', callback: (t) => { form._turnstile = t; } });
  } catch { box.hidden = true; }
}

export function clearErrors(form) {
  form.querySelectorAll('[data-err]').forEach((p) => { p.hidden = true; p.textContent = ''; });
  form.querySelectorAll('[aria-invalid]').forEach((el) => { el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); });
  const fe = form.querySelector('[data-err-form]');
  if (fe) { fe.hidden = true; fe.textContent = ''; }
}

export function showErrors(form, errors, messages) {
  let first = null;
  Object.entries(errors).forEach(([field, code]) => {
    const wrap = form.querySelector(`[data-field="${CSS.escape(field)}"]`);
    const msg = messages[code] || messages.invalid;
    const box = wrap?.querySelector('[data-err]') || form.querySelector('[data-err-form]');
    if (box) { box.textContent = msg; box.hidden = false; }
    const input = wrap?.querySelector('input, textarea');
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      if (box) { box.id = box.id || `err-${form.dataset.form}-${field}`; input.setAttribute('aria-describedby', box.id); }
      if (!first) first = input;
    }
  });
  first?.focus();
}

// Quick client-side pass so a blank field doesn't need a round trip. The server still decides.
export function missingFields(form) {
  const errs = {};
  form.querySelectorAll('[required]').forEach((el) => {
    const empty = el.type === 'checkbox' ? !el.checked : !el.value.trim();
    if (empty && !el.closest('[hidden]')) errs[el.name] = el.name === 'consent' ? 'consent' : 'required';
  });
  return errs;
}

function setBusy(form, busy, labels) {
  const btn = form.querySelector('[type="submit"]');
  if (!btn) return;
  const span = btn.querySelector('span') || btn;
  if (busy) { btn.dataset.label = span.textContent; span.textContent = labels.sending; btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
  else { if (btn.dataset.label) span.textContent = btn.dataset.label; btn.disabled = false; btn.removeAttribute('aria-busy'); }
}

// Wires one form. getBody returns the payload; onOk gets the server reply.
export function wireForm(form, { url, getBody, onOk, data }) {
  const { errors: M, form: L } = data;
  const prime = () => { primeToken().catch(() => {}); mountTurnstile(form).catch(() => {}); };
  form.addEventListener('focusin', prime, { once: true });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    const msgBox = form.querySelector('[data-msg]');
    if (msgBox) { msgBox.hidden = true; msgBox.classList.remove('is-ok', 'is-err'); }
    const miss = missingFields(form);
    if (Object.keys(miss).length) { showErrors(form, miss, M); return; }
    setBusy(form, true, L);
    const fail = (code) => {
      const text = M[code] || M.server;
      if (msgBox) { msgBox.textContent = text; msgBox.classList.add('is-err'); msgBox.hidden = false; }
      else { const fe = form.querySelector('[data-err-form]'); if (fe) { fe.textContent = text; fe.hidden = false; } }
    };
    try {
      const body = { ...getBody(), lang: data.lang, website: form.querySelector('[name="website"]')?.value || '' };
      if (form._turnstile) body.turnstile = form._turnstile;
      const { json } = await postJson(url, body);
      if (json.ok) { onOk(json, body); }
      else if (json.errors) { showErrors(form, json.errors, M); }
      else { fail(json.error || 'server'); }
    } catch {
      fail('network');
    } finally {
      setBusy(form, false, L);
    }
  });
}

(() => {
  'use strict';

  const authRoot = document.querySelector('[data-auth-page]');
  const accountRoot = document.querySelector('[data-account-page]');
  if (!authRoot && !accountRoot) return;

  const SESSION_KEY = 'lwbAccountSession';
  const root = authRoot || accountRoot;
  const apiUrl = root?.dataset.api || window.LWB_SITE_CONFIG?.apiBase || '';
  const status = authRoot?.querySelector('[data-auth-status]') || accountRoot?.querySelector('[data-account-status]');
  const query = new URLSearchParams(location.search);

  const setStatus = (text, ok = false) => {
    if (!status) return;
    status.textContent = text || '';
    status.dataset.state = ok ? 'ok' : 'error';
    status.hidden = !text;
  };
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const formatDate = value => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? escapeHtml(value) : date.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' });
  };
  const money = (value, currency='USD') => new Intl.NumberFormat('en-US', { style:'currency', currency:currency || 'USD' }).format(Number(value || 0));

  async function request(action, data = {}) {
    if (!apiUrl) throw new Error('The account service is not configured.');
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type':'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...data, userAgent:navigator.userAgent }),
      redirect: 'follow'
    });
    const payload = await response.json();
    if (!payload?.ok) throw new Error(payload?.error || 'The account request failed.');
    return payload;
  }

  function saveSession(token) {
    if (token) localStorage.setItem(SESSION_KEY, token);
  }
  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }
  function currentSession() {
    return localStorage.getItem(SESSION_KEY) || '';
  }

  function renderAccount(payload) {
    const library = accountRoot.querySelector('[data-account-library]');
    const orders = accountRoot.querySelector('[data-account-orders]');
    const profile = accountRoot.querySelector('[data-account-profile]');
    document.querySelectorAll('[data-account-email]').forEach(el => { el.textContent = payload.user?.email || 'Not signed in'; });
    if (profile) {
      profile.innerHTML = `<dl class="account-details"><dt>Name</dt><dd>${escapeHtml(payload.user?.display_name || '—')}</dd><dt>Email</dt><dd>${escapeHtml(payload.user?.email || '')}</dd><dt>Email verified</dt><dd>${payload.user?.email_verified ? 'Yes' : 'No'}</dd></dl>`;
    }
    if (library) {
      const items = payload.library || [];
      library.innerHTML = items.length ? `<div class="account-library-grid">${items.map(item => `<article class="account-library-card"><img src="${escapeHtml(item.cover_path || '/assets/icons/lwb-mark.svg')}" alt="Cover of ${escapeHtml(item.title)}"><div><h2>${escapeHtml(item.title)}</h2><p>Added ${formatDate(item.granted_at)}</p>${item.download_url ? `<a class="btn" href="${escapeHtml(item.download_url)}">Download Again</a>` : '<p class="notice warning">Download file is not linked yet.</p>'}<a class="text-link" href="${escapeHtml((item.canonical_path || '/estore/').replace(/\/$/,'') + '/')}">View product</a></div></article>`).join('')}</div>` : '<div class="notice">No purchased eBibles are linked to this account yet. Purchases appear when the PayPal payer email matches this verified account email.</div>';
    }
    if (orders) {
      const rows = payload.orders || [];
      orders.innerHTML = rows.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Order</th><th>Status</th><th>Total</th></tr></thead><tbody>${rows.map(order => `<tr><td>${formatDate(order.created_at)}</td><td>${escapeHtml(order.order_id)}</td><td>${escapeHtml(order.status)}</td><td>${money(order.total, order.currency)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="notice">No orders are linked to this account yet.</div>';
    }
    setStatus('Account information loaded.', true);
  }

  document.querySelectorAll('[data-sign-out]').forEach(btn => {
    btn.addEventListener('click', () => {
      clearSession();
      location.href = '/login/';
    });
  });

  if (authRoot) {
    const type = authRoot.dataset.authPage;
    const form = authRoot.querySelector('form');

    if (type === 'verify-email') {
      const email = query.get('email') || '';
      const token = query.get('token') || '';
      if (!email || !token) {
        setStatus('This verification link is missing required information.');
      } else {
        setStatus('Verifying your email address…', true);
        request('verify-email', { email, token })
          .then(payload => {
            setStatus(payload.message || 'Your email address has been verified.', true);
            const actions = authRoot.querySelector('[data-auth-actions]');
            if (actions) actions.innerHTML = '<a class="btn" href="/login/">Continue to Login</a>';
          })
          .catch(error => setStatus(error.message || 'Email verification failed.'));
      }
      return;
    }

    if (type === 'reset-password' && (!query.get('email') || !query.get('token'))) {
      authRoot.querySelectorAll('input,button').forEach(el => { el.disabled = true; });
      setStatus('This password-reset link is missing required information. Request a new reset email.');
      return;
    }

    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const submit = form.querySelector('[type="submit"]');
      const oldText = submit?.textContent;
      if (submit) { submit.disabled = true; submit.textContent = 'Processing…'; }
      setStatus('Processing…', true);
      const data = Object.fromEntries(new FormData(form).entries());
      try {
        if (type === 'login') {
          const payload = await request('login', data);
          saveSession(payload.token);
          const next = query.get('next');
          location.href = next && next.startsWith('/') ? next : '/account/';
        } else if (type === 'register') {
          const payload = await request('register', data);
          setStatus(payload.message || 'Account created. Check your email to verify your address.', true);
          form.reset();
        } else if (type === 'forgot-password') {
          const payload = await request('forgot-password', data);
          setStatus(payload.message || 'If an account exists for that address, a password-reset email has been sent.', true);
          form.reset();
        } else if (type === 'reset-password') {
          const payload = await request('reset-password', { ...data, email:query.get('email'), token:query.get('token') });
          setStatus(payload.message || 'Your password has been updated. Redirecting to login…', true);
          clearSession();
          setTimeout(() => { location.href = '/login/?reset=complete'; }, 1200);
        }
      } catch (error) {
        setStatus(error.message || 'The account request failed.');
      } finally {
        if (submit) { submit.disabled = false; submit.textContent = oldText; }
      }
    });
  }

  if (accountRoot) {
    const token = currentSession();
    if (!token) {
      location.href = `/login/?next=${encodeURIComponent(location.pathname)}`;
      return;
    }
    setStatus('Loading your library and orders…', true);
    request('account', { token })
      .then(renderAccount)
      .catch(error => {
        clearSession();
        setStatus(error.message || 'Your account session could not be loaded.');
        setTimeout(() => { location.href = `/login/?next=${encodeURIComponent(location.pathname)}`; }, 1400);
      });
  }
})();

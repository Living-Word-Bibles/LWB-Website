(() => {
  'use strict';

  const root = document.querySelector('[data-portal-root]');
  if (!root) return;

  const SESSION_KEY = 'lwbPortalSession';
  const loginPanel = root.querySelector('[data-portal-login]');
  const app = root.querySelector('[data-portal-app]');
  const loginStatus = root.querySelector('[data-portal-login-status]');
  const status = root.querySelector('[data-portal-status]');
  const apiUrl = window.LWB_SITE_CONFIG?.apiBase || '';
  let dashboard = null;
  let currentCustomer = null;
  let currentCustomerEmail = '';

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const date = value => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? esc(value) : d.toLocaleString();
  };
  const money = (value, currency = 'USD') => {
    try { return new Intl.NumberFormat('en-US', { style:'currency', currency:currency || 'USD' }).format(Number(value || 0)); }
    catch (_) { return `$${Number(value || 0).toFixed(2)}`; }
  };

  function token() { return localStorage.getItem(SESSION_KEY) || ''; }
  function saveToken(value) { if (value) localStorage.setItem(SESSION_KEY, value); }
  function clearToken() { localStorage.removeItem(SESSION_KEY); }

  function setMessage(el, text, ok = false) {
    if (!el) return;
    el.textContent = text || '';
    el.dataset.state = ok ? 'ok' : 'error';
    el.hidden = !text;
  }

  async function request(action, data = {}) {
    if (!apiUrl) throw new Error('The Living Word Bibles API is not configured.');
    const payload = { action, ...data, userAgent:navigator.userAgent };
    if (action.startsWith('admin-') && action !== 'admin-login' && !payload.token) payload.token = token();

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type':'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });
    const result = await response.json();
    if (!result?.ok) {
      const error = new Error(result?.error || 'The portal request failed.');
      if (/portal session|sign in again|session has expired/i.test(error.message)) {
        clearToken();
        showLogin();
      }
      throw error;
    }
    return result;
  }

  function showLogin() {
    loginPanel.hidden = false;
    app.hidden = true;
    currentCustomer = null;
  }

  function showApp(admin) {
    loginPanel.hidden = true;
    app.hidden = false;
    root.querySelector('[data-admin-name]').textContent = admin?.display_name || admin?.user || 'Administrator';
  }

  function renderStats(counts = {}) {
    const items = [
      ['Active Subscribers', counts.subscribers_active || 0],
      ['Customer Accounts', counts.customers || 0],
      ['Completed Orders', counts.orders_completed || 0],
      ['Active Entitlements', counts.entitlements_active || 0]
    ];
    root.querySelector('[data-dashboard-stats]').innerHTML = items.map(([label, value]) =>
      `<article class="portal-card portal-stat"><strong>${esc(value)}</strong><span>${esc(label)}</span></article>`
    ).join('');
  }

  function renderCampaign(campaign) {
    const box = root.querySelector('[data-campaign-summary]');
    if (!campaign) {
      box.innerHTML = '<p>No active or recently stored campaign state.</p>';
      return;
    }
    box.innerHTML = `<dl class="account-details"><dt>Status</dt><dd>${esc(campaign.status || '—')}</dd><dt>Subject</dt><dd>${esc(campaign.subject || campaign.template_key || '—')}</dd><dt>Progress</dt><dd>${esc(campaign.cursor || 0)} / ${esc(campaign.total || 0)}</dd><dt>Last batch</dt><dd>${date(campaign.last_batch_at)}</dd></dl>`;
  }

  function logRows(logs) {
    return (logs || []).map(row => `<tr><td>${date(row.timestamp)}</td><td>${esc(row.level)}</td><td>${esc(row.event)}</td><td>${esc(row.source)}</td><td>${esc(row.email)}</td><td class="portal-code">${esc(row.record_id || '')}</td><td>${esc(row.message || '')}</td></tr>`).join('') || '<tr><td colspan="7">No log rows found.</td></tr>';
  }

  function renderDashboard(payload) {
    dashboard = payload;
    showApp(payload.admin);
    renderStats(payload.counts);
    renderCampaign(payload.campaign);
    root.querySelector('[data-dashboard-logs]').innerHTML = (payload.recent_logs || []).map(row =>
      `<tr><td>${date(row.timestamp)}</td><td>${esc(row.event)}</td><td>${esc(row.source)}</td><td>${esc(row.email || '')}</td><td>${esc(row.message || '')}</td></tr>`
    ).join('') || '<tr><td colspan="5">No recent activity.</td></tr>';
    populateProductSelects(payload.eligible_products || []);
  }

  function populateProductSelects(products) {
    const options = products.map(product => `<option value="${esc(product.product_id)}">${esc(product.short_title || product.title)} — ${money(product.price, product.currency)}</option>`).join('');
    root.querySelectorAll('[data-product-select]').forEach(select => { select.innerHTML = options; });
  }

  async function loadDashboard() {
    const payload = await request('admin-dashboard');
    renderDashboard(payload);
  }

  root.querySelector('[data-portal-login-form]').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    setMessage(loginStatus, 'Signing in…', true);
    try {
      const data = Object.fromEntries(new FormData(form).entries());
      const payload = await request('admin-login', data);
      saveToken(payload.token);
      form.reset();
      setMessage(loginStatus, '', true);
      await loadDashboard();
    } catch (error) {
      setMessage(loginStatus, error.message || 'Sign-in failed.');
    } finally {
      button.disabled = false;
    }
  });

  root.querySelector('[data-portal-signout]').addEventListener('click', () => {
    clearToken();
    setMessage(status, 'Signed out.', true);
    showLogin();
  });

  root.querySelectorAll('[data-tab]').forEach(button => {
    button.addEventListener('click', () => {
      const name = button.dataset.tab;
      root.querySelectorAll('[data-tab]').forEach(item => item.setAttribute('aria-selected', String(item === button)));
      root.querySelectorAll('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== name; });
      if (name === 'subscribers') loadSubscribers().catch(showError);
      if (name === 'logs') loadLogs().catch(showError);
    });
  });

  function showError(error) { setMessage(status, error?.message || String(error)); }
  function showOk(message) { setMessage(status, message, true); }

  async function loadSubscribers(query = '') {
    const payload = await request('admin-subscribers', { query, limit:200 });
    const tbody = root.querySelector('[data-subscriber-rows]');
    tbody.innerHTML = (payload.subscribers || []).map(row => `<tr><td>${esc(row.email)}</td><td>${esc(row.name || '')}</td><td><span class="portal-badge">${esc(row.status || '')}</span></td><td>${esc(row.source || '')}</td><td>${date(row.updated_at || row.subscribed_at)}</td><td>${String(row.status || '').toLowerCase() === 'subscribed' ? `<button class="btn secondary portal-danger" type="button" data-remove-subscriber="${esc(row.email)}">Unsubscribe</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6">No subscribers found.</td></tr>';
  }

  root.querySelector('[data-refresh-subscribers]').addEventListener('click', () => loadSubscribers().catch(showError));
  root.querySelector('[data-subscriber-search-form]').addEventListener('submit', event => {
    event.preventDefault();
    loadSubscribers(new FormData(event.currentTarget).get('query') || '').catch(showError);
  });
  root.querySelector('[data-subscriber-add-form]').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const data = Object.fromEntries(new FormData(form).entries());
      await request('admin-subscriber-add', data);
      showOk('Subscriber added or reactivated.');
      form.reset();
      await loadSubscribers();
      await loadDashboard();
    } catch (error) { showError(error); }
  });
  root.querySelector('[data-subscriber-rows]').addEventListener('click', async event => {
    const button = event.target.closest('[data-remove-subscriber]');
    if (!button) return;
    if (!confirm(`Unsubscribe ${button.dataset.removeSubscriber}?`)) return;
    try {
      await request('admin-subscriber-remove', { email:button.dataset.removeSubscriber });
      showOk('Subscriber unsubscribed and added to Do Not Email.');
      await loadSubscribers();
      await loadDashboard();
    } catch (error) { showError(error); }
  });

  /* Newsletter editor */
  const editor = root.querySelector('[data-news-editor]');
  const signature = root.querySelector('[data-news-signature]');
  root.querySelector('[data-editor-toolbar]').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    event.preventDefault();
    editor.focus();
    if (button.dataset.command) document.execCommand(button.dataset.command, false, null);
    if (button.dataset.block) document.execCommand('formatBlock', false, button.dataset.block);
    if (button.hasAttribute('data-link')) {
      const href = prompt('Enter the full link URL (https://...)');
      if (href) document.execCommand('createLink', false, href);
    }
    if (button.hasAttribute('data-cta')) {
      const label = prompt('Button label', 'Read More');
      const href = label ? prompt('Button URL (https://...)') : '';
      if (label && href) document.execCommand('insertHTML', false, `<p><a href="${esc(href)}" style="display:inline-block;padding:12px 20px;background:#8b6a25;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold">${esc(label)}</a></p>`);
    }
  });

  root.querySelector('[data-signature-default]').addEventListener('click', () => {
    signature.innerHTML = '<p>Sincerely,</p><p><strong>Living Word Bibles</strong><br><em>Beautifully Formatted to Bring God’s Word to Life on Any Device</em></p>';
  });

  function newsletterData() {
    return {
      subject: root.querySelector('[data-news-subject]').value.trim(),
      preheader: root.querySelector('[data-news-preheader]').value.trim(),
      html: editor.innerHTML.trim(),
      signature_html: signature.innerHTML.trim()
    };
  }

  root.querySelector('[data-news-preview]').addEventListener('click', () => {
    const data = newsletterData();
    const card = root.querySelector('[data-preview-card]');
    const frame = root.querySelector('[data-news-preview-frame]');
    const body = `${data.html}${data.signature_html ? `<div style="margin-top:28px;padding-top:18px;border-top:1px solid #eee6d8">${data.signature_html}</div>` : ''}`;
    frame.srcdoc = `<!doctype html><html><body style="margin:0;background:#f4f1e8;font-family:Arial,sans-serif;color:#2b2b2b"><div style="max-width:680px;margin:24px auto;background:#fff;border:1px solid #ded6c6;border-radius:14px;overflow:hidden"><div style="text-align:center;padding:28px;border-bottom:1px solid #eee6d8"><img src="/assets/LivingWordBibles01.png" alt="Living Word Bibles" style="max-width:260px;width:80%"><div style="font-family:Georgia,serif;font-style:italic;color:#6c6457;margin-top:10px">Beautifully Formatted to Bring God’s Word to Life on Any Device</div></div><div style="padding:32px 34px;line-height:1.65">${body}</div><div style="padding:22px;text-align:center;background:#faf7f0;border-top:1px solid #eee6d8;font-size:12px;color:#6c6457">Read the Bible Online • History of the Bible • eStore<br>Terms of Service • Privacy Policy • Unsubscribe<br>© 2026 Living Word Bibles. All Rights Reserved.</div></div></body></html>`;
    card.hidden = false;
    card.scrollIntoView({ behavior:'smooth', block:'start' });
  });

  root.querySelector('[data-news-test]').addEventListener('click', async () => {
    try {
      const data = newsletterData();
      data.test_email = root.querySelector('[data-test-email]').value.trim();
      const result = await request('admin-newsletter-test', data);
      showOk(result.message || 'Test newsletter sent.');
    } catch (error) { showError(error); }
  });

  root.querySelector('[data-news-queue]').addEventListener('click', async () => {
    if (!confirm('Queue this newsletter for the subscriber list? Batches send only Monday, Wednesday, and Friday, with no more than 99 recipients per batch.')) return;
    try {
      const result = await request('admin-newsletter-queue', newsletterData());
      showOk(result.message || 'Newsletter queued.');
      await loadDashboard();
    } catch (error) { showError(error); }
  });

  root.querySelector('[data-news-process]').addEventListener('click', async () => {
    try {
      const result = await request('admin-newsletter-process');
      showOk(result.message || `Processed batch: ${result.sent || 0} sent.`);
      await loadDashboard();
    } catch (error) { showError(error); }
  });

  root.querySelector('[data-news-stop]').addEventListener('click', async () => {
    if (!confirm('Stop the active newsletter campaign?')) return;
    try {
      await request('admin-newsletter-stop');
      showOk('Newsletter campaign stopped.');
      await loadDashboard();
    } catch (error) { showError(error); }
  });

  /* Accounts and purchases */
  async function loadCustomer(email = currentCustomerEmail) {
    if (!email) throw new Error('Enter a customer email address.');
    const payload = await request('admin-customer', { email });
    currentCustomer = payload.customer;
    currentCustomerEmail = payload.customer.email;
    renderCustomer(payload);
    return payload;
  }

  function renderCustomer(payload) {
    root.querySelector('[data-customer-area]').hidden = false;
    root.querySelector('[data-customer-summary]').innerHTML = `<dl class="account-details"><dt>Name</dt><dd>${esc(payload.customer.display_name || '—')}</dd><dt>Email</dt><dd>${esc(payload.customer.email)}</dd><dt>Status</dt><dd>${esc(payload.customer.status || '—')}</dd><dt>Verified</dt><dd>${payload.customer.email_verified ? 'Yes' : 'No'}</dd><dt>Customer ID</dt><dd class="portal-code">${esc(payload.customer.customer_id)}</dd></dl>`;
    populateProductSelects(payload.eligible_products || dashboard?.eligible_products || []);

    root.querySelector('[data-entitlement-rows]').innerHTML = (payload.entitlements || []).map(row => `<tr><td>${esc(row.title || row.product_id)}</td><td>${esc(row.status)}</td><td>${esc(row.source || '')}</td><td class="portal-code">${esc(row.order_id || '')}</td><td>${date(row.granted_at)}</td><td>${String(row.status).toLowerCase() === 'active' && !row.required_free ? `<button class="btn secondary portal-danger" type="button" data-revoke-entitlement="${esc(row.entitlement_id)}">Revoke</button>` : row.required_free ? '<span class="portal-badge">Required Free</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="6">No entitlements found.</td></tr>';

    root.querySelector('[data-order-rows]').innerHTML = (payload.orders || []).map(row => `<tr><td class="portal-code">${esc(row.order_id)}</td><td class="portal-code">${esc(row.paypal_capture_id || '')}</td><td>${esc(row.status)}</td><td>${money(row.total,row.currency)}</td><td>${date(row.created_at)}</td><td>${String(row.order_id || '').startsWith('manual_') && String(row.status || '').toLowerCase() !== 'removed' ? `<button class="btn secondary portal-danger" type="button" data-remove-manual-order="${esc(row.order_id)}">Remove Manual Purchase</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6">No orders found.</td></tr>';
  }

  root.querySelector('[data-customer-search-form]').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      currentCustomerEmail = String(new FormData(event.currentTarget).get('email') || '').trim();
      await loadCustomer(currentCustomerEmail);
      showOk('Customer account loaded.');
    } catch (error) { showError(error); }
  });

  root.querySelector('[data-admin-reconcile-form]').addEventListener('submit', async event => {
    event.preventDefault();
    if (!currentCustomerEmail) return showError(new Error('Load a customer account first.'));
    try {
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      data.email = currentCustomerEmail;
      const result = await request('admin-reconcile-purchase', data);
      showOk(`Purchase reconciled: ${result.order_id}.`);
      event.currentTarget.reset();
      await loadCustomer();
      await loadDashboard();
    } catch (error) { showError(error); }
  });

  root.querySelector('[data-entitlement-grant-form]').addEventListener('submit', async event => {
    event.preventDefault();
    if (!currentCustomerEmail) return showError(new Error('Load a customer account first.'));
    try {
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      data.email = currentCustomerEmail;
      await request('admin-entitlement-grant', data);
      showOk('Product granted to account.');
      await loadCustomer();
      await loadDashboard();
    } catch (error) { showError(error); }
  });

  root.querySelector('[data-manual-purchase-form]').addEventListener('submit', async event => {
    event.preventDefault();
    if (!currentCustomerEmail) return showError(new Error('Load a customer account first.'));
    try {
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      data.email = currentCustomerEmail;
      const result = await request('admin-manual-purchase-add', data);
      showOk(`Manual purchase added: ${result.order_id}.`);
      event.currentTarget.reset();
      await loadCustomer();
      await loadDashboard();
    } catch (error) { showError(error); }
  });

  root.querySelector('[data-entitlement-rows]').addEventListener('click', async event => {
    const button = event.target.closest('[data-revoke-entitlement]');
    if (!button) return;
    if (!confirm('Revoke this product from the customer library?')) return;
    try {
      await request('admin-entitlement-revoke', { entitlement_id:button.dataset.revokeEntitlement });
      showOk('Entitlement revoked.');
      await loadCustomer();
      await loadDashboard();
    } catch (error) { showError(error); }
  });

  root.querySelector('[data-order-rows]').addEventListener('click', async event => {
    const button = event.target.closest('[data-remove-manual-order]');
    if (!button) return;
    if (!confirm('Remove this portal-created manual purchase and revoke its attached entitlement?')) return;
    try {
      await request('admin-manual-purchase-remove', { order_id:button.dataset.removeManualOrder });
      showOk('Manual purchase removed.');
      await loadCustomer();
      await loadDashboard();
    } catch (error) { showError(error); }
  });

  async function loadLogs() {
    const payload = await request('admin-logs', { limit:200 });
    root.querySelector('[data-log-rows]').innerHTML = logRows(payload.logs);
  }
  root.querySelector('[data-refresh-logs]').addEventListener('click', () => loadLogs().catch(showError));

  /* Restore existing portal session without ever persisting the sheet password. */
  if (!apiUrl) {
    setMessage(loginStatus, 'The Living Word Bibles API is not configured.');
    return;
  }

  if (token()) {
    request('admin-session')
      .then(() => loadDashboard())
      .catch(() => showLogin());
  } else {
    showLogin();
  }
})();

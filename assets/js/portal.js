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
  let paypalGroups = [];
  let paypalPreview = [];
  let lastOrders = [];

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

  async function loadPortalVersions() {
    const el = root.querySelector('[data-portal-versions]');
    if (!el) return;
    try {
      const response = await fetch('/README.md', { cache:'no-store' });
      if (!response.ok) throw new Error('README unavailable');
      const text = await response.text();
      const front = text.match(/\|\s*Frontend package version\s*\|\s*`?v?([0-9]+(?:\.[0-9]+){2})`?\s*\|/i)?.[1]
        || text.match(/Frontend package v([0-9]+(?:\.[0-9]+){2})/i)?.[1];
      const back = text.match(/\|\s*(?:Google Apps Script|Backend) version\s*\|\s*`?v?([0-9]+(?:\.[0-9]+){2})`?\s*\|/i)?.[1]
        || text.match(/(?:Google Apps Script|Backend) v([0-9]+(?:\.[0-9]+){2})/i)?.[1];
      el.textContent = `Frontend ${front ? `v${front}` : '—'} | Backend ${back ? `v${back}` : '—'}`;
    } catch (_) {
      el.textContent = 'Frontend — | Backend —';
    }
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
    loadPortalVersions();
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
      if (name === 'orders') loadOrders().catch(showError);
      if (name === 'price-reconcile') loadPrintProducts().catch(showError);
      if (name === 'analytics') loadAnalytics().catch(showError);
      if (name === 'consent') loadConsent().catch(showError);
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


  /* Orders, PayPal Activity Report reconciliation, and Print Products */
  function csvRows(text) {
    const rows = [];
    let row = [], field = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') quoted = false;
        else field += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
      else field += ch;
    }
    if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
    if (!rows.length) return [];
    const headers = rows.shift().map(h => String(h || '').replace(/^\uFEFF/, '').trim());
    return rows.filter(r => r.some(v => String(v || '').trim())).map(r => {
      const out = {};
      headers.forEach((h, i) => { if (h) out[h] = r[i] ?? ''; });
      return out;
    });
  }

  const paypalKeepColumns = [
    'Date','Time','TimeZone','Name','Type','Status','Currency','Gross','Fee','Net',
    'From Email Address','To Email Address','Transaction ID','Shipping Address','Address Status',
    'Item Title','Item ID','Sales Tax','Reference Txn ID','Invoice Number','Quantity','Receipt ID',
    'Address Line 1','Address Line 2/District/Neighborhood','Town/City',
    'State/Province/Region/County/Territory/Prefecture/Republic','Zip/Postal Code','Country',
    'Payment Source','Transaction Event Code','Transaction Buyer Country Code','Country Code',
    'Balance Impact','Discount'
  ];

  function compactPayPalRow(row) {
    const out = {};
    paypalKeepColumns.forEach(key => { if (row[key] !== undefined && row[key] !== '') out[key] = row[key]; });
    return out;
  }

  function groupPayPalActivity(rows) {
    const map = new Map();
    rows.forEach((row, index) => {
      const tx = String(row['Transaction ID'] || '').trim();
      const key = tx || `missing_tx_${index}`;
      if (!map.has(key)) map.set(key, { transaction_id:tx, rows:[] });
      map.get(key).rows.push(compactPayPalRow(row));
    });
    return [...map.values()];
  }

  function mergeCounts(target, source) {
    Object.entries(source || {}).forEach(([key, value]) => { target[key] = Number(target[key] || 0) + Number(value || 0); });
    return target;
  }

  async function previewPayPalGroups(groups) {
    const all = [], counts = {};
    for (let i = 0; i < groups.length; i += 200) {
      const payload = await request('admin-paypal-preview', { groups:groups.slice(i, i + 200) });
      all.push(...(payload.transactions || []));
      mergeCounts(counts, payload.counts || {});
    }
    return { transactions:all, counts };
  }

  function resultLabel(value) {
    return ({ matched:'Existing / Matched', new:'Missing / New', unmatched_product:'Unmatched Product', ignored:'Ignored Non-Sale', financial_adjustment:'Refund / Reversal', unsupported:'Unsupported', created:'Created', updated:'Updated' })[value] || value || '—';
  }

  function renderPayPalPreview(payload) {
    paypalPreview = payload.transactions || [];
    const counts = payload.counts || {};
    root.querySelector('[data-paypal-summary]').innerHTML = `<div class="portal-grid" style="margin-top:14px">
      <article class="portal-card portal-stat"><strong>${esc(paypalGroups.reduce((n,g) => n + g.rows.length, 0))}</strong><span>PayPal Rows</span></article>
      <article class="portal-card portal-stat"><strong>${esc(paypalPreview.filter(r => ['matched','new','unmatched_product'].includes(r.result)).length)}</strong><span>Sales Identified</span></article>
      <article class="portal-card portal-stat"><strong>${esc(counts.matched || 0)}</strong><span>Existing Orders</span></article>
      <article class="portal-card portal-stat"><strong>${esc(counts.new || 0)}</strong><span>Missing Orders</span></article>
      <article class="portal-card portal-stat"><strong>${esc(counts.unmatched_product || 0)}</strong><span>Unmatched Products</span></article>
      <article class="portal-card portal-stat"><strong>${esc((counts.ignored || 0) + (counts.financial_adjustment || 0) + (counts.unsupported || 0))}</strong><span>Non-Sale / Review</span></article>
    </div>`;
    root.querySelector('[data-paypal-preview-rows]').innerHTML = paypalPreview.map(row => `<tr>
      <td class="portal-code">${esc(row.transaction_id || '')}</td>
      <td>${date(row.created_at)}</td>
      <td>${esc(row.buyer_name || '')}<br><span class="portal-meta">${esc(row.email || '')}</span></td>
      <td>${esc((row.products || []).map(p => p.title).join('; ') || (row.unmatched_products || []).join('; ') || '—')}</td>
      <td>${row.gross === undefined ? '—' : money(row.gross, row.currency)}</td>
      <td><span class="portal-badge">${esc(resultLabel(row.result))}</span>${row.reason ? `<br><span class="portal-meta">${esc(row.reason)}</span>` : ''}</td>
    </tr>`).join('') || '<tr><td colspan="6">No PayPal transaction groups found.</td></tr>';
    root.querySelector('[data-paypal-reconcile]').disabled = !paypalPreview.some(row => row.result === 'matched' || row.result === 'new');
  }

  async function readPayPalFile() {
    const input = root.querySelector('[data-paypal-activity-file]');
    const file = input?.files?.[0];
    if (!file) throw new Error('Choose a PayPal Activity Report CSV first.');
    if (file.size > 15 * 1024 * 1024) throw new Error('The PayPal Activity Report is larger than the 15 MB portal import limit.');
    const text = await file.text();
    const rows = csvRows(text);
    if (!rows.length || !Object.prototype.hasOwnProperty.call(rows[0], 'Transaction ID')) throw new Error('This does not look like a PayPal Activity Report CSV.');
    paypalGroups = groupPayPalActivity(rows);
    return paypalGroups;
  }

  root.querySelector('[data-paypal-preview]')?.addEventListener('click', async () => {
    const el = root.querySelector('[data-paypal-status]');
    try {
      setMessage(el, 'Reading and comparing PayPal Activity Report…', true);
      const groups = await readPayPalFile();
      const payload = await previewPayPalGroups(groups);
      renderPayPalPreview(payload);
      setMessage(el, `Preview complete: ${groups.length} PayPal transaction groups analyzed.`, true);
    } catch (error) { setMessage(el, error.message || String(error)); }
  });

  root.querySelector('[data-paypal-reconcile]')?.addEventListener('click', async () => {
    const el = root.querySelector('[data-paypal-status]');
    if (!paypalGroups.length) return setMessage(el, 'Preview a PayPal Activity Report first.');
    if (!confirm('Reconcile the previewed PayPal Activity Report into Orders and Order Items? Existing transactions will be updated rather than duplicated.')) return;
    const total = { processed:0, matched:0, created:0, updated:0, ignored:0, financial_adjustment:0, unmatched_product:0, unsupported:0 };
    try {
      root.querySelector('[data-paypal-reconcile]').disabled = true;
      for (let i = 0; i < paypalGroups.length; i += 100) {
        setMessage(el, `Reconciling transaction group ${i + 1}–${Math.min(i + 100, paypalGroups.length)} of ${paypalGroups.length}…`, true);
        const payload = await request('admin-paypal-reconcile', { groups:paypalGroups.slice(i, i + 100) });
        Object.entries(payload.summary || {}).forEach(([key, value]) => { total[key] = Number(total[key] || 0) + Number(value || 0); });
      }
      setMessage(el, `Reconciliation complete: ${total.created} created, ${total.updated} existing orders updated, ${total.unmatched_product} unmatched products, ${total.ignored + total.financial_adjustment + total.unsupported} non-sale/review groups.`, true);
      const payload = await previewPayPalGroups(paypalGroups);
      renderPayPalPreview(payload);
      await loadOrders();
      await loadDashboard();
    } catch (error) { setMessage(el, error.message || String(error)); }
    finally { root.querySelector('[data-paypal-reconcile]').disabled = false; }
  });

  function renderOrders(payload) {
    const summary = payload.summary || {};
    const currency = (payload.orders || []).find(o => o.currency)?.currency || 'USD';
    const stats = [
      ['Completed Orders', summary.completed_orders || 0],
      ['Gross Sales', money(summary.gross_sales || 0, currency)],
      ['PayPal Fees', money(summary.paypal_fees || 0, currency)],
      ['Net Sales*', money(summary.net_sales || 0, currency)],
      ['Units Sold', summary.units_sold || 0],
      ['Average Order', money(summary.average_order_value || 0, currency)]
    ];
    root.querySelector('[data-order-stats]').innerHTML = stats.map(([label,value]) => `<article class="portal-card portal-stat"><strong>${esc(value)}</strong><span>${esc(label)}</span></article>`).join('');
    root.querySelector('[data-orders-products]').innerHTML = (payload.products || []).map(row => `<tr><td>${esc(row.title || row.product_id)}</td><td>${esc(row.orders || 0)}</td><td>${esc(row.units || 0)}</td><td>${money(row.gross || 0,currency)}</td><td>${money(row.net || 0,currency)}</td></tr>`).join('') || '<tr><td colspan="5">No product sales found for this range.</td></tr>';
    const productSelect = root.querySelector('[data-orders-product]');
    if (productSelect && productSelect.options.length <= 1) productSelect.insertAdjacentHTML('beforeend', (payload.product_options || []).map(p => `<option value="${esc(p.product_id)}">${esc(p.title || p.product_id)}</option>`).join(''));
    lastOrders = payload.orders || [];
    root.querySelector('[data-orders-rows]').innerHTML = lastOrders.map((row,index) => `<tr>
      <td>${date(row.created_at)}</td><td>${esc(row.buyer_name || '—')}<br><span class="portal-meta">${esc(row.email || '')}</span></td>
      <td class="portal-code">${esc(row.paypal_capture_id || '')}</td><td>${esc((row.products || []).map(p => p.title).join('; ') || '—')}</td>
      <td><span class="portal-badge">${esc(row.status || '')}</span></td><td>${money(row.total,row.currency)}</td><td>${row.raw_event_id ? money(Math.abs(Number(row.fee || 0)),row.currency) : '—'}</td><td>${row.net === null ? '—' : money(row.net,row.currency)}</td>
      <td>${esc([row.city,row.region,row.payer_country].filter(Boolean).join(', ') || '—')}</td><td><button class="btn secondary" type="button" data-order-detail-index="${index}">View</button></td>
    </tr>`).join('') || '<tr><td colspan="10">No orders found.</td></tr>';
  }

  async function loadOrders() {
    const payload = await request('admin-orders', {
      query:root.querySelector('[data-orders-search]')?.value || '',
      days:Number(root.querySelector('[data-orders-range]')?.value || 0),
      status:root.querySelector('[data-orders-status]')?.value || '',
      product_id:root.querySelector('[data-orders-product]')?.value || ''
    });
    renderOrders(payload);
  }

  root.querySelector('[data-refresh-orders]')?.addEventListener('click', () => loadOrders().catch(showError));
  root.querySelector('[data-orders-apply]')?.addEventListener('click', () => loadOrders().catch(showError));
  root.querySelector('[data-orders-search]')?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); loadOrders().catch(showError); } });
  root.querySelector('[data-orders-rows]')?.addEventListener('click', event => {
    const button = event.target.closest('[data-order-detail-index]');
    if (!button) return;
    const row = lastOrders[Number(button.dataset.orderDetailIndex)];
    if (!row) return;
    root.querySelector('[data-order-detail-body]').innerHTML = `<dl class="account-details">
      <dt>Order</dt><dd class="portal-code">${esc(row.order_id)}</dd><dt>PayPal Transaction</dt><dd class="portal-code">${esc(row.paypal_capture_id || '—')}</dd><dt>Buyer</dt><dd>${esc(row.buyer_name || '—')}</dd><dt>Email</dt><dd>${esc(row.email || '—')}</dd><dt>Status</dt><dd>${esc(row.status || '—')}</dd><dt>Total</dt><dd>${money(row.total,row.currency)}</dd><dt>PayPal Fee</dt><dd>${row.raw_event_id ? money(Math.abs(Number(row.fee || 0)),row.currency) : '—'}</dd><dt>Net</dt><dd>${row.net === null ? '—' : money(row.net,row.currency)}</dd><dt>Products</dt><dd>${esc((row.products || []).map(p => `${p.title} × ${p.quantity}`).join('; ') || '—')}</dd><dt>Country</dt><dd>${esc(row.payer_country || '—')}</dd><dt>Address</dt><dd>${esc([row.address_1,row.address_2,row.city,row.region,row.postal_code,row.payer_country].filter(Boolean).join(', ') || '—')}</dd><dt>Raw Event</dt><dd class="portal-code">${esc(row.raw_event_id || '—')}</dd></dl>`;
    root.querySelector('[data-order-detail]').hidden = false;
    root.querySelector('[data-order-detail]').scrollIntoView({behavior:'smooth',block:'nearest'});
  });
  root.querySelector('[data-order-detail-close]')?.addEventListener('click', () => { root.querySelector('[data-order-detail]').hidden = true; });

  function isoDate(value) {
    if (!value) return '';
    const m = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0,10);
  }

  function renderPrintProducts(products) {
    root.querySelector('[data-print-product-rows]').innerHTML = (products || []).map(row => `<tr data-print-product-id="${esc(row.print_product_id)}">
      <td>${esc(row.product_name || '')}<br><span class="portal-meta">${esc(row.site_page || '')}</span></td><td>${esc(row.product_format || '')}</td><td>${esc(row.category || '')}</td><td class="portal-code">${esc(row.asin || '')}</td>
      <td>${row.amazon_direct_url ? `<a class="btn secondary" href="${esc(row.amazon_direct_url)}" target="_blank" rel="noopener noreferrer">Open Direct</a>` : '—'}</td><td><span class="portal-code">${esc(row.amazon_associate_url || '—')}</span></td>
      <td><input type="number" min="0" step="0.01" value="${esc(Number(row.current_price || 0).toFixed(2))}" data-print-price aria-label="Current price for ${esc(row.product_name || row.print_product_id)}"></td>
      <td><input type="date" value="${esc(isoDate(row.price_observed_date))}" data-print-date aria-label="Observed date for ${esc(row.product_name || row.print_product_id)}"></td>
      <td><button class="btn" type="button" data-save-print-product>Save</button></td>
    </tr>`).join('') || '<tr><td colspan="9">No Print Products rows found.</td></tr>';
  }

  async function loadPrintProducts() {
    const payload = await request('admin-print-products');
    renderPrintProducts(payload.products || []);
  }

  root.querySelector('[data-refresh-print-products]')?.addEventListener('click', () => loadPrintProducts().catch(showError));
  root.querySelector('[data-print-product-rows]')?.addEventListener('click', async event => {
    const button = event.target.closest('[data-save-print-product]');
    if (!button) return;
    const tr = button.closest('[data-print-product-id]');
    try {
      button.disabled = true;
      await request('admin-print-product-update', {
        print_product_id:tr.dataset.printProductId,
        current_price:tr.querySelector('[data-print-price]').value,
        price_observed_date:tr.querySelector('[data-print-date]').value
      });
      showOk('Print product price and observed date updated.');
      await loadPrintProducts();
    } catch (error) { showError(error); }
    finally { button.disabled = false; }
  });


  function rankRows(items, emptyLabel) {
    return (items || []).map(item =>
      `<tr><td>${esc(item.label || '—')}</td><td>${esc(item.count || 0)}</td></tr>`
    ).join('') || `<tr><td colspan="2">${esc(emptyLabel || 'No data available.')}</td></tr>`;
  }

  function renderAnalytics(payload) {
    const summary = payload.summary || {};
    const stats = [
      ['Visitors', summary.visitors || 0],
      ['Sessions', summary.sessions || 0],
      ['Pageviews', summary.pageviews || 0],
      ['Clicks', summary.clicks || 0],
      ['Views / Visitor', summary.pageviews_per_visitor || 0],
      ['Views / Session', summary.pageviews_per_session || 0]
    ];

    root.querySelector('[data-analytics-stats]').innerHTML = stats.map(([label, value]) =>
      `<article class="portal-card portal-stat"><strong>${esc(value)}</strong><span>${esc(label)}</span></article>`
    ).join('');

    root.querySelector('[data-analytics-countries]').innerHTML = rankRows(payload.countries, 'No country data yet.');
    root.querySelector('[data-analytics-regions]').innerHTML = rankRows(payload.regions, 'No region/state data yet.');
    root.querySelector('[data-analytics-pages]').innerHTML = rankRows(payload.top_pages, 'No pageview data yet.');
    root.querySelector('[data-analytics-landings]').innerHTML = rankRows(payload.landing_pages, 'No landing-page data yet.');
    root.querySelector('[data-analytics-referrers]').innerHTML = rankRows(payload.referrers, 'No referrer data yet.');
    root.querySelector('[data-analytics-devices]').innerHTML = rankRows(payload.devices, 'No device data yet.');
    root.querySelector('[data-analytics-browsers]').innerHTML = rankRows(payload.browsers, 'No browser data yet.');
    root.querySelector('[data-analytics-os]').innerHTML = rankRows(payload.operating_systems, 'No operating-system data yet.');

    root.querySelector('[data-analytics-recent]').innerHTML = (payload.recent_activity || []).map(row => {
      const meta = row.metadata || {};
      return `<tr>
        <td>${date(row.timestamp)}</td>
        <td>${esc(row.event || '')}</td>
        <td class="portal-code">${esc(row.path || meta.path || '')}</td>
        <td>${esc(meta.country_name || meta.country_code || '')}</td>
        <td>${esc(meta.device_type || '')}</td>
        <td>${esc(meta.browser || '')}</td>
        <td class="portal-code">${esc(meta.visitor_id || '')}</td>
        <td class="portal-code">${esc(meta.session_id || '')}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="8">No consented analytics activity found for this range.</td></tr>';
  }

  async function loadAnalytics() {
    const days = Number(root.querySelector('[data-analytics-range]')?.value || 0);
    const payload = await request('admin-analytics', { days });
    renderAnalytics(payload);
  }

  function consentStatus(row) {
    const event = String(row.event || '').toUpperCase();
    const meta = row.metadata || {};

    if (event === 'EU_EEA_DIGITAL_CONSENT') return 'Consented';
    if (event === 'EU_EEA_DIGITAL_CONSENT_WITHDRAWN') return 'Withdrawn';
    if (event === 'EU_EEA_CONSENT_EMAIL_SENT') return 'Confirmation Email Sent';
    if (event === 'EU_EEA_CONSENT_EMAIL_FAILED') return 'Confirmation Email Failed';
    if (event === 'PRIVACY_CONSENT') return row.message || 'Privacy Choice Recorded';
    if (event === 'PRIVACY_CONSENT_WITHDRAWN') return row.message || 'Optional Consent Withdrawn';
    if (event === 'PRIVACY_PREFERENCES_UPDATED') return row.message || 'Preferences Updated';
    return row.message || '';
  }

  function yesNo(value) {
    if (value === true) return 'Accepted';
    if (value === false) return 'Rejected';
    return '—';
  }

  function renderConsent(payload) {
    root.querySelector('[data-consent-rows]').innerHTML = (payload.logs || []).map(row => {
      const meta = row.metadata || {};
      const productOrPage =
        meta.product_title ||
        meta.product_slug ||
        meta.path ||
        row.message ||
        '';
      const country = meta.country_name || meta.country_code || meta.payer_country || '';
      return `<tr>
        <td>${date(row.timestamp)}</td>
        <td>${esc(row.event || '')}</td>
        <td>${esc(consentStatus(row))}</td>
        <td>${yesNo(meta.analytics)}</td>
        <td>${yesNo(meta.advertising)}</td>
        <td>${esc(country)}</td>
        <td>${esc(productOrPage)}</td>
        <td>${esc(row.email || '')}</td>
        <td class="portal-code">${esc(row.record_id || '')}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="9">No consent records found.</td></tr>';
  }

  async function loadConsent() {
    const payload = await request('admin-consent', { limit:500 });
    renderConsent(payload);
  }

  root.querySelector('[data-refresh-analytics]')?.addEventListener('click', () => loadAnalytics().catch(showError));
  root.querySelector('[data-analytics-range]')?.addEventListener('change', () => loadAnalytics().catch(showError));
  root.querySelector('[data-refresh-consent]')?.addEventListener('click', () => loadConsent().catch(showError));

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

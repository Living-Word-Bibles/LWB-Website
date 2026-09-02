(() => {
  'use strict';

  const target = document.querySelector('[data-lumiere-library]');
  if (!target) return;

  const SESSION_KEY = 'lwbAccountSession';
  const API = () => String(window.LWB_SITE_CONFIG?.apiBase || '').trim();

  const safe = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[ch]);

  const token = () => {
    try { return localStorage.getItem(SESSION_KEY) || ''; } catch (_) { return ''; }
  };

  async function post(payload) {
    const api = API();
    if (!api) throw new Error('The Living Word Bibles account service is not configured.');
    const response = await fetch(api, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify(payload),
      redirect:'follow'
    });
    if (!response.ok) throw new Error('The account service could not be reached.');
    return response.json();
  }

  function formatLabel(item) {
    return String(item?.product_type || '').toLowerCase() === 'pdf' ? 'PDF' : 'eBible';
  }

  function card(item) {
    const title = safe(item.title || item.short_title || 'Digital Bible');
    const slug = encodeURIComponent(String(item.slug || item.product_id || ''));
    const cover = safe(item.cover_path || '/assets/LivingWordBibles01.png');
    const download = String(item.download_url || '');
    const downloadButton = download
      ? `<a class="btn secondary" href="${safe(download)}">Download</a>`
      : '';

    return `<article class="lumiere-account-card">
      <div class="lumiere-account-cover"><img src="${cover}" alt="Cover of ${title}" loading="lazy"></div>
      <div class="lumiere-account-body">
        <h3>${title}</h3>
        <p class="lumiere-format">${safe(formatLabel(item))}</p>
        <div class="lumiere-account-actions">
          <a class="btn" href="/lumiere/?book=${slug}">Read Online</a>
          ${downloadButton}
        </div>
      </div>
    </article>`;
  }

  async function load() {
    const session = token();
    if (!session) {
      target.innerHTML = '<div class="lumiere-library-message"><strong>Sign in to view your library.</strong><br><a href="/login/">Go to Login</a></div>';
      return;
    }

    try {
      const payload = await post({action:'account', token:session, userAgent:navigator.userAgent});
      if (!payload?.ok) throw new Error(payload?.error || 'Your library could not be loaded.');

      const emailNode = document.querySelector('[data-account-email]');
      if (emailNode && payload.user?.email) emailNode.textContent = payload.user.email;

      const library = Array.isArray(payload.library) ? payload.library : [];
      if (!library.length) {
        target.innerHTML = '<div class="lumiere-library-message">No eligible digital Bible titles are currently attached to this account. Use Reconcile Purchase(s) if you have an eligible PayPal purchase that is not showing.</div>';
        return;
      }

      target.innerHTML = `<div class="lumiere-account-grid">${library.map(card).join('')}</div>`;
    } catch (error) {
      target.innerHTML = `<div class="lumiere-library-message"><strong>Library unavailable.</strong><br>${safe(error?.message || 'Please sign in again and retry.')}</div>`;
    }
  }

  // auth.js still owns normal account/sign-out behavior. This reader view is a
  // separate visible container, so its render cannot be overwritten by auth.js.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load, {once:true});
  } else {
    load();
  }
})();
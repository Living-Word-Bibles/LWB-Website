(() => {
  'use strict';

  const shell = document.querySelector('#reader-shell');
  if (!shell) return;

  const SESSION_KEY = 'lwbAccountSession';
  const params = new URLSearchParams(location.search);
  const book = String(params.get('book') || '').trim();
  let manifest = null;
  let chapterIndex = 0;
  let theme = 'light';
  let scale = 1;

  const safe = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[ch]);

  const sessionToken = () => {
    try { return localStorage.getItem(SESSION_KEY) || ''; } catch (_) { return ''; }
  };

  const apiBase = () => String(window.LWB_SITE_CONFIG?.apiBase || '').trim();
  const storageKey = () => `lwbLumiereState:${book}`;

  function readState() {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey()) || 'null');
      if (!value || typeof value !== 'object') return;
      theme = ['light','sepia','dark'].includes(value.theme) ? value.theme : 'light';
      scale = Math.min(1.45, Math.max(.8, Number(value.scale || 1)));
      if (Number.isInteger(value.chapterIndex)) chapterIndex = Math.max(0, value.chapterIndex);
    } catch (_) {}
  }

  function writeState() {
    try { localStorage.setItem(storageKey(), JSON.stringify({theme, scale, chapterIndex, updatedAt:Date.now()})); } catch (_) {}
  }

  async function post(action, extra = {}) {
    const api = apiBase();
    if (!api) throw new Error('The Living Word Bibles reader service is not configured.');
    const token = sessionToken();
    if (!token) throw new Error('Please sign in to your Living Word Bibles account.');

    const response = await fetch(api, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify(Object.assign({action, token, product:book, userAgent:navigator.userAgent}, extra)),
      redirect:'follow'
    });
    if (!response.ok) throw new Error('The reader service could not be reached.');
    return response.json();
  }

  function copyrightLine() {
    return `Copyright © <span data-vmh-year></span> | <a href="https://www.valoismedia.com" target="_blank" rel="noopener noreferrer">Valois Media Holdings</a> | All Rights Reserved`;
  }

  function setYear() {
    const node = shell.querySelector('[data-vmh-year]');
    if (node) node.textContent = String(new Date().getFullYear());
  }

  function brandBar() {
    return `<div class="lwb-lumiere-brandbar">
      <div class="lwb-lumiere-brandlogos">
        <a href="https://www.valoismedia.com" target="_blank" rel="noopener noreferrer" aria-label="Visit Valois Media Holdings"><img class="lwb-lumiere-vmh" src="https://www.valoismedia.com/assets/VMHLogo01.png" alt="Valois Media Holdings"></a>
        <a href="https://www.valoismedia.com" target="_blank" rel="noopener noreferrer" aria-label="Visit Valois Media for Valois Lumière"><img class="lwb-lumiere-logo" src="https://www.valoismedia.com/assets/Lumiere01.png" alt="Valois Lumière"></a>
      </div>
      <a class="lwb-lumiere-library-link" href="/account/library/">← My Library</a>
    </div>`;
  }

  function emptyState(title, message, actionHref = '/account/library/', actionText = 'Return to My Library') {
    shell.className = 'lwb-lumiere-shell';
    shell.innerHTML = `${brandBar()}<div class="lwb-reader-empty"><div class="lwb-reader-empty-inner"><h1>${safe(title)}</h1><p>${safe(message)}</p><a class="btn" href="${safe(actionHref)}">${safe(actionText)}</a></div></div><div class="lwb-lumiere-copyright">${copyrightLine()}</div>`;
    setYear();
  }

  function applyAppearance() {
    shell.classList.remove('theme-sepia','theme-dark');
    if (theme !== 'light') shell.classList.add(`theme-${theme}`);
    shell.style.setProperty('--reader-scale', String(scale));
    shell.querySelectorAll('[data-theme]').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.theme === theme)));
  }

  function epubShell(reader) {
    const options = (reader.spine || []).map((item, i) => `<option value="${i}">${safe(item.title || `Section ${i + 1}`)}</option>`).join('');
    shell.className = 'lwb-lumiere-shell';
    shell.innerHTML = `${brandBar()}
      <div class="lwb-reader-toolbar" role="toolbar" aria-label="Reader controls">
        <strong class="lwb-reader-title">${safe(reader.title || 'Digital Bible')}</strong>
        <button type="button" data-prev aria-label="Previous section">Previous</button>
        <button type="button" data-next aria-label="Next section">Next</button>
        <select class="lwb-reader-select" data-section aria-label="Choose section">${options}</select>
        <button type="button" data-font-down aria-label="Decrease text size">A−</button>
        <button type="button" data-font-up aria-label="Increase text size">A+</button>
        <button type="button" data-theme="light" aria-pressed="false">Light</button>
        <button type="button" data-theme="sepia" aria-pressed="false">Sepia</button>
        <button type="button" data-theme="dark" aria-pressed="false">Dark</button>
      </div>
      <div class="lwb-reader-stage"><article class="lwb-reader-content" data-reader-content tabindex="-1"></article></div>
      <div class="lwb-lumiere-copyright">${copyrightLine()}</div>`;
    setYear();
    applyAppearance();

    shell.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.matches('[data-prev]')) loadChapter(Math.max(0, chapterIndex - 1));
      if (target.matches('[data-next]')) loadChapter(Math.min((manifest.spine?.length || 1) - 1, chapterIndex + 1));
      if (target.matches('[data-font-down]')) { scale = Math.max(.8, +(scale - .08).toFixed(2)); applyAppearance(); writeState(); }
      if (target.matches('[data-font-up]')) { scale = Math.min(1.45, +(scale + .08).toFixed(2)); applyAppearance(); writeState(); }
      if (target.dataset.theme) { theme = target.dataset.theme; applyAppearance(); writeState(); }
    });

    shell.querySelector('[data-section]')?.addEventListener('change', event => loadChapter(Number(event.target.value || 0)));
  }

  async function loadChapter(nextIndex) {
    if (!manifest?.spine?.length) return;
    const bounded = Math.max(0, Math.min(manifest.spine.length - 1, Number(nextIndex || 0)));
    const item = manifest.spine[bounded];
    const content = shell.querySelector('[data-reader-content]');
    if (!content) return;

    content.innerHTML = '<p><strong>Loading…</strong></p>';
    try {
      const payload = await post('reader-chapter', {chapter:item.id});
      if (!payload?.ok) throw new Error(payload?.error || 'This section could not be loaded.');
      const chapter = payload.chapter || payload.data || {};
      content.innerHTML = chapter.html || '<p>This section is empty.</p>';
      chapterIndex = bounded;
      const select = shell.querySelector('[data-section]');
      if (select) select.value = String(chapterIndex);
      const prev = shell.querySelector('[data-prev]');
      const next = shell.querySelector('[data-next]');
      if (prev) prev.disabled = chapterIndex <= 0;
      if (next) next.disabled = chapterIndex >= manifest.spine.length - 1;
      writeState();
      content.focus({preventScroll:true});
      content.scrollIntoView({behavior:'smooth', block:'start'});
    } catch (error) {
      content.innerHTML = `<p><strong>Reader error:</strong> ${safe(error?.message || 'This section could not be loaded.')}</p>`;
    }
  }

  function pdfShell(reader) {
    const source = String(reader.source_url || '');
    shell.className = 'lwb-lumiere-shell';
    shell.innerHTML = `${brandBar()}
      <div class="lwb-reader-toolbar"><strong class="lwb-reader-title">${safe(reader.title || 'PDF')}</strong><a class="lwb-lumiere-library-link" href="${safe(source)}" target="_blank" rel="noopener noreferrer">Open PDF in New Tab</a></div>
      <div class="lwb-reader-stage"><iframe class="lwb-reader-pdf" title="${safe(reader.title || 'PDF reader')}" src="${safe(source)}#view=FitH" loading="eager"></iframe></div>
      <div class="lwb-lumiere-copyright">${copyrightLine()}</div>`;
    setYear();
  }

  async function initialize() {
    if (!book) {
      emptyState('Valois Lumière is ready.', 'Open a title from your Living Word Bibles Library to begin reading.');
      return;
    }
    if (!sessionToken()) {
      emptyState('Sign in to read this title.', 'Valois Lumière verifies your Living Word Bibles entitlement before opening a title.', '/login/', 'Sign In');
      return;
    }

    try {
      readState();
      emptyState('Preparing Valois Lumière…', 'Verifying your Living Word Bibles library access and preparing this title.');
      const payload = await post('reader-manifest');
      if (!payload?.ok) throw new Error(payload?.error || 'Reader access could not be verified.');
      manifest = payload.reader || payload.data || {};

      if (manifest.format === 'pdf') {
        if (!manifest.source_url) throw new Error('The PDF source is unavailable.');
        pdfShell(manifest);
        return;
      }

      if (manifest.format !== 'epub' || !Array.isArray(manifest.spine) || !manifest.spine.length) {
        throw new Error('This eBible does not contain readable sections.');
      }

      chapterIndex = Math.min(manifest.spine.length - 1, Math.max(0, chapterIndex));
      epubShell(manifest);
      await loadChapter(chapterIndex);
    } catch (error) {
      emptyState('Valois Lumière could not open this title.', error?.message || 'Reader access is temporarily unavailable.');
    }
  }

  initialize();
})();
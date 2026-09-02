(() => {
  'use strict';

  const shell = document.querySelector('#reader-shell');
  if (!shell) return;

  const SESSION_KEY = 'lwbAccountSession';
  const params = new URLSearchParams(location.search);
  const productKey = String(params.get('book') || '').trim();

  let readerMeta = null;
  let epubBook = null;
  let rendition = null;
  let tocItems = [];
  let theme = 'light';
  let fontPercent = 100;
  let savedCfi = '';
  let touchStartX = 0;

  const safe = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[ch]);

  const sessionToken = () => {
    try { return localStorage.getItem(SESSION_KEY) || ''; } catch (_) { return ''; }
  };

  const apiBase = () => String(window.LWB_SITE_CONFIG?.apiBase || '').trim();
  const storageKey = () => `lwbLumiereState:${productKey}`;

  function timeoutPromise(promise, ms, message) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  function normalizeRepositorySource(value) {
    const source = String(value || '').trim();
    if (!source) return '';
    try {
      const url = new URL(source, location.href);
      const host = url.hostname.toLowerCase();
      if (host === 'www.livingwordbibles.com' || host === 'livingwordbibles.com') {
        return url.pathname + url.search + url.hash;
      }
      return url.href;
    } catch (_) {
      return source;
    }
  }

  async function fetchEpubBytes(source) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(source, {
        method:'GET',
        credentials:'same-origin',
        cache:'no-store',
        redirect:'follow',
        signal:controller.signal
      });
      if (!response.ok) {
        throw new Error(`The eBible file could not be loaded (HTTP ${response.status}).`);
      }

      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('text/html')) {
        throw new Error('The eBible URL returned a web page instead of the EPUB file.');
      }

      const bytes = await response.arrayBuffer();
      if (!bytes || bytes.byteLength < 4) {
        throw new Error('The eBible download was empty.');
      }

      const signature = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength));
      if (signature[0] !== 0x50 || signature[1] !== 0x4b) {
        throw new Error('The eBible URL did not return EPUB/ZIP data.');
      }
      return bytes;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error('The eBible download timed out.');
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function readState() {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey()) || 'null');
      if (!value || typeof value !== 'object') return;
      theme = ['light','sepia','dark'].includes(value.theme) ? value.theme : 'light';
      fontPercent = Math.min(145, Math.max(80, Number(value.fontPercent || 100)));
      savedCfi = String(value.cfi || '');
    } catch (_) {}
  }

  function writeState() {
    try {
      localStorage.setItem(storageKey(), JSON.stringify({
        theme,
        fontPercent,
        cfi:savedCfi,
        updatedAt:Date.now()
      }));
    } catch (_) {}
  }

  async function authorizeReader() {
    const api = apiBase();
    if (!api) throw new Error('The Living Word Bibles reader service is not configured.');
    const token = sessionToken();
    if (!token) throw new Error('Please sign in to your Living Word Bibles account.');

    const response = await fetch(api, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({
        action:'reader-manifest',
        token,
        product:productKey,
        userAgent:navigator.userAgent
      }),
      redirect:'follow'
    });

    if (!response.ok) throw new Error('The reader service could not be reached.');
    const payload = await response.json();
    if (!payload?.ok) throw new Error(payload?.error || 'Reader access could not be verified.');
    return payload.reader || payload.data || {};
  }

  function copyrightLine() {
    return `Copyright © <span data-vmh-year></span> | <a href="https://www.valoismedia.com" target="_blank" rel="noopener noreferrer">Valois Media Holdings</a> | All Rights Reserved`;
  }

  function setYear() {
    shell.querySelectorAll('[data-vmh-year]').forEach(node => {
      node.textContent = String(new Date().getFullYear());
    });
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
    destroyEpub();
    shell.className = 'lwb-lumiere-shell';
    shell.innerHTML = `${brandBar()}<div class="lwb-reader-empty"><div class="lwb-reader-empty-inner"><h1>${safe(title)}</h1><p>${safe(message)}</p><a class="btn" href="${safe(actionHref)}">${safe(actionText)}</a></div></div><div class="lwb-lumiere-copyright">${copyrightLine()}</div>`;
    setYear();
  }

  function destroyEpub() {
    try { if (rendition) rendition.destroy(); } catch (_) {}
    try { if (epubBook) epubBook.destroy(); } catch (_) {}
    rendition = null;
    epubBook = null;
    tocItems = [];
  }

  function applyShellTheme() {
    shell.classList.remove('theme-sepia','theme-dark');
    if (theme !== 'light') shell.classList.add(`theme-${theme}`);
    shell.querySelectorAll('[data-theme]').forEach(btn => {
      btn.setAttribute('aria-pressed', String(btn.dataset.theme === theme));
    });
  }

  function applyEpubAppearance() {
    applyShellTheme();
    if (!rendition) return;

    try {
      rendition.themes.select(theme);
      rendition.themes.fontSize(`${fontPercent}%`);
    } catch (_) {}
  }

  function registerEpubThemes() {
    if (!rendition) return;

    rendition.themes.register('light', {
      body: {
        background: '#fbf7ed !important',
        color: '#1d242b !important',
        'font-family': "Georgia, 'Times New Roman', serif !important",
        'line-height': '1.7 !important'
      },
      a: { color: '#174f7a !important' },
      img: { 'max-width': '100% !important', height: 'auto !important' }
    });

    rendition.themes.register('sepia', {
      body: {
        background: '#efe4c9 !important',
        color: '#352d22 !important',
        'font-family': "Georgia, 'Times New Roman', serif !important",
        'line-height': '1.7 !important'
      },
      a: { color: '#65491f !important' },
      img: { 'max-width': '100% !important', height: 'auto !important' }
    });

    rendition.themes.register('dark', {
      body: {
        background: '#151a20 !important',
        color: '#edf1f4 !important',
        'font-family': "Georgia, 'Times New Roman', serif !important",
        'line-height': '1.7 !important'
      },
      a: { color: '#a9d5ff !important' },
      img: { 'max-width': '100% !important', height: 'auto !important' }
    });
  }

  function flattenToc(items, depth = 0, output = []) {
    (Array.isArray(items) ? items : []).forEach(item => {
      output.push({
        href:String(item?.href || ''),
        label:`${depth ? '— '.repeat(Math.min(depth, 3)) : ''}${String(item?.label || 'Section').trim()}`
      });
      if (Array.isArray(item?.subitems) && item.subitems.length) {
        flattenToc(item.subitems, depth + 1, output);
      }
    });
    return output;
  }

  function populateToc(items) {
    tocItems = flattenToc(items);
    const select = shell.querySelector('[data-section]');
    if (!select) return;

    if (!tocItems.length) {
      select.innerHTML = '<option value="">Contents unavailable</option>';
      select.disabled = true;
      return;
    }

    select.disabled = false;
    select.innerHTML = '<option value="">Contents</option>' + tocItems.map(item =>
      `<option value="${safe(item.href)}">${safe(item.label)}</option>`
    ).join('');
  }

  function syncToc(locationData) {
    const href = String(locationData?.start?.href || '').split('#')[0];
    if (!href) return;
    const match = tocItems.find(item => String(item.href || '').split('#')[0] === href);
    const select = shell.querySelector('[data-section]');
    if (match && select) select.value = match.href;
  }

  function epubShell(reader) {
    shell.className = 'lwb-lumiere-shell';
    shell.innerHTML = `${brandBar()}
      <div class="lwb-reader-toolbar" role="toolbar" aria-label="Reader controls">
        <strong class="lwb-reader-title" data-reader-title>${safe(reader.title || 'Digital Bible')}</strong>
        <button type="button" data-prev aria-label="Previous page">Previous</button>
        <button type="button" data-next aria-label="Next page">Next</button>
        <select class="lwb-reader-select" data-section aria-label="Choose section"><option value="">Loading contents…</option></select>
        <button type="button" data-font-down aria-label="Decrease text size">A−</button>
        <button type="button" data-font-up aria-label="Increase text size">A+</button>
        <button type="button" data-theme="light" aria-pressed="false">Light</button>
        <button type="button" data-theme="sepia" aria-pressed="false">Sepia</button>
        <button type="button" data-theme="dark" aria-pressed="false">Dark</button>
      </div>
      <div class="lwb-reader-stage"><div id="epub-viewer" class="lwb-epub-viewer" aria-label="${safe(reader.title || 'eBible reader')}"><div class="lwb-reader-loading" data-reader-loading>Opening eBible…</div></div></div>
      <div class="lwb-lumiere-copyright">${copyrightLine()}</div>`;
    setYear();
    applyShellTheme();

    shell.querySelector('[data-prev]')?.addEventListener('click', () => rendition?.prev());
    shell.querySelector('[data-next]')?.addEventListener('click', () => rendition?.next());
    shell.querySelector('[data-font-down]')?.addEventListener('click', () => {
      fontPercent = Math.max(80, fontPercent - 8);
      applyEpubAppearance();
      writeState();
    });
    shell.querySelector('[data-font-up]')?.addEventListener('click', () => {
      fontPercent = Math.min(145, fontPercent + 8);
      applyEpubAppearance();
      writeState();
    });
    shell.querySelectorAll('[data-theme]').forEach(btn => {
      btn.addEventListener('click', () => {
        theme = btn.dataset.theme || 'light';
        applyEpubAppearance();
        writeState();
      });
    });
    shell.querySelector('[data-section]')?.addEventListener('change', event => {
      const href = String(event.target.value || '');
      if (href && rendition) rendition.display(href).catch(showInlineReaderError);
    });

    const viewer = shell.querySelector('#epub-viewer');
    viewer?.addEventListener('touchstart', event => {
      touchStartX = Number(event.touches?.[0]?.clientX || 0);
    }, {passive:true});
    viewer?.addEventListener('touchend', event => {
      const endX = Number(event.changedTouches?.[0]?.clientX || 0);
      const delta = endX - touchStartX;
      if (Math.abs(delta) < 55 || !rendition) return;
      if (delta < 0) rendition.next();
      else rendition.prev();
    }, {passive:true});
  }

  function showInlineReaderError(error) {
    console.error('Valois Lumière reader error:', error);
  }

  function setEpubLoading(message) {
    const viewer = shell.querySelector('#epub-viewer');
    if (!viewer) return;
    viewer.innerHTML = `<div class="lwb-reader-loading" data-reader-loading>${safe(message || 'Opening eBible…')}</div>`;
  }

  async function openEpub(reader) {
    if (typeof window.ePub !== 'function' || typeof window.JSZip !== 'function') {
      throw new Error('Valois Lumière reader libraries did not load. Refresh the page and try again.');
    }

    const source = normalizeRepositorySource(reader.source_url);
    if (!source) throw new Error('The repository EPUB source is unavailable.');
    if (!/\.epub(?:$|[?#])/i.test(source)) throw new Error('The authorized repository file is not an EPUB.');

    epubShell(reader);
    setEpubLoading('Downloading eBible…');

    // Fetch the original GitHub Pages-hosted EPUB as binary data ourselves.
    // This prevents EPUB.js request/constructor failures from becoming unresolved
    // loading promises and lets us verify that the URL really returned ZIP data.
    const epubBytes = await fetchEpubBytes(source);

    setEpubLoading('Opening eBible…');

    // EPUB.js documents Book.open() as accepting an ArrayBuffer. Opening the
    // already-fetched bytes explicitly avoids the constructor ambiguity that can
    // occur when an archived EPUB URL fails internally.
    epubBook = window.ePub({ replacements:'blobUrl' });
    epubBook.on('openFailed', showInlineReaderError);

    await timeoutPromise(
      epubBook.open(epubBytes, 'epub'),
      30000,
      'Valois Lumière timed out while opening this EPUB.'
    );

    const viewer = shell.querySelector('#epub-viewer');
    if (!viewer) throw new Error('The Valois Lumière reading area is unavailable.');

    // IMPORTANT: remove the loading element before EPUB.js renders into this
    // container. Leaving it here creates a full-height first child that can make
    // the reader look permanently stuck on "Opening eBible…" even after render.
    viewer.replaceChildren();

    rendition = epubBook.renderTo(viewer, {
      width:'100%',
      height:'100%',
      spread:'none',
      flow:'paginated'
    });

    registerEpubThemes();
    applyEpubAppearance();

    rendition.on('relocated', locationData => {
      savedCfi = String(locationData?.start?.cfi || savedCfi || '');
      syncToc(locationData);
      writeState();
    });

    rendition.on('keyup', event => {
      const key = event?.key || '';
      if (key === 'ArrowLeft') rendition.prev();
      if (key === 'ArrowRight') rendition.next();
    });

    const keyHandler = event => {
      if (!rendition) return;
      if (event.key === 'ArrowLeft') rendition.prev();
      if (event.key === 'ArrowRight') rendition.next();
    };
    document.addEventListener('keydown', keyHandler);

    // Display the book FIRST. Navigation and metadata are enhancements and must
    // never block the first page from appearing.
    try {
      await timeoutPromise(
        rendition.display(savedCfi || undefined),
        20000,
        'Valois Lumière timed out while displaying this EPUB.'
      );
    } catch (error) {
      if (!savedCfi) throw error;
      savedCfi = '';
      writeState();
      await timeoutPromise(
        rendition.display(),
        20000,
        'Valois Lumière timed out while displaying the first page of this EPUB.'
      );
    }

    // Load TOC and metadata only after the first page is visible. A malformed or
    // unusual navigation document must not prevent the Bible itself from opening.
    Promise.resolve(epubBook.loaded.navigation)
      .then(navigation => populateToc(navigation?.toc || []))
      .catch(error => {
        showInlineReaderError(error);
        populateToc([]);
      });

    Promise.resolve(epubBook.loaded.metadata)
      .then(metadata => {
        const titleNode = shell.querySelector('[data-reader-title]');
        if (titleNode && metadata?.title) titleNode.textContent = metadata.title;
      })
      .catch(showInlineReaderError);
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
    if (!productKey) {
      emptyState('Valois Lumière is ready.', 'Open a title from your Living Word Bibles Library to begin reading.');
      return;
    }
    if (!sessionToken()) {
      emptyState('Sign in to read this title.', 'Valois Lumière verifies your Living Word Bibles entitlement before opening a title.', '/login/', 'Sign In');
      return;
    }

    try {
      readState();
      emptyState('Preparing Valois Lumière…', 'Verifying your Living Word Bibles library access and opening the repository file.');
      readerMeta = await authorizeReader();

      if (readerMeta.format === 'pdf') {
        if (!readerMeta.source_url) throw new Error('The PDF source is unavailable.');
        pdfShell(readerMeta);
        return;
      }

      if (readerMeta.format !== 'epub') {
        throw new Error('This title is not available as an EPUB or PDF.');
      }

      await openEpub(readerMeta);
    } catch (error) {
      console.error('Valois Lumière initialization error:', error);
      emptyState('Valois Lumière could not open this title.', error?.message || 'Reader access is temporarily unavailable.');
    }
  }

  window.addEventListener('pagehide', () => destroyEpub(), {once:true});
  initialize();
})();

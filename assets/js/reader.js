(() => {
  'use strict';
  const shell = document.querySelector('[data-reader]');
  if (!shell) return;

  let config = {};
  try { config = JSON.parse(shell.dataset.reader || '{}'); } catch (_) {}

  const $ = selector => shell.querySelector(selector);
  const content = $('[data-reader-content]');
  const status = $('[data-reader-status]');
  const input = $('[data-reference-input]');
  const label = $('[data-reference-label]');
  const bookSelect = $('[data-book-select]');
  const chapterSelect = $('[data-chapter-select]');
  const verseSelect = $('[data-verse-select]');
  const booksPanel = $('[data-books-panel]');
  const booksToggle = $('[data-books-toggle]');
  const type = config.type || config.adapter || '';

  const state = { books: [], book: null, chapter: 1, verse: 1, verses: [], fontScale: 1 };
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const plain = value => String(value ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const canonicalBookName = value => String(value || '').replace(/\s+/g, ' ').trim();
  const normalizeName = value => canonicalBookName(value).toLowerCase().replace(/[^a-z0-9]/g, '');

  const aliases = new Map([
    ['psalm','psalms'],['songofsongs','songofsolomon'],['canticles','songofsolomon'],
    ['tobias','tobit'],['ecclesiasticus','sirach'],['1machabees','1maccabees'],['2machabees','2maccabees'],
    ['apocalypse','revelation'],['josue','joshua'],['1paralipomenon','1chronicles'],['2paralipomenon','2chronicles'],
    ['1kingsdrb','1samuel'],['2kingsdrb','2samuel'],['3kings','1kings'],['4kings','2kings']
  ]);

  const CANON_CHAPTERS = Object.freeze({
    genesis:50, exodus:40, leviticus:27, numbers:36, deuteronomy:34, joshua:24, judges:21, ruth:4,
    '1samuel':31, '2samuel':24, '1kings':22, '2kings':25, '1chronicles':29, '2chronicles':36,
    ezra:10, nehemiah:13, esther:10, job:42, psalms:150, proverbs:31, ecclesiastes:12,
    songofsolomon:8, isaiah:66, jeremiah:52, lamentations:5, ezekiel:48, daniel:12, hosea:14,
    joel:3, amos:9, obadiah:1, jonah:4, micah:7, nahum:3, habakkuk:3, zephaniah:3, haggai:2,
    zechariah:14, malachi:4, matthew:28, mark:16, luke:24, john:21, acts:28, romans:16,
    '1corinthians':16, '2corinthians':13, galatians:6, ephesians:6, philippians:4, colossians:4,
    '1thessalonians':5, '2thessalonians':3, '1timothy':6, '2timothy':4, titus:3, philemon:1,
    hebrews:13, james:5, '1peter':5, '2peter':3, '1john':5, '2john':1, '3john':1, jude:1,
    revelation:22,
    // Douay-Rheims / Catholic canon additions.
    tobit:14, judith:16, wisdom:19, sirach:51, baruch:6, '1maccabees':16, '2maccabees':15
  });

  function canonicalChapterCount(book) {
    if (!book) return 0;
    const candidates = [book.name, book.commonName, book.shortname, book.id].filter(Boolean);
    for (const candidate of candidates) {
      const raw = normalizeName(candidate);
      const normalized = aliases.get(raw) || raw;
      if (CANON_CHAPTERS[normalized]) return CANON_CHAPTERS[normalized];
    }
    return 0;
  }

  const hashRef = () => {
    const hash = location.hash.replace(/^#/, '');
    const m = hash.match(/(?:^|&)(?:ref|net|gnv|bsb|oeb|dby|drb)=([^&]+)/i);
    if (m) {
      const decoded = decodeURIComponent(m[1]).replace(/^\//, '');
      const dotted = decoded.match(/^(.+?)[.\s]+(\d+)(?:[.:\s]+(\d+))?$/);
      if (dotted) return `${dotted[1].replace(/[._-]+/g, ' ')} ${dotted[2]}:${dotted[3] || 1}`;
      return decoded;
    }
    if (hash && !hash.includes('=')) {
      const decoded = decodeURIComponent(hash.replace(/^\//, '').replace(/\//g, ' '));
      const dotted = decoded.match(/^(.+?)[.\s]+(\d+)(?:[.:\s]+(\d+))?$/);
      if (dotted) return `${dotted[1].replace(/[._-]+/g, ' ')} ${dotted[2]}:${dotted[3] || 1}`;
      return decoded;
    }
    return '';
  };

  function parseReference(ref) {
    const value = String(ref || '').trim().replace(/\s+/g, ' ');
    const match = value.match(/^(.+?)\s+(\d+)(?::(\d+))?$/);
    if (!match) return null;
    return { bookName: canonicalBookName(match[1]), chapter: Math.max(1, Number(match[2])), verse: Math.max(1, Number(match[3] || 1)) };
  }

  function matchBook(name) {
    const target0 = normalizeName(name);
    const target = aliases.get(target0) || target0;
    return state.books.find(book => {
      const values = [book.name, book.commonName, book.shortname, book.id].filter(Boolean).map(normalizeName);
      return values.includes(target) || values.map(v => aliases.get(v) || v).includes(target);
    }) || null;
  }

  function referenceText() {
    return `${state.book?.name || config.start?.replace(/\s+\d.*$/, '') || 'Genesis'} ${state.chapter}:${state.verse}`;
  }

  function setStatus(message, kind = '') {
    if (!status) return;
    status.textContent = message || '';
    status.dataset.type = kind;
  }

  function setUrl() {
    const ref = referenceText();
    if (input) input.value = ref;
    if (label) label.textContent = ref;
    history.replaceState(null, '', `${location.pathname}#ref=${encodeURIComponent(ref)}`);
    document.title = `${ref} — ${config.name || 'Bible'} | Living Word Bibles`;
    updateShareLinks();
  }

  function updateShareLinks() {
    const url = location.href;
    const title = `${referenceText()} — ${config.name || 'Bible'}`;
    shell.querySelectorAll('.share-row a').forEach(link => {
      if (link.textContent.trim() === 'Facebook') link.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
      else if (link.textContent.trim() === 'X') link.href = `https://x.com/intent/post?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
      else if (link.textContent.trim() === 'LinkedIn') link.href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
      else if (link.textContent.trim() === 'Email') link.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`;
    });
  }

  async function fetchJson(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout || 15000);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Scripture source returned HTTP ${response.status}.`);
      return await response.json();
    } finally { clearTimeout(timer); }
  }

  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const callback = `lwbReader${Date.now()}${Math.floor(Math.random()*1000)}`;
      const script = document.createElement('script');
      const timer = setTimeout(() => cleanup(new Error('Scripture source timed out.')), 15000);
      const cleanup = error => {
        clearTimeout(timer); script.remove(); delete window[callback];
        if (error) reject(error);
      };
      window[callback] = data => { cleanup(); resolve(data); };
      script.src = `${url}${url.includes('?') ? '&' : '?'}callback=${callback}`;
      script.onerror = () => cleanup(new Error('Scripture source could not be reached.'));
      document.head.appendChild(script);
    });
  }

  function flattenText(node) {
    if (node == null) return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(flattenText).join('');
    if (typeof node === 'object') {
      if (typeof node.text === 'string') return node.text;
      if (typeof node.heading === 'string') return node.heading;
      if (node.lineBreak) return '\n';
      if (node.noteId != null) return '';
      if (node.content != null) return flattenText(node.content);
    }
    return '';
  }

  function renderVerses(verses, heading) {
    state.verses = verses.filter(v => Number(v.verse) > 0);
    if (!state.verses.length) throw new Error('No Scripture text was returned for this chapter.');
    if (!state.verses.some(v => Number(v.verse) === state.verse)) state.verse = Number(state.verses[0].verse || 1);
    content.innerHTML = `<article class="reader-chapter"><h2>${escapeHtml(heading)}</h2>${state.verses.map(v => `<p id="verse-${Number(v.verse)}"><sup class="verse-num">${Number(v.verse)}</sup> ${escapeHtml(plain(v.text))}</p>`).join('')}</article>`;
    populateVerseSelect();
    setUrl();
    const selected = document.getElementById(`verse-${state.verse}`);
    selected?.scrollIntoView({ block: 'center' });
    setStatus(`${config.name || 'Bible'} — ${state.book.name} ${state.chapter}`);
  }

  async function initBibleApi() {
    let translation = config.translation;
    let booksPayload;
    try { booksPayload = await fetchJson(`https://bible-api.com/data/${encodeURIComponent(translation)}`); }
    catch (error) {
      if (!config.fallbackTranslation) throw error;
      translation = config.fallbackTranslation;
      booksPayload = await fetchJson(`https://bible-api.com/data/${encodeURIComponent(translation)}`);
    }
    config.translation = translation;
    const books = booksPayload.books || booksPayload || [];
    state.books = books.map((book, index) => ({
      id: book.id || book.book_id || book.abbreviation || book.name,
      name: book.name || book.book_name || book.title || book.id,
      commonName: book.name || book.book_name || '',
      order: Number(book.order || index + 1),
      chapters: Number(book.number_of_chapters || book.chapters || book.chapter_count || 0)
    })).filter(book => book.id && book.name);
  }

  async function loadBibleApiChapter() {
    const payload = await fetchJson(`https://bible-api.com/data/${encodeURIComponent(config.translation)}/${encodeURIComponent(state.book.id)}/${state.chapter}`);
    const verses = (payload.verses || payload.data || payload).map?.(v => ({ verse: v.verse || v.verse_number || v.number, text: v.text || v.content || '' })) || [];
    if (!state.book.chapters && payload.book?.number_of_chapters) state.book.chapters = Number(payload.book.number_of_chapters);
    renderVerses(verses, `${state.book.name} ${state.chapter}`);
  }

  async function initHelloAo() {
    const payload = await fetchJson(`https://bible.helloao.org/api/${encodeURIComponent(config.translation || 'BSB')}/books.json`);
    state.books = (payload.books || []).map(book => ({ id: book.id, name: book.name || book.commonName, commonName: book.commonName, order: Number(book.order), chapters: Number(book.numberOfChapters), firstChapter: Number(book.firstChapterNumber || 1) }));
  }

  async function loadHelloAoChapter() {
    const payload = await fetchJson(`https://bible.helloao.org/api/${encodeURIComponent(config.translation || 'BSB')}/${encodeURIComponent(state.book.id)}/${state.chapter}.json`);
    const contentItems = payload.chapter?.content || [];
    const verses = contentItems.filter(x => x.type === 'verse').map(v => ({ verse: v.number, text: flattenText(v.content) }));
    renderVerses(verses, `${state.book.name} ${state.chapter}`);
  }

  async function initBibleSuperSearch() {
    const payload = await jsonp('https://api.biblesupersearch.com/api/books?language=en');
    const rows = payload.results || [];
    state.books = rows.map((book, index) => {
      const normalized = aliases.get(normalizeName(book.name)) || normalizeName(book.name);
      return {
        id: String(book.id || index + 1),
        name: book.name,
        shortname: book.shortname,
        commonName: book.name,
        order: index + 1,
        chapters: Number(book.chapters || book.chapter_count || CANON_CHAPTERS[normalized] || 0)
      };
    });
  }

  function extractSuperSearchVerses(payload) {
    const results = payload?.results || {};
    const bible = results[config.translation] || results.bibles?.[config.translation] || results;
    const out = [];
    const walk = node => {
      if (!node) return;
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (typeof node === 'object') {
        if (node.verse != null && node.text != null) out.push({ verse: Number(node.verse), text: node.text });
        else Object.values(node).forEach(walk);
      }
    };
    walk(bible);
    const seen = new Set();
    return out.filter(v => { const key = `${v.verse}|${v.text}`; if (seen.has(key)) return false; seen.add(key); return true; }).sort((a,b) => a.verse-b.verse);
  }

  async function loadBibleSuperSearchChapter() {
    const ref = `${state.book.name} ${state.chapter}`;
    const payload = await jsonp(`https://api.biblesupersearch.com/api?bible=${encodeURIComponent(config.translation || 'geneva')}&reference=${encodeURIComponent(ref)}&data_format=minimal&page_all=true`);
    if (payload.error_level >= 4 || payload.errors?.length) throw new Error(payload.errors?.join(' ') || 'Geneva Bible passage unavailable.');
    renderVerses(extractSuperSearchVerses(payload), ref);
  }

  async function loadNet(ref) {
    const payload = await jsonp(`https://labs.bible.org/api/?passage=${encodeURIComponent(ref)}&type=json&formatting=plain`);
    const verses = Array.isArray(payload) ? payload.map(v => ({ verse: Number(v.verse), text: v.text })) : [];
    renderVerses(verses, `${state.book.name} ${state.chapter}`);
  }

  async function loadLeb(ref) {
    content.innerHTML = `<iframe src="https://biblia.com/api/plugins/embeddedbible?layout=normal&navigationbox=true&historybuttons=true&sharebutton=true&textsizebutton=true&resourcepicker=false&resourceName=leb&startingreference=${encodeURIComponent(ref)}" title="Lexham English Bible — ${escapeHtml(ref)}" loading="eager"></iframe>`;
    setUrl();
    setStatus('Lexham English Bible embedded reader');
  }

  async function initFallbackBooks() {
    const payload = await fetchJson('https://bible-api.com/data/web');
    state.books = (payload.books || []).map((book,index) => ({ id: book.id, name: book.name, commonName: book.name, order:index+1, chapters:Number(book.number_of_chapters||0) }));
  }

  async function initializeSource() {
    if (type === 'bible-api') await initBibleApi();
    else if (type === 'helloao') await initHelloAo();
    else if (type === 'biblesupersearch') await initBibleSuperSearch();
    else await initFallbackBooks();
    if (!state.books.length) throw new Error('No Bible books were returned by the Scripture source.');
  }

  function populateBookSelect() {
    bookSelect.innerHTML = state.books.map(book => `<option value="${escapeHtml(book.id)}">${escapeHtml(book.name)}</option>`).join('');
    if (state.book) bookSelect.value = state.book.id;
    booksPanel.innerHTML = state.books.map(book => `<button type="button" data-book-id="${escapeHtml(book.id)}">${escapeHtml(book.name)}</button>`).join('');
    booksPanel.querySelectorAll('[data-book-id]').forEach(button => button.addEventListener('click', () => {
      chooseBook(button.dataset.bookId, 1, 1, true);
      booksPanel.hidden = true;
      booksToggle.setAttribute('aria-expanded', 'false');
    }));
  }

  async function ensureChapterCount(book) {
    if (book.chapters) return book.chapters;
    if (type === 'bible-api') {
      try {
        const payload = await fetchJson(`https://bible-api.com/data/${encodeURIComponent(config.translation)}/${encodeURIComponent(book.id)}`);
        book.chapters = Number(payload.chapters?.length || payload.number_of_chapters || payload.chapter_count || 0);
      } catch (_) {
        // Use the canonical count below when the metadata endpoint is temporarily unavailable.
      }
    }
    if (!book.chapters) book.chapters = canonicalChapterCount(book);
    if (!book.chapters) book.chapters = 1;
    return book.chapters;
  }

  async function populateChapterSelect() {
    const max = await ensureChapterCount(state.book);
    chapterSelect.innerHTML = Array.from({ length: max }, (_, i) => `<option value="${i+1}">${i+1}</option>`).join('');
    if (state.chapter > max) state.chapter = max;
    chapterSelect.value = String(state.chapter);
  }

  function populateVerseSelect() {
    verseSelect.innerHTML = state.verses.map(v => `<option value="${Number(v.verse)}">${Number(v.verse)}</option>`).join('');
    verseSelect.value = String(state.verse);
  }

  async function loadCurrent() {
    content.innerHTML = '<p class="reader-loading">Loading Scripture…</p>';
    setStatus('Loading…');
    try {
      const ref = referenceText();
      if (type === 'bible-api') await loadBibleApiChapter();
      else if (type === 'helloao') await loadHelloAoChapter();
      else if (type === 'biblesupersearch') await loadBibleSuperSearchChapter();
      else if (type === 'net') await loadNet(ref);
      else if (type === 'leb') await loadLeb(ref);
      else throw new Error('This reader source has not been configured.');
    } catch (error) {
      content.innerHTML = `<div class="reader-status"><strong>Reader unavailable.</strong><p>${escapeHtml(error?.message || 'The passage could not be loaded.')}</p><p>Please try again or visit the <a href="${escapeHtml(config.history || '/history-of-the-bible/')}">translation history page</a>.</p></div>`;
      setStatus('The Scripture source could not be loaded.', 'error');
    }
  }

  async function chooseBook(id, chapter = 1, verse = 1, load = false) {
    state.book = state.books.find(b => String(b.id) === String(id)) || state.books[0];
    state.chapter = Math.max(1, Number(chapter || 1));
    state.verse = Math.max(1, Number(verse || 1));
    bookSelect.value = state.book.id;
    await populateChapterSelect();
    if (load) await loadCurrent();
  }

  async function goTo(ref) {
    const parsed = parseReference(ref);
    if (!parsed) { setStatus('Enter a reference such as John 3:16.', 'error'); return; }
    const book = matchBook(parsed.bookName);
    if (!book) { setStatus(`Book not available in this reader: ${parsed.bookName}`, 'error'); return; }
    await chooseBook(book.id, parsed.chapter, parsed.verse, true);
  }

  async function stepChapter(direction) {
    const index = state.books.indexOf(state.book);
    const max = await ensureChapterCount(state.book);
    if (direction > 0 && state.chapter < max) state.chapter += 1;
    else if (direction > 0 && index < state.books.length - 1) { state.book = state.books[index + 1]; state.chapter = 1; }
    else if (direction < 0 && state.chapter > 1) state.chapter -= 1;
    else if (direction < 0 && index > 0) { state.book = state.books[index - 1]; state.chapter = await ensureChapterCount(state.book); }
    state.verse = 1;
    populateBookSelect();
    await populateChapterSelect();
    await loadCurrent();
  }

  $('[data-go]')?.addEventListener('click', () => goTo(input.value));
  input?.addEventListener('keydown', event => { if (event.key === 'Enter') goTo(input.value); });
  bookSelect?.addEventListener('change', () => chooseBook(bookSelect.value, 1, 1, true));
  chapterSelect?.addEventListener('change', () => { state.chapter = Number(chapterSelect.value); state.verse = 1; loadCurrent(); });
  verseSelect?.addEventListener('change', () => { state.verse = Number(verseSelect.value); setUrl(); document.getElementById(`verse-${state.verse}`)?.scrollIntoView({ behavior:'smooth', block:'center' }); });
  $('[data-prev]')?.addEventListener('click', () => stepChapter(-1));
  $('[data-next]')?.addEventListener('click', () => stepChapter(1));
  $('[data-random]')?.addEventListener('click', async () => {
    if (type === 'bible-api') {
      try {
        const payload = await fetchJson(`https://bible-api.com/data/${encodeURIComponent(config.translation)}/random`);
        const ref = `${payload.random_verse?.book || payload.book || payload.book_name} ${payload.random_verse?.chapter || payload.chapter}:${payload.random_verse?.verse || payload.verse}`;
        if (!/undefined/.test(ref)) return goTo(ref);
      } catch (_) {}
    }
    const book = state.books[Math.floor(Math.random()*state.books.length)];
    const max = await ensureChapterCount(book);
    chooseBook(book.id, 1 + Math.floor(Math.random()*Math.max(1,max)), 1, true);
  });
  $('[data-font-plus]')?.addEventListener('click', () => { state.fontScale = Math.min(1.7, state.fontScale + .1); content.style.setProperty('--reader-font', `${1.2*state.fontScale}rem`); });
  $('[data-font-minus]')?.addEventListener('click', () => { state.fontScale = Math.max(.75, state.fontScale - .1); content.style.setProperty('--reader-font', `${1.2*state.fontScale}rem`); });
  booksToggle?.addEventListener('click', () => { const open = booksToggle.getAttribute('aria-expanded') !== 'true'; booksToggle.setAttribute('aria-expanded', String(open)); booksPanel.hidden = !open; });
  $('[data-copy-link]')?.addEventListener('click', async event => { try { await navigator.clipboard.writeText(location.href); const old=event.currentTarget.textContent; event.currentTarget.textContent='Copied'; setTimeout(()=>event.currentTarget.textContent=old,1000); } catch (_) {} });
  $('[data-share-native]')?.addEventListener('click', async () => { if (navigator.share) { try { await navigator.share({title:`${referenceText()} — ${config.name}`,url:location.href}); } catch (_) {} } });
  window.addEventListener('hashchange', () => { const ref = hashRef(); if (ref && ref !== referenceText()) goTo(ref); });

  (async () => {
    try {
      await initializeSource();
      populateBookSelect();
      const start = parseReference(hashRef() || config.start || 'Genesis 1:1') || {bookName:'Genesis',chapter:1,verse:1};
      const book = matchBook(start.bookName) || state.books[0];
      await chooseBook(book.id, start.chapter, start.verse, true);
    } catch (error) {
      content.innerHTML = `<div class="reader-status"><strong>Reader setup error.</strong><p>${escapeHtml(error?.message || 'The reader could not initialize.')}</p></div>`;
      setStatus('Reader initialization failed.', 'error');
    }
  })();
})();

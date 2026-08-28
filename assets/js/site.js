(() => {
  'use strict';

  /*
   * Living Word Bibles — canonical shared shell runtime
   * Runtime revision: 2026-08-28.4
   *
   * AUTHORITATIVE SHELL FILES
   *   /assets/includes/lwb-header.html
   *   /assets/includes/lwb-footer.html
   *
   * The shared include files are the only authoritative shell markup.
   * site.js loads them, removes duplicate legacy shells, and wires behavior;
   * it does not generate or rewrite header/footer navigation markup.
   */

  const RUNTIME_VERSION = '2026-08-28.4';
  const NAV_VERSION = '2026-08-28.4';

  /*
   * Versioned guard:
   * - prevents this exact runtime from initializing twice;
   * - deliberately does NOT trust an older boolean-only guard;
   * - sets the legacy boolean so an older duplicate copy loaded afterward
   *   will stop instead of attaching competing navigation handlers.
   */
  if (window.__LWB_SITE_JS_VERSION__ === RUNTIME_VERSION) return;
  window.__LWB_SITE_JS_VERSION__ = RUNTIME_VERSION;
  window.__LWB_SITE_JS_ACTIVE__ = true;

  const HEADER_URL = '/assets/includes/lwb-header.html';
  const FOOTER_URL = '/assets/includes/lwb-footer.html';
  const MOBILE_BREAKPOINT = '(max-width: 820px)';

  /*
   * Navigation markup lives only in /assets/includes/lwb-header.html.
   * Do not duplicate it here; that would create a second source of truth.
   */

  function freshUrl(path) {
    const url = new URL(path, location.origin);
    url.searchParams.set('lwb-shell-version', NAV_VERSION);
    url.searchParams.set('_lwb', `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
    return url.href;
  }

  function reviveScripts(node) {
    node.querySelectorAll('script').forEach(oldScript => {
      const liveScript = document.createElement('script');

      [...oldScript.attributes].forEach(attr => {
        liveScript.setAttribute(attr.name, attr.value);
      });

      liveScript.textContent = oldScript.textContent;
      oldScript.replaceWith(liveScript);
    });
  }

  function insertFallback(node, kind) {
    if (kind === 'header') {
      const skipLink = document.querySelector('.skip-link');

      if (skipLink) {
        skipLink.insertAdjacentElement('afterend', node);
      } else if (document.body.firstElementChild) {
        document.body.insertBefore(node, document.body.firstElementChild);
      } else {
        document.body.appendChild(node);
      }

      return;
    }

    document.body.appendChild(node);
  }

  async function loadCanonicalFragment({
    kind,
    url,
    placeholderSelector,
    legacySelector,
    expectedSelector
  }) {
    const response = await fetch(freshUrl(url), {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(
        `Could not load shared ${kind}: ${url} (${response.status} ${response.statusText})`
      );
    }

    const template = document.createElement('template');
    template.innerHTML = (await response.text()).trim();

    const node = template.content.firstElementChild;

    if (!node) {
      throw new Error(`Shared ${kind} is empty: ${url}`);
    }

    if (!node.matches(expectedSelector)) {
      throw new Error(
        `Shared ${kind} has unexpected root element. Expected ${expectedSelector}.`
      );
    }

    node.dataset.lwbCanonical = kind;
    node.dataset.lwbShellVersion = NAV_VERSION;

    const placeholders = [...document.querySelectorAll(placeholderSelector)];
    const legacyNodes = [...document.querySelectorAll(legacySelector)];

    const firstPlaceholder = placeholders[0] || null;
    const containingLegacy = firstPlaceholder
      ? firstPlaceholder.closest(legacySelector)
      : null;

    const target =
      containingLegacy ||
      firstPlaceholder ||
      legacyNodes[0] ||
      null;

    if (target) {
      target.replaceWith(node);
    } else {
      insertFallback(node, kind);
    }

    /*
     * Remove every stale placeholder and every duplicate legacy shell.
     */
    document.querySelectorAll(placeholderSelector).forEach(el => {
      el.remove();
    });

    document.querySelectorAll(legacySelector).forEach(el => {
      if (el !== node) el.remove();
    });

    /*
     * No navigation outside the canonical header is allowed to survive.
     */
    if (kind === 'header') {
      document.querySelectorAll('[data-primary-nav], #primary-nav').forEach(nav => {
        if (!node.contains(nav)) nav.remove();
      });

      document.querySelectorAll('[data-nav-toggle]').forEach(toggle => {
        if (!node.contains(toggle)) toggle.remove();
      });
    }

    reviveScripts(node);
    return node;
  }

  function normalizePath(value) {
    try {
      const path = new URL(value, location.origin).pathname;
      return path === '/' ? '/' : `${path.replace(/\/+$/, '')}/`;
    } catch (_) {
      return '/';
    }
  }

  function markCurrentNavigation(header) {
    const nav = header?.querySelector('[data-primary-nav]');
    if (!nav) return;

    const current = normalizePath(location.pathname);

    nav.querySelectorAll('[aria-current="page"]').forEach(link => {
      link.removeAttribute('aria-current');
    });

    nav.querySelectorAll('.nav-direct').forEach(link => {
      if (normalizePath(link.getAttribute('href') || '') === current) {
        link.setAttribute('aria-current', 'page');
      }
    });

    nav.querySelectorAll('[data-nav-group]').forEach(group => {
      const parent = group.querySelector('.nav-parent-link');
      const links = [
        parent,
        ...group.querySelectorAll('[data-dropdown-menu] a')
      ].filter(Boolean);

      const active = links.some(link => {
        const path = normalizePath(link.getAttribute('href') || '');

        return (
          current === path ||
          (path !== '/' && current.startsWith(path))
        );
      });

      if (active && parent) {
        parent.setAttribute('aria-current', 'page');
      }
    });
  }

  function initializeNavigation(header) {
    if (!header) return;

    /*
     * The whole header is replaced whenever we refresh it, so listener state
     * belongs to this specific header node only.
     */
    if (header.dataset.lwbNavigationReady === RUNTIME_VERSION) return;

    const nav = header.querySelector('[data-primary-nav]');
    const mobileToggle = header.querySelector('[data-nav-toggle]');

    if (!nav) return;

    header.dataset.lwbNavigationReady = RUNTIME_VERSION;

    const groups = [...nav.querySelectorAll('[data-nav-group]')];
    const mobileQuery = window.matchMedia(MOBILE_BREAKPOINT);

    const closeGroup = group => {
      const button = group?.querySelector('[data-dropdown-toggle]');
      const menu = group?.querySelector('[data-dropdown-menu]');

      if (!button || !menu) return;

      button.setAttribute('aria-expanded', 'false');
      menu.hidden = true;
      group.dataset.open = 'false';
    };

    const closeAllGroups = except => {
      groups.forEach(group => {
        if (group !== except) closeGroup(group);
      });
    };

    const closeMobileNav = () => {
      nav.dataset.open = 'false';

      if (mobileToggle) {
        mobileToggle.setAttribute('aria-expanded', 'false');
      }

      closeAllGroups();
    };

    nav.dataset.open = 'false';

    if (mobileToggle) {
      mobileToggle.setAttribute('aria-expanded', 'false');
    }

    closeAllGroups();

    if (mobileToggle) {
      mobileToggle.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();

        const opening = nav.dataset.open !== 'true';

        nav.dataset.open = String(opening);
        mobileToggle.setAttribute('aria-expanded', String(opening));

        if (!opening) closeAllGroups();
      });
    }

    groups.forEach(group => {
      const button = group.querySelector('[data-dropdown-toggle]');
      const menu = group.querySelector('[data-dropdown-menu]');

      if (!button || !menu) return;

      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();

        const opening = button.getAttribute('aria-expanded') !== 'true';

        closeAllGroups(group);

        button.setAttribute('aria-expanded', String(opening));
        menu.hidden = !opening;
        group.dataset.open = String(opening);

        if (opening && !mobileQuery.matches) {
          menu.querySelector('a')?.focus({ preventScroll: true });
        }
      });

      group.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeGroup(group);
          button.focus();
          return;
        }

        if (
          event.key === 'ArrowDown' &&
          button === document.activeElement
        ) {
          event.preventDefault();

          if (button.getAttribute('aria-expanded') !== 'true') {
            button.click();
          }

          menu.querySelector('a')?.focus();
        }
      });
    });

    nav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        if (mobileQuery.matches) {
          closeMobileNav();
        } else {
          closeAllGroups();
        }
      });
    });

    /*
     * These listeners intentionally reference the current canonical header.
     * A later BFCache repair replaces the header node and installs a new set.
     */
    const outsideClick = event => {
      if (!header.isConnected) {
        document.removeEventListener('click', outsideClick);
        return;
      }

      if (!header.contains(event.target)) {
        closeAllGroups();
      }
    };

    const escapeHandler = event => {
      if (!header.isConnected) {
        document.removeEventListener('keydown', escapeHandler);
        return;
      }

      if (event.key !== 'Escape') return;

      closeAllGroups();

      if (mobileQuery.matches) {
        closeMobileNav();
      }
    };

    document.addEventListener('click', outsideClick);
    document.addEventListener('keydown', escapeHandler);

    const handleBreakpointChange = () => {
      closeMobileNav();
    };

    if (typeof mobileQuery.addEventListener === 'function') {
      mobileQuery.addEventListener('change', handleBreakpointChange);
    } else if (typeof mobileQuery.addListener === 'function') {
      mobileQuery.addListener(handleBreakpointChange);
    }

    markCurrentNavigation(header);
  }

  function initializeGeneralSiteBehavior() {
    document.querySelectorAll('[data-current-year]').forEach(el => {
      el.textContent = String(new Date().getFullYear());
    });

    document.querySelectorAll('img[data-fallback]').forEach(img => {
      if (img.dataset.lwbFallbackReady === RUNTIME_VERSION) return;
      img.dataset.lwbFallbackReady = RUNTIME_VERSION;

      img.addEventListener(
        'error',
        () => {
          const fallback = img.dataset.fallback;

          if (
            fallback &&
            img.src !== new URL(fallback, location.href).href
          ) {
            img.src = fallback;
          }
        },
        { once: true }
      );
    });

    document.querySelectorAll('[data-accordion-button]').forEach(btn => {
      if (btn.dataset.lwbAccordionReady === RUNTIME_VERSION) return;
      btn.dataset.lwbAccordionReady = RUNTIME_VERSION;

      btn.addEventListener('click', () => {
        const panel = document.getElementById(
          btn.getAttribute('aria-controls')
        );

        const expanded = btn.getAttribute('aria-expanded') === 'true';

        btn.setAttribute('aria-expanded', String(!expanded));

        if (panel) {
          panel.hidden = expanded;
        }
      });
    });

    const bookSearch = document.querySelector('[data-book-search]');
    const bookItems = [...document.querySelectorAll('[data-book-item]')];

    if (
      bookSearch &&
      bookSearch.dataset.lwbSearchReady !== RUNTIME_VERSION
    ) {
      bookSearch.dataset.lwbSearchReady = RUNTIME_VERSION;

      bookSearch.addEventListener('input', () => {
        const q = bookSearch.value.trim().toLowerCase();

        bookItems.forEach(item => {
          item.hidden = Boolean(
            q && !item.textContent.toLowerCase().includes(q)
          );
        });
      });
    }

    const config = window.LWB_PUBLIC_CONFIG || {};

    if (config.adsEnabled === true && config.adsenseClient) {
      const existingAdsense = document.querySelector(
        'script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]'
      );

      if (!existingAdsense) {
        const script = document.createElement('script');
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.src =
          'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js' +
          `?client=${encodeURIComponent(config.adsenseClient)}`;

        document.head.appendChild(script);
      }
    }
  }

  async function syncHeader() {
    try {
      const header = await loadCanonicalFragment({
        kind: 'header',
        url: HEADER_URL,
        placeholderSelector: '[data-lwb-header]',
        legacySelector: '.site-header',
        expectedSelector: '.site-header'
      });

      initializeNavigation(header);
      return true;
    } catch (error) {
      console.error('LWB canonical header failed to load:', error);

      const existing = document.querySelector('.site-header');

      if (existing) {
        initializeNavigation(existing);
      }

      return false;
    }
  }

  async function syncFooter() {
    try {
      await loadCanonicalFragment({
        kind: 'footer',
        url: FOOTER_URL,
        placeholderSelector: '[data-lwb-footer]',
        legacySelector: '.site-footer',
        expectedSelector: '.site-footer'
      });

      return true;
    } catch (error) {
      console.error('LWB canonical footer failed to load:', error);
      return false;
    }
  }

  async function boot() {
    const root = document.documentElement;
    const params = new URLSearchParams(location.search);

    const isEmbed =
      window.self !== window.top ||
      params.get('embed') === '1';

    if (isEmbed) {
      root.dataset.embed = 'true';
    }

    const [headerLoaded, footerLoaded] = await Promise.all([
      syncHeader(),
      syncFooter()
    ]);

    initializeGeneralSiteBehavior();

    document.dispatchEvent(
      new CustomEvent('lwb:layout-ready', {
        detail: {
          headerLoaded,
          footerLoaded,
          runtimeVersion: RUNTIME_VERSION,
          navVersion: NAV_VERSION
        }
      })
    );
  }

  async function repairRestoredPage() {
    /*
     * BFCache/history restoration can bring back an already-rendered shell
     * without rerunning DOMContentLoaded. Reload both authoritative include
     * files so restored pages use exactly the same global header and footer.
     */
    await Promise.all([syncHeader(), syncFooter()]);
    initializeGeneralSiteBehavior();
  }

  /*
   * pageshow fires when a document is restored from the browser's back/forward
   * cache. DOMContentLoaded does not rerun in that situation.
   */
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      repairRestoredPage();
      return;
    }

    /* Normal page loads are handled by boot(). */
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

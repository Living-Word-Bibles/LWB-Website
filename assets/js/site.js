(() => {
  'use strict';

  /*
   * Living Word Bibles — canonical shared shell runtime
   * Runtime revision: 2026-09-07.1
   *
   * AUTHORITATIVE SHELL FILES
   *   /assets/includes/lwb-header.html
   *   /assets/includes/lwb-footer.html
   *
   * The shared include files are the only authoritative shell markup.
   * site.js loads them, removes duplicate legacy shells, and wires behavior;
   * it does not generate or rewrite header/footer navigation markup.
   */

  const RUNTIME_VERSION = '2026-09-07.1';
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
  }


  /*
   * Global privacy and cookie preferences.
   * Applies worldwide. Necessary storage is always available; optional
   * Analytics and Advertising/Marketing technologies remain off until the
   * visitor gives consent.
   */
  const PRIVACY_STORAGE_KEY = 'lwbPrivacyChoicesV1';
  const PRIVACY_VERSION = 1;

  function defaultPrivacyChoices() {
    return {
      version: PRIVACY_VERSION,
      necessary: true,
      analytics: false,
      advertising: false,
      updatedAt: null
    };
  }

  function readPrivacyChoices() {
    try {
      const saved = JSON.parse(localStorage.getItem(PRIVACY_STORAGE_KEY) || 'null');

      if (
        saved &&
        saved.version === PRIVACY_VERSION &&
        typeof saved.analytics === 'boolean' &&
        typeof saved.advertising === 'boolean'
      ) {
        return {
          version: PRIVACY_VERSION,
          necessary: true,
          analytics: saved.analytics,
          advertising: saved.advertising,
          updatedAt: saved.updatedAt || null
        };
      }
    } catch (_) {}

    return null;
  }

  function writePrivacyChoices(choices) {
    const normalized = {
      version: PRIVACY_VERSION,
      necessary: true,
      analytics: Boolean(choices?.analytics),
      advertising: Boolean(choices?.advertising),
      updatedAt: new Date().toISOString()
    };

    try {
      localStorage.setItem(PRIVACY_STORAGE_KEY, JSON.stringify(normalized));
    } catch (_) {}

    window.LWB_PRIVACY_CHOICES = normalized;

    document.dispatchEvent(
      new CustomEvent('lwb:privacy-consent-changed', {
        detail: { ...normalized }
      })
    );

    return normalized;
  }

  function loadAnalyticsTechnologies() {
    if (!document.querySelector('script[data-lwb-activity-log]')) {
      const script = document.createElement('script');
      script.src = '/assets/js/activity-log.js';
      script.defer = true;
      script.dataset.lwbActivityLog = 'true';
      document.body.appendChild(script);
    }

    const counterWrap = document.querySelector('[data-lwb-counter-wrap]');

    if (counterWrap && !counterWrap.querySelector('iframe')) {
      const iframe = document.createElement('iframe');
      iframe.src = '/assets/counter.html';
      iframe.title = 'Living Word Bibles site view counter';
      iframe.scrolling = 'no';
      iframe.loading = 'eager';
      iframe.style.cssText =
        'display:block;border:0;width:240px;height:90px;overflow:hidden;background:transparent;';
      counterWrap.appendChild(iframe);
    }
  }

  function loadAdvertisingTechnologies() {
    const config = window.LWB_PUBLIC_CONFIG || {};

    if (config.adsEnabled !== true || !config.adsenseClient) return;

    const existingAdsense = document.querySelector(
      'script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]'
    );

    if (existingAdsense) return;

    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src =
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js' +
      `?client=${encodeURIComponent(config.adsenseClient)}`;

    document.head.appendChild(script);
  }

  function applyPrivacyChoices(choices) {
    const current = choices || readPrivacyChoices() || defaultPrivacyChoices();
    window.LWB_PRIVACY_CHOICES = current;

    if (current.analytics === true) {
      loadAnalyticsTechnologies();
    }

    if (current.advertising === true) {
      loadAdvertisingTechnologies();
    }
  }

  function privacyMarkup() {
    return `
      <section class="lwb-privacy-banner" data-lwb-privacy-banner hidden
        role="dialog" aria-label="Privacy and Cookie Choices">
        <div class="lwb-privacy-banner-inner">
          <p class="lwb-privacy-banner-copy">
            <strong>Privacy &amp; Cookie Choices:</strong> Living Word Bibles uses necessary cookies and browser storage to operate and secure our website, maintain accounts and sessions, and remember your privacy choices. With your permission, we may also use optional analytics, advertising, and similar technologies to understand how our website is used and improve our Services. You may accept all optional technologies, reject them, or manage your preferences. You may change your choices at any time through Cookie Settings in the footer. For more information, please review our <a href="/privacy-policy/">Privacy Policy</a>.
          </p>
          <div class="lwb-privacy-banner-actions">
            <button class="btn gold" type="button" data-lwb-privacy-accept>Accept All</button>
            <button class="btn secondary" type="button" data-lwb-privacy-reject>Reject Optional</button>
            <button class="btn ghost" type="button" data-lwb-privacy-settings>Cookie Settings</button>
          </div>
        </div>
      </section>

      <div class="lwb-privacy-modal-backdrop" data-lwb-privacy-modal-backdrop hidden>
        <section class="lwb-privacy-modal" role="dialog" aria-modal="true"
          aria-labelledby="lwb-privacy-modal-title">
          <div class="lwb-privacy-modal-header">
            <div>
              <p class="eyebrow">Living Word Bibles</p>
              <h2 id="lwb-privacy-modal-title">Cookie Settings</h2>
            </div>
            <button class="lwb-privacy-modal-close" type="button"
              data-lwb-privacy-close aria-label="Close Cookie Settings">×</button>
          </div>

          <div class="lwb-privacy-modal-body">
            <p class="lwb-privacy-modal-intro">
              Choose which optional technologies Living Word Bibles may use on this device. Necessary technologies remain active because they support core website functions and remember your privacy choices.
            </p>

            <div class="lwb-privacy-category">
              <div>
                <h3>Necessary</h3>
                <p>Required for core website operation, security, accounts, sessions, and saving your privacy choices.</p>
              </div>
              <span class="lwb-privacy-status">Always Active</span>
            </div>

            <div class="lwb-privacy-category">
              <div>
                <h3>Analytics</h3>
                <p>Helps us understand visits and interactions so we can measure and improve the website.</p>
              </div>
              <label class="lwb-privacy-toggle">
                <input type="checkbox" data-lwb-privacy-analytics>
                <span>Allow</span>
              </label>
            </div>

            <div class="lwb-privacy-category">
              <div>
                <h3>Advertising &amp; Marketing</h3>
                <p>Allows optional advertising, marketing, and similar technologies when those services are enabled.</p>
              </div>
              <label class="lwb-privacy-toggle">
                <input type="checkbox" data-lwb-privacy-advertising>
                <span>Allow</span>
              </label>
            </div>
          </div>

          <div class="lwb-privacy-modal-footer">
            <button class="btn secondary" type="button" data-lwb-privacy-modal-reject>Reject Optional</button>
            <button class="btn gold" type="button" data-lwb-privacy-save>Save Preferences</button>
          </div>
        </section>
      </div>
    `;
  }

  function initializePrivacyCenter() {
    if (!document.querySelector('[data-lwb-privacy-banner]')) {
      const host = document.createElement('div');
      host.dataset.lwbPrivacyUi = 'true';
      host.innerHTML = privacyMarkup();
      document.body.appendChild(host);
    }

    const banner = document.querySelector('[data-lwb-privacy-banner]');
    const backdrop = document.querySelector('[data-lwb-privacy-modal-backdrop]');
    const analyticsToggle = document.querySelector('[data-lwb-privacy-analytics]');
    const advertisingToggle = document.querySelector('[data-lwb-privacy-advertising]');

    if (!banner || !backdrop || !analyticsToggle || !advertisingToggle) return;

    const stored = readPrivacyChoices();

    if (!stored) {
      banner.hidden = false;
    } else {
      banner.hidden = true;
      analyticsToggle.checked = stored.analytics === true;
      advertisingToggle.checked = stored.advertising === true;
      applyPrivacyChoices(stored);
    }

    const openSettings = () => {
      const current = readPrivacyChoices() || defaultPrivacyChoices();
      analyticsToggle.checked = current.analytics === true;
      advertisingToggle.checked = current.advertising === true;
      backdrop.hidden = false;
      document.body.dataset.lwbPrivacyModalOpen = 'true';
      document.querySelector('[data-lwb-privacy-close]')?.focus();
    };

    const closeSettings = () => {
      backdrop.hidden = true;
      delete document.body.dataset.lwbPrivacyModalOpen;
    };

    const commit = choices => {
      const previous = readPrivacyChoices() || defaultPrivacyChoices();
      const saved = writePrivacyChoices(choices);

      banner.hidden = true;
      closeSettings();

      const disablingPreviouslyAllowed =
        (previous.analytics === true && saved.analytics === false) ||
        (previous.advertising === true && saved.advertising === false);

      if (disablingPreviouslyAllowed) {
        location.reload();
        return;
      }

      applyPrivacyChoices(saved);
    };

    if (banner.dataset.lwbPrivacyReady !== RUNTIME_VERSION) {
      banner.dataset.lwbPrivacyReady = RUNTIME_VERSION;

      banner.querySelector('[data-lwb-privacy-accept]')?.addEventListener('click', () => {
        commit({ analytics: true, advertising: true });
      });

      banner.querySelector('[data-lwb-privacy-reject]')?.addEventListener('click', () => {
        commit({ analytics: false, advertising: false });
      });

      banner.querySelector('[data-lwb-privacy-settings]')?.addEventListener('click', openSettings);
    }

    if (backdrop.dataset.lwbPrivacyReady !== RUNTIME_VERSION) {
      backdrop.dataset.lwbPrivacyReady = RUNTIME_VERSION;

      backdrop.querySelector('[data-lwb-privacy-close]')?.addEventListener('click', closeSettings);

      backdrop.querySelector('[data-lwb-privacy-modal-reject]')?.addEventListener('click', () => {
        analyticsToggle.checked = false;
        advertisingToggle.checked = false;
        commit({ analytics: false, advertising: false });
      });

      backdrop.querySelector('[data-lwb-privacy-save]')?.addEventListener('click', () => {
        commit({
          analytics: analyticsToggle.checked,
          advertising: advertisingToggle.checked
        });
      });

      backdrop.addEventListener('click', event => {
        if (event.target === backdrop) closeSettings();
      });

      backdrop.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeSettings();
      });
    }

    if (document.documentElement.dataset.lwbPrivacyDelegation !== RUNTIME_VERSION) {
      document.documentElement.dataset.lwbPrivacyDelegation = RUNTIME_VERSION;

      document.addEventListener('click', event => {
        const trigger = event.target.closest?.('[data-lwb-cookie-settings]');
        if (!trigger) return;
        event.preventDefault();
        openSettings();
      });
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
    initializePrivacyCenter();
    applyPrivacyChoices(readPrivacyChoices() || defaultPrivacyChoices());

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
    initializePrivacyCenter();
    applyPrivacyChoices(readPrivacyChoices() || defaultPrivacyChoices());
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

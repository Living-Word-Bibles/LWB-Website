(() => {
  'use strict';

  const VERSION = '2026-09-07.1';
  if (window.__LWB_ACTIVITY_LOG_VERSION__ === VERSION) return;
  window.__LWB_ACTIVITY_LOG_VERSION__ = VERSION;

  const ACCOUNT_SESSION_KEY = 'lwbAccountSession';
  const PORTAL_SESSION_KEY = 'lwbPortalSession';
  const ACTIVITY_SESSION_KEY = 'lwbActivitySession';
  const ANALYTICS_VISITOR_KEY = 'lwbAnalyticsVisitorId';
  const ANALYTICS_LANDING_KEY = 'lwbAnalyticsLandingPage';
  const ANALYTICS_SESSION_STARTED_KEY = 'lwbAnalyticsSessionStartedAt';
  const MAX_BATCH = 25;
  const queue = [];
  let timer = null;
  let apiUrl = '';
  let analyticsContext = null;


  function randomId(prefix) {
    try {
      if (window.crypto?.randomUUID) return `${prefix}_${window.crypto.randomUUID()}`;
    } catch (_) {}
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  }

  function visitorId() {
    let value = '';
    try { value = localStorage.getItem(ANALYTICS_VISITOR_KEY) || ''; } catch (_) {}
    if (!value) {
      value = randomId('v');
      try { localStorage.setItem(ANALYTICS_VISITOR_KEY, value); } catch (_) {}
    }
    return value;
  }

  function landingPage() {
    let value = '';
    try { value = sessionStorage.getItem(ANALYTICS_LANDING_KEY) || ''; } catch (_) {}
    if (!value) {
      value = safePath(location.href);
      try { sessionStorage.setItem(ANALYTICS_LANDING_KEY, value); } catch (_) {}
    }
    return value;
  }

  function sessionStartedAt() {
    let value = '';
    try { value = sessionStorage.getItem(ANALYTICS_SESSION_STARTED_KEY) || ''; } catch (_) {}
    if (!value) {
      value = new Date().toISOString();
      try { sessionStorage.setItem(ANALYTICS_SESSION_STARTED_KEY, value); } catch (_) {}
    }
    return value;
  }

  function referrerDomain() {
    if (!document.referrer) return '';
    try { return new URL(document.referrer).hostname.slice(0, 180); }
    catch (_) { return ''; }
  }

  function browserName() {
    const ua = navigator.userAgent || '';
    if (/Edg\//i.test(ua)) return 'Edge';
    if (/OPR\//i.test(ua)) return 'Opera';
    if (/SamsungBrowser\//i.test(ua)) return 'Samsung Internet';
    if (/Firefox\//i.test(ua)) return 'Firefox';
    if (/Chrome\//i.test(ua) || /CriOS\//i.test(ua)) return 'Chrome';
    if (/Safari\//i.test(ua) && !/Chrome|CriOS|Chromium/i.test(ua)) return 'Safari';
    return 'Other';
  }

  function operatingSystem() {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
    if (/Android/i.test(ua)) return 'Android';
    if (/Windows NT/i.test(ua)) return 'Windows';
    if (/CrOS/i.test(ua)) return 'ChromeOS';
    if (/Mac OS X|Macintosh/i.test(ua)) return 'macOS';
    if (/Linux/i.test(ua)) return 'Linux';
    return 'Other';
  }

  function deviceType() {
    const ua = navigator.userAgent || '';
    if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablet';
    if (/Mobile|iPhone|iPod|Android/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  async function resolveApproximateLocation() {
    try {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timeout = controller ? setTimeout(() => controller.abort(), 2500) : null;
      const response = await fetch('https://ipapi.co/json/', {
        cache: 'no-store',
        signal: controller?.signal
      });
      if (timeout) clearTimeout(timeout);
      if (!response.ok) throw new Error('Location lookup failed.');
      const data = await response.json();
      return {
        country_code: cleanText(data.country_code || '', 3).toUpperCase(),
        country_name: cleanText(data.country_name || '', 80),
        region: cleanText(data.region || '', 100),
        region_code: cleanText(data.region_code || '', 20),
        timezone: cleanText(data.timezone || '', 80)
      };
    } catch (_) {
      return {
        country_code: '',
        country_name: '',
        region: '',
        region_code: '',
        timezone: ''
      };
    }
  }

  async function buildAnalyticsContext() {
    const locationData = await resolveApproximateLocation();
    return {
      visitor_id: visitorId(),
      landing_page: landingPage(),
      session_started_at: sessionStartedAt(),
      referrer_domain: referrerDomain(),
      screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
      device_type: deviceType(),
      browser: browserName(),
      operating_system: operatingSystem(),
      language: cleanText(navigator.language || '', 30),
      ...locationData
    };
  }

  function sessionId() {
    let value = sessionStorage.getItem(ACTIVITY_SESSION_KEY) || '';
    if (!value) {
      value = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
      try { sessionStorage.setItem(ACTIVITY_SESSION_KEY, value); } catch (_) {}
    }
    return value;
  }

  function safePath(value) {
    try {
      const url = new URL(value || location.href, location.href);
      return url.pathname || '/';
    } catch (_) {
      return String(value || '/').split('?')[0].split('#')[0] || '/';
    }
  }

  function safeHref(value) {
    if (!value) return '';
    try {
      const url = new URL(value, location.href);
      return url.origin === location.origin ? url.pathname : `${url.origin}${url.pathname}`;
    } catch (_) {
      return String(value).split('?')[0].split('#')[0].slice(0, 600);
    }
  }

  function cleanText(value, max = 240) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function targetDetails(target) {
    const el = target instanceof Element ? target : null;
    if (!el) return {};

    const interactive = el.closest('a,button,input,summary,[role="button"],[data-lwb-action]') || el;
    const tag = (interactive.tagName || '').toLowerCase();
    const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';
    const label = isInput
      ? cleanText(interactive.getAttribute('aria-label') || interactive.getAttribute('name') || interactive.getAttribute('type') || tag)
      : cleanText(interactive.getAttribute('aria-label') || interactive.getAttribute('title') || interactive.textContent || tag);

    return {
      tag,
      label,
      href: safeHref(interactive.getAttribute?.('href') || ''),
      id: cleanText(interactive.id || '', 120),
      class_name: cleanText(interactive.className && typeof interactive.className === 'string' ? interactive.className : '', 240),
      title: cleanText(document.title || '', 240)
    };
  }

  function eventBase(kind) {
    return {
      kind,
      path: safePath(location.href),
      referrer_path: document.referrer ? safePath(document.referrer) : '',
      viewport: `${window.innerWidth || 0}x${window.innerHeight || 0}`,
      session_id: sessionId(),
      client_time: new Date().toISOString(),
      title: cleanText(document.title || '', 240),
      ...(analyticsContext || {})
    };
  }

  function enqueue(event) {
    queue.push(event);
    if (queue.length >= MAX_BATCH) {
      flush();
      return;
    }
    if (!timer) timer = setTimeout(flush, 2500);
  }

  function payload(events) {
    return {
      action: 'activity-log-batch',
      events,
      account_token: localStorage.getItem(ACCOUNT_SESSION_KEY) || '',
      admin_token: localStorage.getItem(PORTAL_SESSION_KEY) || ''
    };
  }

  function send(events) {
    if (!apiUrl || !events.length) return false;
    const body = JSON.stringify(payload(events));

    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });
        if (navigator.sendBeacon(apiUrl, blob)) return true;
      }
    } catch (_) {}

    try {
      fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body,
        keepalive: true,
        redirect: 'follow'
      }).catch(() => {});
      return true;
    } catch (_) {
      return false;
    }
  }

  function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!queue.length || !apiUrl) return;
    const batch = queue.splice(0, MAX_BATCH);
    send(batch);
    if (queue.length) timer = setTimeout(flush, 300);
  }

  let started = false;

  async function start() {
    if (started) return;

    apiUrl = window.LWB_SITE_CONFIG?.apiBase || '';
    if (!apiUrl) {
      setTimeout(start, 500);
      return;
    }

    started = true;
    analyticsContext = await buildAnalyticsContext();

    enqueue(eventBase('pageview'));

    document.addEventListener('click', event => {
      enqueue({ ...eventBase('click'), ...targetDetails(event.target) });
    }, true);

    document.addEventListener('submit', event => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      if (!form) return;
      enqueue({
        ...eventBase('click'),
        tag: 'form',
        label: cleanText(form.getAttribute('aria-label') || form.getAttribute('data-lwb-action') || form.id || 'form submit'),
        id: cleanText(form.id || '', 120),
        class_name: cleanText(form.className || '', 240),
        href: ''
      });
    }, true);

    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();

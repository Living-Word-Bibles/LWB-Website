(() => {
  'use strict';

  const VERSION = '2026-09-01.1';
  if (window.__LWB_ACTIVITY_LOG_VERSION__ === VERSION) return;
  window.__LWB_ACTIVITY_LOG_VERSION__ = VERSION;

  const ACCOUNT_SESSION_KEY = 'lwbAccountSession';
  const PORTAL_SESSION_KEY = 'lwbPortalSession';
  const ACTIVITY_SESSION_KEY = 'lwbActivitySession';
  const MAX_BATCH = 25;
  const queue = [];
  let timer = null;
  let apiUrl = '';

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
      title: cleanText(document.title || '', 240)
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

  function start() {
    apiUrl = window.LWB_SITE_CONFIG?.apiBase || '';
    if (!apiUrl) {
      setTimeout(start, 500);
      return;
    }

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

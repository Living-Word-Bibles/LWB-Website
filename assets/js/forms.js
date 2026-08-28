(() => {
  'use strict';
  const EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

  const setMessage = (form, text, ok = true) => {
    const el = form.querySelector('[data-form-message]');
    if (!el) return;
    el.textContent = text || '';
    el.hidden = !text;
    el.dataset.state = ok ? 'ok' : 'error';
  };

  document.addEventListener('submit', async event => {
    const form = event.target.closest?.('form[data-lwb-action]');
    if (!form) return;
    event.preventDefault();

    const endpoint = form.dataset.endpoint || window.LWB_SITE_CONFIG?.apiBase || '';
    const action = form.dataset.lwbAction;
    const submit = form.querySelector('[type="submit"]');
    const data = Object.fromEntries(new FormData(form).entries());
    data.action = action;
    data.userAgent = navigator.userAgent;

    if (data.email) {
      data.email = String(data.email).trim().toLowerCase();
      if (!EMAIL_RE.test(data.email)) {
        setMessage(form, 'Please enter a valid email address.', false);
        form.querySelector('[name="email"]')?.focus();
        return;
      }
    }

    if (!endpoint) {
      setMessage(form, 'This form is temporarily unavailable while the new Living Word Bibles data service is being connected.', false);
      return;
    }

    const prior = submit?.textContent;
    if (submit) { submit.disabled = true; submit.textContent = 'Processing…'; }
    setMessage(form, '');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(data),
        redirect: 'follow'
      });
      const payload = await response.json();
      if (!payload.ok) throw new Error(payload.error || 'Request failed.');
      const success = action === 'unsubscribe'
        ? 'Your address has been removed from future newsletters.'
        : action === 'contact'
          ? 'Thank you. Your message has been received.'
          : 'Thank you! You are subscribed.';
      setMessage(form, success, true);
      form.reset();
    } catch (error) {
      setMessage(form, error.message || 'The server did not confirm this request. Please try again or contact Living Word Bibles.', false);
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = prior; }
    }
  });
})();

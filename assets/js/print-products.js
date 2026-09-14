(() => {
  'use strict';

  const apiBase = String(window.LWB_SITE_CONFIG?.apiBase || '').trim();
  const pagePath = location.pathname
    .replace(/\/index\.html$/i, '')
    .replace(/\/+$/, '/') || '/';

  let domReady = document.readyState !== 'loading';
  let latestPayload = null;
  let requestSerial = 0;
  let retryTimer = null;
  let completed = false;
  const activeRequests = new Map();

  function formatDate(value) {
    const text = String(value ?? '').trim();
    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return '';

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

    if (
      Number.isNaN(date.getTime()) ||
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) return '';

    const monthName = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      timeZone: 'UTC'
    }).format(date);

    return `${day} ${monthName} ${year}`;
  }

  function formatPrice(value) {
    if (value === null || value === undefined || value === '') return '';
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return '';
    return amount.toFixed(2);
  }

  function dynamicPriceElements() {
    return Array.from(document.querySelectorAll(
      '.print-bible-price[data-price-source="print-products-sheet"], ' +
      '.print-book-price[data-price-source="print-products-sheet"]'
    ));
  }

  function pageProducts(payload) {
    if (!payload || payload.ok !== true || !Array.isArray(payload.products)) return null;

    return payload.products.filter(product => {
      const target = String(product.site_page ?? '').replace(/\/+$/, '/') || '';
      return !target || target === pagePath;
    });
  }

  function renderProducts(payload) {
    if (!domReady) return { rendered: 0, expected: 0, complete: false };

    const products = pageProducts(payload);
    if (!products) return { rendered: 0, expected: 0, complete: false };

    const byId = new Map();
    products.forEach(product => {
      const id = String(product.print_product_id ?? '').trim();
      if (id) byId.set(id, product);
    });

    const priceEls = dynamicPriceElements();
    const successfulDates = [];
    let renderedCount = 0;

    priceEls.forEach(priceEl => {
      const card = priceEl.closest('[data-print-product-id]');
      const id = String(card?.dataset.printProductId || '').trim();
      const product = id ? byId.get(id) : null;
      const amount = formatPrice(product?.current_price);
      const observedDate = formatDate(product?.price_observed_date);

      if (!product || !amount || !observedDate) {
        priceEl.replaceChildren();
        priceEl.hidden = true;
        return;
      }

      priceEl.replaceChildren();
      priceEl.hidden = false;
      priceEl.append(`From $${amount}`);

      const small = document.createElement('small');
      if (priceEl.classList.contains('print-book-price')) {
        small.textContent = `Paperback starting price observed on Amazon ${observedDate}. Price, condition, seller, shipping, and availability may change.`;
      } else {
        small.textContent = `Amazon listing price observed ${observedDate}. Price, seller, shipping, and availability may change.`;
      }
      priceEl.appendChild(small);

      successfulDates.push(String(product.price_observed_date));
      renderedCount += 1;
    });

    renderPageNote(successfulDates);

    return {
      rendered: renderedCount,
      expected: priceEls.length,
      complete: priceEls.length > 0 && renderedCount === priceEls.length
    };
  }

  function renderPageNote(dateValues) {
    const note = document.querySelector(
      '.print-bible-note[data-price-note-source="print-products-sheet"], ' +
      '.print-book-note[data-price-note-source="print-products-sheet"]'
    );
    if (!note) return;

    const validDates = dateValues
      .map(value => String(value || '').trim())
      .filter(value => /^\d{4}-\d{2}-\d{2}$/.test(value))
      .sort();

    if (!validDates.length) {
      note.replaceChildren();
      note.hidden = true;
      return;
    }

    const observedDate = formatDate(validDates[validDates.length - 1]);
    if (!observedDate) {
      note.replaceChildren();
      note.hidden = true;
      return;
    }

    note.hidden = false;
    note.textContent =
      `Prices shown are current starting paperback prices observed on the linked Amazon product listings as of ${observedDate} and are subject to change at any time. ` +
      'Amazon determines product pricing, condition, availability, sellers, shipping, and fulfillment terms. ' +
      'Living Word Bibles does not process Amazon orders on this website.';
  }

  function retireCallback(name) {
    window[name] = () => {};
    setTimeout(() => {
      try { delete window[name]; } catch (_) { window[name] = undefined; }
    }, 30000);
  }

  function settleRequest(name) {
    const request = activeRequests.get(name);
    if (!request) return;

    clearTimeout(request.watchdog);
    request.script.remove();
    activeRequests.delete(name);
    retireCallback(name);
  }

  function cancelAllRequests() {
    Array.from(activeRequests.keys()).forEach(settleRequest);
  }

  function finish() {
    completed = true;
    cancelAllRequests();
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  function scheduleRetry(delay) {
    if (completed || !apiBase) return;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      requestPrices();
    }, delay);
  }

  function acceptPayload(payload) {
    if (!payload || payload.ok !== true || !Array.isArray(payload.products)) return false;

    latestPayload = payload;

    if (!domReady) {
      cancelAllRequests();
      return true;
    }

    const result = renderProducts(payload);
    if (result.complete) {
      finish();
    } else {
      scheduleRetry(3000);
    }
    return true;
  }

  function requestPrices() {
    if (completed || !apiBase) return;

    requestSerial += 1;
    const attempt = requestSerial;
    const callbackName = `LWB_PRINT_PRODUCTS_RECEIVE_${Date.now()}_${attempt}`;
    const script = document.createElement('script');

    window[callbackName] = payload => {
      settleRequest(callbackName);
      if (!acceptPayload(payload)) scheduleRetry(750);
    };

    script.async = true;
    script.src =
      `${apiBase}?action=print-products&callback=${encodeURIComponent(callbackName)}` +
      `&_=${Date.now()}`;

    script.onerror = () => {
      settleRequest(callbackName);
      scheduleRetry(750);
    };

    const watchdog = setTimeout(() => {
      settleRequest(callbackName);
      scheduleRetry(attempt < 3 ? 750 : 3000);
    }, 2500);

    activeRequests.set(callbackName, { script, watchdog });
    document.head.appendChild(script);
  }

  if (!domReady) {
    document.addEventListener('DOMContentLoaded', () => {
      domReady = true;

      if (latestPayload) {
        const result = renderProducts(latestPayload);
        if (result.complete) {
          finish();
        } else {
          scheduleRetry(3000);
        }
      }
    }, { once: true });
  }

  if (apiBase) requestPrices();
})();

(() => {
  'use strict';

  const CALLBACK = 'LWB_PRINT_PRODUCTS_RECEIVE';
  const apiBase = String(window.LWB_SITE_CONFIG?.apiBase || '').trim();
  const pagePath = location.pathname
    .replace(/\/index\.html$/i, '')
    .replace(/\/+$/, '/') || '/';

  let domReady = document.readyState !== 'loading';
  let receivedPayload = null;
  let requestFailed = false;
  let requestScript = null;

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

  function priceElements() {
    return Array.from(document.querySelectorAll(
      '.print-bible-price[data-price-source="print-products-sheet"], ' +
      '.print-book-price[data-price-source="print-products-sheet"]'
    ));
  }

  function setUnavailable(priceEl) {
    priceEl.replaceChildren();
    priceEl.textContent = 'Current Amazon price unavailable';
    const small = document.createElement('small');
    small.textContent = 'View on Amazon for current pricing.';
    priceEl.appendChild(small);
  }

  function setPending(priceEl) {
    if (priceEl.textContent.trim()) return;
    priceEl.textContent = 'Current price available on Amazon';
  }

  function pageProducts(payload) {
    if (!payload?.ok || !Array.isArray(payload.products)) return null;
    return payload.products.filter(product => {
      const target = String(product.site_page ?? '').replace(/\/+$/, '/') || '';
      return !target || target === pagePath;
    });
  }

  function renderProducts(payload) {
    const products = pageProducts(payload);
    if (!products) {
      renderFailure();
      return;
    }

    const byId = new Map();
    products.forEach(product => {
      const id = String(product.print_product_id ?? '').trim();
      if (id) byId.set(id, product);
    });

    const successfulDates = [];

    priceElements().forEach(priceEl => {
      const card = priceEl.closest('[data-print-product-id]');
      const id = String(card?.dataset.printProductId || '').trim();
      const product = id ? byId.get(id) : null;
      const amount = formatPrice(product?.current_price);
      const observedDate = formatDate(product?.price_observed_date);

      if (!product || !amount || !observedDate) {
        setUnavailable(priceEl);
        return;
      }

      priceEl.replaceChildren();
      priceEl.textContent = `From $${amount}`;

      const small = document.createElement('small');
      if (priceEl.classList.contains('print-book-price')) {
        small.textContent = `Paperback starting price observed on Amazon ${observedDate}. Price, condition, seller, shipping, and availability may change.`;
      } else {
        small.textContent = `Amazon listing price observed ${observedDate}. Price, seller, shipping, and availability may change.`;
      }
      priceEl.appendChild(small);
      successfulDates.push(String(product.price_observed_date));
    });

    renderPageNote(successfulDates);
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
      note.textContent = 'Amazon pricing is temporarily unavailable. Please use the View on Amazon buttons for current pricing.';
      return;
    }

    const observedDate = formatDate(validDates[validDates.length - 1]);
    if (!observedDate) {
      note.textContent = 'Amazon pricing is temporarily unavailable. Please use the View on Amazon buttons for current pricing.';
      return;
    }

    note.textContent = `Prices shown are current starting paperback prices observed on the linked Amazon product listings as of ${observedDate} and are subject to change at any time. Amazon determines product pricing, condition, availability, sellers, shipping, and fulfillment terms. Living Word Bibles does not process Amazon orders on this website.`;
  }

  function renderFailure() {
    priceElements().forEach(setUnavailable);
    renderPageNote([]);
  }

  function renderPendingState() {
    priceElements().forEach(setPending);
  }

  function tryRender() {
    if (!domReady) return;
    if (receivedPayload) {
      renderProducts(receivedPayload);
      return;
    }
    if (requestFailed) {
      renderFailure();
      return;
    }
    renderPendingState();
  }

  window[CALLBACK] = payload => {
    receivedPayload = payload;
    if (requestScript) requestScript.remove();
    tryRender();
  };

  if (!domReady) {
    document.addEventListener('DOMContentLoaded', () => {
      domReady = true;
      tryRender();
    }, { once: true });
  }

  if (!apiBase) {
    requestFailed = true;
    tryRender();
    return;
  }

  requestScript = document.createElement('script');
  requestScript.async = true;
  requestScript.src = `${apiBase}?action=print-products&callback=${encodeURIComponent(CALLBACK)}&_=${Date.now()}`;
  requestScript.onerror = () => {
    requestFailed = true;
    requestScript?.remove();
    tryRender();
  };
  document.head.appendChild(requestScript);
})();

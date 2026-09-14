(() => {
  'use strict';

  const apiBase = window.LWB_SITE_CONFIG?.apiBase || '';
  if (!apiBase) return;

  const pagePath = location.pathname
    .replace(/\/index\.html$/i, '')
    .replace(/\/+$/, '/') || '/';

  function formatDate(value) {
    const text = String(value ?? '').trim();
    if (!text) return '';

    const m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return text;

    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`);
    if (Number.isNaN(d.getTime())) return text;

    return new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(d);
  }

  function formatPrice(value) {
    const text = String(value ?? '').trim();
    if (!text) return '';

    const n = Number(text);
    if (!Number.isFinite(n) || n < 0) return '';
    return n.toFixed(2);
  }

  function findCard(product) {
    const productId = String(product.print_product_id ?? '').trim();
    const asin = String(product.asin ?? '').trim();

    if (productId) {
      const byId = document.querySelector(
        `[data-print-product-id="${CSS.escape(productId)}"]`
      );
      if (byId) return byId;
    }

    if (asin) {
      const byAsin = document.querySelector(
        `[data-amazon-asin="${CSS.escape(asin)}"]`
      );
      if (byAsin) return byAsin.closest('article');
    }

    return null;
  }

  function renderProduct(product) {
    const card = findCard(product);
    if (!card) return;

    const priceEl = card.querySelector(
      '.print-bible-price[data-price-source="print-products-sheet"], ' +
      '.print-book-price[data-price-source="print-products-sheet"]'
    );
    if (!priceEl) return;

    const amount = formatPrice(product.current_price);
    const observedDate = formatDate(product.price_observed_date);

    if (!amount || !observedDate) {
      priceEl.replaceChildren();
      return;
    }

    const small = document.createElement('small');

    if (priceEl.classList.contains('print-book-price')) {
      priceEl.textContent = `$${amount}`;
      small.textContent = `Paperback price observed on Amazon ${observedDate}. Price, condition, seller, shipping, and availability may change.`;
    } else {
      priceEl.textContent = `$${amount}`;
      small.textContent = `Amazon listing price observed ${observedDate}. Price, seller, shipping, and availability may change.`;
    }

    priceEl.appendChild(small);
  }

  function updatePageNote(products) {
    const dates = products
      .map(product => String(product.price_observed_date ?? '').trim())
      .filter(Boolean)
      .sort();

    if (!dates.length) return;

    const observedDate = formatDate(dates[dates.length - 1]);
    if (!observedDate) return;

    const note = document.querySelector(
      '.print-bible-note[data-price-note-source="print-products-sheet"], ' +
      '.print-book-note[data-price-note-source="print-products-sheet"]'
    );
    if (!note) return;

    note.textContent = `Prices shown are current starting paperback prices observed on the linked Amazon product listings as of ${observedDate} and are subject to change at any time. Amazon determines product pricing, condition, availability, sellers, shipping, and fulfillment terms. Living Word Bibles does not process Amazon orders on this website.`;
  }

  function loadPrintProducts() {
    const callback = `lwbPrintProducts${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const script = document.createElement('script');

    const cleanup = () => {
      try { delete window[callback]; } catch (_) { window[callback] = undefined; }
      script.remove();
    };

    const timer = window.setTimeout(cleanup, 10000);

    window[callback] = payload => {
      window.clearTimeout(timer);
      cleanup();

      if (!payload?.ok || !Array.isArray(payload.products)) return;

      const products = payload.products.filter(product => {
        const target = String(product.site_page ?? '')
          .replace(/\/+$/, '/') || '';
        return !target || target === pagePath;
      });

      products.forEach(renderProduct);
      updatePageNote(products);
    };

    script.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
    };

    script.src = `${apiBase}?action=print-products&callback=${encodeURIComponent(callback)}`;
    document.head.appendChild(script);
  }

  loadPrintProducts();
})();

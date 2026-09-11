(() => {
  'use strict';

  const apiBase = window.LWB_SITE_CONFIG?.apiBase || '';
  if (!apiBase) return;

  const pagePath = location.pathname.replace(/\/index\.html$/i, '').replace(/\/+$/, '/') || '/';

  function formatDate(value) {
    const text = String(value || '').trim();
    const m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return text;
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`);
    if (Number.isNaN(d.getTime())) return text;
    return new Intl.DateTimeFormat('en-US', { day:'numeric', month:'long', year:'numeric', timeZone:'UTC' }).format(d);
  }

  function price(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n.toFixed(2) : '0.00';
  }

  function updateCard(product) {
    const productId = String(product.print_product_id || '').trim();
    const asin = String(product.asin || '').trim();

    // Stable internal product ID is authoritative. ASIN is only a fallback
    // because spreadsheet software may coerce numeric ASINs and strip leading zeros.
    let card = productId
      ? document.querySelector(`[data-print-product-id="${CSS.escape(productId)}"]`)
      : null;

    if (!card && asin) {
      const anchor = document.querySelector(`[data-amazon-asin="${CSS.escape(asin)}"]`);
      card = anchor?.closest('article') || null;
    }

    if (!card) return;
    const priceEl = card.querySelector('.print-bible-price, .print-book-price');
    if (!priceEl) return;

    const date = formatDate(product.price_observed_date);
    const amount = price(product.current_price);
    if (card.querySelector('.print-book-price')) {
      priceEl.innerHTML = `From $${amount}<small>Paperback starting price observed on Amazon ${date}. Price, condition, seller, shipping, and availability may change.</small>`;
    } else {
      priceEl.innerHTML = `From $${amount}<small>Amazon listing price observed ${date}. Price, seller, shipping, and availability may change.</small>`;
    }
  }

  function updatePageNote(products) {
    const dates = products.map(p => String(p.price_observed_date || '')).filter(Boolean).sort();
    if (!dates.length) return;
    const latest = formatDate(dates[dates.length - 1]);
    const bibleNote = document.querySelector('.print-bible-note');
    const bookNote = document.querySelector('.print-book-note');
    if (bibleNote) bibleNote.textContent = `Prices shown are current starting prices observed on the linked Amazon product listings as of ${latest} and are subject to change at any time. Amazon determines product pricing, availability, sellers, shipping, and fulfillment terms. Living Word Bibles does not process Amazon orders on this website.`;
    if (bookNote) bookNote.textContent = `Prices shown are current starting paperback prices observed on the linked Amazon product listings as of ${latest} and are subject to change at any time. Amazon determines product pricing, condition, availability, sellers, shipping, and fulfillment terms. Living Word Bibles does not process Amazon orders on this website.`;
  }

  function load() {
    const callback = `lwbPrintProducts${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const script = document.createElement('script');
    const timer = setTimeout(() => {
      delete window[callback];
      script.remove();
    }, 10000);

    window[callback] = payload => {
      clearTimeout(timer);
      delete window[callback];
      script.remove();
      if (!payload?.ok || !Array.isArray(payload.products)) return;
      const products = payload.products.filter(product => {
        const target = String(product.site_page || '').replace(/\/+$/, '/') || '';
        return !target || target === pagePath;
      });
      products.forEach(updateCard);
      updatePageNote(products);
    };

    script.src = `${apiBase}?action=print-products&callback=${encodeURIComponent(callback)}`;
    script.onerror = () => {
      clearTimeout(timer);
      delete window[callback];
      script.remove();
    };
    document.head.appendChild(script);
  }

  load();
})();

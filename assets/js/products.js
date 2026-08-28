(() => {
  const paypalClient = document.documentElement.dataset.paypalClient;
  const apiBase = window.LWB_SITE_CONFIG?.apiBase || '';
  const api = document.body.dataset.productsApi || (apiBase ? `${apiBase}?action=products` : '');

  function money(value) {
    const n = Number(value || 0);
    return n === 0 ? 'FREE' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  }

  function refreshCards(products) {
    const bySlug = new Map((products || []).map(p => [String(p.slug), p]));
    document.querySelectorAll('[data-product-card]').forEach(card => {
      const p = bySlug.get(card.dataset.productSlug);
      if (!p) return;
      card.querySelectorAll('[data-product-title]').forEach(el => { el.textContent = p.title || el.textContent; });
      card.querySelectorAll('[data-product-description]').forEach(el => { el.textContent = p.description || el.textContent; });
      card.querySelectorAll('[data-product-link]').forEach(el => { if (p.canonical_path) el.href = `${String(p.canonical_path).replace(/\/$/, '')}/`; });
      const price = card.querySelector('[data-product-price]');
      if (price) {
        const original = Number(p.original_price || 0);
        price.innerHTML = `${money(p.price)}${original ? ` <del>${money(original)}</del>` : ''}`;
      }
      const img = card.querySelector('.product-cover img');
      if (img && p.cover_path) img.src = p.cover_path;
      const paypal = card.querySelector('[data-paypal-button]');
      if (paypal && p.paypal_button_id) paypal.dataset.paypalButton = p.paypal_button_id;
    });
  }

  function loadCatalog() {
    if (!api) return Promise.resolve([]);
    return new Promise((resolve, reject) => {
      const callback = `lwbProducts${Date.now()}${Math.floor(Math.random() * 1000)}`;
      const script = document.createElement('script');
      const timer = setTimeout(() => {
        delete window[callback];
        script.remove();
        reject(new Error('Product catalog timed out.'));
      }, 10000);
      window[callback] = payload => {
        clearTimeout(timer);
        delete window[callback];
        script.remove();
        if (!payload?.ok || !Array.isArray(payload.products)) return reject(new Error(payload?.error || 'Catalog unavailable.'));
        refreshCards(payload.products);
        resolve(payload.products);
      };
      script.src = `${api}${api.includes('?') ? '&' : '?'}callback=${encodeURIComponent(callback)}`;
      script.onerror = () => {
        clearTimeout(timer);
        delete window[callback];
        script.remove();
        reject(new Error('Product catalog unavailable.'));
      };
      document.head.appendChild(script);
    });
  }

  function loadPayPal() {
    const containers = [...document.querySelectorAll('[data-paypal-button]')];
    if (!containers.length || !paypalClient) return Promise.resolve();
    return new Promise((resolve, reject) => {
      if (window.paypal?.HostedButtons) return resolve(window.paypal);
      const existing = document.querySelector('script[data-lwb-paypal]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.paypal), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.dataset.lwbPaypal = 'true';
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(paypalClient)}&components=hosted-buttons&enable-funding=venmo&currency=USD`;
      script.onload = () => resolve(window.paypal);
      script.onerror = reject;
      document.head.appendChild(script);
    }).then(paypal => {
      containers.forEach(node => {
        const id = node.dataset.paypalButton;
        if (!id || node.dataset.rendered || !node.id) return;
        node.dataset.rendered = 'true';
        paypal.HostedButtons({ hostedButtonId: id }).render(`#${CSS.escape(node.id)}`);
      });
    }).catch(() => {
      containers.forEach(node => {
        if (!node.dataset.rendered) node.innerHTML = '<p class="notice warning">PayPal checkout could not load. Please refresh or contact Living Word Bibles.</p>';
      });
    });
  }

  // Sheet data enhances the static SEO catalog. A network failure leaves the
  // generated product cards and Hosted Button IDs intact.
  loadCatalog().catch(() => []).finally(loadPayPal);
})();

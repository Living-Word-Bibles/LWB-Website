(() => {
  'use strict';
  const page = document.querySelector('[data-order-complete]');
  if (!page) return;
  const box = page.querySelector('[data-order-status]');
  const api = page.dataset.api || window.LWB_SITE_CONFIG?.apiBase || '';
  const params = new URLSearchParams(location.search);
  const tx = params.get('tx') || params.get('txn_id') || '';
  const product = params.get('product') || params.get('slug') || '';

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const render = (html, className='') => { box.className = `content-card ${className}`.trim(); box.innerHTML = html; };

  if (!api) {
    render('<h2>Fulfillment setup required</h2><p>The website is installed, but the Google Apps Script endpoint is not configured.</p>', 'notice warning');
    return;
  }
  if (!tx) {
    render('<h2>Transaction ID not received</h2><p>PayPal did not return a transaction ID. Open the payment confirmation email or contact Living Word Bibles with the PayPal receipt.</p>', 'notice warning');
    return;
  }

  const jsonp = url => new Promise((resolve, reject) => {
    const callback = `lwbOrder${Date.now()}${Math.floor(Math.random()*1000)}`;
    const script = document.createElement('script');
    const timer = setTimeout(() => cleanup(new Error('Verification timed out.')), 20000);
    function cleanup(error) {
      clearTimeout(timer); script.remove(); delete window[callback];
      if (error) reject(error);
    }
    window[callback] = payload => { cleanup(); resolve(payload); };
    script.src = `${url}${url.includes('?')?'&':'?'}callback=${encodeURIComponent(callback)}`;
    script.onerror = () => cleanup(new Error('The verification service could not be reached.'));
    document.head.appendChild(script);
  });

  render('<p class="reader-loading">Verifying the completed PayPal transaction…</p>');
  const url = `${api}${api.includes('?')?'&':'?'}action=verify-pdt&tx=${encodeURIComponent(tx)}&product=${encodeURIComponent(product)}`;
  jsonp(url).then(payload => {
    if (!payload?.ok) throw new Error(payload?.error || 'PayPal verification was not successful.');
    const title = escapeHtml(payload.product?.title || 'Your eBible');
    const email = escapeHtml(payload.email || 'your PayPal email address');
    const download = payload.download_url ? `<a class="btn" href="${escapeHtml(payload.download_url)}">Download ${title}</a>` : '';
    render(`<div class="order-download"><h2>Purchase Verified</h2><p><strong>${title}</strong> is ready. A purchase record has been saved for ${email}.</p>${download}<p class="muted">This secure download link expires. Return to this confirmation page or contact support if another copy is needed.</p></div>`, 'notice success');
  }).catch(error => {
    render(`<h2>We could not finish verification automatically</h2><p>${escapeHtml(error.message)}</p><p>Your payment may still be complete. Keep your PayPal receipt and contact <a href="mailto:gospellivingwordbibles@gmail.com">gospellivingwordbibles@gmail.com</a> so the order can be matched and fulfilled.</p>`, 'notice warning');
  });
})();

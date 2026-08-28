/**
 * Living Word Bibles — STEP 4
 * Core Website API
 *
 * Account: gospellivingwordbibles@gmail.com
 * Spreadsheet: LWB Website
 * Legal display date: 27 August 2026
 *
 * THIS SCRIPT DOES NOT:
 * - create or rebuild website pages
 * - create or replace spreadsheet tabs
 * - change product prices
 * - change PayPal Hosted Button IDs
 * - change any PayPal receiver email
 * - use Google Contacts / People API
 *
 * Existing resources:
 * Spreadsheet ID: 1xnzdo1UJsEOTqcO2066Nfb6ayqKn8Zg5RbNLdpbaTcc
 * Product folder ID: 1G6H26CknI1XI090cMVVjb8aVYxM94APP
 */

const LWB = Object.freeze({
  SITE_URL: 'https://www.livingwordbibles.com',
  CONTACT_EMAIL: 'gospellivingwordbibles@gmail.com',
  SPREADSHEET_ID: '1xnzdo1UJsEOTqcO2066Nfb6ayqKn8Zg5RbNLdpbaTcc',
  PRODUCT_FOLDER_ID: '1G6H26CknI1XI090cMVVjb8aVYxM94APP',
  CONSENT_VERSION: '2026-08-27',
  EMAIL_RE: /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/,
  CALLBACK_RE: /^[A-Za-z_$][0-9A-Za-z_$\.]{0,80}$/,
  SHEETS: Object.freeze({
    SETTINGS: 'Settings',
    PRODUCTS: 'Products',
    FEATURES: 'Product Features',
    IMAGES: 'Product Images',
    ASSETS: 'Digital Assets',
    CUSTOMERS: 'Customers',
    ORDERS: 'Orders',
    ORDER_ITEMS: 'Order Items',
    ENTITLEMENTS: 'Entitlements',
    DOWNLOADS: 'Download Log',
    SUBSCRIBERS: 'Newsletter Subscribers',
    AUDIENCE: 'Audience Memberships',
    DNE: 'Do Not Email',
    CONTACT: 'Contact Messages',
    CAMPAIGNS: 'Newsletter Campaigns',
    SOCIAL: 'Social Posts',
    LOG: 'System Log'
  })
});

/* ========================================================================== */
/* STEP 4 INSTALL / VERIFY                                                    */
/* ========================================================================== */

/**
 * Run ONCE after pasting this file into Code.gs.
 *
 * It records only the already-created Sheet/Drive IDs and generates the
 * download-signing secret if one does not already exist.
 *
 * It does NOT set or change PayPal properties.
 */
function step4ConfigureCoreApi() {
  const props = PropertiesService.getScriptProperties();

  props.setProperty('LWB_SHEET_ID', LWB.SPREADSHEET_ID);
  props.setProperty('LWB_DRIVE_FOLDER_ID', LWB.PRODUCT_FOLDER_ID);

  if (!props.getProperty('DOWNLOAD_TOKEN_SECRET')) {
    props.setProperty(
      'DOWNLOAD_TOKEN_SECRET',
      Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid()
    );
  }

  const ss = SpreadsheetApp.openById(LWB.SPREADSHEET_ID);
  const folder = DriveApp.getFolderById(LWB.PRODUCT_FOLDER_ID);

  Logger.log('STEP 4 CONFIGURATION COMPLETE');
  Logger.log('Spreadsheet OK: ' + ss.getName());
  Logger.log('Product folder OK: ' + folder.getName());
  Logger.log('Public contact: ' + LWB.CONTACT_EMAIL);
  Logger.log('PayPal settings: UNCHANGED');
}

/**
 * Run after deployment as a quick backend health test.
 */
function step4HealthCheck() {
  const result = healthCheck_();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/* ========================================================================== */
/* WEB APP                                                                    */
/* ========================================================================== */

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const action = String(p.action || 'ping').toLowerCase();

    if (action === 'download') {
      return downloadRedirect_(p);
    }

    let payload;

    switch (action) {
      case 'ping':
        payload = {
          ok: true,
          service: 'LWB Website API',
          version: '3.0.0',
          time: new Date().toISOString()
        };
        break;

      case 'health':
        payload = healthCheck_();
        break;

      case 'settings':
        payload = { ok: true, settings: getPublicSettings_() };
        break;

      case 'products':
        payload = { ok: true, products: listProducts_(p) };
        break;

      case 'product':
        payload = {
          ok: true,
          product: getProduct_(p.slug || p.id || p.product || '')
        };
        break;

      case 'social':
        payload = { ok: true, posts: listSocialPosts_(p) };
        break;

      case 'free-download-link':
        payload = freeDownloadLink_(p);
        break;

      /*
       * Preserved for the existing payment-complete page.
       * It will return a clear configuration error until the existing
       * PayPal PDT credential is deliberately added in the PayPal step.
       */
      case 'verify-pdt':
        payload = verifyPayPalPdt_(p);
        break;

      default:
        payload = { ok: false, error: 'Unknown GET action' };
    }

    return output_(payload, p.callback);
  } catch (err) {
    logSystem_('ERROR', 'GET', '', '', 'web-app', safeError_(err), {});
    return output_({ ok: false, error: safeError_(err) }, null);
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const data = parsePost_(e);
    const action = String(data.action || '').toLowerCase();
    let payload;

    switch (action) {
      case 'subscribe':
        payload = subscribe_(data);
        break;

      case 'unsubscribe':
        payload = unsubscribe_(data);
        break;

      case 'contact':
        payload = submitContact_(data);
        break;

      case 'free-download':
        payload = createFreeEntitlement_(data);
        break;

      default:
        payload = { ok: false, error: 'Unknown POST action' };
    }

    return output_(payload, data.callback);
  } catch (err) {
    logSystem_('ERROR', 'POST', '', '', 'web-app', safeError_(err), {});
    return output_({ ok: false, error: safeError_(err) }, null);
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/* ========================================================================== */
/* PUBLIC CATALOG                                                             */
/* ========================================================================== */

function listProducts_(params) {
  const includeInactive =
    String((params && params.include_inactive) || '').toLowerCase() === 'true';

  return readObjects_(sheet_(LWB.SHEETS.PRODUCTS))
    .filter(function(row) {
      return includeInactive ||
        String(row.status || '').toLowerCase() === 'active';
    })
    .sort(function(a, b) {
      return Number(a.sort_order || 0) - Number(b.sort_order || 0);
    })
    .map(publicProduct_);
}

function getProduct_(slugOrId) {
  const key = String(slugOrId || '').trim();
  if (!key) return null;

  const row = readObjects_(sheet_(LWB.SHEETS.PRODUCTS))
    .find(function(product) {
      return String(product.slug) === key ||
        String(product.product_id) === key;
    });

  return row ? publicProduct_(row) : null;
}

function listSocialPosts_(params) {
  const limit = Math.min(
    50,
    Math.max(1, Number((params && params.limit) || 12))
  );

  return readObjects_(sheet_(LWB.SHEETS.SOCIAL))
    .filter(function(row) {
      return String(row.status || '').toLowerCase() === 'published';
    })
    .sort(function(a, b) {
      return new Date(b.published_at || 0) - new Date(a.published_at || 0);
    })
    .slice(0, limit)
    .map(function(row) {
      return pick_(row, [
        'post_id',
        'platform',
        'title',
        'caption',
        'image_url',
        'post_url',
        'published_at'
      ]);
    });
}

function getPublicSettings_() {
  const out = {};

  readObjects_(sheet_(LWB.SHEETS.SETTINGS))
    .forEach(function(row) {
      if (truthy_(row.public)) {
        out[String(row.key)] = row.value;
      }
    });

  return out;
}

/* ========================================================================== */
/* NEWSLETTER                                                                 */
/* ========================================================================== */

function subscribe_(data) {
  const email = normalizeEmail_(data.email);
  const name = clean_(data.name || '', 160);
  const source = clean_(data.source || 'lwb-website', 100);
  const ua = clean_(data.userAgent || data.user_agent || '', 500);

  if (!validEmail_(email)) {
    return { ok: false, error: 'Invalid email address' };
  }

  if (findBy_(sheet_(LWB.SHEETS.DNE), 'email', email)) {
    logSystem_(
      'WARN',
      'SUBSCRIBE_BLOCKED',
      email,
      '',
      source,
      'Address is on Do Not Email',
      {}
    );

    return {
      ok: false,
      error:
        'This address cannot be subscribed through the automated form. ' +
        'Contact support for help.'
    };
  }

  const now = new Date();
  const subscriberSheet = sheet_(LWB.SHEETS.SUBSCRIBERS);
  const existing = findBy_(subscriberSheet, 'email', email);

  const record = {
    subscriber_id: existing ? existing.subscriber_id : uuid_(),
    email: email,
    name: name || (existing && existing.name) || '',
    status: 'subscribed',
    source: source,
    consent_version:
      clean_(data.consent_version || LWB.CONSENT_VERSION, 50),
    subscribed_at:
      existing && existing.subscribed_at ?
        existing.subscribed_at :
        now,
    unsubscribed_at: '',
    updated_at: now,
    user_agent: ua
  };

  upsertByKey_(subscriberSheet, 'email', email, record);

  let membership = readObjects_(sheet_(LWB.SHEETS.AUDIENCE))
    .find(function(row) {
      return normalizeEmail_(row.email) === email &&
        String(row.audience) === 'Subscribe';
    });

  upsertByKey_(
    sheet_(LWB.SHEETS.AUDIENCE),
    'membership_id',
    membership ? membership.membership_id : uuid_(),
    {
      membership_id:
        membership ? membership.membership_id : uuid_(),
      email: email,
      audience: 'Subscribe',
      status: 'active',
      created_at:
        membership && membership.created_at ?
          membership.created_at :
          now,
      updated_at: now
    }
  );

  logSystem_(
    'INFO',
    'SUBSCRIBE',
    email,
    record.subscriber_id,
    source,
    existing ? 'reactivated-or-existing' : 'added',
    {}
  );

  return {
    ok: true,
    email: email,
    added: !existing,
    status: 'subscribed'
  };
}

function unsubscribe_(data) {
  const email = normalizeEmail_(data.email);
  const source = clean_(data.source || 'lwb-website-opt-out', 100);
  const ua = clean_(data.userAgent || data.user_agent || '', 500);

  if (!validEmail_(email)) {
    return { ok: false, error: 'Invalid email address' };
  }

  const now = new Date();
  const subscriberSheet = sheet_(LWB.SHEETS.SUBSCRIBERS);
  const existing = findBy_(subscriberSheet, 'email', email);

  if (existing) {
    existing.status = 'unsubscribed';
    existing.unsubscribed_at = now;
    existing.updated_at = now;
    existing.user_agent = ua;

    upsertByKey_(
      subscriberSheet,
      'email',
      email,
      existing
    );
  }

  const dneSheet = sheet_(LWB.SHEETS.DNE);
  const existingDne = findBy_(dneSheet, 'email', email);

  upsertByKey_(
    dneSheet,
    'email',
    email,
    {
      dne_id: existingDne ? existingDne.dne_id : uuid_(),
      email: email,
      source: source,
      reason: clean_(data.reason || 'newsletter opt-out', 200),
      created_at:
        existingDne && existingDne.created_at ?
          existingDne.created_at :
          now,
      updated_at: now,
      user_agent: ua
    }
  );

  deactivateAudience_(email);

  logSystem_(
    'INFO',
    'UNSUBSCRIBE',
    email,
    existing ? existing.subscriber_id : '',
    source,
    existing ? 'unsubscribed' : 'not-found-added-to-dne',
    {}
  );

  return {
    ok: true,
    email: email,
    status: 'unsubscribed'
  };
}

/* ========================================================================== */
/* CONTACT FORM                                                               */
/* ========================================================================== */

function submitContact_(data) {
  const email = normalizeEmail_(data.email);
  const name = clean_(data.name || '', 160);
  const subject = clean_(data.subject || 'Website message', 180);
  const message = clean_(data.message || '', 10000);

  if (!validEmail_(email)) {
    return { ok: false, error: 'Invalid email address' };
  }

  if (!message) {
    return { ok: false, error: 'Message is required' };
  }

  const id = uuid_();

  appendObject_(
    sheet_(LWB.SHEETS.CONTACT),
    {
      message_id: id,
      timestamp: new Date(),
      name: name,
      email: email,
      subject: subject,
      message: message,
      source: clean_(data.source || 'lwb-website', 100),
      status: 'new',
      user_agent: clean_(data.userAgent || data.user_agent || '', 500)
    }
  );

  logSystem_(
    'INFO',
    'CONTACT_MESSAGE',
    email,
    id,
    'website',
    'received',
    {}
  );

  return { ok: true, message_id: id };
}

/* ========================================================================== */
/* FREE PRODUCTS / ENTITLEMENTS                                               */
/* ========================================================================== */

function createFreeEntitlement_(data) {
  const product = getProduct_(data.slug || data.product_id || '');

  if (!product) {
    return { ok: false, error: 'Product not found' };
  }

  if (Number(product.price) !== 0) {
    return {
      ok: false,
      error: 'Paid products require verified payment'
    };
  }

  const email = normalizeEmail_(data.email || '');

  const entitlement = grantEntitlement_({
    customer_id: '',
    email: email,
    product_id: product.product_id,
    order_id: '',
    source: 'free-product'
  });

  return Object.assign(
    { ok: true, product: product },
    entitlement
  );
}

function grantEntitlement_(data) {
  const entitlementSheet = sheet_(LWB.SHEETS.ENTITLEMENTS);

  const email = normalizeEmail_(data.email || '');
  const customerId = clean_(data.customer_id || '', 200);
  const productId = clean_(data.product_id || '', 200);

  if (!productId) {
    return { ok: false, error: 'Product is required' };
  }

  const existing = readObjects_(entitlementSheet)
    .find(function(row) {
      return String(row.product_id) === productId &&
        String(row.status) === 'active' &&
        (
          (
            customerId &&
            String(row.customer_id) === customerId
          ) ||
          (
            email &&
            normalizeEmail_(row.email) === email
          )
        );
    });

  if (existing) {
    return {
      ok: true,
      entitlement_id: existing.entitlement_id,
      existing: true
    };
  }

  const id = uuid_();

  appendObject_(
    entitlementSheet,
    {
      entitlement_id: id,
      customer_id: customerId,
      email: email,
      product_id: productId,
      order_id: clean_(data.order_id || '', 200),
      status: 'active',
      source: clean_(data.source || 'manual', 100),
      granted_at: new Date(),
      expires_at: data.expires_at || '',
      revoked_at: '',
      notes: clean_(data.notes || '', 500)
    }
  );

  logSystem_(
    'INFO',
    'ENTITLEMENT_GRANTED',
    email,
    id,
    data.source || 'manual',
    productId,
    { customer_id: customerId }
  );

  return {
    ok: true,
    entitlement_id: id,
    existing: false
  };
}

/* ========================================================================== */
/* ORDERS                                                                     */
/* ========================================================================== */

function recordOrder_(order) {
  const orderSheet = sheet_(LWB.SHEETS.ORDERS);

  const id = clean_(order.order_id || '', 200) || uuid_();

  const existing =
    findBy_(orderSheet, 'order_id', id) ||
    (
      order.paypal_order_id &&
      findBy_(orderSheet, 'paypal_order_id', order.paypal_order_id)
    );

  const now = new Date();

  const record = Object.assign(
    {},
    existing || {},
    {
      order_id:
        existing && existing.order_id ?
          existing.order_id :
          id,
      paypal_order_id:
        clean_(order.paypal_order_id || '', 200),
      paypal_capture_id:
        clean_(order.paypal_capture_id || '', 200),
      customer_id:
        clean_(order.customer_id || '', 200),
      email:
        normalizeEmail_(order.email || ''),
      status:
        clean_(order.status || 'pending', 50),
      currency:
        clean_(order.currency || 'USD', 10),
      subtotal:
        Number(order.subtotal || order.total || 0),
      total:
        Number(order.total || 0),
      payer_country:
        clean_(order.payer_country || '', 20),
      created_at:
        existing && existing.created_at ?
          existing.created_at :
          now,
      updated_at: now,
      raw_event_id:
        clean_(order.raw_event_id || '', 200)
    }
  );

  upsertByKey_(
    orderSheet,
    'order_id',
    record.order_id,
    record
  );

  return record;
}

function recordOrderItem_(item) {
  const id =
    clean_(item.order_item_id || '', 200) ||
    uuid_();

  const record = {
    order_item_id: id,
    order_id: clean_(item.order_id || '', 200),
    product_id: clean_(item.product_id || '', 200),
    quantity: Number(item.quantity || 1),
    unit_price: Number(item.unit_price || 0),
    line_total: Number(
      item.line_total ||
      item.unit_price ||
      0
    ),
    created_at: new Date()
  };

  upsertByKey_(
    sheet_(LWB.SHEETS.ORDER_ITEMS),
    'order_item_id',
    id,
    record
  );

  return record;
}

/* ========================================================================== */
/* DIGITAL ASSETS / DOWNLOADS                                                 */
/* ========================================================================== */

function findAssetForProduct_(productId) {
  return readObjects_(sheet_(LWB.SHEETS.ASSETS))
    .find(function(asset) {
      return String(asset.product_id) === String(productId) &&
        truthy_(asset.active) &&
        (
          asset.drive_file_id ||
          asset.repository_path
        );
    }) || null;
}

function freeDownloadLink_(params) {
  const product =
    getProduct_(params.product || params.slug || '');

  if (!product) {
    return { ok: false, error: 'Product not found' };
  }

  if (Number(product.price) !== 0) {
    return {
      ok: false,
      error: 'Paid products require verified payment'
    };
  }

  const asset =
    findAssetForProduct_(product.product_id);

  if (!asset) {
    return {
      ok: false,
      error: 'Download asset not configured'
    };
  }

  if (asset.repository_path) {
    return {
      ok: true,
      product: product,
      download_url:
        LWB.SITE_URL + asset.repository_path
    };
  }

  const token = createDownloadToken_({
    asset_id: asset.asset_id,
    product_id: product.product_id,
    email: '',
    order_id: 'free',
    expires:
      Date.now() + 24 * 60 * 60 * 1000
  });

  return {
    ok: true,
    product: product,
    download_url:
      ScriptApp.getService().getUrl() +
      '?action=download&token=' +
      encodeURIComponent(token)
  };
}

function createDownloadToken_(payload) {
  const secret =
    PropertiesService.getScriptProperties()
      .getProperty('DOWNLOAD_TOKEN_SECRET');

  if (!secret) {
    throw new Error(
      'DOWNLOAD_TOKEN_SECRET is not configured.'
    );
  }

  const body =
    Utilities.base64EncodeWebSafe(
      JSON.stringify(payload),
      Utilities.Charset.UTF_8
    ).replace(/=+$/, '');

  const signature =
    Utilities.base64EncodeWebSafe(
      Utilities.computeHmacSha256Signature(
        body,
        secret
      )
    ).replace(/=+$/, '');

  return body + '.' + signature;
}

function verifyDownloadToken_(token) {
  const parts = String(token || '').split('.');

  if (parts.length !== 2) {
    throw new Error('Invalid download token.');
  }

  const secret =
    PropertiesService.getScriptProperties()
      .getProperty('DOWNLOAD_TOKEN_SECRET');

  if (!secret) {
    throw new Error(
      'Download service is not configured.'
    );
  }

  const expected =
    Utilities.base64EncodeWebSafe(
      Utilities.computeHmacSha256Signature(
        parts[0],
        secret
      )
    ).replace(/=+$/, '');

  if (!constantTimeEqual_(expected, parts[1])) {
    throw new Error('Invalid download signature.');
  }

  const payload =
    JSON.parse(
      Utilities
        .newBlob(
          Utilities.base64DecodeWebSafe(parts[0])
        )
        .getDataAsString()
    );

  if (Number(payload.expires || 0) < Date.now()) {
    throw new Error(
      'This download link has expired.'
    );
  }

  return payload;
}

function downloadRedirect_(params) {
  try {
    const payload =
      verifyDownloadToken_(params.token);

    const asset =
      findBy_(
        sheet_(LWB.SHEETS.ASSETS),
        'asset_id',
        payload.asset_id
      );

    if (!asset || !truthy_(asset.active)) {
      throw new Error(
        'Download asset unavailable.'
      );
    }

    let target = '';

    if (asset.repository_path) {
      target =
        LWB.SITE_URL + asset.repository_path;
    } else if (asset.drive_file_id) {
      target =
        'https://drive.google.com/uc?export=download&id=' +
        encodeURIComponent(asset.drive_file_id);

      if (asset.drive_resource_key) {
        target +=
          '&resourcekey=' +
          encodeURIComponent(
            asset.drive_resource_key
          );
      }
    } else {
      throw new Error(
        'Drive file is not linked.'
      );
    }

    logDownload_({
      email: payload.email,
      product_id: payload.product_id,
      asset_id: asset.asset_id,
      result: 'redirected',
      token_id:
        String(params.token).slice(-16)
    });

    return HtmlService
      .createHtmlOutput(
        '<!doctype html>' +
        '<meta charset="utf-8">' +
        '<title>Starting download…</title>' +
        '<p>Starting your eBible download…</p>' +
        '<script>location.replace(' +
        JSON.stringify(target) +
        ');<\/script>' +
        '<p><a href="' +
        escapeHtml_(target) +
        '">Continue to download</a></p>'
      );
  } catch (err) {
    return HtmlService
      .createHtmlOutput(
        '<!doctype html>' +
        '<meta charset="utf-8">' +
        '<title>Download unavailable</title>' +
        '<h1>Download unavailable</h1>' +
        '<p>' +
        escapeHtml_(safeError_(err)) +
        '</p>' +
        '<p><a href="' +
        LWB.SITE_URL +
        '/estore/">Return to the eStore</a></p>'
      );
  }
}

function logDownload_(data) {
  const id = uuid_();

  appendObject_(
    sheet_(LWB.SHEETS.DOWNLOADS),
    {
      download_id: id,
      timestamp: new Date(),
      customer_id:
        clean_(data.customer_id || '', 200),
      email:
        normalizeEmail_(data.email || ''),
      product_id:
        clean_(data.product_id || '', 200),
      asset_id:
        clean_(data.asset_id || '', 200),
      result:
        clean_(data.result || '', 100),
      ip_hash:
        clean_(data.ip_hash || '', 200),
      user_agent:
        clean_(data.user_agent || '', 500),
      token_id:
        clean_(data.token_id || '', 200)
    }
  );

  return {
    ok: true,
    download_id: id
  };
}

/* ========================================================================== */
/* PAYPAL PDT — PRESERVED, NOT RECONFIGURED HERE                              */
/* ========================================================================== */

function verifyPayPalPdt_(params) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    return verifyPayPalPdtUnlocked_(params);
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function verifyPayPalPdtUnlocked_(params) {
  const tx =
    clean_(params.tx || params.txn_id || '', 200);

  const requestedProduct =
    clean_(params.product || params.slug || '', 300);

  if (!tx) {
    return {
      ok: false,
      error: 'Missing PayPal transaction ID'
    };
  }

  const existing =
    findBy_(
      sheet_(LWB.SHEETS.ORDERS),
      'paypal_capture_id',
      tx
    );

  if (
    existing &&
    String(existing.status).toLowerCase() ===
      'completed'
  ) {
    const product =
      getProductById_(
        existingProductIdForOrder_(
          existing.order_id
        )
      );

    if (!product) {
      return {
        ok: false,
        error:
          'The transaction is recorded, but its product could not be matched.'
      };
    }

    return fulfillmentResponse_(
      existing,
      product,
      existing.email
    );
  }

  const props =
    PropertiesService.getScriptProperties();

  const pdtToken =
    props.getProperty(
      'PAYPAL_PDT_IDENTITY_TOKEN'
    );

  if (!pdtToken) {
    return {
      ok: false,
      error:
        'PayPal PDT is not configured yet.'
    };
  }

  const response =
    UrlFetchApp.fetch(
      'https://www.paypal.com/cgi-bin/webscr',
      {
        method: 'post',
        payload: {
          cmd: '_notify-synch',
          tx: tx,
          at: pdtToken
        },
        muteHttpExceptions: true,
        followRedirects: false
      }
    );

  const parsed =
    parsePdtResponse_(
      response.getContentText()
    );

  if (!parsed.ok) {
    return {
      ok: false,
      error:
        'PayPal did not verify this transaction.'
    };
  }

  const data = parsed.data;

  if (
    String(data.payment_status || '') !==
      'Completed'
  ) {
    return {
      ok: false,
      error:
        'PayPal payment status is not Completed.'
    };
  }

  const product =
    matchPdtProduct_(data);

  if (!product) {
    return {
      ok: false,
      error:
        'The verified PayPal item could not be matched to a Living Word Bibles product.'
    };
  }

  if (
    requestedProduct &&
    !productIdentifierMatches_(
      product,
      requestedProduct
    )
  ) {
    return {
      ok: false,
      error:
        'The returned product did not match the verified PayPal item.'
    };
  }

  /*
   * IMPORTANT:
   * This property is intentionally NOT populated by this Step 4 script.
   * Whatever PayPal receiver account is currently in use stays untouched.
   */
  const expectedReceiver =
    normalizeEmail_(
      props.getProperty(
        'PAYPAL_RECEIVER_EMAIL'
      ) || ''
    );

  const actualReceiver =
    normalizeEmail_(
      data.receiver_email ||
      data.business ||
      ''
    );

  if (
    expectedReceiver &&
    actualReceiver &&
    expectedReceiver !== actualReceiver
  ) {
    return {
      ok: false,
      error:
        'PayPal receiver did not match the configured merchant account.'
    };
  }

  const amount =
    Number(
      data.mc_gross ||
      data.payment_gross ||
      data.amount ||
      0
    );

  const currency =
    String(
      data.mc_currency ||
      data.currency ||
      'USD'
    ).toUpperCase();

  if (
    currency !==
    String(product.currency || 'USD')
      .toUpperCase()
  ) {
    return {
      ok: false,
      error:
        'Payment currency did not match the product.'
    };
  }

  if (
    Math.abs(
      amount -
      Number(product.price || 0)
    ) > 0.001
  ) {
    return {
      ok: false,
      error:
        'Payment amount did not match the product price.'
    };
  }

  const email =
    normalizeEmail_(
      data.payer_email || ''
    );

  if (!validEmail_(email)) {
    return {
      ok: false,
      error:
        'PayPal did not return a valid payer email address.'
    };
  }

  const customer =
    findBy_(
      sheet_(LWB.SHEETS.CUSTOMERS),
      'email',
      email
    );

  const customerId =
    customer ?
      customer.customer_id :
      '';

  const order =
    recordOrder_({
      order_id: 'pdt_' + tx,
      paypal_order_id:
        clean_(
          data.parent_txn_id || '',
          200
        ),
      paypal_capture_id: tx,
      customer_id: customerId,
      email: email,
      status: 'completed',
      currency: currency,
      subtotal: amount,
      total: amount,
      payer_country:
        clean_(
          data.residence_country ||
          data.address_country_code ||
          '',
          20
        ),
      raw_event_id:
        'pdt:' + tx
    });

  recordOrderItem_({
    order_id: order.order_id,
    product_id: product.product_id,
    quantity: 1,
    unit_price: amount,
    line_total: amount
  });

  grantEntitlement_({
    customer_id: customerId,
    email: email,
    product_id: product.product_id,
    order_id: order.order_id,
    source: 'paypal-pdt'
  });

  logSystem_(
    'INFO',
    'PAYPAL_PDT_VERIFIED',
    email,
    order.order_id,
    'paypal',
    product.product_id,
    { txn_id: tx }
  );

  return fulfillmentResponse_(
    order,
    product,
    email
  );
}

function parsePdtResponse_(text) {
  const lines =
    String(text || '')
      .replace(/\r/g, '')
      .split('\n');

  const status =
    String(lines.shift() || '').trim();

  const data = {};

  lines.forEach(function(line) {
    const i = line.indexOf('=');

    if (i < 0) return;

    const key =
      decodeURIComponent(
        line.slice(0, i)
          .replace(/\+/g, ' ')
      );

    const value =
      decodeURIComponent(
        line.slice(i + 1)
          .replace(/\+/g, ' ')
      );

    data[key] = value;
  });

  return {
    ok: status === 'SUCCESS',
    data: data
  };
}

function matchPdtProduct_(data) {
  const candidates = [
    data.item_number,
    data.custom,
    data.item_name
  ].filter(Boolean).map(String);

  const rows =
    readObjects_(sheet_(LWB.SHEETS.PRODUCTS))
      .filter(function(row) {
        return String(
          row.status || ''
        ).toLowerCase() === 'active';
      });

  for (
    let i = 0;
    i < candidates.length;
    i++
  ) {
    let candidate = candidates[i];

    if (candidate.charAt(0) === '{') {
      try {
        const parsed =
          JSON.parse(candidate);

        candidate =
          parsed.product_slug ||
          parsed.product_id ||
          parsed.slug ||
          candidate;
      } catch (_) {}
    }

    const row =
      rows.find(function(productRow) {
        return productIdentifierMatches_(
          publicProduct_(productRow),
          candidate
        );
      });

    if (row) {
      return publicProduct_(row);
    }
  }

  return null;
}

function productIdentifierMatches_(product, value) {
  const candidate =
    normalizeProductKey_(value);

  if (!candidate) return false;

  const keys = [
    product.slug,
    product.product_id,
    product.short_title,
    product.title,
    product.paypal_button_id
  ]
    .map(normalizeProductKey_)
    .filter(Boolean);

  return keys.some(function(value) {
    return value === candidate;
  });
}

function normalizeProductKey_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function fulfillmentResponse_(order, product, email) {
  const asset =
    findAssetForProduct_(
      product.product_id
    );

  if (!asset) {
    return {
      ok: false,
      error:
        'The eBible asset is not linked in Digital Assets.'
    };
  }

  const token =
    createDownloadToken_({
      asset_id: asset.asset_id,
      product_id: product.product_id,
      email: email,
      order_id: order.order_id,
      expires:
        Date.now() +
        24 * 60 * 60 * 1000
    });

  return {
    ok: true,
    order_id: order.order_id,
    email: email,
    product: product,
    download_url:
      ScriptApp.getService().getUrl() +
      '?action=download&token=' +
      encodeURIComponent(token)
  };
}

function getProductById_(productId) {
  const row =
    findBy_(
      sheet_(LWB.SHEETS.PRODUCTS),
      'product_id',
      productId
    );

  return row ? publicProduct_(row) : null;
}

function existingProductIdForOrder_(orderId) {
  const row =
    findBy_(
      sheet_(LWB.SHEETS.ORDER_ITEMS),
      'order_id',
      orderId
    );

  return row && row.product_id;
}

/* ========================================================================== */
/* HEALTH                                                                     */
/* ========================================================================== */

function healthCheck_() {
  const ss =
    SpreadsheetApp.openById(
      LWB.SPREADSHEET_ID
    );

  const folder =
    DriveApp.getFolderById(
      LWB.PRODUCT_FOLDER_ID
    );

  const checks = {
    spreadsheet: {
      ok: Boolean(ss),
      id: ss.getId(),
      name: ss.getName()
    },
    product_folder: {
      ok: Boolean(folder),
      id: folder.getId(),
      name: folder.getName()
    },
    sheets: {},
    paid_assets: {}
  };

  Object.keys(LWB.SHEETS)
    .forEach(function(key) {
      const name = LWB.SHEETS[key];
      checks.sheets[name] =
        Boolean(ss.getSheetByName(name));
    });

  ['prod_kjv', 'prod_asv', 'prod_ylt', 'prod_web']
    .forEach(function(productId) {
      const asset =
        readObjects_(
          sheet_(LWB.SHEETS.ASSETS)
        ).find(function(row) {
          return String(row.product_id) ===
            productId;
        });

      checks.paid_assets[productId] = {
        linked:
          Boolean(
            asset &&
            asset.drive_file_id
          ),
        file_name:
          asset ?
            asset.drive_file_name :
            ''
      };
    });

  const allSheets =
    Object.keys(checks.sheets)
      .every(function(name) {
        return checks.sheets[name];
      });

  const allPaidAssets =
    Object.keys(checks.paid_assets)
      .every(function(productId) {
        return checks
          .paid_assets[productId]
          .linked;
      });

  return {
    ok:
      checks.spreadsheet.ok &&
      checks.product_folder.ok &&
      allSheets &&
      allPaidAssets,
    service: 'LWB Website API',
    version: '3.0.0',
    contact_email:
      LWB.CONTACT_EMAIL,
    checks: checks,
    time: new Date().toISOString()
  };
}

/* ========================================================================== */
/* SHEET HELPERS                                                              */
/* ========================================================================== */

function spreadsheet_() {
  return SpreadsheetApp.openById(
    LWB.SPREADSHEET_ID
  );
}

function sheet_(name) {
  const sheet =
    spreadsheet_().getSheetByName(name);

  if (!sheet) {
    throw new Error(
      'Required sheet not found: ' + name
    );
  }

  return sheet;
}

function headers_(sheet) {
  const lastColumn =
    sheet.getLastColumn();

  if (!lastColumn) return [];

  return sheet
    .getRange(
      1,
      1,
      1,
      lastColumn
    )
    .getValues()[0]
    .map(String);
}

function readObjects_(sheet) {
  const values =
    sheet.getDataRange().getValues();

  if (values.length < 2) {
    return [];
  }

  const headers =
    values[0].map(String);

  return values
    .slice(1)
    .filter(function(row) {
      return row.some(function(value) {
        return String(value).trim() !== '';
      });
    })
    .map(function(row) {
      const object = {};

      headers.forEach(function(header, i) {
        object[header] = row[i];
      });

      return object;
    });
}

function appendObject_(sheet, object) {
  const headers = headers_(sheet);

  sheet.appendRow(
    headers.map(function(header) {
      return object[header] === undefined ?
        '' :
        object[header];
    })
  );
}

function findBy_(sheet, key, value) {
  const needle =
    String(value || '').toLowerCase();

  return readObjects_(sheet)
    .find(function(row) {
      return String(
        row[key] || ''
      ).toLowerCase() === needle;
    }) || null;
}

function upsertByKey_(sheet, key, value, object) {
  const headers = headers_(sheet);
  const values = sheet.getDataRange().getValues();
  const keyIndex = headers.indexOf(key);

  if (keyIndex === -1) {
    throw new Error(
      'Column "' + key +
      '" is missing from "' +
      sheet.getName() + '".'
    );
  }

  let rowNumber = -1;
  const needle =
    String(value || '').toLowerCase();

  for (let i = 1; i < values.length; i++) {
    if (
      String(values[i][keyIndex] || '')
        .toLowerCase() === needle
    ) {
      rowNumber = i + 1;
      break;
    }
  }

  const row =
    headers.map(function(header) {
      return object[header] === undefined ?
        '' :
        object[header];
    });

  if (rowNumber === -1) {
    sheet.appendRow(row);
  } else {
    sheet
      .getRange(
        rowNumber,
        1,
        1,
        headers.length
      )
      .setValues([row]);
  }
}

function deactivateAudience_(email) {
  const sheet =
    sheet_(LWB.SHEETS.AUDIENCE);

  readObjects_(sheet)
    .filter(function(row) {
      return normalizeEmail_(row.email) ===
        email;
    })
    .forEach(function(row) {
      row.status = 'inactive';
      row.updated_at = new Date();

      upsertByKey_(
        sheet,
        'membership_id',
        row.membership_id,
        row
      );
    });
}

/* ========================================================================== */
/* GENERAL HELPERS                                                            */
/* ========================================================================== */

function parsePost_(e) {
  const text =
    e &&
    e.postData &&
    e.postData.contents ?
      e.postData.contents :
      '';

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch (_) {
    const out = {};

    String(text)
      .split('&')
      .forEach(function(pair) {
        const i = pair.indexOf('=');

        if (i < 0) return;

        out[
          decodeURIComponent(
            pair.slice(0, i)
          )
        ] =
          decodeURIComponent(
            pair.slice(i + 1)
              .replace(/\+/g, ' ')
          );
      });

    return out;
  }
}

function output_(object, callback) {
  const json = JSON.stringify(object);

  if (
    callback &&
    LWB.CALLBACK_RE.test(callback)
  ) {
    return ContentService
      .createTextOutput(
        callback + '(' + json + ');'
      )
      .setMimeType(
        ContentService.MimeType.JAVASCRIPT
      );
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(
      ContentService.MimeType.JSON
    );
}

function publicProduct_(row) {
  return pick_(
    row,
    [
      'product_id',
      'slug',
      'title',
      'short_title',
      'status',
      'product_type',
      'price',
      'original_price',
      'currency',
      'cover_path',
      'canonical_path',
      'description',
      'paypal_button_id',
      'uk_restricted',
      'featured',
      'sort_order'
    ]
  );
}

function logSystem_(
  level,
  event,
  email,
  recordId,
  source,
  message,
  metadata
) {
  try {
    appendObject_(
      sheet_(LWB.SHEETS.LOG),
      {
        timestamp: new Date(),
        level: clean_(level || 'INFO', 20),
        event: clean_(event || '', 100),
        email: normalizeEmail_(email || ''),
        record_id:
          clean_(recordId || '', 200),
        source: clean_(source || '', 100),
        message: clean_(message || '', 1000),
        metadata_json:
          JSON.stringify(metadata || {})
            .slice(0, 5000)
      }
    );
  } catch (_) {}
}

function normalizeEmail_(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function validEmail_(value) {
  return LWB.EMAIL_RE.test(
    String(value || '')
  );
}

function clean_(value, max) {
  return String(value || '')
    .trim()
    .replace(/\u0000/g, '')
    .slice(0, max || 1000);
}

function truthy_(value) {
  return value === true ||
    ['true', '1', 'yes', 'y']
      .indexOf(
        String(value || '')
          .toLowerCase()
      ) >= 0;
}

function uuid_() {
  return Utilities.getUuid();
}

function pick_(object, keys) {
  const out = {};

  keys.forEach(function(key) {
    out[key] = object[key];
  });

  return out;
}

function constantTimeEqual_(a, b) {
  a = String(a);
  b = String(b);

  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |=
      a.charCodeAt(i) ^
      b.charCodeAt(i);
  }

  return result === 0;
}

function safeError_(error) {
  return error && error.message ?
    String(error.message) :
    String(error);
}

function escapeHtml_(value) {
  return String(value || '')
    .replace(
      /[&<>"']/g,
      function(character) {
        return {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        }[character];
      }
    );
}

/*
==========================================================================================

END OF LWB BACKEND | Copyright © 2026 Living Word Bibles.  All Rights Reserved.  Developed by Cook Technology Services.  Last Updated on 27 August 2026 at 14:43:40Z UTC.

==========================================================================================
*/

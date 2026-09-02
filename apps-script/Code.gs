/**
 * Living Word Bibles Backend v2.0.2
 * Core Website API
 *
 * Account: gospellivingwordbibles@gmail.com
 * Spreadsheet: LWB Website
 * Legal display date: 27 August 2026
 * Build timestamp: 02 September 2026 at 12:18:00Z UTC
 *
 * v2.0.2 highlights:
 * - Integrates Valois Lumière online reading with existing LWB account entitlements.
 * - Adds lock-free reader-manifest and reader-chapter API actions for entitled titles.
 * - Supports repository/Drive EPUB reading and the existing Ethiopian Bible PDF.
 * - Reuses existing Customers, Products, Digital Assets, and Entitlements sheets.
 * - Adds no new sheets or columns and does not change PayPal, portal, or account auth.
 * v2.0.1 highlights:
 * - Adds the /portal administrative console using the existing Settings,
 *   Newsletter Subscribers, Newsletter Campaigns, Customers, Orders,
 *   Order Items, Entitlements, and System Log sheets.
 * - Portal login reads the existing Settings rows admin_user, admin_password,
 *   admin_display_name, admin_email, admin_enabled, admin_session_minutes,
 *   admin_created_at, and admin_updated_at. The admin password remains
 *   plain text in Settings as requested; no admin-password hash is stored.
 * - Portal tools manage subscribers, compose branded HTML newsletters,
 *   reconcile PayPal purchases, and grant/revoke account entitlements.
 * - Newsletter campaigns remain capped at 99 recipients per batch and send
 *   only Monday, Wednesday, and Friday.
 * - Site page views and clicks can be appended to the existing System Log;
 *   form values, passwords, and URL query strings are intentionally excluded.
 * - v2.0.0 purchase reconciliation, free KJV Special/DRB entitlements,
 *   Ethiopian Bible PDF eligibility, and branded transactional email remain.
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
  VERSION: '2.0.2',
  BUILD_UTC: '02 September 2026 at 12:18:00Z UTC',
  SITE_URL: 'https://www.livingwordbibles.com',
  CONTACT_EMAIL: 'gospellivingwordbibles@gmail.com',
  SPREADSHEET_ID: '1xnzdo1UJsEOTqcO2066Nfb6ayqKn8Zg5RbNLdpbaTcc',
  PRODUCT_FOLDER_ID: '1G6H26CknI1XI090cMVVjb8aVYxM94APP',
  CONSENT_VERSION: '2026-08-27',
  LOGO_URL: 'https://www.livingwordbibles.com/assets/LivingWordBibles01.png',
  NEWSLETTER_BATCH_MAX: 99,
  NEWSLETTER_WEEKDAYS: Object.freeze([1, 3, 5]), // Monday, Wednesday, Friday
  FREE_ACCOUNT_PRODUCTS: Object.freeze(['prod_kjv_special', 'prod_drb']),
  ETHIOPIAN_PRODUCT_IDS: Object.freeze([
    'prod_ethiopian_apocrypha',
    'prod_ethiopian_bible',
    'prod_ethiopian'
  ]),
  ETHIOPIAN_SLUGS: Object.freeze([
    'ethiopian-bible',
    'ethiopian-bible-complete-apocrypha',
    'the-ethiopian-bible-complete-apocrypha'
  ]),
  ETHIOPIAN_PAYPAL_BUTTON_ID: '8Z63ZMZEALLG4',
  ETHIOPIAN_PDF_PATH: '/assets/products/EthiopianApocryphaPDF.pdf',
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
/* INSTALL / VERIFY                                                           */
/* ========================================================================== */

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

  ensureAuthSecrets_();
  ensureCustomerAuthColumns_();

  const ss = SpreadsheetApp.openById(LWB.SPREADSHEET_ID);
  const folder = DriveApp.getFolderById(LWB.PRODUCT_FOLDER_ID);

  Logger.log('LWB v' + LWB.VERSION + ' CONFIGURATION COMPLETE');
  Logger.log('Spreadsheet OK: ' + ss.getName());
  Logger.log('Product folder OK: ' + folder.getName());
  Logger.log('Public contact: ' + LWB.CONTACT_EMAIL);
  Logger.log('PayPal settings: UNCHANGED');
}

function step4HealthCheck() {
  const result = healthCheck_();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Optional one-time installer for newsletter processing.
 * Creates a single daily trigger. The processor itself enforces Monday /
 * Wednesday / Friday sending and a 99-recipient maximum per run.
 */
function installNewsletterCampaignTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'processNewsletterCampaign') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('processNewsletterCampaign')
    .timeBased()
    .everyDays(1)
    .atHour(10)
    .create();

  return {
    ok: true,
    message: 'Daily newsletter processor installed. Sending is restricted to Monday, Wednesday, and Friday.'
  };
}

/* ========================================================================== */
/* WEB APP                                                                    */
/* ========================================================================== */

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const action = String(p.action || 'ping').toLowerCase();

    if (action === 'download') return downloadRedirect_(p);

    let payload;
    switch (action) {
      case 'ping':
        payload = {
          ok: true,
          service: 'LWB Website API',
          version: LWB.VERSION,
          build_utc: LWB.BUILD_UTC,
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
        payload = { ok: true, product: getProduct_(p.slug || p.id || p.product || '') };
        break;
      case 'social':
        payload = { ok: true, posts: listSocialPosts_(p) };
        break;
      case 'free-download-link':
        payload = freeDownloadLink_(p);
        break;
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
  /*
   * Telemetry is intentionally lock-free so ordinary page clicks cannot block
   * account, payment, newsletter, or portal writes behind a global script lock.
   */
  const parsed = parsePost_(e);
  const parsedAction = String(parsed.action || '').toLowerCase();

  if (parsedAction === 'activity-log' || parsedAction === 'activity-log-batch') {
    try {
      const telemetryPayload = parsedAction === 'activity-log-batch'
        ? activityLogBatch_(parsed)
        : activityLog_(parsed);
      return output_(telemetryPayload, parsed.callback);
    } catch (err) {
      return output_({ ok: false, error: safeError_(err) }, parsed.callback);
    }
  }

  if (parsedAction === 'reader-manifest' || parsedAction === 'reader-chapter') {
    try {
      const readerPayload = parsedAction === 'reader-manifest'
        ? readerManifest_(parsed)
        : readerChapter_(parsed);
      return output_(readerPayload, parsed.callback);
    } catch (err) {
      return output_({ ok: false, error: safeError_(err) }, parsed.callback);
    }
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const data = parsed;
    const action = parsedAction;
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
      case 'register':
        payload = registerAccount_(data);
        break;
      case 'login':
        payload = loginAccount_(data);
        break;
      case 'forgot-password':
        payload = forgotPassword_(data);
        break;
      case 'reset-password':
        payload = resetPassword_(data);
        break;
      case 'verify-email':
        payload = verifyEmail_(data);
        break;
      case 'account':
        payload = accountData_(data);
        break;
      case 'reconcile-purchase':
        payload = reconcilePurchase_(data);
        break;
      case 'free-download':
        payload = createFreeEntitlement_(data);
        break;

      /* Admin portal */
      case 'admin-login':
        payload = adminLogin_(data);
        break;
      case 'admin-session':
        payload = adminSession_(data);
        break;
      case 'admin-dashboard':
        payload = adminDashboard_(data);
        break;
      case 'admin-subscribers':
        payload = adminSubscribers_(data);
        break;
      case 'admin-subscriber-add':
        payload = adminSubscriberAdd_(data);
        break;
      case 'admin-subscriber-remove':
        payload = adminSubscriberRemove_(data);
        break;
      case 'admin-newsletter-test':
        payload = adminNewsletterTest_(data);
        break;
      case 'admin-newsletter-queue':
        payload = adminNewsletterQueue_(data);
        break;
      case 'admin-newsletter-process':
        payload = adminNewsletterProcess_(data);
        break;
      case 'admin-newsletter-stop':
        payload = adminNewsletterStop_(data);
        break;
      case 'admin-customer':
        payload = adminCustomer_(data);
        break;
      case 'admin-entitlement-grant':
        payload = adminEntitlementGrant_(data);
        break;
      case 'admin-entitlement-revoke':
        payload = adminEntitlementRevoke_(data);
        break;
      case 'admin-reconcile-purchase':
        payload = adminReconcilePurchase_(data);
        break;
      case 'admin-manual-purchase-add':
        payload = adminManualPurchaseAdd_(data);
        break;
      case 'admin-manual-purchase-remove':
        payload = adminManualPurchaseRemove_(data);
        break;
      case 'admin-logs':
        payload = adminLogs_(data);
        break;

      default:
        payload = { ok: false, error: 'Unknown POST action' };
    }

    return output_(payload, data.callback);
  } catch (err) {
    logSystem_('ERROR', 'POST', '', '', 'web-app', safeError_(err), {
      action: parsedAction
    });
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
      return includeInactive || String(row.status || '').toLowerCase() === 'active';
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
      return String(product.slug) === key || String(product.product_id) === key;
    });

  return row ? publicProduct_(row) : null;
}

function getProductById_(productId) {
  const row = findBy_(sheet_(LWB.SHEETS.PRODUCTS), 'product_id', productId);
  return row ? publicProduct_(row) : null;
}

function listSocialPosts_(params) {
  const limit = Math.min(50, Math.max(1, Number((params && params.limit) || 12)));

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
        'post_id', 'platform', 'title', 'caption', 'image_url', 'post_url', 'published_at'
      ]);
    });
}

function getPublicSettings_() {
  const out = {};
  readObjects_(sheet_(LWB.SHEETS.SETTINGS)).forEach(function(row) {
    if (truthy_(row.public)) out[String(row.key)] = row.value;
  });
  return out;
}

/* ========================================================================== */
/* NEWSLETTER SUBSCRIBE / UNSUBSCRIBE                                         */
/* ========================================================================== */

function subscribe_(data) {
  const email = normalizeEmail_(data.email);
  const name = clean_(data.name || '', 160);
  const source = clean_(data.source || 'lwb-website', 100);
  const ua = clean_(data.userAgent || data.user_agent || '', 500);

  if (!validEmail_(email)) return { ok: false, error: 'Invalid email address' };

  if (findBy_(sheet_(LWB.SHEETS.DNE), 'email', email)) {
    logSystem_('WARN', 'SUBSCRIBE_BLOCKED', email, '', source, 'Address is on Do Not Email', {});
    return {
      ok: false,
      error: 'This address cannot be subscribed through the automated form. Contact support for help.'
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
    consent_version: clean_(data.consent_version || LWB.CONSENT_VERSION, 50),
    subscribed_at: existing && existing.subscribed_at ? existing.subscribed_at : now,
    unsubscribed_at: '',
    updated_at: now,
    user_agent: ua
  };

  upsertByKey_(subscriberSheet, 'email', email, record);

  const membership = readObjects_(sheet_(LWB.SHEETS.AUDIENCE)).find(function(row) {
    return normalizeEmail_(row.email) === email && String(row.audience) === 'Subscribe';
  });
  const membershipId = membership ? membership.membership_id : uuid_();

  upsertByKey_(sheet_(LWB.SHEETS.AUDIENCE), 'membership_id', membershipId, {
    membership_id: membershipId,
    email: email,
    audience: 'Subscribe',
    status: 'active',
    created_at: membership && membership.created_at ? membership.created_at : now,
    updated_at: now
  });

  logSystem_('INFO', 'SUBSCRIBE', email, record.subscriber_id, source,
    existing ? 'reactivated-or-existing' : 'added', {});

  return { ok: true, email: email, added: !existing, status: 'subscribed' };
}

/**
 * Existing working opt-out behavior intentionally preserved.
 * It updates Newsletter Subscribers, adds/updates Do Not Email, and deactivates
 * audience memberships. It does not delete the subscriber row so audit history
 * remains intact.
 */
function unsubscribe_(data) {
  const email = normalizeEmail_(data.email);
  const source = clean_(data.source || 'lwb-website-opt-out', 100);
  const ua = clean_(data.userAgent || data.user_agent || '', 500);

  if (!validEmail_(email)) return { ok: false, error: 'Invalid email address' };

  const now = new Date();
  const subscriberSheet = sheet_(LWB.SHEETS.SUBSCRIBERS);
  const existing = findBy_(subscriberSheet, 'email', email);

  if (existing) {
    existing.status = 'unsubscribed';
    existing.unsubscribed_at = now;
    existing.updated_at = now;
    existing.user_agent = ua;
    upsertByKey_(subscriberSheet, 'email', email, existing);
  }

  const dneSheet = sheet_(LWB.SHEETS.DNE);
  const existingDne = findBy_(dneSheet, 'email', email);

  upsertByKey_(dneSheet, 'email', email, {
    dne_id: existingDne ? existingDne.dne_id : uuid_(),
    email: email,
    source: source,
    reason: clean_(data.reason || 'newsletter opt-out', 200),
    created_at: existingDne && existingDne.created_at ? existingDne.created_at : now,
    updated_at: now,
    user_agent: ua
  });

  deactivateAudience_(email);

  logSystem_('INFO', 'UNSUBSCRIBE', email, existing ? existing.subscriber_id : '', source,
    existing ? 'unsubscribed' : 'not-found-added-to-dne', {});

  return { ok: true, email: email, status: 'unsubscribed' };
}

/* ========================================================================== */
/* NEWSLETTER CAMPAIGNS                                                       */
/* ========================================================================== */

/**
 * Starts or restarts a newsletter feature campaign.
 * Example: startNewsletterCampaign('audio_bible')
 *
 * The daily trigger may run every day, but processNewsletterCampaign() sends
 * only Monday, Wednesday, and Friday. Every run is capped at 99 recipients.
 */
function startNewsletterCampaign(templateKey) {
  const template = newsletterTemplate_(templateKey, { name: '' });
  if (!template) throw new Error('Unknown newsletter template: ' + templateKey);

  const recipients = newsletterRecipients_();
  const campaignId = 'campaign_' + Utilities.getUuid();
  const props = PropertiesService.getScriptProperties();
  const state = {
    campaign_id: campaignId,
    template_key: String(templateKey),
    cursor: 0,
    total: recipients.length,
    status: 'active',
    started_at: new Date().toISOString(),
    last_batch_date: ''
  };

  props.setProperty('LWB_NEWSLETTER_CAMPAIGN_STATE', JSON.stringify(state));
  writeCampaignStatus_(state, 'queued');

  return {
    ok: true,
    campaign_id: campaignId,
    template_key: templateKey,
    recipients: recipients.length,
    batch_max: LWB.NEWSLETTER_BATCH_MAX,
    weekdays: ['Monday', 'Wednesday', 'Friday']
  };
}

function stopNewsletterCampaign() {
  const props = PropertiesService.getScriptProperties();
  const state = getNewsletterCampaignState_();
  if (state) {
    state.status = 'stopped';
    state.stopped_at = new Date().toISOString();
    props.setProperty('LWB_NEWSLETTER_CAMPAIGN_STATE', JSON.stringify(state));
    writeCampaignStatus_(state, 'stopped');
  }
  return { ok: true, stopped: Boolean(state) };
}

function processNewsletterCampaign() {
  const state = getNewsletterCampaignState_();
  if (!state || state.status !== 'active') {
    return { ok: true, sent: 0, message: 'No active newsletter campaign.' };
  }

  const now = new Date();
  const sendTimeZone = Session.getScriptTimeZone() || 'America/Indiana/Indianapolis';
  const weekday = Number(Utilities.formatDate(now, sendTimeZone, 'u'));
  if (LWB.NEWSLETTER_WEEKDAYS.indexOf(weekday) === -1) {
    return { ok: true, sent: 0, message: 'Newsletter batches send only Monday, Wednesday, and Friday.' };
  }

  const today = Utilities.formatDate(now, sendTimeZone, 'yyyy-MM-dd');
  const props = PropertiesService.getScriptProperties();
  const globalLastBatchDate = props.getProperty('LWB_NEWSLETTER_LAST_BATCH_DATE') || '';
  if (state.last_batch_date === today || globalLastBatchDate === today) {
    return { ok: true, sent: 0, message: 'A newsletter batch has already been sent today.' };
  }

  const recipients = newsletterRecipients_();
  const cursor = Math.max(0, Number(state.cursor || 0));
  const quota = Math.max(0, Number(MailApp.getRemainingDailyQuota() || 0));
  const batchSize = Math.min(LWB.NEWSLETTER_BATCH_MAX, quota, Math.max(0, recipients.length - cursor));

  if (batchSize <= 0) {
    if (cursor >= recipients.length) {
      state.status = 'complete';
      state.completed_at = now.toISOString();
      saveNewsletterCampaignState_(state);
      writeCampaignStatus_(state, 'complete');
      return { ok: true, sent: 0, complete: true };
    }
    return { ok: false, sent: 0, error: 'No MailApp quota is available for today.' };
  }

  const slice = recipients.slice(cursor, cursor + batchSize);
  let sent = 0;
  let failed = 0;

  slice.forEach(function(recipient) {
    try {
      if (String(state.mode || '') === 'custom') {
        sendCustomNewsletterEmail_(recipient.email, recipient.name || '', state);
      } else {
        sendNewsletterTemplateEmail_(recipient.email, recipient.name || '', state.template_key);
      }
      sent++;
    } catch (err) {
      failed++;
      logSystem_('ERROR', 'NEWSLETTER_SEND_FAILED', recipient.email, state.campaign_id,
        'newsletter', safeError_(err), { template_key: state.template_key || '', subject: state.subject || '' });
    }
  });

  state.cursor = cursor + slice.length;
  state.total = recipients.length;
  state.last_batch_date = today;
  state.last_batch_at = now.toISOString();
  props.setProperty('LWB_NEWSLETTER_LAST_BATCH_DATE', today);
  state.last_batch_sent = sent;
  state.last_batch_failed = failed;

  if (state.cursor >= recipients.length) {
    state.status = 'complete';
    state.completed_at = now.toISOString();
  }

  saveNewsletterCampaignState_(state);
  writeCampaignStatus_(state, state.status === 'complete' ? 'complete' : 'batch-sent');

  logSystem_('INFO', 'NEWSLETTER_BATCH', '', state.campaign_id, 'newsletter',
    'sent=' + sent + ', failed=' + failed,
    { template_key: state.template_key, cursor: state.cursor, total: state.total });

  return {
    ok: true,
    campaign_id: state.campaign_id,
    template_key: state.template_key,
    sent: sent,
    failed: failed,
    cursor: state.cursor,
    total: state.total,
    complete: state.status === 'complete',
    batch_max: LWB.NEWSLETTER_BATCH_MAX
  };
}

function getNewsletterCampaignState_() {
  const raw = PropertiesService.getScriptProperties().getProperty('LWB_NEWSLETTER_CAMPAIGN_STATE');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

function saveNewsletterCampaignState_(state) {
  PropertiesService.getScriptProperties().setProperty(
    'LWB_NEWSLETTER_CAMPAIGN_STATE',
    JSON.stringify(state)
  );
}

function newsletterRecipients_() {
  const dne = {};
  readObjects_(sheet_(LWB.SHEETS.DNE)).forEach(function(row) {
    const email = normalizeEmail_(row.email);
    if (email) dne[email] = true;
  });

  const seen = {};
  return readObjects_(sheet_(LWB.SHEETS.SUBSCRIBERS))
    .filter(function(row) {
      const email = normalizeEmail_(row.email);
      return validEmail_(email) &&
        String(row.status || '').toLowerCase() === 'subscribed' &&
        !dne[email] && !seen[email] && (seen[email] = true);
    })
    .map(function(row) {
      return {
        subscriber_id: row.subscriber_id || '',
        email: normalizeEmail_(row.email),
        name: clean_(row.name || '', 160)
      };
    });
}

function writeCampaignStatus_(state, status) {
  try {
    appendObject_(sheet_(LWB.SHEETS.CAMPAIGNS), {
      campaign_id: state.campaign_id,
      template_key: state.template_key || '',
      subject: state.subject || '',
      preheader: state.preheader || '',
      campaign_type: state.mode || 'template',
      status: status,
      recipient_count: Number(state.total || 0),
      sent_count: Number(state.cursor || 0),
      batch_size: Number(state.last_batch_sent || 0),
      created_at: state.started_at || new Date(),
      updated_at: new Date(),
      last_batch_at: state.last_batch_at || '',
      notes: (state.mode === 'custom' ? 'Portal custom HTML newsletter. ' : '') +
        'Max 99 recipients per batch; Monday/Wednesday/Friday stagger.'
    });
  } catch (_) {}
}

/* ========================================================================== */
/* CONTACT FORM                                                               */
/* ========================================================================== */

function submitContact_(data) {
  const email = normalizeEmail_(data.email);
  const name = clean_(data.name || '', 160);
  const subject = clean_(data.subject || 'Website message', 180);
  const message = clean_(data.message || '', 10000);

  if (!validEmail_(email)) return { ok: false, error: 'Invalid email address' };
  if (!message) return { ok: false, error: 'Message is required' };

  const id = uuid_();
  appendObject_(sheet_(LWB.SHEETS.CONTACT), {
    message_id: id,
    timestamp: new Date(),
    name: name,
    email: email,
    subject: subject,
    message: message,
    source: clean_(data.source || 'lwb-website', 100),
    status: 'new',
    user_agent: clean_(data.userAgent || data.user_agent || '', 500)
  });

  logSystem_('INFO', 'CONTACT_MESSAGE', email, id, 'website', 'received', {});
  return { ok: true, message_id: id };
}

/* ========================================================================== */
/* ENTITLEMENTS / ACCOUNT-ELIGIBLE PRODUCTS                                   */
/* ========================================================================== */

function createFreeEntitlement_(data) {
  const product = getProduct_(data.slug || data.product_id || '');
  if (!product) return { ok: false, error: 'Product not found' };
  if (Number(product.price) !== 0) {
    return { ok: false, error: 'Paid products require verified payment' };
  }

  const email = normalizeEmail_(data.email || '');
  const entitlement = grantEntitlement_({
    customer_id: '',
    email: email,
    product_id: product.product_id,
    order_id: '',
    source: 'free-product'
  });

  return Object.assign({ ok: true, product: product }, entitlement);
}

function ensureDefaultFreeEntitlements_(customer) {
  if (!customer) return [];
  const granted = [];
  LWB.FREE_ACCOUNT_PRODUCTS.forEach(function(productId) {
    const product = getProductById_(productId);
    if (!product) return;

    const result = grantEntitlement_({
      customer_id: customer.customer_id,
      email: customer.email,
      product_id: productId,
      order_id: '',
      source: 'account-default-free'
    });
    granted.push({ product_id: productId, existing: Boolean(result.existing) });
  });
  return granted;
}

function grantEntitlement_(data) {
  const entitlementSheet = sheet_(LWB.SHEETS.ENTITLEMENTS);
  const email = normalizeEmail_(data.email || '');
  const customerId = clean_(data.customer_id || '', 200);
  const productId = clean_(data.product_id || '', 200);

  if (!productId) return { ok: false, error: 'Product is required' };

  const existing = readObjects_(entitlementSheet).find(function(row) {
    return String(row.product_id) === productId &&
      String(row.status || '').toLowerCase() === 'active' &&
      ((customerId && String(row.customer_id) === customerId) ||
       (email && normalizeEmail_(row.email) === email));
  });

  if (existing) {
    return { ok: true, entitlement_id: existing.entitlement_id, existing: true };
  }

  const id = uuid_();
  appendObject_(entitlementSheet, {
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
  });

  logSystem_('INFO', 'ENTITLEMENT_GRANTED', email, id, data.source || 'manual', productId,
    { customer_id: customerId });

  return { ok: true, entitlement_id: id, existing: false };
}

function isEthiopianProduct_(product) {
  if (!product) return false;
  const id = String(product.product_id || '').toLowerCase();
  const slug = String(product.slug || '').toLowerCase();
  const button = String(product.paypal_button_id || '').toUpperCase();
  const title = String(product.title || '').toLowerCase();

  return LWB.ETHIOPIAN_PRODUCT_IDS.indexOf(id) >= 0 ||
    LWB.ETHIOPIAN_SLUGS.indexOf(slug) >= 0 ||
    button === LWB.ETHIOPIAN_PAYPAL_BUTTON_ID ||
    (title.indexOf('ethiopian') >= 0 && title.indexOf('bible') >= 0);
}

function isAccountEligibleProduct_(product) {
  if (!product) return false;
  const type = String(product.product_type || '').trim().toLowerCase();
  return type === 'ebook' || isEthiopianProduct_(product);
}

/* ========================================================================== */
/* ORDERS                                                                     */
/* ========================================================================== */

function recordOrder_(order) {
  const orderSheet = sheet_(LWB.SHEETS.ORDERS);
  const id = clean_(order.order_id || '', 200) || uuid_();
  const existing =
    findBy_(orderSheet, 'order_id', id) ||
    (order.paypal_order_id && findBy_(orderSheet, 'paypal_order_id', order.paypal_order_id)) ||
    (order.paypal_capture_id && findBy_(orderSheet, 'paypal_capture_id', order.paypal_capture_id));

  const now = new Date();
  const record = Object.assign({}, existing || {}, {
    order_id: existing && existing.order_id ? existing.order_id : id,
    paypal_order_id: clean_(order.paypal_order_id || (existing && existing.paypal_order_id) || '', 200),
    paypal_capture_id: clean_(order.paypal_capture_id || (existing && existing.paypal_capture_id) || '', 200),
    customer_id: clean_(order.customer_id || (existing && existing.customer_id) || '', 200),
    email: normalizeEmail_(order.email || (existing && existing.email) || ''),
    status: clean_(order.status || (existing && existing.status) || 'pending', 50),
    currency: clean_(order.currency || (existing && existing.currency) || 'USD', 10),
    subtotal: Number(order.subtotal !== undefined ? order.subtotal : ((existing && existing.subtotal) || order.total || 0)),
    total: Number(order.total !== undefined ? order.total : ((existing && existing.total) || 0)),
    payer_country: clean_(order.payer_country || (existing && existing.payer_country) || '', 20),
    created_at: existing && existing.created_at ? existing.created_at : now,
    updated_at: now,
    raw_event_id: clean_(order.raw_event_id || (existing && existing.raw_event_id) || '', 200)
  });

  upsertByKey_(orderSheet, 'order_id', record.order_id, record);
  return record;
}

function recordOrderItem_(item) {
  const itemSheet = sheet_(LWB.SHEETS.ORDER_ITEMS);
  const existing = readObjects_(itemSheet).find(function(row) {
    return String(row.order_id || '') === String(item.order_id || '') &&
      String(row.product_id || '') === String(item.product_id || '');
  });

  const id = existing ? existing.order_item_id : (clean_(item.order_item_id || '', 200) || uuid_());
  const record = Object.assign({}, existing || {}, {
    order_item_id: id,
    order_id: clean_(item.order_id || '', 200),
    product_id: clean_(item.product_id || '', 200),
    quantity: Number(item.quantity || 1),
    unit_price: Number(item.unit_price || 0),
    line_total: Number(item.line_total !== undefined ? item.line_total : (item.unit_price || 0)),
    created_at: existing && existing.created_at ? existing.created_at : new Date()
  });

  upsertByKey_(itemSheet, 'order_item_id', id, record);
  return record;
}

function orderItemsForOrder_(orderId) {
  return readObjects_(sheet_(LWB.SHEETS.ORDER_ITEMS)).filter(function(row) {
    return String(row.order_id || '') === String(orderId || '');
  });
}

function existingProductIdForOrder_(orderId) {
  const row = orderItemsForOrder_(orderId)[0];
  return row && row.product_id;
}

/* ========================================================================== */
/* VALOIS LUMIÈRE ONLINE READER                                              */
/* ========================================================================== */

function readerManifest_(data) {
  const access = readerRequireAccess_(data);
  const product = access.product;
  const asset = readerFindAsset_(product);
  const format = readerAssetFormat_(asset, product);

  if (format === 'pdf') {
    if (!asset.repository_path) {
      throw new Error('Online PDF reading is not configured for this title.');
    }
    return {
      ok: true,
      reader: {
        format: 'pdf',
        product_id: product.product_id,
        slug: product.slug,
        title: product.title,
        source_url: readerRepositoryUrl_(asset.repository_path)
      }
    };
  }

  if (format !== 'epub') {
    throw new Error('This title is not available in Valois Lumière.');
  }

  const epub = readerLoadEpub_(asset);
  return {
    ok: true,
    reader: {
      format: 'epub',
      product_id: product.product_id,
      slug: product.slug,
      title: product.title,
      spine: epub.spine.map(function(item, index) {
        return {
          id: item.id,
          href: item.href,
          title: item.title || ('Section ' + (index + 1))
        };
      })
    }
  };
}

function readerChapter_(data) {
  const access = readerRequireAccess_(data);
  const product = access.product;
  const asset = readerFindAsset_(product);

  if (readerAssetFormat_(asset, product) !== 'epub') {
    throw new Error('This title is not an EPUB eBible.');
  }

  const epub = readerLoadEpub_(asset);
  const chapterId = clean_(data.chapter || '', 500);
  const item = epub.spine.find(function(row) {
    return String(row.id) === chapterId;
  });

  if (!item) throw new Error('The requested reader section is unavailable.');
  const blob = epub.blobs[item.path];
  if (!blob) throw new Error('The requested EPUB file is unavailable.');

  return {
    ok: true,
    chapter: {
      id: item.id,
      title: item.title || '',
      html: readerSanitizeChapter_(blob.getDataAsString())
    }
  };
}

function readerRequireAccess_(data) {
  const customer = verifySessionToken_(data.token);
  const product = getProduct_(data.product || data.slug || data.product_id || '');
  if (!product || !isAccountEligibleProduct_(product)) {
    throw new Error('This title is not available in your Living Word Bibles reader library.');
  }

  const email = normalizeEmail_(customer.email || '');
  const customerId = String(customer.customer_id || '');
  const entitlement = readObjects_(sheet_(LWB.SHEETS.ENTITLEMENTS)).find(function(row) {
    if (String(row.product_id || '') !== String(product.product_id || '')) return false;
    if (String(row.status || '').toLowerCase() !== 'active') return false;

    const belongsToCustomer = customerId && String(row.customer_id || '') === customerId;
    const belongsToEmail = email && normalizeEmail_(row.email || '') === email;
    if (!belongsToCustomer && !belongsToEmail) return false;

    if (row.expires_at) {
      const expires = new Date(row.expires_at).getTime();
      if (expires && expires < Date.now()) return false;
    }
    return true;
  });

  if (!entitlement) {
    throw new Error('Your Living Word Bibles account does not have access to this title.');
  }

  return { customer: customer, product: product, entitlement: entitlement };
}

function readerFindAsset_(product) {
  const productId = String(product.product_id || '');
  const expected = String(product.product_type || '').toLowerCase() === 'pdf' || isEthiopianProduct_(product)
    ? 'pdf'
    : 'epub';

  const configured = readObjects_(sheet_(LWB.SHEETS.ASSETS)).find(function(asset) {
    if (String(asset.product_id || '') !== productId || !truthy_(asset.active)) return false;
    if (!asset.drive_file_id && !asset.repository_path) return false;

    const type = String(asset.asset_type || '').toLowerCase();
    const mime = String(asset.mime_type || '').toLowerCase();
    const name = String(asset.drive_file_name || asset.download_name || asset.repository_path || '').toLowerCase();

    if (expected === 'pdf') {
      return type === 'pdf' || mime.indexOf('application/pdf') >= 0 || /\.pdf(?:$|[?#])/.test(name);
    }
    return type === 'epub' || mime.indexOf('epub') >= 0 || /\.epub(?:$|[?#])/.test(name);
  });

  if (configured) return configured;

  // Preserves the existing Ethiopian repository-path fallback.
  const fallback = findAssetForProduct_(productId);
  if (fallback) return fallback;

  throw new Error('The digital asset for this title is not configured.');
}

function readerAssetFormat_(asset, product) {
  if (String(product.product_type || '').toLowerCase() === 'pdf' || isEthiopianProduct_(product)) {
    return 'pdf';
  }
  const type = String(asset.asset_type || asset.file_type || '').toLowerCase();
  const mime = String(asset.mime_type || '').toLowerCase();
  const name = String(asset.drive_file_name || asset.download_name || asset.repository_path || '').toLowerCase();
  if (type === 'pdf' || mime.indexOf('application/pdf') >= 0 || /\.pdf(?:$|[?#])/.test(name)) return 'pdf';
  if (type === 'epub' || mime.indexOf('epub') >= 0 || /\.epub(?:$|[?#])/.test(name)) return 'epub';
  return '';
}

function readerLoadEpub_(asset) {
  let sourceBlob;

  if (asset.drive_file_id) {
    sourceBlob = DriveApp.getFileById(String(asset.drive_file_id)).getBlob();
  } else if (asset.repository_path) {
    const response = UrlFetchApp.fetch(readerRepositoryUrl_(asset.repository_path), {
      followRedirects: true,
      muteHttpExceptions: true
    });
    const code = response.getResponseCode();
    if (code < 200 || code >= 300) {
      throw new Error('The repository EPUB could not be loaded.');
    }
    sourceBlob = response.getBlob();
  } else {
    throw new Error('The EPUB source is unavailable.');
  }

  let unzipped;
  try {
    unzipped = Utilities.unzip(sourceBlob);
  } catch (_) {
    throw new Error('The eBible file is not a readable EPUB.');
  }

  const blobs = {};
  unzipped.forEach(function(blob) {
    blobs[readerNormalizePath_(blob.getName())] = blob;
  });

  const container = blobs['META-INF/container.xml'];
  if (!container) throw new Error('Invalid EPUB container.');

  const containerXml = container.getDataAsString();
  const packageMatch = containerXml.match(/full-path=["']([^"']+)["']/i);
  if (!packageMatch) throw new Error('EPUB package file is missing.');

  const opfPath = readerNormalizePath_(readerXmlDecode_(packageMatch[1]));
  const opfBlob = blobs[opfPath];
  if (!opfBlob) throw new Error('EPUB package file is unavailable.');

  const xml = opfBlob.getDataAsString();
  const manifest = {};

  (xml.match(/<item\b[^>]*>/gi) || []).forEach(function(tag) {
    const id = readerAttr_(tag, 'id');
    const href = readerXmlDecode_(readerAttr_(tag, 'href'));
    if (!id || !href) return;
    manifest[id] = {
      id: id,
      href: href,
      media: readerAttr_(tag, 'media-type'),
      properties: readerAttr_(tag, 'properties'),
      path: readerResolvePath_(opfPath, href)
    };
  });

  const titleMap = readerTitleMap_(xml, opfPath, manifest, blobs);
  const spine = [];
  (xml.match(/<itemref\b[^>]*>/gi) || []).forEach(function(tag) {
    const idref = readerAttr_(tag, 'idref');
    if (!manifest[idref]) return;
    const item = Object.assign({}, manifest[idref]);
    item.title = titleMap[item.path] || titleMap[readerNormalizePath_(item.href)] || '';
    spine.push(item);
  });

  if (!spine.length) throw new Error('The EPUB reading order is empty.');
  return { spine: spine, blobs: blobs };
}

function readerTitleMap_(opfXml, opfPath, manifest, blobs) {
  const map = {};
  const items = Object.keys(manifest).map(function(key) { return manifest[key]; });
  const navItem = items.find(function(item) {
    return String(item.properties || '').split(/\s+/).indexOf('nav') >= 0;
  });

  if (navItem && blobs[navItem.path]) {
    const nav = blobs[navItem.path].getDataAsString();
    const anchorRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = anchorRe.exec(nav))) {
      const path = readerResolvePath_(navItem.path, readerXmlDecode_(match[1]));
      const label = readerPlainText_(match[2]);
      if (path && label && !map[path]) map[path] = label;
    }
  }

  const ncxItem = items.find(function(item) {
    return String(item.media || '').toLowerCase() === 'application/x-dtbncx+xml';
  });

  if (ncxItem && blobs[ncxItem.path]) {
    const ncx = blobs[ncxItem.path].getDataAsString();
    const pointRe = /<navPoint\b[\s\S]*?<navLabel\b[\s\S]*?<text\b[^>]*>([\s\S]*?)<\/text>[\s\S]*?<content\b[^>]*src=["']([^"']+)["'][^>]*>[\s\S]*?<\/navPoint>/gi;
    let match;
    while ((match = pointRe.exec(ncx))) {
      const label = readerPlainText_(match[1]);
      const path = readerResolvePath_(ncxItem.path, readerXmlDecode_(match[2]));
      if (path && label && !map[path]) map[path] = label;
    }
  }

  return map;
}

function readerAttr_(tag, name) {
  const match = String(tag || '').match(new RegExp('(?:\\s|^)' + name + '=["\\\']([^"\\\']*)["\\\']', 'i'));
  return match ? match[1] : '';
}

function readerResolvePath_(base, relative) {
  let rel = readerNormalizePath_(readerXmlDecode_(relative || ''));
  if (!rel) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(rel)) return rel;
  if (rel.charAt(0) === '/') rel = rel.replace(/^\/+/, '');

  const parts = readerNormalizePath_(base || '').split('/');
  parts.pop();
  rel.split('/').forEach(function(part) {
    if (!part || part === '.') return;
    if (part === '..') parts.pop();
    else parts.push(part);
  });
  return readerNormalizePath_(parts.join('/'));
}

function readerNormalizePath_(value) {
  let path = String(value || '').split('#')[0].split('?')[0].replace(/\\/g, '/');
  try { path = decodeURIComponent(path); } catch (_) {}
  return path.replace(/^\.\//, '').replace(/\/+/g, '/');
}

function readerXmlDecode_(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function readerPlainText_(html) {
  return readerXmlDecode_(String(html || '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function readerSanitizeChapter_(html) {
  let value = String(html || '');

  value = value
    .replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select|video|audio|canvas|svg)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select|video|audio|canvas|svg)\b[^>]*\/?>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/<meta\b[^>]*>/gi, '')
    .replace(/<base\b[^>]*>/gi, '')
    .replace(/\sstyle\s*=\s*(["'])[\s\S]*?\1/gi, '')
    .replace(/\son\w+\s*=\s*(["'])[\s\S]*?\1/gi, '')
    .replace(/\s(href|src)\s*=\s*(["'])\s*(javascript:|data:text\/html)[\s\S]*?\2/gi, '');

  const body = value.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  return body ? body[1] : value;
}

function readerRepositoryUrl_(path) {
  const value = String(path || '').trim();
  if (/^https?:\/\//i.test(value)) return value;
  return LWB.SITE_URL + (value.charAt(0) === '/' ? value : '/' + value);
}

/* ========================================================================== */
/* DIGITAL ASSETS / DOWNLOADS                                                 */
/* ========================================================================== */

function findAssetForProduct_(productId) {
  const configured = readObjects_(sheet_(LWB.SHEETS.ASSETS)).find(function(asset) {
    return String(asset.product_id) === String(productId) && truthy_(asset.active) &&
      (asset.drive_file_id || asset.repository_path);
  });
  if (configured) return configured;

  const product = getProductById_(productId);
  if (isEthiopianProduct_(product)) {
    return {
      asset_id: 'repo_ethiopian_apocrypha_pdf',
      product_id: productId,
      repository_path: LWB.ETHIOPIAN_PDF_PATH,
      active: true,
      file_type: 'pdf'
    };
  }
  return null;
}

function freeDownloadLink_(params) {
  const product = getProduct_(params.product || params.slug || '');
  if (!product) return { ok: false, error: 'Product not found' };
  if (Number(product.price) !== 0) {
    return { ok: false, error: 'Paid products require verified payment' };
  }

  const asset = findAssetForProduct_(product.product_id);
  if (!asset) return { ok: false, error: 'Download asset not configured' };

  if (asset.repository_path) {
    return { ok: true, product: product, download_url: LWB.SITE_URL + asset.repository_path };
  }

  const token = createDownloadToken_({
    asset_id: asset.asset_id,
    product_id: product.product_id,
    email: '',
    order_id: 'free',
    expires: Date.now() + 24 * 60 * 60 * 1000
  });

  return {
    ok: true,
    product: product,
    download_url: ScriptApp.getService().getUrl() + '?action=download&token=' + encodeURIComponent(token)
  };
}

function createDownloadToken_(payload) {
  const secret = PropertiesService.getScriptProperties().getProperty('DOWNLOAD_TOKEN_SECRET');
  if (!secret) throw new Error('DOWNLOAD_TOKEN_SECRET is not configured.');

  const body = Utilities.base64EncodeWebSafe(
    JSON.stringify(payload), Utilities.Charset.UTF_8
  ).replace(/=+$/, '');
  const signature = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(body, secret)
  ).replace(/=+$/, '');
  return body + '.' + signature;
}

function verifyDownloadToken_(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) throw new Error('Invalid download token.');

  const secret = PropertiesService.getScriptProperties().getProperty('DOWNLOAD_TOKEN_SECRET');
  if (!secret) throw new Error('Download service is not configured.');

  const expected = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(parts[0], secret)
  ).replace(/=+$/, '');

  if (!constantTimeEqual_(expected, parts[1])) throw new Error('Invalid download signature.');

  const payload = JSON.parse(
    Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString()
  );
  if (Number(payload.expires || 0) < Date.now()) throw new Error('This download link has expired.');
  return payload;
}

function downloadRedirect_(params) {
  try {
    const payload = verifyDownloadToken_(params.token);
    let asset = findBy_(sheet_(LWB.SHEETS.ASSETS), 'asset_id', payload.asset_id);

    if (!asset && payload.asset_id === 'repo_ethiopian_apocrypha_pdf') {
      asset = {
        asset_id: payload.asset_id,
        repository_path: LWB.ETHIOPIAN_PDF_PATH,
        active: true
      };
    }

    if (!asset || !truthy_(asset.active)) throw new Error('Download asset unavailable.');

    let target = '';
    if (asset.repository_path) {
      target = LWB.SITE_URL + asset.repository_path;
    } else if (asset.drive_file_id) {
      target = 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(asset.drive_file_id);
      if (asset.drive_resource_key) {
        target += '&resourcekey=' + encodeURIComponent(asset.drive_resource_key);
      }
    } else {
      throw new Error('Drive file is not linked.');
    }

    logDownload_({
      email: payload.email,
      customer_id: payload.customer_id,
      product_id: payload.product_id,
      asset_id: asset.asset_id,
      result: 'redirected',
      token_id: String(params.token).slice(-16)
    });

    return HtmlService.createHtmlOutput(
      '<!doctype html><meta charset="utf-8"><title>Starting download…</title>' +
      '<p>Starting your Living Word Bibles download…</p>' +
      '<script>location.replace(' + JSON.stringify(target) + ');<\/script>' +
      '<p><a href="' + escapeHtml_(target) + '">Continue to download</a></p>'
    );
  } catch (err) {
    return HtmlService.createHtmlOutput(
      '<!doctype html><meta charset="utf-8"><title>Download unavailable</title>' +
      '<h1>Download unavailable</h1><p>' + escapeHtml_(safeError_(err)) + '</p>' +
      '<p><a href="' + LWB.SITE_URL + '/estore/">Return to the eStore</a></p>'
    );
  }
}

function logDownload_(data) {
  const id = uuid_();
  appendObject_(sheet_(LWB.SHEETS.DOWNLOADS), {
    download_id: id,
    timestamp: new Date(),
    customer_id: clean_(data.customer_id || '', 200),
    email: normalizeEmail_(data.email || ''),
    product_id: clean_(data.product_id || '', 200),
    asset_id: clean_(data.asset_id || '', 200),
    result: clean_(data.result || '', 100),
    ip_hash: clean_(data.ip_hash || '', 200),
    user_agent: clean_(data.user_agent || '', 500),
    token_id: clean_(data.token_id || '', 200)
  });
  return { ok: true, download_id: id };
}

/* ========================================================================== */
/* PAYPAL PDT                                                                 */
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
  const tx = clean_(params.tx || params.txn_id || '', 200);
  const requestedProduct = clean_(params.product || params.slug || '', 300);

  if (!tx) return { ok: false, error: 'Missing PayPal transaction ID' };

  const existing = findBy_(sheet_(LWB.SHEETS.ORDERS), 'paypal_capture_id', tx);
  if (existing && String(existing.status || '').toLowerCase() === 'completed') {
    const product = getProductById_(existingProductIdForOrder_(existing.order_id));
    if (!product) {
      return { ok: false, error: 'The transaction is recorded, but its product could not be matched.' };
    }
    return fulfillmentResponse_(existing, product, existing.email);
  }

  const props = PropertiesService.getScriptProperties();
  const pdtToken = props.getProperty('PAYPAL_PDT_IDENTITY_TOKEN');
  if (!pdtToken) return { ok: false, error: 'PayPal PDT is not configured yet.' };

  const response = UrlFetchApp.fetch('https://www.paypal.com/cgi-bin/webscr', {
    method: 'post',
    payload: { cmd: '_notify-synch', tx: tx, at: pdtToken },
    muteHttpExceptions: true,
    followRedirects: false
  });

  const parsed = parsePdtResponse_(response.getContentText());
  if (!parsed.ok) return { ok: false, error: 'PayPal did not verify this transaction.' };

  const data = parsed.data;
  if (String(data.payment_status || '') !== 'Completed') {
    return { ok: false, error: 'PayPal payment status is not Completed.' };
  }

  const product = matchPdtProduct_(data);
  if (!product) {
    return { ok: false, error: 'The verified PayPal item could not be matched to a Living Word Bibles product.' };
  }

  if (requestedProduct && !productIdentifierMatches_(product, requestedProduct)) {
    return { ok: false, error: 'The returned product did not match the verified PayPal item.' };
  }

  const expectedReceiver = normalizeEmail_(props.getProperty('PAYPAL_RECEIVER_EMAIL') || '');
  const actualReceiver = normalizeEmail_(data.receiver_email || data.business || '');
  if (expectedReceiver && actualReceiver && expectedReceiver !== actualReceiver) {
    return { ok: false, error: 'PayPal receiver did not match the configured merchant account.' };
  }

  const amount = Number(data.mc_gross || data.payment_gross || data.amount || 0);
  const currency = String(data.mc_currency || data.currency || 'USD').toUpperCase();

  if (currency !== String(product.currency || 'USD').toUpperCase()) {
    return { ok: false, error: 'Payment currency did not match the product.' };
  }
  if (Math.abs(amount - Number(product.price || 0)) > 0.001) {
    return { ok: false, error: 'Payment amount did not match the product price.' };
  }

  const email = normalizeEmail_(data.payer_email || '');
  if (!validEmail_(email)) {
    return { ok: false, error: 'PayPal did not return a valid payer email address.' };
  }

  const customer = findBy_(sheet_(LWB.SHEETS.CUSTOMERS), 'email', email);
  const customerId = customer ? customer.customer_id : '';

  const order = recordOrder_({
    order_id: 'pdt_' + tx,
    paypal_order_id: clean_(data.parent_txn_id || '', 200),
    paypal_capture_id: tx,
    customer_id: customerId,
    email: email,
    status: 'completed',
    currency: currency,
    subtotal: amount,
    total: amount,
    payer_country: clean_(data.residence_country || data.address_country_code || '', 20),
    raw_event_id: 'pdt:' + tx
  });

  recordOrderItem_({
    order_id: order.order_id,
    product_id: product.product_id,
    quantity: 1,
    unit_price: amount,
    line_total: amount
  });

  if (isAccountEligibleProduct_(product)) {
    grantEntitlement_({
      customer_id: customerId,
      email: email,
      product_id: product.product_id,
      order_id: order.order_id,
      source: 'paypal-pdt'
    });
  }

  logSystem_('INFO', 'PAYPAL_PDT_VERIFIED', email, order.order_id, 'paypal', product.product_id,
    { txn_id: tx });

  return fulfillmentResponse_(order, product, email);
}

function parsePdtResponse_(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const status = String(lines.shift() || '').trim();
  const data = {};

  lines.forEach(function(line) {
    const i = line.indexOf('=');
    if (i < 0) return;
    const key = decodeURIComponent(line.slice(0, i).replace(/\+/g, ' '));
    const value = decodeURIComponent(line.slice(i + 1).replace(/\+/g, ' '));
    data[key] = value;
  });

  return { ok: status === 'SUCCESS', data: data };
}

function matchPdtProduct_(data) {
  const candidates = [data.item_number, data.custom, data.item_name]
    .filter(Boolean).map(String);
  const rows = readObjects_(sheet_(LWB.SHEETS.PRODUCTS)).filter(function(row) {
    return String(row.status || '').toLowerCase() === 'active';
  });

  for (let i = 0; i < candidates.length; i++) {
    let candidate = candidates[i];
    if (candidate.charAt(0) === '{') {
      try {
        const parsed = JSON.parse(candidate);
        candidate = parsed.product_slug || parsed.product_id || parsed.slug || candidate;
      } catch (_) {}
    }

    const row = rows.find(function(productRow) {
      return productIdentifierMatches_(publicProduct_(productRow), candidate);
    });
    if (row) return publicProduct_(row);
  }

  // Strong fallback for the dedicated Ethiopian Bible hosted button / item text.
  const allText = normalizeProductKey_(candidates.join(' '));
  if (allText.indexOf('ethiopian') >= 0 || allText.indexOf('apocrypha') >= 0) {
    const eth = rows.find(function(row) { return isEthiopianProduct_(publicProduct_(row)); });
    if (eth) return publicProduct_(eth);
  }

  return null;
}

function productIdentifierMatches_(product, value) {
  const candidate = normalizeProductKey_(value);
  if (!candidate) return false;

  const keys = [
    product.slug,
    product.product_id,
    product.short_title,
    product.title,
    product.paypal_button_id
  ].map(normalizeProductKey_).filter(Boolean);

  return keys.some(function(valueKey) { return valueKey === candidate; });
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
  const asset = findAssetForProduct_(product.product_id);
  if (!asset) {
    return { ok: false, error: 'The digital asset is not linked in Digital Assets.' };
  }

  if (asset.repository_path) {
    return {
      ok: true,
      order_id: order.order_id,
      email: email,
      product: product,
      download_url: LWB.SITE_URL + asset.repository_path
    };
  }

  const token = createDownloadToken_({
    asset_id: asset.asset_id,
    product_id: product.product_id,
    email: email,
    order_id: order.order_id,
    expires: Date.now() + 24 * 60 * 60 * 1000
  });

  return {
    ok: true,
    order_id: order.order_id,
    email: email,
    product: product,
    download_url: ScriptApp.getService().getUrl() + '?action=download&token=' + encodeURIComponent(token)
  };
}

/* ========================================================================== */
/* PURCHASE RECONCILIATION                                                    */
/* ========================================================================== */

function reconcilePurchase_(data) {
  ensureAuthSecrets_();
  ensureCustomerAuthColumns_();

  const customer = verifySessionToken_(data.token);
  const tx = clean_(data.tx || data.txn_id || data.transaction_id || '', 200);
  if (!tx) return { ok: false, error: 'Enter a PayPal transaction ID.' };

  let order = findBy_(sheet_(LWB.SHEETS.ORDERS), 'paypal_capture_id', tx);

  if (!order || String(order.status || '').toLowerCase() !== 'completed') {
    const verified = verifyPayPalPdtUnlocked_({ tx: tx });
    if (!verified || !verified.ok) {
      return { ok: false, error: (verified && verified.error) || 'PayPal could not verify that transaction.' };
    }
    order = findBy_(sheet_(LWB.SHEETS.ORDERS), 'paypal_capture_id', tx);
  }

  if (!order || String(order.status || '').toLowerCase() !== 'completed') {
    return { ok: false, error: 'The transaction could not be located as a completed Living Word Bibles payment.' };
  }

  const currentCustomerId = String(customer.customer_id || '');
  const attachedCustomerId = String(order.customer_id || '');
  if (attachedCustomerId && attachedCustomerId !== currentCustomerId) {
    return {
      ok: false,
      error: 'This PayPal transaction is already attached to a different Living Word Bibles account.'
    };
  }

  const items = orderItemsForOrder_(order.order_id);
  if (!items.length) {
    return { ok: false, error: 'The transaction is verified, but no Living Word Bibles product is recorded for it.' };
  }

  const eligible = [];
  const rejected = [];

  items.forEach(function(item) {
    const product = getProductById_(item.product_id);
    if (!product) {
      rejected.push({ product_id: item.product_id, reason: 'Product record not found' });
      return;
    }
    if (!isAccountEligibleProduct_(product)) {
      rejected.push({ product_id: product.product_id, title: product.title, reason: 'Not an account-eligible digital product' });
      return;
    }
    eligible.push(product);
  });

  if (!eligible.length) {
    return {
      ok: false,
      error: 'This purchase is valid, but it is not an eBible or the Living Word Bibles Ethiopian Bible PDF and cannot be attached to an account.'
    };
  }

  order.customer_id = currentCustomerId;
  order.updated_at = new Date();
  upsertByKey_(sheet_(LWB.SHEETS.ORDERS), 'order_id', order.order_id, order);

  const attached = eligible.map(function(product) {
    const ent = grantEntitlement_({
      customer_id: currentCustomerId,
      email: customer.email,
      product_id: product.product_id,
      order_id: order.order_id,
      source: 'account-reconcile-paypal'
    });
    return {
      product_id: product.product_id,
      title: product.title,
      existing: Boolean(ent.existing)
    };
  });

  ensureDefaultFreeEntitlements_(customer);

  logSystem_('INFO', 'PURCHASE_RECONCILED', customer.email, order.order_id, 'account', tx, {
    customer_id: currentCustomerId,
    attached_products: attached.map(function(row) { return row.product_id; }),
    rejected_products: rejected
  });

  return {
    ok: true,
    message: attached.length === 1 ? 'Purchase attached to your account.' : 'Purchases attached to your account.',
    order_id: order.order_id,
    transaction_id: tx,
    attached_products: attached,
    skipped_products: rejected
  };
}

/* ========================================================================== */
/* ACCOUNTS / AUTH                                                            */
/* ========================================================================== */

function ensureAuthSecrets_() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('AUTH_PASSWORD_PEPPER')) {
    props.setProperty('AUTH_PASSWORD_PEPPER', Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid());
  }
  if (!props.getProperty('AUTH_TOKEN_SECRET')) {
    props.setProperty('AUTH_TOKEN_SECRET', Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid());
  }
  if (!props.getProperty('AUTH_SESSION_SECRET')) {
    props.setProperty('AUTH_SESSION_SECRET', Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid());
  }
}

function ensureCustomerAuthColumns_() {
  const customerSheet = sheet_(LWB.SHEETS.CUSTOMERS);
  const required = [
    'password_hash', 'password_salt', 'session_version',
    'verification_token_hash', 'verification_expires_at',
    'reset_token_hash', 'reset_expires_at'
  ];

  const headers = headers_(customerSheet);
  let nextColumn = headers.length + 1;
  required.forEach(function(name) {
    if (headers.indexOf(name) === -1) {
      customerSheet.getRange(1, nextColumn).setValue(name);
      headers.push(name);
      nextColumn++;
    }
  });
  customerSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  customerSheet.setFrozenRows(1);
}

function registerAccount_(data) {
  ensureAuthSecrets_();
  ensureCustomerAuthColumns_();

  const email = normalizeEmail_(data.email);
  const displayName = clean_(data.display_name || data.name || '', 160);
  const password = String(data.password || '');

  if (!validEmail_(email)) return { ok: false, error: 'Please enter a valid email address.' };
  const passwordError = passwordValidationError_(password);
  if (passwordError) return { ok: false, error: passwordError };
  if (!allowAuthAttempt_('register', email, 5, 3600)) {
    return { ok: false, error: 'Too many account requests. Please try again later.' };
  }

  const customerSheet = sheet_(LWB.SHEETS.CUSTOMERS);
  const existing = findBy_(customerSheet, 'email', email);

  if (existing) {
    if (!truthy_(existing.email_verified)) {
      const verification = issueVerificationToken_(existing);
      upsertByKey_(customerSheet, 'customer_id', existing.customer_id, existing);
      sendWelcomeVerificationEmail_(email, existing.display_name || displayName, verification.token);
      return {
        ok: true,
        message: 'Your account already exists but is not verified. A new welcome and verification email has been sent.'
      };
    }
    return { ok: false, error: 'An account already exists for that email address. Sign in or use Forgot Password.' };
  }

  const now = new Date();
  const salt = randomToken_();
  const customerId = uuid_();
  const customer = {
    customer_id: customerId,
    firebase_uid: '',
    email: email,
    display_name: displayName,
    status: 'pending_verification',
    email_verified: false,
    created_at: now,
    updated_at: now,
    last_login_at: '',
    password_hash: hashPassword_(password, salt),
    password_salt: salt,
    session_version: 1,
    verification_token_hash: '',
    verification_expires_at: '',
    reset_token_hash: '',
    reset_expires_at: ''
  };

  const verification = issueVerificationToken_(customer);
  appendObject_(customerSheet, customer);

  try {
    sendWelcomeVerificationEmail_(email, displayName, verification.token);
  } catch (err) {
    logSystem_('ERROR', 'REGISTER_EMAIL_FAILED', email, customerId, 'account', safeError_(err), {});
    return {
      ok: false,
      error: 'Your account was created, but the welcome/verification email could not be sent. Please contact Living Word Bibles.'
    };
  }

  logSystem_('INFO', 'ACCOUNT_REGISTERED', email, customerId, 'account', 'welcome verification sent', {});
  return { ok: true, message: 'Account created. Check your email to verify your address.' };
}

function loginAccount_(data) {
  ensureAuthSecrets_();
  ensureCustomerAuthColumns_();

  const email = normalizeEmail_(data.email);
  const password = String(data.password || '');
  if (!validEmail_(email) || !password) return { ok: false, error: 'Invalid email address or password.' };
  if (!allowAuthAttempt_('login', email, 12, 900)) {
    return { ok: false, error: 'Too many sign-in attempts. Please try again later.' };
  }

  const customerSheet = sheet_(LWB.SHEETS.CUSTOMERS);
  const customer = findBy_(customerSheet, 'email', email);
  if (!customer || !verifyPassword_(password, customer.password_salt, customer.password_hash)) {
    return { ok: false, error: 'Invalid email address or password.' };
  }
  if (!truthy_(customer.email_verified)) {
    return { ok: false, error: 'Please verify your email address before signing in.' };
  }
  if (String(customer.status || '').toLowerCase() !== 'active') {
    return { ok: false, error: 'This account is not active.' };
  }

  ensureDefaultFreeEntitlements_(customer);

  customer.last_login_at = new Date();
  customer.updated_at = new Date();
  customer.session_version = Number(customer.session_version || 1);
  upsertByKey_(customerSheet, 'customer_id', customer.customer_id, customer);

  const token = createSessionToken_(customer);
  logSystem_('INFO', 'LOGIN', email, customer.customer_id, 'account', 'success', {});
  return { ok: true, token: token, user: publicCustomer_(customer) };
}

function forgotPassword_(data) {
  ensureAuthSecrets_();
  ensureCustomerAuthColumns_();

  const email = normalizeEmail_(data.email);
  const generic = {
    ok: true,
    message: 'If an account exists for that address, a password-reset email has been sent.'
  };
  if (!validEmail_(email)) return generic;
  if (!allowAuthAttempt_('forgot', email, 5, 3600)) return generic;

  const customerSheet = sheet_(LWB.SHEETS.CUSTOMERS);
  const customer = findBy_(customerSheet, 'email', email);
  if (!customer) return generic;

  const token = randomToken_();
  customer.reset_token_hash = hashAuthToken_(token);
  customer.reset_expires_at = new Date(Date.now() + 60 * 60 * 1000);
  customer.updated_at = new Date();
  upsertByKey_(customerSheet, 'customer_id', customer.customer_id, customer);

  try {
    sendResetEmail_(email, customer.display_name || '', token);
    logSystem_('INFO', 'PASSWORD_RESET_REQUESTED', email, customer.customer_id, 'account', 'email sent', {});
  } catch (err) {
    logSystem_('ERROR', 'PASSWORD_RESET_EMAIL_FAILED', email, customer.customer_id, 'account', safeError_(err), {});
  }
  return generic;
}

function resetPassword_(data) {
  ensureAuthSecrets_();
  ensureCustomerAuthColumns_();

  const email = normalizeEmail_(data.email);
  const token = String(data.token || '');
  const password = String(data.password || '');

  if (!validEmail_(email) || !token) return { ok: false, error: 'This password-reset link is invalid.' };
  const passwordError = passwordValidationError_(password);
  if (passwordError) return { ok: false, error: passwordError };

  const customerSheet = sheet_(LWB.SHEETS.CUSTOMERS);
  const customer = findBy_(customerSheet, 'email', email);
  if (!customer || !customer.reset_token_hash || !customer.reset_expires_at) {
    return { ok: false, error: 'This password-reset link is invalid or has expired.' };
  }

  const expires = new Date(customer.reset_expires_at).getTime();
  if (!expires || expires < Date.now()) {
    return { ok: false, error: 'This password-reset link has expired. Request a new one.' };
  }
  if (!constantTimeEqual_(String(customer.reset_token_hash), hashAuthToken_(token))) {
    return { ok: false, error: 'This password-reset link is invalid or has expired.' };
  }

  const salt = randomToken_();
  customer.password_salt = salt;
  customer.password_hash = hashPassword_(password, salt);
  customer.reset_token_hash = '';
  customer.reset_expires_at = '';
  customer.session_version = Number(customer.session_version || 1) + 1;
  customer.updated_at = new Date();
  upsertByKey_(customerSheet, 'customer_id', customer.customer_id, customer);

  logSystem_('INFO', 'PASSWORD_RESET_COMPLETED', email, customer.customer_id, 'account', 'success', {});
  return { ok: true, message: 'Your password has been updated. You can now sign in.' };
}

function verifyEmail_(data) {
  ensureAuthSecrets_();
  ensureCustomerAuthColumns_();

  const email = normalizeEmail_(data.email);
  const token = String(data.token || '');
  if (!validEmail_(email) || !token) return { ok: false, error: 'This verification link is invalid.' };

  const customerSheet = sheet_(LWB.SHEETS.CUSTOMERS);
  const customer = findBy_(customerSheet, 'email', email);
  if (!customer) return { ok: false, error: 'This verification link is invalid.' };

  if (truthy_(customer.email_verified)) {
    ensureDefaultFreeEntitlements_(customer);
    return { ok: true, message: 'Your email address is already verified.' };
  }

  const expires = new Date(customer.verification_expires_at || '').getTime();
  if (!customer.verification_token_hash || !expires || expires < Date.now()) {
    return { ok: false, error: 'This verification link has expired. Create the account again to receive a new link.' };
  }
  if (!constantTimeEqual_(String(customer.verification_token_hash), hashAuthToken_(token))) {
    return { ok: false, error: 'This verification link is invalid.' };
  }

  customer.email_verified = true;
  customer.status = 'active';
  customer.verification_token_hash = '';
  customer.verification_expires_at = '';
  customer.updated_at = new Date();
  upsertByKey_(customerSheet, 'customer_id', customer.customer_id, customer);

  ensureDefaultFreeEntitlements_(customer);

  logSystem_('INFO', 'EMAIL_VERIFIED', email, customer.customer_id, 'account', 'success + free library', {});
  return {
    ok: true,
    message: 'Your email address has been verified. Your free KJV Special Edition and Douay-Rheims Bible are ready in your Library.'
  };
}

function accountData_(data) {
  ensureAuthSecrets_();
  ensureCustomerAuthColumns_();

  const customer = verifySessionToken_(data.token);
  ensureDefaultFreeEntitlements_(customer);

  const email = normalizeEmail_(customer.email);
  const customerId = String(customer.customer_id || '');

  const orders = readObjects_(sheet_(LWB.SHEETS.ORDERS))
    .filter(function(order) {
      if (String(order.status || '').toLowerCase() === 'removed') return false;
      const attachedCustomerId = String(order.customer_id || '');
      if (attachedCustomerId) {
        return Boolean(customerId && attachedCustomerId === customerId);
      }
      return normalizeEmail_(order.email) === email;
    })
    .sort(function(a, b) {
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    })
    .map(function(order) {
      return pick_(order, [
        'order_id', 'paypal_order_id', 'paypal_capture_id', 'status',
        'currency', 'subtotal', 'total', 'created_at', 'updated_at'
      ]);
    });

  const activeEntitlements = readObjects_(sheet_(LWB.SHEETS.ENTITLEMENTS)).filter(function(entitlement) {
    if (String(entitlement.status || '').toLowerCase() !== 'active') return false;
    const attachedCustomerId = String(entitlement.customer_id || '');
    const belongsToCustomer = customerId && attachedCustomerId === customerId;
    const belongsToEmail = !attachedCustomerId && email && normalizeEmail_(entitlement.email) === email;
    if (!belongsToCustomer && !belongsToEmail) return false;
    if (entitlement.expires_at) {
      const expires = new Date(entitlement.expires_at).getTime();
      if (expires && expires < Date.now()) return false;
    }
    return true;
  });

  const byProduct = {};
  activeEntitlements.forEach(function(entitlement) {
    const key = String(entitlement.product_id || '');
    if (!key) return;
    if (!byProduct[key]) {
      byProduct[key] = entitlement;
      return;
    }
    const current = new Date(byProduct[key].granted_at || 0).getTime();
    const candidate = new Date(entitlement.granted_at || 0).getTime();
    if (candidate > current) byProduct[key] = entitlement;
  });

  const library = Object.keys(byProduct).map(function(productId) {
    const entitlement = byProduct[productId];
    const product = getProductById_(productId);
    if (!product || !isAccountEligibleProduct_(product)) return null;

    const asset = findAssetForProduct_(productId);
    let downloadUrl = '';

    if (asset) {
      if (asset.repository_path) {
        downloadUrl = LWB.SITE_URL + asset.repository_path;
      } else if (asset.drive_file_id) {
        const token = createDownloadToken_({
          asset_id: asset.asset_id,
          product_id: productId,
          email: email,
          order_id: entitlement.order_id || '',
          customer_id: customerId,
          expires: Date.now() + 24 * 60 * 60 * 1000
        });
        downloadUrl = ScriptApp.getService().getUrl() + '?action=download&token=' + encodeURIComponent(token);
      }
    }

    return {
      entitlement_id: entitlement.entitlement_id,
      product_id: product.product_id,
      slug: product.slug,
      title: product.title,
      short_title: product.short_title,
      product_type: product.product_type,
      cover_path: product.cover_path,
      canonical_path: product.canonical_path,
      granted_at: entitlement.granted_at,
      download_url: downloadUrl
    };
  }).filter(Boolean).sort(function(a, b) {
    return new Date(b.granted_at || 0) - new Date(a.granted_at || 0);
  });

  return {
    ok: true,
    user: publicCustomer_(customer),
    library: library,
    orders: orders,
    reconciliation_url: LWB.SITE_URL + '/payment-complete/?reconcile=1'
  };
}

function issueVerificationToken_(customer) {
  const token = randomToken_();
  customer.verification_token_hash = hashAuthToken_(token);
  customer.verification_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);
  customer.updated_at = new Date();
  return { token: token };
}

function passwordValidationError_(password) {
  if (password.length < 10) return 'Password must be at least 10 characters.';
  if (password.length > 128) return 'Password must be 128 characters or fewer.';
  return '';
}

function hashPassword_(password, salt) {
  const pepper = PropertiesService.getScriptProperties().getProperty('AUTH_PASSWORD_PEPPER');
  if (!pepper) throw new Error('Account password service is not configured.');

  const seed = Utilities.newBlob(String(salt) + '|' + pepper).getBytes();
  let digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    Utilities.newBlob(String(password) + '|' + String(salt) + '|' + pepper).getBytes()
  );

  for (let i = 1; i < 4096; i++) {
    digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, digest.concat(seed));
  }
  return Utilities.base64EncodeWebSafe(digest).replace(/=+$/, '');
}

function verifyPassword_(password, salt, expectedHash) {
  if (!salt || !expectedHash) return false;
  return constantTimeEqual_(hashPassword_(password, salt), String(expectedHash));
}

function randomToken_() {
  return Utilities.getUuid().replace(/-/g, '') +
    Utilities.getUuid().replace(/-/g, '') +
    Utilities.getUuid().replace(/-/g, '');
}

function hashAuthToken_(token) {
  const secret = PropertiesService.getScriptProperties().getProperty('AUTH_TOKEN_SECRET');
  if (!secret) throw new Error('Account token service is not configured.');
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(String(token), secret)
  ).replace(/=+$/, '');
}

function createSessionToken_(customer) {
  const secret = PropertiesService.getScriptProperties().getProperty('AUTH_SESSION_SECRET');
  if (!secret) throw new Error('Account session service is not configured.');

  const payload = {
    customer_id: customer.customer_id,
    email: normalizeEmail_(customer.email),
    session_version: Number(customer.session_version || 1),
    issued_at: Date.now(),
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000
  };

  const body = Utilities.base64EncodeWebSafe(
    JSON.stringify(payload), Utilities.Charset.UTF_8
  ).replace(/=+$/, '');
  const signature = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(body, secret)
  ).replace(/=+$/, '');
  return body + '.' + signature;
}

function verifySessionToken_(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) throw new Error('Your account session is invalid. Please sign in again.');

  const secret = PropertiesService.getScriptProperties().getProperty('AUTH_SESSION_SECRET');
  if (!secret) throw new Error('Account session service is not configured.');

  const expected = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(parts[0], secret)
  ).replace(/=+$/, '');
  if (!constantTimeEqual_(expected, parts[1])) {
    throw new Error('Your account session is invalid. Please sign in again.');
  }

  const payload = JSON.parse(
    Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString()
  );
  if (Number(payload.expires || 0) < Date.now()) {
    throw new Error('Your account session has expired. Please sign in again.');
  }

  const customer = findBy_(sheet_(LWB.SHEETS.CUSTOMERS), 'customer_id', payload.customer_id);
  if (!customer) throw new Error('Your account could not be found. Please sign in again.');
  if (normalizeEmail_(customer.email) !== normalizeEmail_(payload.email)) {
    throw new Error('Your account session is invalid. Please sign in again.');
  }
  if (Number(customer.session_version || 1) !== Number(payload.session_version || 1)) {
    throw new Error('Your account session has expired. Please sign in again.');
  }
  if (!truthy_(customer.email_verified) || String(customer.status || '').toLowerCase() !== 'active') {
    throw new Error('Your account is not active.');
  }
  return customer;
}

function publicCustomer_(customer) {
  return {
    customer_id: customer.customer_id,
    email: normalizeEmail_(customer.email),
    display_name: customer.display_name || '',
    email_verified: truthy_(customer.email_verified),
    created_at: customer.created_at || '',
    last_login_at: customer.last_login_at || ''
  };
}

function allowAuthAttempt_(bucket, key, limit, seconds) {
  try {
    const cache = CacheService.getScriptCache();
    const cacheKey = 'auth:' + bucket + ':' + normalizeEmail_(key).slice(0, 180);
    const current = Number(cache.get(cacheKey) || 0);
    if (current >= limit) return false;
    cache.put(cacheKey, String(current + 1), seconds);
    return true;
  } catch (_) {
    return true;
  }
}


/* ========================================================================== */
/* SITE ACTIVITY / EXISTING SYSTEM LOG                                        */
/* ========================================================================== */

/**
 * Appends one sanitized site event to the existing System Log sheet.
 * Values typed into forms, passwords, and URL query strings are never logged.
 */
function activityLog_(data) {
  const event = normalizeActivityEvent_(data);
  if (!event) return { ok: true, logged: 0 };

  const identity = activityIdentity_(data);
  logSystem_(
    'INFO',
    event.event_type,
    identity.email,
    '',
    identity.source,
    event.path,
    event.metadata
  );

  return { ok: true, logged: 1 };
}

function activityLogBatch_(data) {
  const events = Array.isArray(data.events) ? data.events.slice(0, 25) : [];
  const identity = activityIdentity_(data);
  let logged = 0;

  events.forEach(function(raw) {
    const event = normalizeActivityEvent_(raw);
    if (!event) return;

    logSystem_(
      'INFO',
      event.event_type,
      identity.email,
      '',
      identity.source,
      event.path,
      event.metadata
    );
    logged++;
  });

  return { ok: true, logged: logged };
}

function activityIdentity_(data) {
  let email = '';
  let source = 'website';

  const portalToken = String(data.admin_token || '');
  if (portalToken) {
    try {
      const admin = verifyAdminSessionToken_(portalToken);
      email = normalizeEmail_(admin.email || '');
      source = 'portal';
      return { email: email, source: source };
    } catch (_) {}
  }

  const accountToken = String(data.account_token || '');
  if (accountToken) {
    try {
      const customer = verifySessionToken_(accountToken);
      email = normalizeEmail_(customer.email || '');
      source = 'account';
    } catch (_) {}
  }

  return { email: email, source: source };
}

function normalizeActivityEvent_(raw) {
  raw = raw || {};
  const kind = String(raw.kind || raw.event_type || 'click').toLowerCase();
  const eventType = kind === 'pageview' ? 'PAGE_VIEW' : 'SITE_CLICK';
  const path = safeActivityPath_(raw.path || '/');

  const metadata = {
    href: safeActivityHref_(raw.href || ''),
    label: cleanActivityText_(raw.label || '', 240),
    tag: cleanActivityText_(raw.tag || '', 40),
    id: cleanActivityText_(raw.id || '', 120),
    class_name: cleanActivityText_(raw.class_name || raw.className || '', 240),
    title: cleanActivityText_(raw.title || '', 240),
    referrer_path: safeActivityPath_(raw.referrer_path || ''),
    viewport: cleanActivityText_(raw.viewport || '', 40),
    session_id: cleanActivityText_(raw.session_id || '', 100),
    client_time: cleanActivityText_(raw.client_time || '', 80)
  };

  return {
    event_type: eventType,
    path: path,
    metadata: metadata
  };
}

function safeActivityPath_(value) {
  let path = String(value || '').trim();
  if (!path) return '';

  path = path.split('?')[0].split('#')[0];
  path = path.replace(/^https?:\/\/[^/]+/i, '');
  if (!path) path = '/';
  if (path.charAt(0) !== '/') path = '/' + path.replace(/^\/+/, '');

  return clean_(path, 600);
}

function safeActivityHref_(value) {
  let href = String(value || '').trim();
  if (!href) return '';

  href = href.split('?')[0].split('#')[0];

  if (/^https?:\/\//i.test(href)) {
    const ownOrigin = LWB.SITE_URL.replace(/\/+$/, '');
    if (href.indexOf(ownOrigin) === 0) {
      href = href.slice(ownOrigin.length) || '/';
    }
  }

  return clean_(href, 600);
}

function cleanActivityText_(value, max) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max || 240);
}

/* ========================================================================== */
/* ADMIN PORTAL — EXISTING SHEET ARCHITECTURE                                 */
/* ========================================================================== */

function getSettingValue_(key) {
  const row = readObjects_(sheet_(LWB.SHEETS.SETTINGS)).find(function(item) {
    return String(item.key || '').trim() === String(key || '').trim();
  });
  return row ? row.value : '';
}

function adminSettings_() {
  return {
    user: String(getSettingValue_('admin_user') || '').trim(),
    password: String(getSettingValue_('admin_password') || ''),
    display_name: String(getSettingValue_('admin_display_name') || 'Living Word Bibles').trim(),
    email: normalizeEmail_(getSettingValue_('admin_email') || LWB.CONTACT_EMAIL),
    enabled: truthy_(getSettingValue_('admin_enabled')),
    session_minutes: Math.min(720, Math.max(15, Number(getSettingValue_('admin_session_minutes') || 90))),
    created_at: getSettingValue_('admin_created_at') || '',
    updated_at: getSettingValue_('admin_updated_at') || ''
  };
}

function adminCredentialFingerprint_(settings) {
  ensureAuthSecrets_();
  const secret = PropertiesService.getScriptProperties().getProperty('AUTH_SESSION_SECRET');
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(
      String(settings.user) + '|' + String(settings.password) + '|' + String(settings.updated_at || ''),
      secret
    )
  ).replace(/=+$/, '');
}

function createAdminSessionToken_(settings) {
  ensureAuthSecrets_();
  const secret = PropertiesService.getScriptProperties().getProperty('AUTH_SESSION_SECRET');
  const now = Date.now();
  const payload = {
    type: 'lwb-admin',
    user: settings.user,
    fingerprint: adminCredentialFingerprint_(settings),
    issued_at: now,
    expires: now + settings.session_minutes * 60 * 1000
  };

  const body = Utilities.base64EncodeWebSafe(
    JSON.stringify(payload),
    Utilities.Charset.UTF_8
  ).replace(/=+$/, '');

  const signature = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature('admin:' + body, secret)
  ).replace(/=+$/, '');

  return body + '.' + signature;
}

function verifyAdminSessionToken_(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) throw new Error('Your portal session is invalid. Sign in again.');

  ensureAuthSecrets_();
  const secret = PropertiesService.getScriptProperties().getProperty('AUTH_SESSION_SECRET');
  const expected = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature('admin:' + parts[0], secret)
  ).replace(/=+$/, '');

  if (!constantTimeEqual_(expected, parts[1])) {
    throw new Error('Your portal session is invalid. Sign in again.');
  }

  const payload = JSON.parse(
    Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString()
  );

  if (payload.type !== 'lwb-admin' || Number(payload.expires || 0) < Date.now()) {
    throw new Error('Your portal session has expired. Sign in again.');
  }

  const settings = adminSettings_();
  if (!settings.enabled || !settings.user || !settings.password) {
    throw new Error('Portal administration is disabled or incomplete in Settings.');
  }

  if (!constantTimeEqual_(String(payload.user || ''), String(settings.user))) {
    throw new Error('Your portal session is no longer valid.');
  }

  if (!constantTimeEqual_(String(payload.fingerprint || ''), adminCredentialFingerprint_(settings))) {
    throw new Error('Portal credentials changed. Sign in again.');
  }

  return settings;
}

function publicAdmin_(settings) {
  return {
    user: settings.user,
    display_name: settings.display_name,
    email: settings.email,
    session_minutes: settings.session_minutes,
    created_at: settings.created_at,
    updated_at: settings.updated_at
  };
}

function adminLogin_(data) {
  const settings = adminSettings_();
  const user = String(data.admin_user || data.username || '').trim();
  const password = String(data.admin_password || data.password || '');

  if (!settings.enabled) return { ok: false, error: 'The administration portal is disabled in Settings.' };
  if (!settings.user || !settings.password) {
    return { ok: false, error: 'The administration portal credentials are incomplete in Settings.' };
  }

  if (!allowAuthAttempt_('admin', user || 'portal', 10, 900)) {
    return { ok: false, error: 'Too many portal sign-in attempts. Try again later.' };
  }

  const validUser = constantTimeEqual_(user, settings.user);
  const validPassword = constantTimeEqual_(password, settings.password);

  if (!validUser || !validPassword) {
    logSystem_('WARN', 'ADMIN_LOGIN_FAILED', '', '', 'portal', 'invalid credentials', {
      attempted_user: clean_(user, 120)
    });
    return { ok: false, error: 'Invalid portal username or password.' };
  }

  const token = createAdminSessionToken_(settings);
  logSystem_('INFO', 'ADMIN_LOGIN', settings.email, '', 'portal', settings.user, {});

  return {
    ok: true,
    token: token,
    admin: publicAdmin_(settings)
  };
}

function adminSession_(data) {
  const settings = verifyAdminSessionToken_(data.token);
  return { ok: true, admin: publicAdmin_(settings) };
}

function adminDashboard_(data) {
  const settings = verifyAdminSessionToken_(data.token);
  const subscribers = readObjects_(sheet_(LWB.SHEETS.SUBSCRIBERS));
  const customers = readObjects_(sheet_(LWB.SHEETS.CUSTOMERS));
  const orders = readObjects_(sheet_(LWB.SHEETS.ORDERS));
  const entitlements = readObjects_(sheet_(LWB.SHEETS.ENTITLEMENTS));
  const state = getNewsletterCampaignState_();

  return {
    ok: true,
    admin: publicAdmin_(settings),
    counts: {
      subscribers_active: subscribers.filter(function(row) {
        return String(row.status || '').toLowerCase() === 'subscribed';
      }).length,
      subscribers_unsubscribed: subscribers.filter(function(row) {
        return String(row.status || '').toLowerCase() === 'unsubscribed';
      }).length,
      customers: customers.length,
      customers_active: customers.filter(function(row) {
        return String(row.status || '').toLowerCase() === 'active';
      }).length,
      orders_completed: orders.filter(function(row) {
        return String(row.status || '').toLowerCase() === 'completed';
      }).length,
      entitlements_active: entitlements.filter(function(row) {
        return String(row.status || '').toLowerCase() === 'active';
      }).length
    },
    campaign: publicNewsletterCampaignState_(state),
    eligible_products: accountEligibleProducts_(),
    recent_logs: recentSystemLogs_(25),
    newsletter_rules: {
      batch_max: LWB.NEWSLETTER_BATCH_MAX,
      weekdays: ['Monday', 'Wednesday', 'Friday']
    }
  };
}

function accountEligibleProducts_() {
  return readObjects_(sheet_(LWB.SHEETS.PRODUCTS))
    .map(publicProduct_)
    .filter(function(product) {
      return String(product.status || '').toLowerCase() === 'active' &&
        isAccountEligibleProduct_(product);
    })
    .sort(function(a, b) {
      return Number(a.sort_order || 0) - Number(b.sort_order || 0);
    });
}

function adminSubscribers_(data) {
  verifyAdminSessionToken_(data.token);
  const query = String(data.query || '').trim().toLowerCase();
  const limit = Math.min(300, Math.max(1, Number(data.limit || 150)));

  const rows = readObjects_(sheet_(LWB.SHEETS.SUBSCRIBERS))
    .filter(function(row) {
      if (!query) return true;
      return String(row.email || '').toLowerCase().indexOf(query) >= 0 ||
        String(row.name || '').toLowerCase().indexOf(query) >= 0 ||
        String(row.status || '').toLowerCase().indexOf(query) >= 0;
    })
    .sort(function(a, b) {
      return new Date(b.updated_at || b.subscribed_at || 0) -
        new Date(a.updated_at || a.subscribed_at || 0);
    })
    .slice(0, limit)
    .map(function(row) {
      return pick_(row, [
        'subscriber_id', 'email', 'name', 'status', 'source',
        'subscribed_at', 'unsubscribed_at', 'updated_at'
      ]);
    });

  return { ok: true, subscribers: rows };
}

function adminSubscriberAdd_(data) {
  const admin = verifyAdminSessionToken_(data.token);
  const email = normalizeEmail_(data.email);
  const name = clean_(data.name || '', 160);
  const overrideDne = truthy_(data.override_dne);

  if (!validEmail_(email)) return { ok: false, error: 'Enter a valid subscriber email address.' };

  if (overrideDne) {
    removeDneByEmail_(email);
  }

  const result = subscribe_({
    email: email,
    name: name,
    source: 'admin-portal',
    consent_version: LWB.CONSENT_VERSION,
    user_agent: clean_(data.userAgent || '', 500)
  });

  if (result.ok) {
    logSystem_('INFO', 'ADMIN_SUBSCRIBER_ADD', admin.email, result.email, 'portal',
      'subscriber added or reactivated', { subscriber_email: result.email, override_dne: overrideDne });
  }

  return result;
}

function adminSubscriberRemove_(data) {
  const admin = verifyAdminSessionToken_(data.token);
  const email = normalizeEmail_(data.email);

  if (!validEmail_(email)) return { ok: false, error: 'Enter a valid subscriber email address.' };

  const result = unsubscribe_({
    email: email,
    source: 'admin-portal',
    reason: clean_(data.reason || 'removed in administration portal', 200),
    user_agent: clean_(data.userAgent || '', 500)
  });

  if (result.ok) {
    logSystem_('INFO', 'ADMIN_SUBSCRIBER_REMOVE', admin.email, email, 'portal',
      'subscriber unsubscribed', { subscriber_email: email });
  }

  return result;
}

function removeDneByEmail_(email) {
  const dneSheet = sheet_(LWB.SHEETS.DNE);
  const values = dneSheet.getDataRange().getValues();
  if (values.length < 2) return 0;
  const headers = values[0].map(String);
  const emailIndex = headers.indexOf('email');
  if (emailIndex < 0) return 0;

  let removed = 0;
  for (let i = values.length - 1; i >= 1; i--) {
    if (normalizeEmail_(values[i][emailIndex]) === normalizeEmail_(email)) {
      dneSheet.deleteRow(i + 1);
      removed++;
    }
  }
  return removed;
}

function adminNewsletterTest_(data) {
  const admin = verifyAdminSessionToken_(data.token);
  const target = normalizeEmail_(data.test_email || admin.email);
  if (!validEmail_(target)) return { ok: false, error: 'Enter a valid test email address.' };

  const state = buildCustomNewsletterState_(data, 'test_' + uuid_());
  sendCustomNewsletterEmail_(target, admin.display_name || '', state);

  logSystem_('INFO', 'ADMIN_NEWSLETTER_TEST', admin.email, '', 'portal', state.subject, {
    test_email: target
  });

  return { ok: true, message: 'Test newsletter sent.', email: target };
}

function adminNewsletterQueue_(data) {
  const admin = verifyAdminSessionToken_(data.token);
  const existing = getNewsletterCampaignState_();
  if (existing && existing.status === 'active') {
    return {
      ok: false,
      error: 'A newsletter campaign is already active. Stop or finish it before queueing another.'
    };
  }

  const recipients = newsletterRecipients_();
  const campaignId = 'campaign_' + uuid_();
  const state = buildCustomNewsletterState_(data, campaignId);
  state.cursor = 0;
  state.total = recipients.length;
  state.status = 'active';
  state.started_at = new Date().toISOString();
  state.last_batch_date = '';

  const serialized = JSON.stringify(state);
  if (Utilities.newBlob(serialized).getBytes().length > 8500) {
    return {
      ok: false,
      error: 'This newsletter is too large for the campaign queue. Shorten the body or signature.'
    };
  }

  saveNewsletterCampaignState_(state);
  writeCampaignStatus_(state, 'queued');

  logSystem_('INFO', 'ADMIN_NEWSLETTER_QUEUED', admin.email, campaignId, 'portal', state.subject, {
    recipients: recipients.length,
    batch_max: LWB.NEWSLETTER_BATCH_MAX,
    weekdays: ['Monday', 'Wednesday', 'Friday']
  });

  return {
    ok: true,
    campaign: publicNewsletterCampaignState_(state),
    message: 'Newsletter queued. Subscriber batches send only Monday, Wednesday, and Friday.'
  };
}

function buildCustomNewsletterState_(data, campaignId) {
  const subject = clean_(data.subject || '', 200);
  const preheader = clean_(data.preheader || '', 240);
  const rawHtml = String(data.html || data.body_html || '');
  const rawSignature = String(data.signature_html || '');

  if (!subject) throw new Error('Newsletter subject is required.');
  if (!rawHtml.trim()) throw new Error('Newsletter body is required.');
  if (rawHtml.length > 6000) throw new Error('Newsletter body must be 6,000 characters or fewer.');
  if (rawSignature.length > 1200) throw new Error('Newsletter signature must be 1,200 characters or fewer.');

  return {
    campaign_id: campaignId,
    mode: 'custom',
    template_key: '',
    subject: subject,
    preheader: preheader,
    html: sanitizeNewsletterHtml_(rawHtml),
    signature_html: sanitizeNewsletterHtml_(rawSignature)
  };
}

function adminNewsletterProcess_(data) {
  const admin = verifyAdminSessionToken_(data.token);
  const result = processNewsletterCampaign();
  logSystem_('INFO', 'ADMIN_NEWSLETTER_PROCESS', admin.email,
    result.campaign_id || '', 'portal', result.message || ('sent=' + Number(result.sent || 0)), {
      sent: Number(result.sent || 0),
      failed: Number(result.failed || 0),
      complete: Boolean(result.complete)
    });
  return result;
}

function adminNewsletterStop_(data) {
  const admin = verifyAdminSessionToken_(data.token);
  const result = stopNewsletterCampaign();
  logSystem_('INFO', 'ADMIN_NEWSLETTER_STOP', admin.email, '', 'portal', 'campaign stopped', {});
  return result;
}

function publicNewsletterCampaignState_(state) {
  if (!state) return null;
  return {
    campaign_id: state.campaign_id || '',
    mode: state.mode || 'template',
    template_key: state.template_key || '',
    subject: state.subject || '',
    status: state.status || '',
    cursor: Number(state.cursor || 0),
    total: Number(state.total || 0),
    started_at: state.started_at || '',
    last_batch_at: state.last_batch_at || '',
    last_batch_date: state.last_batch_date || '',
    last_batch_sent: Number(state.last_batch_sent || 0),
    last_batch_failed: Number(state.last_batch_failed || 0),
    completed_at: state.completed_at || ''
  };
}

function adminCustomer_(data) {
  verifyAdminSessionToken_(data.token);
  const customer = findAdminCustomer_(data);
  if (!customer) return { ok: false, error: 'Customer account not found.' };

  if (truthy_(customer.email_verified) && String(customer.status || '').toLowerCase() === 'active') {
    ensureDefaultFreeEntitlements_(customer);
  }

  return adminCustomerResponse_(customer);
}

function findAdminCustomer_(data) {
  const customerId = clean_(data.customer_id || '', 200);
  const email = normalizeEmail_(data.email || '');

  if (customerId) return findBy_(sheet_(LWB.SHEETS.CUSTOMERS), 'customer_id', customerId);
  if (email) return findBy_(sheet_(LWB.SHEETS.CUSTOMERS), 'email', email);
  return null;
}

function adminCustomerResponse_(customer) {
  const customerId = String(customer.customer_id || '');
  const email = normalizeEmail_(customer.email);

  const orders = readObjects_(sheet_(LWB.SHEETS.ORDERS))
    .filter(function(order) {
      return (customerId && String(order.customer_id || '') === customerId) ||
        (email && normalizeEmail_(order.email) === email);
    })
    .sort(function(a, b) {
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    })
    .slice(0, 100)
    .map(function(order) {
      return pick_(order, [
        'order_id', 'paypal_order_id', 'paypal_capture_id', 'customer_id',
        'email', 'status', 'currency', 'subtotal', 'total', 'created_at', 'updated_at'
      ]);
    });

  const entitlements = readObjects_(sheet_(LWB.SHEETS.ENTITLEMENTS))
    .filter(function(row) {
      return (customerId && String(row.customer_id || '') === customerId) ||
        (email && normalizeEmail_(row.email) === email);
    })
    .sort(function(a, b) {
      return new Date(b.granted_at || 0) - new Date(a.granted_at || 0);
    })
    .slice(0, 150)
    .map(function(row) {
      const product = getProductById_(row.product_id);
      return {
        entitlement_id: row.entitlement_id || '',
        product_id: row.product_id || '',
        title: product ? product.title : row.product_id,
        status: row.status || '',
        source: row.source || '',
        order_id: row.order_id || '',
        granted_at: row.granted_at || '',
        revoked_at: row.revoked_at || '',
        required_free: LWB.FREE_ACCOUNT_PRODUCTS.indexOf(String(row.product_id || '')) >= 0
      };
    });

  return {
    ok: true,
    customer: pick_(customer, [
      'customer_id', 'email', 'display_name', 'status', 'email_verified',
      'created_at', 'updated_at', 'last_login_at'
    ]),
    orders: orders,
    entitlements: entitlements,
    eligible_products: accountEligibleProducts_()
  };
}

function adminEntitlementGrant_(data) {
  const admin = verifyAdminSessionToken_(data.token);
  const customer = findAdminCustomer_(data);
  if (!customer) return { ok: false, error: 'Customer account not found.' };

  const product = getProductById_(clean_(data.product_id || '', 200));
  if (!product || !isAccountEligibleProduct_(product)) {
    return { ok: false, error: 'Only eBible products and the Ethiopian Bible PDF can be attached to accounts.' };
  }

  const result = grantEntitlement_({
    customer_id: customer.customer_id,
    email: customer.email,
    product_id: product.product_id,
    order_id: '',
    source: 'admin-portal-manual',
    notes: clean_(data.notes || 'Manually added in administration portal', 500)
  });

  logSystem_('INFO', 'ADMIN_ENTITLEMENT_GRANTED', admin.email, result.entitlement_id,
    'portal', product.product_id, { customer_id: customer.customer_id, customer_email: customer.email });

  return Object.assign({
    ok: true,
    product: product
  }, result);
}

function adminEntitlementRevoke_(data) {
  const admin = verifyAdminSessionToken_(data.token);
  const entitlementId = clean_(data.entitlement_id || '', 200);
  const entitlementSheet = sheet_(LWB.SHEETS.ENTITLEMENTS);
  const entitlement = findBy_(entitlementSheet, 'entitlement_id', entitlementId);

  if (!entitlement) return { ok: false, error: 'Entitlement not found.' };
  if (LWB.FREE_ACCOUNT_PRODUCTS.indexOf(String(entitlement.product_id || '')) >= 0) {
    return {
      ok: false,
      error: 'The KJV Special Edition and Douay-Rheims Bible are required free account products and cannot be removed.'
    };
  }

  entitlement.status = 'revoked';
  entitlement.revoked_at = new Date();
  entitlement.notes = clean_(
    (entitlement.notes ? String(entitlement.notes) + ' | ' : '') +
    (data.notes || 'Revoked in administration portal'),
    500
  );
  upsertByKey_(entitlementSheet, 'entitlement_id', entitlementId, entitlement);

  logSystem_('INFO', 'ADMIN_ENTITLEMENT_REVOKED', admin.email, entitlementId,
    'portal', entitlement.product_id || '', {
      customer_id: entitlement.customer_id || '',
      customer_email: entitlement.email || ''
    });

  return { ok: true, entitlement_id: entitlementId, status: 'revoked' };
}

function adminReconcilePurchase_(data) {
  const admin = verifyAdminSessionToken_(data.token);
  const customer = findAdminCustomer_(data);
  if (!customer) return { ok: false, error: 'Customer account not found.' };

  const tx = clean_(data.tx || data.txn_id || data.transaction_id || '', 200);
  if (!tx) return { ok: false, error: 'Enter a PayPal transaction ID.' };

  let order = findBy_(sheet_(LWB.SHEETS.ORDERS), 'paypal_capture_id', tx);
  if (!order || String(order.status || '').toLowerCase() !== 'completed') {
    const verified = verifyPayPalPdtUnlocked_({ tx: tx });
    if (!verified || !verified.ok) {
      return { ok: false, error: (verified && verified.error) || 'PayPal could not verify that transaction.' };
    }
    order = findBy_(sheet_(LWB.SHEETS.ORDERS), 'paypal_capture_id', tx);
  }

  if (!order || String(order.status || '').toLowerCase() !== 'completed') {
    return { ok: false, error: 'The transaction could not be located as a completed payment.' };
  }

  const targetCustomerId = String(customer.customer_id || '');
  const oldCustomerId = String(order.customer_id || '');
  const force = truthy_(data.force);

  if (oldCustomerId && oldCustomerId !== targetCustomerId && !force) {
    return {
      ok: false,
      error: 'That transaction is already attached to another customer. Check “Allow reassignment” to move it.'
    };
  }

  const items = orderItemsForOrder_(order.order_id);
  const eligible = [];
  const rejected = [];

  items.forEach(function(item) {
    const product = getProductById_(item.product_id);
    if (product && isAccountEligibleProduct_(product)) {
      eligible.push(product);
    } else {
      rejected.push(item.product_id || '');
    }
  });

  if (!eligible.length) {
    return { ok: false, error: 'This order has no account-eligible eBible or Ethiopian Bible PDF products.' };
  }

  if (force && oldCustomerId && oldCustomerId !== targetCustomerId) {
    revokeEntitlementsForOrderCustomer_(order.order_id, oldCustomerId, admin.email);
  }

  order.customer_id = targetCustomerId;
  order.updated_at = new Date();
  upsertByKey_(sheet_(LWB.SHEETS.ORDERS), 'order_id', order.order_id, order);

  const attached = eligible.map(function(product) {
    return {
      product_id: product.product_id,
      title: product.title,
      entitlement: grantEntitlement_({
        customer_id: targetCustomerId,
        email: customer.email,
        product_id: product.product_id,
        order_id: order.order_id,
        source: 'admin-portal-reconcile'
      })
    };
  });

  ensureDefaultFreeEntitlements_(customer);

  logSystem_('INFO', 'ADMIN_PURCHASE_RECONCILED', admin.email, order.order_id,
    'portal', tx, {
      customer_id: targetCustomerId,
      customer_email: customer.email,
      previous_customer_id: oldCustomerId,
      force_reassigned: Boolean(force && oldCustomerId && oldCustomerId !== targetCustomerId),
      attached_products: attached.map(function(row) { return row.product_id; }),
      rejected_products: rejected
    });

  return {
    ok: true,
    order_id: order.order_id,
    transaction_id: tx,
    attached_products: attached,
    skipped_products: rejected
  };
}

function revokeEntitlementsForOrderCustomer_(orderId, customerId, adminEmail) {
  const entitlementSheet = sheet_(LWB.SHEETS.ENTITLEMENTS);
  readObjects_(entitlementSheet)
    .filter(function(row) {
      return String(row.order_id || '') === String(orderId || '') &&
        String(row.customer_id || '') === String(customerId || '') &&
        String(row.status || '').toLowerCase() === 'active';
    })
    .forEach(function(row) {
      row.status = 'revoked';
      row.revoked_at = new Date();
      row.notes = clean_((row.notes ? String(row.notes) + ' | ' : '') +
        'Revoked during admin purchase reassignment', 500);
      upsertByKey_(entitlementSheet, 'entitlement_id', row.entitlement_id, row);
      logSystem_('INFO', 'ADMIN_REASSIGN_REVOKE', adminEmail, row.entitlement_id,
        'portal', row.product_id || '', { order_id: orderId, old_customer_id: customerId });
    });
}

function adminManualPurchaseAdd_(data) {
  const admin = verifyAdminSessionToken_(data.token);
  const customer = findAdminCustomer_(data);
  if (!customer) return { ok: false, error: 'Customer account not found.' };

  const product = getProductById_(clean_(data.product_id || '', 200));
  if (!product || !isAccountEligibleProduct_(product)) {
    return { ok: false, error: 'Only eBible products and the Ethiopian Bible PDF can be added as account purchases.' };
  }

  const amount = data.amount === '' || data.amount === undefined
    ? Number(product.price || 0)
    : Number(data.amount);

  if (!isFinite(amount) || amount < 0) {
    return { ok: false, error: 'Enter a valid non-negative purchase amount.' };
  }

  const orderId = 'manual_' + uuid_();
  const order = recordOrder_({
    order_id: orderId,
    paypal_order_id: '',
    paypal_capture_id: '',
    customer_id: customer.customer_id,
    email: customer.email,
    status: 'completed',
    currency: product.currency || 'USD',
    subtotal: amount,
    total: amount,
    payer_country: '',
    raw_event_id: 'admin-manual:' + uuid_()
  });

  recordOrderItem_({
    order_id: order.order_id,
    product_id: product.product_id,
    quantity: 1,
    unit_price: amount,
    line_total: amount
  });

  const entitlement = grantEntitlement_({
    customer_id: customer.customer_id,
    email: customer.email,
    product_id: product.product_id,
    order_id: order.order_id,
    source: 'admin-manual-purchase',
    notes: clean_(data.notes || 'Manual purchase added in administration portal', 500)
  });

  logSystem_('INFO', 'ADMIN_MANUAL_PURCHASE_ADDED', admin.email, order.order_id,
    'portal', product.product_id, {
      customer_id: customer.customer_id,
      customer_email: customer.email,
      amount: amount
    });

  return {
    ok: true,
    order_id: order.order_id,
    product: product,
    entitlement_id: entitlement.entitlement_id
  };
}

function adminManualPurchaseRemove_(data) {
  const admin = verifyAdminSessionToken_(data.token);
  const orderId = clean_(data.order_id || '', 200);
  const orderSheet = sheet_(LWB.SHEETS.ORDERS);
  const order = findBy_(orderSheet, 'order_id', orderId);

  if (!order) return { ok: false, error: 'Order not found.' };
  if (String(order.order_id || '').indexOf('manual_') !== 0 &&
      String(order.raw_event_id || '').indexOf('admin-manual:') !== 0) {
    return { ok: false, error: 'Only portal-created manual purchases can be removed with this action.' };
  }

  order.status = 'removed';
  order.updated_at = new Date();
  upsertByKey_(orderSheet, 'order_id', order.order_id, order);

  const entitlementSheet = sheet_(LWB.SHEETS.ENTITLEMENTS);
  readObjects_(entitlementSheet)
    .filter(function(row) {
      return String(row.order_id || '') === orderId &&
        String(row.status || '').toLowerCase() === 'active';
    })
    .forEach(function(row) {
      if (LWB.FREE_ACCOUNT_PRODUCTS.indexOf(String(row.product_id || '')) >= 0) return;
      row.status = 'revoked';
      row.revoked_at = new Date();
      row.notes = clean_((row.notes ? String(row.notes) + ' | ' : '') +
        'Manual purchase removed in administration portal', 500);
      upsertByKey_(entitlementSheet, 'entitlement_id', row.entitlement_id, row);
    });

  logSystem_('INFO', 'ADMIN_MANUAL_PURCHASE_REMOVED', admin.email, orderId,
    'portal', 'manual purchase removed', { customer_id: order.customer_id || '', email: order.email || '' });

  return { ok: true, order_id: orderId, status: 'removed' };
}

function adminLogs_(data) {
  verifyAdminSessionToken_(data.token);
  return {
    ok: true,
    logs: recentSystemLogs_(Math.min(300, Math.max(1, Number(data.limit || 150))))
  };
}

function recentSystemLogs_(limit) {
  return readObjects_(sheet_(LWB.SHEETS.LOG))
    .sort(function(a, b) {
      return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
    })
    .slice(0, limit || 100)
    .map(function(row) {
      return pick_(row, [
        'timestamp', 'level', 'event', 'email', 'record_id',
        'source', 'message', 'metadata_json'
      ]);
    });
}

/* ========================================================================== */
/* CUSTOM PORTAL NEWSLETTER EMAIL                                             */
/* ========================================================================== */

function sendCustomNewsletterEmail_(email, displayName, state) {
  const context = {
    first_name: firstName_(displayName),
    email: normalizeEmail_(email)
  };

  const subject = newsletterTokenReplace_(state.subject || 'Living Word Bibles', context);
  const preheader = newsletterTokenReplace_(state.preheader || '', context);
  const body = newsletterTokenReplace_(state.html || '', context);
  const signature = newsletterTokenReplace_(state.signature_html || '', context);

  const html = body +
    (signature ? '<div style="margin-top:28px;padding-top:18px;border-top:1px solid #eee6d8">' +
      signature + '</div>' : '');

  sendBrandedEmail_({
    to: email,
    subject: subject,
    preheader: preheader,
    html: html,
    text: stripHtmlForEmail_(html),
    newsletter: true,
    optOutEmail: email
  });
}

function newsletterTokenReplace_(value, context) {
  return String(value || '')
    .replace(/\{\{\s*first_name\s*\}\}/gi, escapeHtml_(context.first_name || ''))
    .replace(/\{\{\s*email\s*\}\}/gi, escapeHtml_(context.email || ''));
}

function stripHtmlForEmail_(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sanitizeNewsletterHtml_(value) {
  let html = String(value || '');

  html = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|form|input|textarea|select|option|meta|link)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style|iframe|object|embed|form|input|textarea|select|option|meta|link)\b[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript\s*:/gi, '');

  return html;
}

/* ========================================================================== */
/* BRANDED EMAIL SYSTEM                                                       */
/* ========================================================================== */

function sendWelcomeVerificationEmail_(email, displayName, token) {
  const link = LWB.SITE_URL + '/verify-email/?email=' + encodeURIComponent(email) +
    '&token=' + encodeURIComponent(token);
  const firstName = firstName_(displayName);
  const bodyHtml =
    '<p style="margin:0 0 18px">' + escapeHtml_(firstName ? 'Hello ' + firstName + ',' : 'Hello,') + '</p>' +
    '<h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.2;margin:0 0 14px;color:#1d2a34">Welcome to Living Word Bibles</h1>' +
    '<p style="margin:0 0 18px">Thank you for creating your Living Word Bibles account. Verify your email address to activate your account and open your personal Bible library.</p>' +
    emailButton_('Verify My Email', link) +
    '<p style="margin:22px 0 0"><strong>Your account includes two free digital Bibles:</strong> The Holy Bible: King James Version Special Edition and the Douay-Rheims Bible.</p>' +
    '<p style="margin:14px 0 0">This verification link expires in 24 hours.</p>';

  sendBrandedEmail_({
    to: email,
    subject: 'Welcome to Living Word Bibles — verify your account',
    preheader: 'Verify your account and receive two free digital Bibles.',
    html: bodyHtml,
    text: 'Welcome to Living Word Bibles. Verify your account: ' + link +
      '\n\nYour account includes the KJV Special Edition and Douay-Rheims Bible free.'
  });
}

function sendResetEmail_(email, displayName, token) {
  const link = LWB.SITE_URL + '/reset-password/?email=' + encodeURIComponent(email) +
    '&token=' + encodeURIComponent(token);
  const firstName = firstName_(displayName);

  sendBrandedEmail_({
    to: email,
    subject: 'Reset your Living Word Bibles password',
    preheader: 'Use this secure link to reset your Living Word Bibles password.',
    html:
      '<p>' + escapeHtml_(firstName ? 'Hello ' + firstName + ',' : 'Hello,') + '</p>' +
      '<h1 style="font-family:Georgia,serif;font-size:28px;color:#1d2a34">Reset your password</h1>' +
      '<p>Use the button below to choose a new Living Word Bibles password.</p>' +
      emailButton_('Reset Password', link) +
      '<p style="margin-top:20px">This link expires in 60 minutes. If you did not request this, you can ignore this email.</p>',
    text: 'Reset your Living Word Bibles password: ' + link +
      '\n\nThis link expires in 60 minutes. If you did not request this, ignore this email.'
  });
}

function sendNewsletterTemplateEmail_(email, displayName, templateKey) {
  const template = newsletterTemplate_(templateKey, { name: displayName, email: email });
  if (!template) throw new Error('Unknown newsletter template: ' + templateKey);

  sendBrandedEmail_({
    to: email,
    subject: template.subject,
    preheader: template.preheader,
    html: template.html,
    text: template.text,
    newsletter: true,
    optOutEmail: email
  });
}

/**
 * Convenience tester. Sends one chosen feature email to one address.
 * Example: sendNewsletterTemplateTest('you@example.com', 'history_of_the_bible')
 */
function sendNewsletterTemplateTest(email, templateKey) {
  const normalized = normalizeEmail_(email);
  if (!validEmail_(normalized)) throw new Error('Valid test email required.');
  sendNewsletterTemplateEmail_(normalized, '', templateKey);
  return { ok: true, email: normalized, template_key: templateKey };
}

function newsletterTemplate_(key, context) {
  const name = firstName_((context && context.name) || '');
  const greeting = name ? 'Hello ' + escapeHtml_(name) + ',' : 'Hello,';

  const templates = {
    read_bible_online: {
      subject: 'Read the Bible Online with Living Word Bibles',
      preheader: 'Open Scripture in your browser and begin reading today.',
      title: 'Read the Bible Online',
      copy: 'Open Scripture on any device with Living Word Bibles. Choose a translation, move easily between books and chapters, and continue reading wherever you are.',
      cta: 'Read the Bible Online',
      url: LWB.SITE_URL + '/read-the-bible-online/'
    },
    audio_bible: {
      subject: 'Listen to the King James Bible',
      preheader: 'Hear the KJV with the Living Word Bibles Audio Bible.',
      title: 'Listen to the Bible',
      copy: 'Our KJV Audio Bible lets you listen through Genesis to Revelation with simple book and chapter navigation and a visual Bible-art experience.',
      cta: 'Listen Now',
      url: LWB.SITE_URL + '/audio-bible/'
    },
    history_of_the_bible: {
      subject: 'Explore the History of the Bible',
      preheader: 'Trace Scripture from manuscripts and codices to print and digital editions.',
      title: 'The History of the Bible',
      copy: 'Explore how Scripture was copied, preserved, translated, printed, and carried across generations—from ancient manuscripts to the Bible on today’s devices.',
      cta: 'Explore Bible History',
      url: LWB.SITE_URL + '/history-of-the-bible/'
    },
    estore: {
      subject: 'Visit the Living Word Bibles eStore',
      preheader: 'Discover free and low-cost digital Bible editions.',
      title: 'Living Word Bibles eStore',
      copy: 'Browse beautifully formatted eBibles for study, devotion, and everyday reading, including free editions and low-cost digital releases.',
      cta: 'Visit the eStore',
      url: LWB.SITE_URL + '/estore/'
    },
    ethiopian_bible: {
      subject: 'Discover the Ethiopian Bible',
      preheader: 'Explore the Ethiopian Bible, its history, and the Living Word Bibles digital edition.',
      title: 'The Ethiopian Bible',
      copy: 'Learn about the ancient Ethiopian Christian biblical tradition and explore the Living Word Bibles digital PDF edition of the Complete Apocrypha.',
      cta: 'Explore the Ethiopian Bible',
      url: LWB.SITE_URL + '/ethiopian-bible/'
    },
    bible_study: {
      subject: 'Go deeper with Living Word Bibles Bible Study',
      preheader: 'Verse studies, prayer resources, and contextual media in one place.',
      title: 'Bible Study Resources',
      copy: 'Explore verse studies, prayer resources, book studies, and media designed to help you read Scripture in context and continue learning.',
      cta: 'Open Bible Study',
      url: LWB.SITE_URL + '/bible-study/'
    },
    prayers: {
      subject: 'Prayer resources from Living Word Bibles',
      preheader: 'Read classic Christian prayers with context and Scripture.',
      title: 'Common Prayers',
      copy: 'Find thoughtfully presented Christian prayers with historical context, biblical connections, and references for personal devotion.',
      cta: 'Explore Prayers',
      url: LWB.SITE_URL + '/prayers/'
    },
    maps: {
      subject: 'Explore Maps of the Holy Land',
      preheader: 'Add geography and historical context to your Bible reading.',
      title: 'Maps of the Holy Land',
      copy: 'See the places behind the biblical story and connect Scripture with the geography of the ancient Holy Land.',
      cta: 'Explore the Maps',
      url: LWB.SITE_URL + '/maps-of-the-holy-land/'
    },
    print_bibles: {
      subject: 'Shop curated Print Bibles',
      preheader: 'Browse Living Word Bibles’ curated selection of print editions.',
      title: 'Print Bibles',
      copy: 'Prefer a Bible you can hold? Browse our curated print-Bible storefront with trusted editions available through Amazon.',
      cta: 'Shop Print Bibles',
      url: LWB.SITE_URL + '/estore/print-bibles/'
    },
    bible_app: {
      subject: 'Take Living Word Bibles with you',
      preheader: 'Explore the Living Word Bibles App for supported devices.',
      title: 'Living Word Bibles App',
      copy: 'Keep Scripture close with the Living Word Bibles App, designed for simple navigation and comfortable reading on supported mobile and desktop devices.',
      cta: 'Explore the App',
      url: LWB.SITE_URL + '/ios/'
    },
    translations: {
      subject: 'Explore Bible translations',
      preheader: 'Compare translation histories and reading options across Living Word Bibles.',
      title: 'Bible Translations',
      copy: 'Explore the history, character, and reading experience of trusted Bible translations and discover which edition fits your study or devotional reading.',
      cta: 'View Bible Translations',
      url: LWB.SITE_URL + '/the-holy-bible/'
    },
    catholic_bible: {
      subject: 'Explore the Catholic Bible',
      preheader: 'Learn about the 73-book Catholic canon and its biblical tradition.',
      title: 'The Catholic Bible',
      copy: 'Learn about the Catholic biblical canon, the deuterocanonical books, and the Douay-Rheims tradition through Living Word Bibles resources.',
      cta: 'Explore the Catholic Bible',
      url: LWB.SITE_URL + '/the-catholic-bible/'
    },
    free_bibles: {
      subject: 'Two free digital Bibles for your Living Word Bibles account',
      preheader: 'Your KJV Special Edition and Douay-Rheims Bible are available free.',
      title: 'Your Free Digital Bibles',
      copy: 'Every verified Living Word Bibles account includes The Holy Bible: King James Version Special Edition and the Douay-Rheims Bible at no charge.',
      cta: 'Open My Library',
      url: LWB.SITE_URL + '/account/library/'
    }
  };

  const item = templates[String(key || '')];
  if (!item) return null;

  const html =
    '<p style="margin:0 0 18px">' + greeting + '</p>' +
    '<h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.2;margin:0 0 14px;color:#1d2a34">' + escapeHtml_(item.title) + '</h1>' +
    '<p style="margin:0 0 22px">' + escapeHtml_(item.copy) + '</p>' +
    emailButton_(item.cta, item.url);

  const text = (name ? 'Hello ' + name + ',' : 'Hello,') + '\n\n' +
    item.title + '\n\n' + item.copy + '\n\n' + item.cta + ': ' + item.url;

  return {
    subject: item.subject,
    preheader: item.preheader,
    html: html,
    text: text
  };
}

function sendBrandedEmail_(options) {
  const email = normalizeEmail_(options.to);
  if (!validEmail_(email)) throw new Error('Invalid email address.');

  const newsletter = Boolean(options.newsletter);
  const optOutEmail = normalizeEmail_(options.optOutEmail || email);
  const optOutUrl = LWB.SITE_URL + '/opt-out/?email=' + encodeURIComponent(optOutEmail);

  const footerLinks =
    '<a href="' + LWB.SITE_URL + '/read-the-bible-online/" style="color:#6e5420;text-decoration:none">Read the Bible Online</a>' +
    ' &nbsp;•&nbsp; <a href="' + LWB.SITE_URL + '/history-of-the-bible/" style="color:#6e5420;text-decoration:none">History of the Bible</a>' +
    ' &nbsp;•&nbsp; <a href="' + LWB.SITE_URL + '/estore/" style="color:#6e5420;text-decoration:none">eStore</a><br>' +
    '<a href="' + LWB.SITE_URL + '/terms-of-service/" style="color:#6e5420;text-decoration:none">Terms of Service</a>' +
    ' &nbsp;•&nbsp; <a href="' + LWB.SITE_URL + '/privacy-policy/" style="color:#6e5420;text-decoration:none">Privacy Policy</a>' +
    (newsletter ? ' &nbsp;•&nbsp; <a href="' + optOutUrl + '" style="color:#6e5420;text-decoration:none">Unsubscribe</a>' : '');

  const htmlBody =
    '<!doctype html><html><body style="margin:0;padding:0;background:#f4f1e8;font-family:Arial,Helvetica,sans-serif;color:#2b2b2b">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0">' + escapeHtml_(options.preheader || '') + '</div>' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f1e8;padding:28px 12px"><tr><td align="center">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:680px;background:#ffffff;border:1px solid #ded6c6;border-radius:14px;overflow:hidden">' +
    '<tr><td align="center" style="padding:28px 28px 18px;background:#fffdf8;border-bottom:1px solid #eee6d8">' +
    '<a href="' + LWB.SITE_URL + '/" style="text-decoration:none"><img src="' + LWB.LOGO_URL + '" width="260" alt="Living Word Bibles" style="display:block;max-width:100%;height:auto;border:0"></a>' +
    '<div style="font-family:Georgia,serif;font-style:italic;color:#6c6457;margin-top:10px">Beautifully Formatted to Bring God’s Word to Life on Any Device</div>' +
    '</td></tr>' +
    '<tr><td style="padding:32px 34px;font-size:16px;line-height:1.65">' + (options.html || '') + '</td></tr>' +
    '<tr><td align="center" style="padding:22px 26px 26px;background:#faf7f0;border-top:1px solid #eee6d8;font-size:12px;line-height:1.7;color:#6c6457">' +
    footerLinks +
    '<div style="margin-top:12px">© 2026 Living Word Bibles. All Rights Reserved.</div>' +
    '<div>Developed by Cook Technology Services.</div>' +
    '</td></tr></table>' +
    '</td></tr></table></body></html>';

  let textBody = String(options.text || '');
  textBody += '\n\nRead the Bible Online: ' + LWB.SITE_URL + '/read-the-bible-online/' +
    '\nHistory of the Bible: ' + LWB.SITE_URL + '/history-of-the-bible/' +
    '\neStore: ' + LWB.SITE_URL + '/estore/' +
    '\nTerms: ' + LWB.SITE_URL + '/terms-of-service/' +
    '\nPrivacy: ' + LWB.SITE_URL + '/privacy-policy/';
  if (newsletter) textBody += '\nUnsubscribe: ' + optOutUrl;
  textBody += '\n\n© 2026 Living Word Bibles. All Rights Reserved.';

  MailApp.sendEmail({
    to: email,
    subject: clean_(options.subject || 'Living Word Bibles', 250),
    name: 'Living Word Bibles',
    replyTo: LWB.CONTACT_EMAIL,
    body: textBody,
    htmlBody: htmlBody
  });
}

function emailButton_(label, url) {
  return '<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="background:#8b6a25;border-radius:6px">' +
    '<a href="' + escapeHtml_(url) + '" style="display:inline-block;padding:12px 20px;color:#ffffff;text-decoration:none;font-weight:bold">' +
    escapeHtml_(label) + '</a></td></tr></table>';
}

function firstName_(displayName) {
  const clean = String(displayName || '').trim();
  return clean ? clean.split(/\s+/)[0] : '';
}

/* ========================================================================== */
/* HEALTH                                                                     */
/* ========================================================================== */

function healthCheck_() {
  const ss = SpreadsheetApp.openById(LWB.SPREADSHEET_ID);
  const folder = DriveApp.getFolderById(LWB.PRODUCT_FOLDER_ID);

  const checks = {
    spreadsheet: { ok: Boolean(ss), id: ss.getId(), name: ss.getName() },
    product_folder: { ok: Boolean(folder), id: folder.getId(), name: folder.getName() },
    sheets: {},
    account_products: {}
  };

  Object.keys(LWB.SHEETS).forEach(function(key) {
    const name = LWB.SHEETS[key];
    checks.sheets[name] = Boolean(ss.getSheetByName(name));
  });

  ['prod_kjv_special', 'prod_drb', 'prod_kjv', 'prod_asv', 'prod_ylt', 'prod_web'].forEach(function(productId) {
    const product = getProductById_(productId);
    checks.account_products[productId] = {
      exists: Boolean(product),
      eligible: Boolean(product && isAccountEligibleProduct_(product)),
      asset_linked: Boolean(product && findAssetForProduct_(productId))
    };
  });

  const ethProduct = readObjects_(sheet_(LWB.SHEETS.PRODUCTS))
    .map(publicProduct_)
    .find(isEthiopianProduct_);
  checks.account_products.ethiopian_bible_pdf = {
    exists: Boolean(ethProduct),
    product_id: ethProduct ? ethProduct.product_id : '',
    eligible: Boolean(ethProduct && isAccountEligibleProduct_(ethProduct)),
    asset_linked: Boolean(ethProduct && findAssetForProduct_(ethProduct.product_id))
  };

  const allSheets = Object.keys(checks.sheets).every(function(name) { return checks.sheets[name]; });

  return {
    ok: checks.spreadsheet.ok && checks.product_folder.ok && allSheets,
    service: 'LWB Website API',
    version: LWB.VERSION,
    build_utc: LWB.BUILD_UTC,
    contact_email: LWB.CONTACT_EMAIL,
    newsletter_batch_max: LWB.NEWSLETTER_BATCH_MAX,
    newsletter_weekdays: ['Monday', 'Wednesday', 'Friday'],
    checks: checks,
    time: new Date().toISOString()
  };
}

/* ========================================================================== */
/* SHEET HELPERS                                                              */
/* ========================================================================== */

function spreadsheet_() {
  return SpreadsheetApp.openById(LWB.SPREADSHEET_ID);
}

function sheet_(name) {
  const sheet = spreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('Required sheet not found: ' + name);
  return sheet;
}

function headers_(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (!lastColumn) return [];
  return sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String);
}

function readObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1)
    .filter(function(row) {
      return row.some(function(value) { return String(value).trim() !== ''; });
    })
    .map(function(row) {
      const object = {};
      headers.forEach(function(header, i) { object[header] = row[i]; });
      return object;
    });
}

function appendObject_(sheet, object) {
  const headers = headers_(sheet);
  sheet.appendRow(headers.map(function(header) {
    return object[header] === undefined ? '' : object[header];
  }));
}

function findBy_(sheet, key, value) {
  const needle = String(value || '').toLowerCase();
  return readObjects_(sheet).find(function(row) {
    return String(row[key] || '').toLowerCase() === needle;
  }) || null;
}

function upsertByKey_(sheet, key, value, object) {
  const headers = headers_(sheet);
  const values = sheet.getDataRange().getValues();
  const keyIndex = headers.indexOf(key);
  if (keyIndex === -1) {
    throw new Error('Column "' + key + '" is missing from "' + sheet.getName() + '".');
  }

  let rowNumber = -1;
  const needle = String(value || '').toLowerCase();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][keyIndex] || '').toLowerCase() === needle) {
      rowNumber = i + 1;
      break;
    }
  }

  const existing = rowNumber === -1 ? null : values[rowNumber - 1];
  const row = headers.map(function(header, index) {
    if (object[header] !== undefined) return object[header];
    return existing ? existing[index] : '';
  });

  if (rowNumber === -1) {
    sheet.appendRow(row);
  } else {
    sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row]);
  }
}

function deactivateAudience_(email) {
  const audienceSheet = sheet_(LWB.SHEETS.AUDIENCE);
  readObjects_(audienceSheet)
    .filter(function(row) { return normalizeEmail_(row.email) === email; })
    .forEach(function(row) {
      row.status = 'inactive';
      row.updated_at = new Date();
      upsertByKey_(audienceSheet, 'membership_id', row.membership_id, row);
    });
}

/* ========================================================================== */
/* GENERAL HELPERS                                                            */
/* ========================================================================== */

function parsePost_(e) {
  const text = e && e.postData && e.postData.contents ? e.postData.contents : '';
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch (_) {
    const out = {};
    String(text).split('&').forEach(function(pair) {
      const i = pair.indexOf('=');
      if (i < 0) return;
      out[decodeURIComponent(pair.slice(0, i))] =
        decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' '));
    });
    return out;
  }
}

function output_(object, callback) {
  const json = JSON.stringify(object);
  if (callback && LWB.CALLBACK_RE.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function publicProduct_(row) {
  return pick_(row, [
    'product_id', 'slug', 'title', 'short_title', 'status', 'product_type',
    'price', 'original_price', 'currency', 'cover_path', 'canonical_path',
    'description', 'paypal_button_id', 'uk_restricted', 'featured', 'sort_order'
  ]);
}

function logSystem_(level, event, email, recordId, source, message, metadata) {
  try {
    appendObject_(sheet_(LWB.SHEETS.LOG), {
      timestamp: new Date(),
      level: clean_(level || 'INFO', 20),
      event: clean_(event || '', 100),
      email: normalizeEmail_(email || ''),
      record_id: clean_(recordId || '', 200),
      source: clean_(source || '', 100),
      message: clean_(message || '', 1000),
      metadata_json: JSON.stringify(metadata || {}).slice(0, 5000)
    });
  } catch (_) {}
}

function normalizeEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

function validEmail_(value) {
  return LWB.EMAIL_RE.test(String(value || ''));
}

function clean_(value, max) {
  return String(value || '').trim().replace(/\u0000/g, '').slice(0, max || 1000);
}

function truthy_(value) {
  return value === true || ['true', '1', 'yes', 'y'].indexOf(String(value || '').toLowerCase()) >= 0;
}

function uuid_() {
  return Utilities.getUuid();
}

function pick_(object, keys) {
  const out = {};
  keys.forEach(function(key) { out[key] = object[key]; });
  return out;
}

function constantTimeEqual_(a, b) {
  a = String(a);
  b = String(b);
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function safeError_(error) {
  return error && error.message ? String(error.message) : String(error);
}

function escapeHtml_(value) {
  return String(value || '').replace(/[&<>"']/g, function(character) {
    return {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character];
  });
}

/*
==========================================================================================
END OF LWB BACKEND v2.0.2 | Copyright © 2026 Living Word Bibles. All Rights Reserved. Developed by Cook Technology Services. Last Updated on 02 September 2026 at 12:18:00Z UTC.
==========================================================================================
*/

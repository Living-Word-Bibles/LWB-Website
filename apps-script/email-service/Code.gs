/**
 * Living Word Bibles Email Service v1.0.0
 * Outbound Email + Newsletter Service
 *
 * Account: gospel@livingwordbibles.com
 * Spreadsheet: LWB Website
 * Website backend remains deployed separately under gospellivingwordbibles@gmail.com.
 *
 * Web App URL:
 * https://script.google.com/macros/s/AKfycby4zWPYCSDiRyxgXHCH7wbOqKV1J32avpko_905ODuM_QToQhFWhd-FJvd0ZTsaJI6Xug/exec
 *
 * Build timestamp: 02 October 2026 at 16:27:00Z UTC
 *
 * RESPONSIBILITIES:
 * - Sends account verification emails.
 * - Sends password-reset emails.
 * - Sends EU/EEA digital-purchase consent confirmations.
 * - Sends newsletter tests and newsletter campaign batches.
 * - Owns the newsletter processing trigger.
 *
 * DOES NOT:
 * - Handle PayPal verification.
 * - Create accounts or entitlements.
 * - Handle website login/session auth.
 * - Reconcile purchases.
 * - Run analytics or storefront APIs.
 */

const LWB_EMAIL = Object.freeze({
  VERSION: '1.0.0',
  BUILD_UTC: '02 October 2026 at 16:27:00Z UTC',
  SITE_URL: 'https://www.livingwordbibles.com',
  PUBLIC_EMAIL: 'gospel@livingwordbibles.com',
  SPREADSHEET_ID: '1xnzdo1UJsEOTqcO2066Nfb6ayqKn8Zg5RbNLdpbaTcc',
  LOGO_URL: 'https://www.livingwordbibles.com/assets/LivingWordBibles01.png',
  NEWSLETTER_BATCH_MAX: 99,
  NEWSLETTER_WEEKDAYS: Object.freeze([1, 3, 5]),
  EMAIL_RE: /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/,
  SHEETS: Object.freeze({
    SUBSCRIBERS: 'Newsletter Subscribers',
    DNE: 'Do Not Email',
    CAMPAIGNS: 'Newsletter Campaigns',
    LOG: 'System Log'
  })
});

function configureEmailService(secret) {
  const value = String(secret || '').trim();
  if (value.length < 24) throw new Error('Use a strong shared secret of at least 24 characters.');
  PropertiesService.getScriptProperties().setProperty('LWB_EMAIL_SERVICE_SECRET', value);
  return {
    ok: true,
    version: LWB_EMAIL.VERSION,
    sender: LWB_EMAIL.PUBLIC_EMAIL,
    spreadsheet_id: LWB_EMAIL.SPREADSHEET_ID
  };
}

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
  return { ok: true, message: 'Daily newsletter processor installed; sending remains Monday/Wednesday/Friday.' };
}

function doGet(e) {
  const action = String(e && e.parameter && e.parameter.action || 'ping').toLowerCase();
  if (action === 'ping' || action === 'health') {
    return output_({
      ok: true,
      service: 'Living Word Bibles Email Service',
      version: LWB_EMAIL.VERSION,
      sender: LWB_EMAIL.PUBLIC_EMAIL,
      build_utc: LWB_EMAIL.BUILD_UTC,
      time: new Date().toISOString()
    });
  }
  return output_({ ok: false, error: 'Unknown GET action' });
}

function doPost(e) {
  try {
    const data = parsePost_(e);
    requireServiceSecret_(data.service_secret);
    const action = String(data.action || '').toLowerCase();

    switch (action) {
      case 'send-welcome-verification':
        return output_(sendWelcomeVerificationEmail_(data.email, data.display_name, data.token));
      case 'send-password-reset':
        return output_(sendResetEmail_(data.email, data.display_name, data.token));
      case 'send-eu-eea-consent':
        return output_(sendEuEeaDigitalConsentConfirmation_(data.order || {}, data.product || {}));
      case 'newsletter-test':
        return output_(newsletterTest_(data));
      case 'newsletter-queue':
        return output_(newsletterQueue_(data));
      case 'newsletter-process':
        return output_(processNewsletterCampaign());
      case 'newsletter-stop':
        return output_(stopNewsletterCampaign());
      case 'newsletter-status':
        return output_({ ok: true, campaign: publicNewsletterCampaignState_(getNewsletterCampaignState_()) });
      default:
        return output_({ ok: false, error: 'Unknown POST action' });
    }
  } catch (err) {
    return output_({ ok: false, error: safeError_(err) });
  }
}

function requireServiceSecret_(provided) {
  const expected = PropertiesService.getScriptProperties().getProperty('LWB_EMAIL_SERVICE_SECRET');
  if (!constantTimeEqual_(String(provided || ''), expected)) throw new Error('Unauthorized email service request.');
}

function sendWelcomeVerificationEmail_(email, displayName, token) {
  email = normalizeEmail_(email);
  if (!validEmail_(email) || !token) throw new Error('Invalid verification-email request.');
  const link = LWB_EMAIL.SITE_URL + '/verify-email/?email=' + encodeURIComponent(email) +
    '&token=' + encodeURIComponent(token);
  const firstName = firstName_(displayName);
  const bodyHtml =
    '<p style="margin:0 0 18px">' + escapeHtml_(firstName ? 'Hello ' + firstName + ',' : 'Hello,') + '</p>' +
    '<h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.2;margin:0 0 14px;color:#1d2a34">Welcome to Living Word Bibles</h1>' +
    '<p style="margin:0 0 18px">Thank you for creating your Living Word Bibles account. Verify your email address to activate your account and open your personal Bible library.</p>' +
    emailButton_('Verify My Email', link) +
    '<p style="margin:22px 0 0"><strong>Your account includes three free Bible editions:</strong> The Holy Bible: King James Version Special Edition, the Douay-Rheims Bible, and The Holy Bible: Presidential Edition — Joe Biden (online reading only).</p>' +
    '<p style="margin:14px 0 0">This verification link expires in 24 hours.</p>';

  sendBrandedEmail_({
    to: email,
    subject: 'Welcome to Living Word Bibles — verify your account',
    preheader: 'Verify your account and receive three free Bible editions.',
    html: bodyHtml,
    text: 'Welcome to Living Word Bibles. Verify your account: ' + link +
      '\n\nYour account includes the KJV Special Edition, Douay-Rheims Bible, and Joe Biden Presidential Edition free; the Biden edition is available for online reading only.'
  });
  logSystem_('INFO', 'ACCOUNT_VERIFICATION_EMAIL_SENT', email, '', 'email-service', 'verification email sent', {});
  return { ok: true, sent: true };
}

function sendResetEmail_(email, displayName, token) {
  email = normalizeEmail_(email);
  if (!validEmail_(email) || !token) throw new Error('Invalid password-reset email request.');
  const link = LWB_EMAIL.SITE_URL + '/reset-password/?email=' + encodeURIComponent(email) +
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
  logSystem_('INFO', 'PASSWORD_RESET_EMAIL_SENT', email, '', 'email-service', 'password reset email sent', {});
  return { ok: true, sent: true };
}

function sendEuEeaDigitalConsentConfirmation_(order, product) {
  const email = normalizeEmail_(order.email || '');
  const tx = clean_(order.paypal_capture_id || '', 200);
  if (!validEmail_(email) || !tx) throw new Error('Missing EU/EEA confirmation email or transaction.');

  const purchaseDate = order.created_at || new Date();
  let purchaseIso = '';
  try { purchaseIso = new Date(purchaseDate).toISOString(); }
  catch (_) { purchaseIso = new Date().toISOString(); }

  const productTitle = clean_(product.title || product.short_title || product.product_id || 'Digital Product', 500);
  const productUrl = product.canonical_path
    ? LWB_EMAIL.SITE_URL + String(product.canonical_path)
    : LWB_EMAIL.SITE_URL + '/estore/';
  const orderRef = clean_(order.order_id || '', 200);
  const paypalOrder = clean_(order.paypal_order_id || '', 200);
  const country = clean_(order.payer_country || '', 20).toUpperCase();
  const consentText = 'EU/EEA Right of Withdrawal: This notice applies only to consumers in the European Union (EU) or European Economic Area (EEA). By checking this box, you expressly consent to the immediate delivery of this digital product and acknowledge that you will lose any applicable right of withdrawal once the digital download begins. If you do not consent, please do not purchase this product.';

  const html =
    '<h1 style="font-family:Georgia,serif;font-size:28px;line-height:1.2;margin:0 0 16px;color:#1d2a34">Digital Purchase &amp; EU/EEA Consent Confirmation</h1>' +
    '<p>This transactional email confirms your completed Living Word Bibles digital purchase and the EU/EEA digital-delivery consent presented before checkout.</p>' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;border-collapse:collapse">' +
      '<tr><td style="padding:8px;border-bottom:1px solid #eee6d8"><strong>Product</strong></td><td style="padding:8px;border-bottom:1px solid #eee6d8"><a href="' + escapeHtml_(productUrl) + '">' + escapeHtml_(productTitle) + '</a></td></tr>' +
      '<tr><td style="padding:8px;border-bottom:1px solid #eee6d8"><strong>PayPal transaction</strong></td><td style="padding:8px;border-bottom:1px solid #eee6d8">' + escapeHtml_(tx) + '</td></tr>' +
      '<tr><td style="padding:8px;border-bottom:1px solid #eee6d8"><strong>Order reference</strong></td><td style="padding:8px;border-bottom:1px solid #eee6d8">' + escapeHtml_(orderRef || '—') + '</td></tr>' +
      (paypalOrder ? '<tr><td style="padding:8px;border-bottom:1px solid #eee6d8"><strong>PayPal order</strong></td><td style="padding:8px;border-bottom:1px solid #eee6d8">' + escapeHtml_(paypalOrder) + '</td></tr>' : '') +
      '<tr><td style="padding:8px;border-bottom:1px solid #eee6d8"><strong>Purchaser email</strong></td><td style="padding:8px;border-bottom:1px solid #eee6d8">' + escapeHtml_(email) + '</td></tr>' +
      '<tr><td style="padding:8px;border-bottom:1px solid #eee6d8"><strong>Country</strong></td><td style="padding:8px;border-bottom:1px solid #eee6d8">' + escapeHtml_(country) + '</td></tr>' +
      '<tr><td style="padding:8px"><strong>Purchase timestamp</strong></td><td style="padding:8px">' + escapeHtml_(purchaseIso) + '</td></tr>' +
    '</table>' +
    '<div style="padding:16px;border:1px solid #ded6c6;border-radius:10px;background:#faf7f0"><p style="margin:0"><strong>EU/EEA Right of Withdrawal:</strong> ' +
      escapeHtml_(consentText.replace(/^EU\/EEA Right of Withdrawal:\s*/i, '')) + '</p></div>';

  const text =
    'Living Word Bibles — Digital Purchase & EU/EEA Consent Confirmation\n\n' +
    'Product: ' + productTitle + '\nProduct URL: ' + productUrl +
    '\nPayPal transaction: ' + tx + '\nOrder reference: ' + (orderRef || '—') +
    (paypalOrder ? '\nPayPal order: ' + paypalOrder : '') +
    '\nPurchaser email: ' + email + '\nCountry: ' + country +
    '\nPurchase timestamp: ' + purchaseIso + '\n\n' + consentText;

  try {
    sendBrandedEmail_({
      to: email,
      subject: 'Living Word Bibles — Digital Purchase & EU/EEA Consent Confirmation',
      preheader: 'Your digital purchase and EU/EEA consent confirmation.',
      html: html,
      text: text,
      newsletter: false
    });
    logSystem_('INFO', 'EU_EEA_CONSENT_EMAIL_SENT', email, tx, 'email-service', productTitle, {
      transaction_id: tx, order_id: orderRef, paypal_order_id: paypalOrder,
      payer_country: country, product_id: product.product_id || '', sent_utc: new Date().toISOString()
    });
    return { ok: true, sent: true };
  } catch (err) {
    logSystem_('ERROR', 'EU_EEA_CONSENT_EMAIL_FAILED', email, tx, 'email-service', safeError_(err), {
      transaction_id: tx, order_id: orderRef, product_id: product.product_id || ''
    });
    throw err;
  }
}

function newsletterTest_(data) {
  const email = normalizeEmail_(data.test_email || '');
  if (!validEmail_(email)) throw new Error('Enter a valid test email address.');
  const state = buildCustomNewsletterState_(data, 'test_' + uuid_());
  sendCustomNewsletterEmail_(email, data.display_name || '', state);
  logSystem_('INFO', 'ADMIN_NEWSLETTER_TEST', data.requested_by || '', '', 'email-service', state.subject, { test_email: email });
  return { ok: true, message: 'Test newsletter sent.', email: email };
}

function newsletterQueue_(data) {
  const existing = getNewsletterCampaignState_();
  if (existing && existing.status === 'active') {
    return { ok: false, error: 'A newsletter campaign is already active. Stop or finish it before queueing another.' };
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
    return { ok: false, error: 'This newsletter is too large for the campaign queue. Shorten the body or signature.' };
  }
  saveNewsletterCampaignState_(state);
  writeCampaignStatus_(state, 'queued');
  logSystem_('INFO', 'ADMIN_NEWSLETTER_QUEUED', data.requested_by || '', campaignId, 'email-service', state.subject, { recipients: recipients.length });
  return {
    ok: true,
    campaign: publicNewsletterCampaignState_(state),
    message: 'Newsletter queued. Subscriber batches send only Monday, Wednesday, and Friday.'
  };
}

function stopNewsletterCampaign() {
  const state = getNewsletterCampaignState_();
  if (state) {
    state.status = 'stopped';
    state.stopped_at = new Date().toISOString();
    saveNewsletterCampaignState_(state);
    writeCampaignStatus_(state, 'stopped');
  }
  return { ok: true, stopped: Boolean(state), campaign: publicNewsletterCampaignState_(state) };
}

function processNewsletterCampaign() {
  const state = getNewsletterCampaignState_();
  if (!state || state.status !== 'active') {
    return { ok: true, sent: 0, message: 'No active newsletter campaign.', campaign: publicNewsletterCampaignState_(state) };
  }

  const now = new Date();
  const sendTimeZone = Session.getScriptTimeZone() || 'America/Indiana/Indianapolis';
  const weekday = Number(Utilities.formatDate(now, sendTimeZone, 'u'));
  if (LWB_EMAIL.NEWSLETTER_WEEKDAYS.indexOf(weekday) === -1) {
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
  const batchSize = Math.min(LWB_EMAIL.NEWSLETTER_BATCH_MAX, quota, Math.max(0, recipients.length - cursor));

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
  let sent = 0, failed = 0;
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
      logSystem_('ERROR', 'NEWSLETTER_SEND_FAILED', recipient.email, state.campaign_id, 'email-service', safeError_(err), {});
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
  logSystem_('INFO', 'NEWSLETTER_BATCH', '', state.campaign_id, 'email-service', 'sent=' + sent + ', failed=' + failed, {});
  return {
    ok: true, campaign_id: state.campaign_id, sent: sent, failed: failed,
    cursor: state.cursor, total: state.total, complete: state.status === 'complete',
    batch_max: LWB_EMAIL.NEWSLETTER_BATCH_MAX
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
    campaign_id: campaignId, mode: 'custom', template_key: '',
    subject: subject, preheader: preheader,
    html: sanitizeNewsletterHtml_(rawHtml),
    signature_html: sanitizeNewsletterHtml_(rawSignature)
  };
}

function getNewsletterCampaignState_() {
  const raw = PropertiesService.getScriptProperties().getProperty('LWB_NEWSLETTER_CAMPAIGN_STATE');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

function saveNewsletterCampaignState_(state) {
  PropertiesService.getScriptProperties().setProperty('LWB_NEWSLETTER_CAMPAIGN_STATE', JSON.stringify(state));
}

function publicNewsletterCampaignState_(state) {
  if (!state) return null;
  return {
    campaign_id: state.campaign_id || '', mode: state.mode || 'template',
    template_key: state.template_key || '', subject: state.subject || '',
    status: state.status || '', cursor: Number(state.cursor || 0),
    total: Number(state.total || 0), started_at: state.started_at || '',
    last_batch_at: state.last_batch_at || '', last_batch_date: state.last_batch_date || '',
    last_batch_sent: Number(state.last_batch_sent || 0),
    last_batch_failed: Number(state.last_batch_failed || 0),
    completed_at: state.completed_at || ''
  };
}

function newsletterRecipients_() {
  const dne = {};
  readObjects_(sheet_(LWB_EMAIL.SHEETS.DNE)).forEach(function(row) {
    const email = normalizeEmail_(row.email);
    if (email) dne[email] = true;
  });
  const seen = {};
  return readObjects_(sheet_(LWB_EMAIL.SHEETS.SUBSCRIBERS))
    .filter(function(row) {
      const email = normalizeEmail_(row.email);
      return validEmail_(email) &&
        String(row.status || '').toLowerCase() === 'subscribed' &&
        !dne[email] && !seen[email] && (seen[email] = true);
    })
    .map(function(row) {
      return { subscriber_id: row.subscriber_id || '', email: normalizeEmail_(row.email), name: clean_(row.name || '', 160) };
    });
}

function writeCampaignStatus_(state, status) {
  try {
    appendObject_(sheet_(LWB_EMAIL.SHEETS.CAMPAIGNS), {
      campaign_id: state.campaign_id, template_key: state.template_key || '',
      subject: state.subject || '', preheader: state.preheader || '',
      campaign_type: state.mode || 'template', status: status,
      recipient_count: Number(state.total || 0), sent_count: Number(state.cursor || 0),
      batch_size: Number(state.last_batch_sent || 0),
      created_at: state.started_at || new Date(), updated_at: new Date(),
      last_batch_at: state.last_batch_at || '',
      notes: (state.mode === 'custom' ? 'Portal custom HTML newsletter. ' : '') +
        'Max 99 recipients per batch; Monday/Wednesday/Friday stagger.'
    });
  } catch (_) {}
}

function sendCustomNewsletterEmail_(email, displayName, state) {
  const context = { first_name: firstName_(displayName), email: normalizeEmail_(email) };
  const subject = newsletterTokenReplace_(state.subject || 'Living Word Bibles', context);
  const preheader = newsletterTokenReplace_(state.preheader || '', context);
  const body = newsletterTokenReplace_(state.html || '', context);
  const signature = newsletterTokenReplace_(state.signature_html || '', context);
  const html = body + (signature ? '<div style="margin-top:28px;padding-top:18px;border-top:1px solid #eee6d8">' + signature + '</div>' : '');
  sendBrandedEmail_({
    to: email, subject: subject, preheader: preheader, html: html,
    text: stripHtmlForEmail_(html), newsletter: true, optOutEmail: email
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
      url: LWB_EMAIL.SITE_URL + '/read-the-bible-online/'
    },
    audio_bible: {
      subject: 'Listen to the King James Bible',
      preheader: 'Hear the KJV with the Living Word Bibles Audio Bible.',
      title: 'Listen to the Bible',
      copy: 'Our KJV Audio Bible lets you listen through Genesis to Revelation with simple book and chapter navigation and a visual Bible-art experience.',
      cta: 'Listen Now',
      url: LWB_EMAIL.SITE_URL + '/audio-bible/'
    },
    history_of_the_bible: {
      subject: 'Explore the History of the Bible',
      preheader: 'Trace Scripture from manuscripts and codices to print and digital editions.',
      title: 'The History of the Bible',
      copy: 'Explore how Scripture was copied, preserved, translated, printed, and carried across generations—from ancient manuscripts to the Bible on today’s devices.',
      cta: 'Explore Bible History',
      url: LWB_EMAIL.SITE_URL + '/history-of-the-bible/'
    },
    estore: {
      subject: 'Visit the Living Word Bibles eStore',
      preheader: 'Discover free and low-cost digital Bible editions.',
      title: 'Living Word Bibles eStore',
      copy: 'Browse beautifully formatted eBibles for study, devotion, and everyday reading, including free editions and low-cost digital releases.',
      cta: 'Visit the eStore',
      url: LWB_EMAIL.SITE_URL + '/estore/'
    },
    ethiopian_bible: {
      subject: 'Discover the Ethiopian Bible',
      preheader: 'Explore the Ethiopian Bible, its history, and the Living Word Bibles digital edition.',
      title: 'The Ethiopian Bible',
      copy: 'Learn about the ancient Ethiopian Christian biblical tradition and explore the Living Word Bibles digital PDF edition of the Complete Apocrypha.',
      cta: 'Explore the Ethiopian Bible',
      url: LWB_EMAIL.SITE_URL + '/ethiopian-bible/'
    },
    bible_study: {
      subject: 'Go deeper with Living Word Bibles Bible Study',
      preheader: 'Verse studies, prayer resources, and contextual media in one place.',
      title: 'Bible Study Resources',
      copy: 'Explore verse studies, prayer resources, book studies, and media designed to help you read Scripture in context and continue learning.',
      cta: 'Open Bible Study',
      url: LWB_EMAIL.SITE_URL + '/bible-study/'
    },
    prayers: {
      subject: 'Prayer resources from Living Word Bibles',
      preheader: 'Read classic Christian prayers with context and Scripture.',
      title: 'Common Prayers',
      copy: 'Find thoughtfully presented Christian prayers with historical context, biblical connections, and references for personal devotion.',
      cta: 'Explore Prayers',
      url: LWB_EMAIL.SITE_URL + '/prayers/'
    },
    maps: {
      subject: 'Explore Maps of the Holy Land',
      preheader: 'Add geography and historical context to your Bible reading.',
      title: 'Maps of the Holy Land',
      copy: 'See the places behind the biblical story and connect Scripture with the geography of the ancient Holy Land.',
      cta: 'Explore the Maps',
      url: LWB_EMAIL.SITE_URL + '/maps-of-the-holy-land/'
    },
    print_bibles: {
      subject: 'Shop curated Print Bibles',
      preheader: 'Browse Living Word Bibles’ curated selection of print editions.',
      title: 'Print Bibles',
      copy: 'Prefer a Bible you can hold? Browse our curated print-Bible storefront with trusted editions available through Amazon.',
      cta: 'Shop Print Bibles',
      url: LWB_EMAIL.SITE_URL + '/estore/print-bibles/'
    },
    bible_app: {
      subject: 'Take Living Word Bibles with you',
      preheader: 'Explore the Living Word Bibles App for supported devices.',
      title: 'Living Word Bibles App',
      copy: 'Keep Scripture close with the Living Word Bibles App, designed for simple navigation and comfortable reading on supported mobile and desktop devices.',
      cta: 'Explore the App',
      url: LWB_EMAIL.SITE_URL + '/ios/'
    },
    translations: {
      subject: 'Explore Bible translations',
      preheader: 'Compare translation histories and reading options across Living Word Bibles.',
      title: 'Bible Translations',
      copy: 'Explore the history, character, and reading experience of trusted Bible translations and discover which edition fits your study or devotional reading.',
      cta: 'View Bible Translations',
      url: LWB_EMAIL.SITE_URL + '/the-holy-bible/'
    },
    catholic_bible: {
      subject: 'Explore the Catholic Bible',
      preheader: 'Learn about the 73-book Catholic canon and its biblical tradition.',
      title: 'The Catholic Bible',
      copy: 'Learn about the Catholic biblical canon, the deuterocanonical books, and the Douay-Rheims tradition through Living Word Bibles resources.',
      cta: 'Explore the Catholic Bible',
      url: LWB_EMAIL.SITE_URL + '/the-catholic-bible/'
    },
    free_bibles: {
      subject: 'Three free Bible editions for your Living Word Bibles account',
      preheader: 'Your KJV Special Edition, Douay-Rheims Bible, and Joe Biden Presidential Edition are available free.',
      title: 'Your Free Digital Bibles',
      copy: 'Every verified Living Word Bibles account includes The Holy Bible: King James Version Special Edition and the Douay-Rheims Bible at no charge.',
      cta: 'Open My Library',
      url: LWB_EMAIL.SITE_URL + '/account/library/'
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

function firstName_(displayName) {
  const clean = String(displayName || '').trim();
  return clean ? clean.split(/\s+/)[0] : '';
}

function sendNewsletterTemplateEmail_(email, displayName, templateKey) {
  const template = newsletterTemplate_(templateKey, { name: displayName, email: email });
  if (!template) throw new Error('Unknown newsletter template: ' + templateKey);
  sendBrandedEmail_({
    to: email, subject: template.subject, preheader: template.preheader,
    html: template.html, text: template.text, newsletter: true, optOutEmail: email
  });
}

function sendBrandedEmail_(options) {
  const email = normalizeEmail_(options.to);
  if (!validEmail_(email)) throw new Error('Invalid email address.');

  const newsletter = Boolean(options.newsletter);
  const optOutEmail = normalizeEmail_(options.optOutEmail || email);
  const optOutUrl = LWB_EMAIL.SITE_URL + '/opt-out/?email=' + encodeURIComponent(optOutEmail);

  const footerLinks =
    '<a href="' + LWB_EMAIL.SITE_URL + '/read-the-bible-online/" style="color:#6e5420;text-decoration:none">Read the Bible Online</a>' +
    ' &nbsp;•&nbsp; <a href="' + LWB_EMAIL.SITE_URL + '/history-of-the-bible/" style="color:#6e5420;text-decoration:none">History of the Bible</a>' +
    ' &nbsp;•&nbsp; <a href="' + LWB_EMAIL.SITE_URL + '/estore/" style="color:#6e5420;text-decoration:none">eStore</a><br>' +
    '<a href="' + LWB_EMAIL.SITE_URL + '/terms-of-service/" style="color:#6e5420;text-decoration:none">Terms of Service</a>' +
    ' &nbsp;•&nbsp; <a href="' + LWB_EMAIL.SITE_URL + '/privacy-policy/" style="color:#6e5420;text-decoration:none">Privacy Policy</a>' +
    (newsletter ? ' &nbsp;•&nbsp; <a href="' + optOutUrl + '" style="color:#6e5420;text-decoration:none">Unsubscribe</a>' : '');

  const htmlBody =
    '<!doctype html><html><body style="margin:0;padding:0;background:#f4f1e8;font-family:Arial,Helvetica,sans-serif;color:#2b2b2b">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0">' + escapeHtml_(options.preheader || '') + '</div>' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f1e8;padding:28px 12px"><tr><td align="center">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:680px;background:#ffffff;border:1px solid #ded6c6;border-radius:14px;overflow:hidden">' +
    '<tr><td align="center" style="padding:28px 28px 18px;background:#fffdf8;border-bottom:1px solid #eee6d8">' +
    '<a href="' + LWB_EMAIL.SITE_URL + '/" style="text-decoration:none"><img src="' + LWB_EMAIL.LOGO_URL + '" width="260" alt="Living Word Bibles" style="display:block;max-width:100%;height:auto;border:0"></a>' +
    '<div style="font-family:Georgia,serif;font-style:italic;color:#6c6457;margin-top:10px">Beautifully Formatted to Bring God’s Word to Life on Any Device</div>' +
    '</td></tr>' +
    '<tr><td style="padding:32px 34px;font-size:16px;line-height:1.65">' + (options.html || '') + '</td></tr>' +
    '<tr><td align="center" style="padding:22px 26px 26px;background:#faf7f0;border-top:1px solid #eee6d8;font-size:12px;line-height:1.7;color:#6c6457">' +
    footerLinks +
    '<div style="margin-top:12px">© 2026 Living Word Bibles. All Rights Reserved.</div>' +
    '<div>Developed by Cook Technology Services.</div>' +
    '</td></tr></table></td></tr></table></body></html>';

  let textBody = String(options.text || '');
  textBody += '\n\nRead the Bible Online: ' + LWB_EMAIL.SITE_URL + '/read-the-bible-online/' +
    '\nHistory of the Bible: ' + LWB_EMAIL.SITE_URL + '/history-of-the-bible/' +
    '\neStore: ' + LWB_EMAIL.SITE_URL + '/estore/' +
    '\nTerms: ' + LWB_EMAIL.SITE_URL + '/terms-of-service/' +
    '\nPrivacy: ' + LWB_EMAIL.SITE_URL + '/privacy-policy/';
  if (newsletter) textBody += '\nUnsubscribe: ' + optOutUrl;
  textBody += '\n\n© 2026 Living Word Bibles. All Rights Reserved.';

  MailApp.sendEmail({
    to: email,
    subject: clean_(options.subject || 'Living Word Bibles', 250),
    name: 'Living Word Bibles',
    replyTo: LWB_EMAIL.PUBLIC_EMAIL,
    body: textBody,
    htmlBody: htmlBody
  });
}

function emailButton_(label, url) {
  return '<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="background:#8b6a25;border-radius:6px">' +
    '<a href="' + escapeHtml_(url) + '" style="display:inline-block;padding:12px 20px;color:#ffffff;text-decoration:none;font-weight:bold">' +
    escapeHtml_(label) + '</a></td></tr></table>';
}

function spreadsheet_() { return SpreadsheetApp.openById(LWB_EMAIL.SPREADSHEET_ID); }
function sheet_(name) {
  const s = spreadsheet_().getSheetByName(name);
  if (!s) throw new Error('Required sheet not found: ' + name);
  return s;
}
function headers_(sheet) {
  const n = sheet.getLastColumn();
  return n ? sheet.getRange(1, 1, 1, n).getValues()[0].map(String) : [];
}
function readObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(function(row) {
    return row.some(function(value) { return String(value).trim() !== ''; });
  }).map(function(row) {
    const obj = {};
    headers.forEach(function(header, i) { obj[header] = row[i]; });
    return obj;
  });
}
function appendObject_(sheet, object) {
  const headers = headers_(sheet);
  sheet.appendRow(headers.map(function(header) { return object[header] === undefined ? '' : object[header]; }));
}
function logSystem_(level, event, email, recordId, source, message, metadata) {
  try {
    appendObject_(sheet_(LWB_EMAIL.SHEETS.LOG), {
      timestamp: new Date(), level: clean_(level || 'INFO', 20),
      event: clean_(event || '', 100), email: normalizeEmail_(email || ''),
      record_id: clean_(recordId || '', 200), source: clean_(source || '', 100),
      message: clean_(message || '', 1000),
      metadata_json: JSON.stringify(metadata || {}).slice(0, 5000)
    });
  } catch (_) {}
}
function parsePost_(e) {
  const text = e && e.postData && e.postData.contents ? e.postData.contents : '';
  if (!text) return {};
  try { return JSON.parse(text); } catch (_) {
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
function output_(object) { return ContentService.createTextOutput(JSON.stringify(object)).setMimeType(ContentService.MimeType.JSON); }
function normalizeEmail_(value) { return String(value || '').trim().toLowerCase(); }
function validEmail_(value) { return LWB_EMAIL.EMAIL_RE.test(String(value || '')); }
function clean_(value, max) { return String(value || '').trim().replace(/\u0000/g, '').slice(0, max || 1000); }
function uuid_() { return Utilities.getUuid(); }
function safeError_(error) { return error && error.message ? String(error.message) : String(error); }
function constantTimeEqual_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
function escapeHtml_(value) {
  return String(value || '').replace(/[&<>"']/g, function(character) {
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character];
  });
}

/*
==========================================================================================
END OF LWB EMAIL SERVICE v1.0.0 | Copyright © 2026 Living Word Bibles. All Rights Reserved.
Developed by Cook Technology Services. Last Updated on 02 October 2026 at 16:27:00Z UTC
==========================================================================================
*/

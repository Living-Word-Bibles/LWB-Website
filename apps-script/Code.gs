/**
 * Living Word Bibles — Valois Lumière reader integration patch
 * Target: existing Apps Script v2.0.1
 * Proposed version after merge: v2.0.2
 * Build: 02 September 2026 at 12:18:00Z UTC
 *
 * PURPOSE
 * - Entitlement-gated online reading for LWB eBibles and the Ethiopian Bible PDF.
 * - Reuses existing Customers, Products, Digital Assets and Entitlements sheets.
 * - No new sheets or columns.
 * - No PayPal changes.
 * - No account/session redesign.
 * - No backend reading-progress writes; Lumière state is stored in browser localStorage.
 *
 * IMPORTANT: This is a SURGICAL PATCH, not a standalone Code.gs replacement.
 */

/* ========================================================================== */
/* 1. VERSION METADATA                                                        */
/* ========================================================================== */

/* In the existing LWB object, change ONLY these two values:

  VERSION: '2.0.2',
  BUILD_UTC: '02 September 2026 at 12:18:00Z UTC',

*/

/* ========================================================================== */
/* 2. LOCK-FREE READER ROUTING                                                */
/* ========================================================================== */

/*
 * In doPost(e), immediately AFTER the existing activity-log/activity-log-batch
 * lock-free block and BEFORE:
 *
 *   const lock = LockService.getScriptLock();
 *
 * insert this block:
 */

/* BEGIN INSERT INTO doPost(e) */
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
/* END INSERT INTO doPost(e) */

/* ========================================================================== */
/* 3. VALOIS LUMIÈRE READER HELPERS                                           */
/* ========================================================================== */

/* Append the following functions once near the Digital Assets / Downloads area. */

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

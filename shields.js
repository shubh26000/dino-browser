'use strict';

const BUILTIN_RULES = [
  { domain: 'doubleclick.net', category: 'ads' },
  { domain: 'googlesyndication.com', category: 'ads' },
  { domain: 'adservice.google.com', category: 'ads' },
  { domain: 'adnxs.com', category: 'ads' },
  { domain: 'criteo.com', category: 'ads' },
  { domain: 'taboola.com', category: 'ads' },
  { domain: 'outbrain.com', category: 'ads' },
  { domain: 'google-analytics.com', category: 'trackers' },
  { domain: 'hotjar.com', category: 'trackers' },
  { domain: 'segment.io', category: 'trackers' },
  { domain: 'scorecardresearch.com', category: 'trackers' },
  { domain: 'connect.facebook.net', category: 'trackers' },
  { domain: 'pixel.facebook.com', category: 'trackers' },
  { domain: 'analytics.tiktok.com', category: 'trackers' },
];

const TRACKING_PARAMETERS = new Set([
  'fbclid',
  'gclid',
  'dclid',
  'gbraid',
  'wbraid',
  'msclkid',
  'mc_eid',
  'igshid',
  'vero_id',
  'ref_src',
  'campaign_id',
]);

function hostFromUrl(value) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^\[|\]$/g, '');
  } catch {
    return '';
  }
}

function matchesDomain(host, domain) {
  const normalizedHost = typeof host === 'string' ? host.toLowerCase().replace(/^\[|\]$/g, '') : '';
  const normalizedDomain = domain.toLowerCase();
  return normalizedHost === normalizedDomain || normalizedHost.endsWith(`.${normalizedDomain}`);
}

function isShieldException(topLevelUrl, exceptions = []) {
  const topLevelHost = hostFromUrl(topLevelUrl);
  return exceptions.some((exception) => matchesDomain(topLevelHost, exception));
}

function cleanTrackingParameters(address) {
  let parsed;
  try {
    parsed = new URL(address);
  } catch {
    return address;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return address;

  let changed = false;
  for (const parameter of [...parsed.searchParams.keys()]) {
    const normalized = parameter.toLowerCase();
    if (TRACKING_PARAMETERS.has(normalized) || normalized.startsWith('utm_')) {
      parsed.searchParams.delete(parameter);
      changed = true;
    }
  }
  return changed ? parsed.href : address;
}

function isLocalHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost'
    || host.endsWith('.localhost')
    || host.endsWith('.local')
    || host === '::1'
    || host.startsWith('fc')
    || host.startsWith('fd')
    || host.startsWith('fe80:')
  ) return true;

  const octets = host.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return !host.includes('.');
  }
  return octets[0] === 10
    || octets[0] === 127
    || (octets[0] === 169 && octets[1] === 254)
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168);
}

function upgradeToHttps(address) {
  let parsed;
  try {
    parsed = new URL(address);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' || isLocalHost(parsed.hostname)) return null;

  const fallbackUrl = parsed.href;
  parsed.protocol = 'https:';
  if (parsed.port === '80') parsed.port = '';
  return { redirectUrl: parsed.href, fallbackUrl };
}

function findBlockRule(host, customBlockedHosts = []) {
  return BUILTIN_RULES.find((rule) => matchesDomain(host, rule.domain))
    || (customBlockedHosts.some((domain) => matchesDomain(host, domain))
      ? { domain: customBlockedHosts.find((domain) => matchesDomain(host, domain)), category: 'custom' }
      : null);
}

function evaluateRequest(details, settings = {}) {
  const isMainFrame = details.resourceType === 'mainFrame';
  let parsed;
  try {
    parsed = new URL(details.url);
  } catch {
    return { type: 'allow' };
  }

  if (isMainFrame) {
    const cleanedUrl = settings.urlCleaning === false
      ? details.url
      : cleanTrackingParameters(details.url);
    if (cleanedUrl !== details.url) {
      return { type: 'redirect', redirectUrl: cleanedUrl, reason: 'tracking-parameters' };
    }
    if (settings.httpsFirst !== false) {
      const upgrade = upgradeToHttps(details.url);
      if (upgrade) return { type: 'redirect', ...upgrade, reason: 'https-first' };
    }
    return { type: 'allow' };
  }

  if (
    settings.shieldsEnabled === false
    || isShieldException(
      settings.topLevelUrl || details.topLevelUrl || details.initiatorOrigin || details.referrer,
      settings.shieldExceptions || [],
    )
  ) {
    return { type: 'allow' };
  }

  const rule = findBlockRule(parsed.hostname, settings.customBlockedHosts || []);
  if (rule?.category === 'ads' && settings.adsBlocking === false) return { type: 'allow' };
  if (rule?.category === 'trackers' && settings.trackersBlocking === false) return { type: 'allow' };
  if (!rule) return { type: 'allow' };
  return { type: 'block', category: rule.category, domain: rule.domain };
}

module.exports = {
  BUILTIN_RULES,
  cleanTrackingParameters,
  evaluateRequest,
  isLocalHost,
  isShieldException,
  matchesDomain,
  upgradeToHttps,
};

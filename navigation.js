const SEARCH_ENGINES = {
  google: {
    home: 'https://www.google.com',
    search: 'https://www.google.com/search?q=',
  },
  bing: {
    home: 'https://www.bing.com',
    search: 'https://www.bing.com/search?q=',
  },
  duckduckgo: {
    home: 'https://duckduckgo.com',
    search: 'https://duckduckgo.com/?q=',
  },
};

function normalizeAddress(input, searchEngine = 'google') {
  const engine = SEARCH_ENGINES[searchEngine] || SEARCH_ENGINES.google;
  const value = input.trim();
  if (!value) {
    return engine.home;
  }

  if (/\s/.test(value)) {
    return `${engine.search}${encodeURIComponent(value)}`;
  }

  try {
    const hasScheme = value.includes('://');
    const candidate = new URL(hasScheme ? value : `https://${value}`);
    const looksLikeHost = hasScheme
      || candidate.hostname.includes('.')
      || candidate.hostname === 'localhost'
      || candidate.hostname.startsWith('[');
    if (
      looksLikeHost
      && (candidate.protocol === 'http:' || candidate.protocol === 'https:')
    ) {
      return candidate.href;
    }
  } catch {
    // Treat invalid addresses as search terms.
  }

  return `${engine.search}${encodeURIComponent(value)}`;
}

function getHomeUrl(searchEngine = 'google') {
  return (SEARCH_ENGINES[searchEngine] || SEARCH_ENGINES.google).home;
}

function isAllowedNavigation(address) {
  try {
    const protocol = new URL(address).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function isTrustedUiUrl(address, trustedUrl) {
  return address === trustedUrl;
}

function describeNavigationError(errorCode, errorDescription, url) {
  const knownErrors = {
    [-106]: ['You’re offline', 'Check your internet connection, then try again.'],
    [-105]: ['We couldn’t find that site', 'Check the web address, or try again in a moment.'],
    [-102]: ['The connection was refused', 'The site refused the connection. You can reload to try again.'],
    [-101]: ['The connection was interrupted', 'The connection ended unexpectedly. You can reload to try again.'],
    [-118]: ['The site took too long to respond', 'The server did not respond in time. You can reload to try again.'],
    [-7]: ['The site took too long to respond', 'The server did not respond in time. You can reload to try again.'],
  };
  const isCertificateError = (errorCode <= -200 && errorCode >= -299)
    || /CERT|SSL/i.test(errorDescription || '');
  const [title, description] = isCertificateError
    ? ['The connection isn’t private', 'The site’s security certificate could not be verified. The browser blocked this connection.']
    : knownErrors[errorCode] || ['This page can’t be reached', 'Something interrupted the connection. Check the address and try again.'];
  return {
    title,
    description,
    code: errorDescription || `ERR_NETWORK_${Math.abs(errorCode)}`,
    url,
  };
}

module.exports = {
  describeNavigationError,
  getHomeUrl,
  isAllowedNavigation,
  isTrustedUiUrl,
  normalizeAddress,
};

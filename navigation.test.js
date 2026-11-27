const test = require('node:test');
const assert = require('node:assert/strict');
const {
  describeNavigationError,
  getHomeUrl,
  isAllowedNavigation,
  isTrustedUiUrl,
  normalizeAddress,
} = require('./navigation');

test('normalizes web addresses and keeps their paths', () => {
  assert.equal(normalizeAddress('example.com/docs'), 'https://example.com/docs');
  assert.equal(normalizeAddress('http://localhost:8000'), 'http://localhost:8000/');
});

test('uses Google search for words and invalid input', () => {
  assert.equal(
    normalizeAddress('student management'),
    'https://www.google.com/search?q=student%20management',
  );
  assert.equal(normalizeAddress(''), 'https://www.google.com');
  assert.equal(normalizeAddress('weather', 'bing'), 'https://www.bing.com/search?q=weather');
  assert.equal(getHomeUrl('duckduckgo'), 'https://duckduckgo.com');
});

test('blocks unsafe navigation protocols', () => {
  assert.equal(isAllowedNavigation('https://example.com'), true);
  assert.equal(isAllowedNavigation('javascript:alert(1)'), false);
  assert.equal(isAllowedNavigation('file:///C:/Windows/win.ini'), false);
});

test('only accepts the exact trusted browser UI URL', () => {
  const trustedUrl = 'file:///C:/browser/index.html';
  assert.equal(isTrustedUiUrl(trustedUrl, trustedUrl), true);
  assert.equal(isTrustedUiUrl('https://example.com', trustedUrl), false);
  assert.equal(isTrustedUiUrl(`${trustedUrl}#redirect`, trustedUrl), false);
});

test('describes common navigation failures with safe recovery guidance', () => {
  assert.deepEqual(
    describeNavigationError(-106, 'ERR_INTERNET_DISCONNECTED', 'https://example.com'),
    {
      title: 'You’re offline',
      description: 'Check your internet connection, then try again.',
      code: 'ERR_INTERNET_DISCONNECTED',
      url: 'https://example.com',
    },
  );
  assert.equal(describeNavigationError(-105, 'ERR_NAME_NOT_RESOLVED').title, 'We couldn’t find that site');
  assert.equal(describeNavigationError(-200, 'ERR_CERT_COMMON_NAME_INVALID').title, 'The connection isn’t private');
});

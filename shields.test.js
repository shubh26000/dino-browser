'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  cleanTrackingParameters,
  evaluateRequest,
  isShieldException,
  matchesDomain,
  upgradeToHttps,
} = require('./shields');

test('matches tracker domains at host boundaries', () => {
  assert.equal(matchesDomain('ads.doubleclick.net', 'doubleclick.net'), true);
  assert.equal(matchesDomain('doubleclick.net', 'doubleclick.net'), true);
  assert.equal(matchesDomain('notdoubleclick.net', 'doubleclick.net'), false);
});

test('blocks bundled ad and tracker hosts for subresources only', () => {
  const details = {
    url: 'https://stats.google-analytics.com/collect',
    resourceType: 'xhr',
    topLevelUrl: 'https://example.com/',
  };
  assert.deepEqual(evaluateRequest(details), {
    type: 'block',
    category: 'trackers',
    domain: 'google-analytics.com',
  });
  assert.equal(evaluateRequest({ ...details, resourceType: 'mainFrame' }).type, 'allow');
});

test('respects category switches and custom host rules', () => {
  assert.equal(evaluateRequest({
    url: 'https://ads.example.test/banner.js',
    resourceType: 'script',
    topLevelUrl: 'https://publisher.test/',
  }, { customBlockedHosts: ['ads.example.test'] }).category, 'custom');
  assert.equal(evaluateRequest({
    url: 'https://doubleclick.net/ad.js',
    resourceType: 'script',
    topLevelUrl: 'https://publisher.test/',
  }, { adsBlocking: false }).type, 'allow');
  assert.equal(evaluateRequest({
    url: 'https://google-analytics.com/collect',
    resourceType: 'xhr',
    topLevelUrl: 'https://publisher.test/',
  }, { trackersBlocking: false }).type, 'allow');
});

test('respects the global Shields switch and per-site exceptions', () => {
  const details = {
    url: 'https://connect.facebook.net/en_US/fbevents.js',
    resourceType: 'script',
    topLevelUrl: 'https://shop.example.com/',
  };
  assert.equal(evaluateRequest(details, { shieldsEnabled: false }).type, 'allow');
  assert.equal(evaluateRequest(details, { shieldExceptions: ['example.com'] }).type, 'allow');
  assert.equal(isShieldException('https://sub.example.com', ['example.com']), true);
  assert.equal(isShieldException('https://example.com.evil.test', ['example.com']), false);
});

test('cleans known tracking parameters and keeps ordinary query values', () => {
  assert.equal(
    cleanTrackingParameters('https://example.com/path?utm_source=mail&fbclid=abc&view=full#top'),
    'https://example.com/path?view=full#top',
  );
  assert.equal(cleanTrackingParameters('https://example.com/?view=full'), 'https://example.com/?view=full');
});

test('upgrades public HTTP navigations and leaves local development hosts alone', () => {
  assert.deepEqual(upgradeToHttps('http://example.com/path?q=1'), {
    redirectUrl: 'https://example.com/path?q=1',
    fallbackUrl: 'http://example.com/path?q=1',
  });
  assert.equal(upgradeToHttps('http://localhost:8080/'), null);
  assert.equal(upgradeToHttps('http://192.168.1.4/'), null);
});

test('cleans tracking parameters before applying HTTPS-first redirect', () => {
  assert.deepEqual(evaluateRequest({
    url: 'http://example.com/?utm_campaign=launch',
    resourceType: 'mainFrame',
  }), {
    type: 'redirect',
    redirectUrl: 'http://example.com/',
    reason: 'tracking-parameters',
  });
});

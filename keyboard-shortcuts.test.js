const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveBrowserShortcut } = require('./keyboard-shortcuts');

function key(keyName, modifiers = {}) {
  return resolveBrowserShortcut({ type: 'keyDown', key: keyName, ...modifiers });
}

test('maps Windows tab, history, bookmark, and focus shortcuts', () => {
  assert.deepEqual(key('t', { control: true }), { action: 'newTab' });
  assert.deepEqual(key('t', { control: true, shift: true }), { action: 'restoreClosedTab' });
  assert.deepEqual(key('Tab', { control: true, shift: true }), { action: 'previousTab' });
  assert.deepEqual(key('9', { control: true }), { action: 'selectTab', index: -1 });
  assert.deepEqual(key('d', { control: true, shift: true }), { action: 'bookmarkAllTabs' });
  assert.deepEqual(key('F6'), { action: 'focusCycle', reverse: false });
  assert.deepEqual(key('d', { alt: true }), { action: 'focusAddress' });
});

test('maps page, privacy, zoom, and navigation shortcuts', () => {
  assert.deepEqual(key('r', { control: true, shift: true }), { action: 'hardReload' });
  assert.deepEqual(key('g', { control: true, shift: true }), { action: 'findNext', reverse: true });
  assert.deepEqual(key('Delete', { control: true, shift: true }), { action: 'clearBrowsingData' });
  assert.deepEqual(key('ArrowLeft', { alt: true }), { action: 'back' });
  assert.deepEqual(key('F11'), { action: 'fullscreen' });
  assert.deepEqual(key('=', { control: true, shift: true }), { action: 'zoomIn' });
  assert.equal(key('q', { control: true }), null);
  assert.equal(resolveBrowserShortcut({ type: 'keyUp', key: 't', control: true }), null);
});

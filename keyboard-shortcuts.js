function resolveBrowserShortcut(input) {
  if (!input || input.type !== 'keyDown') return null;
  const key = String(input.key || '').toLowerCase();
  const control = Boolean(input.control || input.meta);
  const shift = Boolean(input.shift);
  const alt = Boolean(input.alt);

  if (key === 'escape' && !control && !alt) return { action: 'stop' };
  if (key === 'f5') return { action: 'reload' };
  if (key === 'f6') return { action: 'focusCycle', reverse: shift };
  if (key === 'f11') return { action: 'fullscreen' };
  if (!control && alt && key === 'd') return { action: 'focusAddress' };
  if (key === 'f12' || (control && shift && key === 'i')) return { action: 'devTools' };
  if (alt && ['arrowleft', 'left'].includes(key)) return { action: 'back' };
  if (alt && ['arrowright', 'right'].includes(key)) return { action: 'forward' };
  if (alt && key === 'home') return { action: 'home' };
  if (!control) return null;

  if (key === 'tab' || key === 'pagedown') return { action: shift ? 'previousTab' : 'nextTab' };
  if (key === 'pageup') return { action: 'previousTab' };
  if (/^[1-9]$/.test(key)) return { action: 'selectTab', index: key === '9' ? -1 : Number(key) - 1 };
  const shortcuts = {
    l: 'focusAddress',
    t: shift ? 'restoreClosedTab' : 'newTab',
    w: 'closeTab',
    r: shift ? 'hardReload' : 'reload',
    d: shift ? 'bookmarkAllTabs' : 'bookmark',
    h: shift ? null : 'history',
    o: shift ? 'bookmarks' : null,
    ',': shift ? null : 'settings',
    a: shift ? 'tabSearch' : null,
    n: shift ? 'privateWindow' : 'newWindow',
    f: shift ? null : 'find',
    g: 'findNext',
    p: shift ? null : 'print',
    s: shift ? null : 'savePage',
    u: shift ? null : 'viewSource',
    b: shift ? 'toggleBookmarksBar' : null,
    j: shift ? null : 'downloads',
    'delete': shift ? 'clearBrowsingData' : null,
    '=': shift ? 'zoomIn' : null,
    '+': 'zoomIn',
    '-': 'zoomOut',
    '0': 'zoomReset',
  };
  const action = shortcuts[key];
  if (!action) return null;
  return action === 'findNext' ? { action, reverse: shift } : { action };
}

module.exports = { resolveBrowserShortcut };

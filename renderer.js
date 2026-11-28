const tabsElement = document.querySelector('#tabs');
const addressInput = document.querySelector('#address');
const secureMark = document.querySelector('.secure-mark');
const backButton = document.querySelector('#back');
const forwardButton = document.querySelector('#forward');
const bookmarkButton = document.querySelector('#bookmark');
const shieldsButton = document.querySelector('#shields-button');
const shieldsCount = document.querySelector('#shields-count');
const shieldsPopup = document.querySelector('#shields-popup');
const extensionsButton = document.querySelector('#extensions-button');
const extensionsPopup = document.querySelector('#extensions-popup');
const findBar = document.querySelector('#find-bar');
const findQuery = document.querySelector('#find-query');
const findCount = document.querySelector('#find-count');
const findMatchCase = document.querySelector('#find-match-case');
const menuButton = document.querySelector('#browser-menu-button');
const menu = document.querySelector('#browser-menu');
const internalPage = document.querySelector('#internal-page');
const bookmarksBar = document.querySelector('#bookmarks-bar');
const toast = document.querySelector('#toast');
const ICONS = {
  add: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m7 7 10 10M17 7 7 17"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
  starFilled: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" fill="currentColor" stroke="none"/>',
  maximize: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
  restore: '<path d="M8 8V5h11v11h-3M5 8h11v11H5z"/>',
  reload: '<path d="M20 7v5h-5M19 12a7 7 0 1 1-2-4.9L20 12"/>',
  stop: '<path d="M7 7h10v10H7z"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3.5 9h17M3.5 15h17M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  warning: '<path d="m12 3 9 17H3L12 3Z"/><path d="M12 9v4m0 3h.01"/>',
};

function makeIcon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'ui-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.innerHTML = ICONS[name] || ICONS.close;
  return svg;
}

function setIcon(button, name) {
  button.replaceChildren(makeIcon(name));
}

const newTabButton = document.createElement('button');
newTabButton.id = 'new-tab';
newTabButton.className = 'new-tab chrome-button';
newTabButton.type = 'button';
newTabButton.append(makeIcon('add'));
newTabButton.setAttribute('aria-label', 'New tab');
newTabButton.setAttribute('aria-keyshortcuts', 'Control+T');
newTabButton.title = 'New tab';
newTabButton.addEventListener('click', () => run(window.browser.newTab()));

let browserState = { tabs: [], recentlyClosedTabs: [], activeTabId: null, internalPage: null };
let renderedTabIds = new Set();
let renderedTabsSignature = '';
const loadingTimers = new Map();
const visibleLoadingTabs = new Set();
let library = {
  history: [],
  bookmarks: [],
  settings: {
    searchEngine: 'google',
    theme: 'night',
    accent: '#496fe8',
    accentMode: 'theme',
    density: 'comfortable',
    roundness: 'default',
    reduceEffects: false,
    shieldsEnabled: true,
    adsBlocking: true,
    trackersBlocking: true,
    shieldExceptions: [],
    httpsFirst: true,
    urlCleaning: true,
    customBlockedHosts: [],
    ambient: true,
    showBookmarksBar: true,
    highContrast: false,
    startupBehavior: 'home',
  },
  shieldsStats: { ads: 0, trackers: 0, custom: 0 },
};
let settingsDestination;
let toastTimer;
let clockTimer;
let wallpaperTimer;
let notesSaveTimer;
let shortcutSequence = 0;
let tabSearchSignature = '';
const START_PAGE_WIDGET_MANIFEST = [
  { id: 'quote', name: 'Quote of the day', description: 'A short offline quote.', sizes: ['S'], settingsSchema: {}, permissions: [], dataSources: ['bundled'] },
  { id: 'bookmarks', name: 'Bookmarks', description: 'Your saved bookmarks.', sizes: ['S', 'M'], settingsSchema: {}, permissions: [], dataSources: ['local bookmarks'] },
  { id: 'recent', name: 'Recent pages', description: 'Pages from local history.', sizes: ['S', 'M'], settingsSchema: {}, permissions: [], dataSources: ['local history'] },
  { id: 'todo', name: 'To-do list', description: 'A private checklist stored on this device.', sizes: ['M'], settingsSchema: { maxItems: 50 }, permissions: [], dataSources: ['encrypted browser profile'] },
  { id: 'notes', name: 'Quick notes', description: 'Notes saved locally in your encrypted profile.', sizes: ['M', 'L'], settingsSchema: { maxCharacters: 5000 }, permissions: [], dataSources: ['encrypted browser profile'] },
];

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 4000);
}

function run(action) {
  return action.catch((error) => {
    showToast(error.message || 'The browser action could not be completed.');
  });
}

function openToolbarMenu(button, width, openMenu) {
  const rect = button.getBoundingClientRect();
  const position = {
    x: Math.max(0, Math.floor(rect.right - width)),
    y: Math.ceil(rect.bottom),
  };
  button.setAttribute('aria-expanded', 'true');
  run(openMenu(position));
}

function openFindBar() {
  findBar.hidden = false;
  document.body.classList.add('find-open');
  run(window.browser.setFindOpen(true));
  findQuery.focus();
  findQuery.select();
}

function closeFindBar(returnFocus = true) {
  findBar.hidden = true;
  document.body.classList.remove('find-open');
  findCount.textContent = '0 of 0';
  run(window.browser.stopFind());
  run(window.browser.setFindOpen(false));
  if (returnFocus) run(window.browser.focusPage());
}

function submitFind(forward = true, findNext = true) {
  findCount.textContent = 'Searching…';
  run(window.browser.findPage(findQuery.value, { forward, findNext, matchCase: findMatchCase.checked }));
}

function cycleChromeFocus(reverse = false) {
  const active = document.activeElement;
  const inBookmarks = Boolean(active?.closest('#bookmarks-bar'));
  const inToolbar = Boolean(active?.closest('.browser-chrome'));
  const inPage = Boolean(active?.closest('#internal-page'));
  if (reverse) {
    if (inBookmarks) addressInput.focus();
    else if (inPage) {
      if (!bookmarksBar.hidden) bookmarksBar.querySelector('button')?.focus();
      else addressInput.focus();
    } else run(window.browser.focusPage());
    return;
  }
  if (inToolbar && !inBookmarks && !bookmarksBar.hidden) {
    (bookmarksBar.querySelector('button') || addressInput).focus();
  } else if (inToolbar && !inBookmarks) {
    run(window.browser.focusPage());
  } else if (inBookmarks || inPage) {
    if (inBookmarks) run(window.browser.focusPage());
    else addressInput.focus();
  } else {
    addressInput.focus();
  }
}

function renderTabs() {
  const signature = JSON.stringify({
    activeTabId: browserState.activeTabId,
    tabs: browserState.tabs.map((tab) => [tab.id, tab.title, tab.url, tab.isLoading, tab.loadingPhase, tab.isBookmarked, Boolean(tab.error)]),
  });
  if (signature === renderedTabsSignature) return;
  renderedTabsSignature = signature;
  if (tabHoverCard) {
    tabHoverCard.classList.remove('visible');
    tabHoverCard.setAttribute('aria-hidden', 'true');
    document.querySelector('.tab-title[aria-describedby="tab-hover-card"]')?.removeAttribute('aria-describedby');
  }
  const oldTabElements = new Map([...tabsElement.querySelectorAll('.tab[data-tab-id]')]
    .map((element) => [element.dataset.tabId, { element, bounds: element.getBoundingClientRect() }]));
  const previousBounds = newTabButton.isConnected ? newTabButton.getBoundingClientRect() : null;
  tabsElement.replaceChildren();
  const currentTabIds = new Set();
  let newTabPlaced = false;

  for (const tab of browserState.tabs) {
    if (tab.isLoading && !visibleLoadingTabs.has(tab.id) && !loadingTimers.has(tab.id)) {
      const timer = window.setTimeout(() => {
        loadingTimers.delete(tab.id);
        const current = browserState.tabs.find((candidate) => candidate.id === tab.id);
        if (current?.isLoading) {
          visibleLoadingTabs.add(tab.id);
          renderTabs();
        }
      }, 150);
      loadingTimers.set(tab.id, timer);
    } else if (!tab.isLoading) {
      window.clearTimeout(loadingTimers.get(tab.id));
      loadingTimers.delete(tab.id);
      visibleLoadingTabs.delete(tab.id);
    }

    const element = document.createElement('div');
    element.className = `tab${tab.id === browserState.activeTabId ? ' active' : ''}`;
    element.dataset.tabId = tab.id;
    element.draggable = true;
    element.setAttribute('role', 'presentation');
    if (!renderedTabIds.has(tab.id)) {
      element.classList.add('tab-entering');
    }

    const title = document.createElement('button');
    title.className = 'tab-title';
    title.type = 'button';
    const loadingIcon = document.createElement('span');
    loadingIcon.className = 'tab-loading-spinner';
    loadingIcon.hidden = !tab.isLoading || !visibleLoadingTabs.has(tab.id);
    loadingIcon.classList.toggle('waiting', tab.loadingPhase !== 'loading');
    loadingIcon.classList.toggle('receiving', tab.loadingPhase === 'loading');
    loadingIcon.setAttribute('aria-hidden', 'true');
    const titleText = document.createElement('span');
    titleText.className = 'tab-title-text';
    titleText.textContent = tab.isLoading ? 'Loading…' : tab.title;
    title.append(loadingIcon, titleText);
    title.title = tab.title;
    title.setAttribute('aria-label', tab.isLoading ? 'Loading page' : tab.title);
    title.setAttribute('role', 'tab');
    title.setAttribute('aria-selected', String(tab.id === browserState.activeTabId));
    title.tabIndex = tab.id === browserState.activeTabId ? 0 : -1;
    title.addEventListener('click', () => run(window.browser.switchTab(tab.id)));
    title.addEventListener('keydown', (event) => {
      const tabButtons = [...tabsElement.querySelectorAll('.tab-title')];
      const index = tabButtons.indexOf(title);
      let nextIndex = index;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabButtons.length;
      else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabButtons.length) % tabButtons.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = tabButtons.length - 1;
      else return;
      event.preventDefault();
      tabButtons[nextIndex]?.focus();
    });

    const close = document.createElement('button');
    close.className = 'tab-close';
    close.type = 'button';
    close.append(makeIcon('close'));
    close.setAttribute('aria-label', `Close ${tab.title}`);
    close.addEventListener('click', () => run(window.browser.closeTab(tab.id)));

    let hoverCardTimer;
    const showHoverCard = () => {
      window.clearTimeout(hoverCardTimer);
      hoverCardTimer = window.setTimeout(() => showTabHoverCard(element, tab), 500);
    };
    element.addEventListener('pointerenter', showHoverCard);
    element.addEventListener('pointerleave', () => {
      window.clearTimeout(hoverCardTimer);
      hideTabHoverCard();
    });
    element.addEventListener('focusin', showHoverCard);
    element.addEventListener('focusout', () => {
      window.clearTimeout(hoverCardTimer);
      hideTabHoverCard();
    });

    element.append(title, close);
    element.addEventListener('auxclick', (event) => {
      if (event.button === 1) {
        event.preventDefault();
        run(window.browser.closeTab(tab.id));
      }
    });
    element.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      run(window.browser.showTabContextMenu(tab.id));
    });
    element.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/browser-tab-id', tab.id);
      event.dataTransfer.effectAllowed = 'move';
      element.classList.add('dragging');
    });
    element.addEventListener('dragend', () => element.classList.remove('dragging'));
    element.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    });
    element.addEventListener('drop', (event) => {
      event.preventDefault();
      const fromId = event.dataTransfer.getData('text/browser-tab-id');
      if (fromId && fromId !== tab.id) run(window.browser.reorderTab(fromId, tab.id));
    });
    tabsElement.append(element);
    currentTabIds.add(tab.id);
    if (tab.id === browserState.activeTabId) {
      tabsElement.append(newTabButton);
      newTabPlaced = true;
    }
  }

  if (!newTabPlaced) {
    tabsElement.append(newTabButton);
  }
  const reducedMotion = document.body.classList.contains('reduce-motion');
  if (!reducedMotion) {
    for (const [id, old] of oldTabElements) {
      const next = tabsElement.querySelector(`.tab[data-tab-id="${CSS.escape(id)}"]`);
      if (!next) continue;
      const bounds = next.getBoundingClientRect();
      const offsetX = old.bounds.left - bounds.left;
      const offsetY = old.bounds.top - bounds.top;
      if (offsetX || offsetY) {
        next.animate(
          [{ transform: `translate(${offsetX}px, ${offsetY}px)` }, { transform: 'translate(0, 0)' }],
          { duration: 180, easing: 'cubic-bezier(.2, .75, .25, 1)' },
        );
      }
    }
  }
  renderedTabIds = currentTabIds;

  if (previousBounds && !reducedMotion) {
    const nextBounds = newTabButton.getBoundingClientRect();
    const offsetX = previousBounds.left - nextBounds.left;
    const offsetY = previousBounds.top - nextBounds.top;
    if (offsetX || offsetY) {
      newTabButton.animate(
        [
          { transform: `translate(${offsetX}px, ${offsetY}px)` },
          { transform: 'translate(0, 0)' },
        ],
        { duration: 180, easing: 'cubic-bezier(.2, .75, .25, 1)' },
      );
    }
  }
}

let tabHoverCard;
let tabHoverCardHideTimer;
function showTabHoverCard(tabElement, tab) {
  window.clearTimeout(tabHoverCardHideTimer);
  if (!tabHoverCard) {
    tabHoverCard = document.createElement('div');
    tabHoverCard.className = 'tab-hover-card';
    tabHoverCard.setAttribute('aria-hidden', 'true');
    tabHoverCard.setAttribute('role', 'tooltip');
    tabHoverCard.id = 'tab-hover-card';
    document.querySelector('.browser-chrome').append(tabHoverCard);
  }
  const title = document.createElement('strong');
  title.textContent = tab.title || 'New tab';
  const url = document.createElement('span');
  url.textContent = tab.url || 'Blank page';
  tabHoverCard.replaceChildren(title, url);
  tabHoverCard.setAttribute('aria-hidden', 'false');
  tabElement.querySelector('.tab-title')?.setAttribute('aria-describedby', tabHoverCard.id);
  const chrome = document.querySelector('.browser-chrome');
  const chromeRect = chrome.getBoundingClientRect();
  const tabRect = tabElement.getBoundingClientRect();
  const width = Math.min(280, chromeRect.width - 20);
  const left = Math.max(10, Math.min(tabRect.left - chromeRect.left, chromeRect.width - width - 10));
  const top = Math.min(tabRect.bottom - chromeRect.top + 3, chromeRect.height - 52);
  tabHoverCard.style.left = `${left}px`;
  tabHoverCard.style.top = `${top}px`;
  tabHoverCard.classList.add('visible');
}

function hideTabHoverCard() {
  if (!tabHoverCard) return;
  window.clearTimeout(tabHoverCardHideTimer);
  tabHoverCardHideTimer = window.setTimeout(() => {
    tabHoverCard?.classList.remove('visible');
    tabHoverCard?.setAttribute('aria-hidden', 'true');
    document.querySelector('.tab-title[aria-describedby="tab-hover-card"]')?.removeAttribute('aria-describedby');
  }, 80);
}

function renderBookmarksBar() {
  bookmarksBar.replaceChildren();
  bookmarksBar.hidden = library.settings.showBookmarksBar === false;
  document.body.classList.toggle('bookmarks-hidden', bookmarksBar.hidden);
  for (const bookmark of library.bookmarks) {
    const button = document.createElement('button');
    button.className = 'bookmark-link';
    button.type = 'button';
    button.textContent = bookmark.title || bookmark.url;
    button.title = bookmark.url;
    button.dataset.bookmarkId = bookmark.id;
    button.addEventListener('click', () => run(window.browser.navigate(bookmark.url)));
    button.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      run(window.browser.showBookmarkContextMenu(bookmark.id));
    });
    bookmarksBar.append(button);
  }
  if (!library.bookmarks.length) {
    const hint = document.createElement('span');
    hint.className = 'bookmarks-hint';
    hint.textContent = 'Your bookmarks will appear here';
    bookmarksBar.append(hint);
  }
}

function makePageHeading(title, description) {
  const heading = document.createElement('header');
  heading.className = 'page-heading';
  const titleElement = document.createElement('h1');
  titleElement.textContent = title;
  titleElement.tabIndex = -1;
  const descriptionElement = document.createElement('p');
  descriptionElement.textContent = description;
  heading.append(titleElement, descriptionElement);
  return heading;
}

function makeEmptyState(message) {
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  empty.textContent = message;
  return empty;
}

function renderHomePage() {
  const root = document.createElement('div');
  root.id = 'start-page';
  root.className = 'start-page';
  internalPage.append(root);
  renderStartPageContent(true);
  renderCustomizeDrawer();
}

function startPageValues() {
  return library.startPage || {
    wallpaper: 'aurora', wallpaperUrl: null, wallpaperDim: 18, wallpaperBlur: 0, cardOpacity: 13, layout: 'clean', greetingName: '',
    showGreeting: true, showClock: true, use24Hour: false, showPrivacyStats: true,
    showShortcuts: true, widgets: [], widgetSizes: {}, shortcuts: [], todoItems: [], notes: '',
  };
}

function getStartPageTopSites() {
  const used = new Set();
  return [...library.history]
    .filter((entry) => {
      try {
        const url = new URL(entry.url);
        return ['http:', 'https:'].includes(url.protocol) && !used.has(entry.url) && used.add(entry.url);
      } catch {
        return false;
      }
    })
    .sort((first, second) => second.visits - first.visits || second.visitedAt - first.visitedAt)
    .slice(0, 10);
}

function buildStartPageStats() {
  const stats = library.shieldsStats || { ads: 0, trackers: 0, custom: 0 };
  const totalBlocked = stats.ads + stats.trackers + stats.custom;
  const panel = document.createElement('section');
  panel.className = 'privacy-stats';
  panel.setAttribute('aria-label', 'Local privacy statistics');
  panel.hidden = !startPageValues().showPrivacyStats;
  const values = [
    ['Requests blocked', totalBlocked.toLocaleString()],
    ['Bandwidth saved · est.', formatBytes(totalBlocked * 50 * 1024)],
    ['Time saved · est.', formatSavedTime(totalBlocked * 100)],
  ];
  for (const [index, [label, value]] of values.entries()) {
    const card = document.createElement('div');
    card.className = 'privacy-stat';
    const number = document.createElement('strong');
    number.dataset.privacyStat = String(index);
    number.textContent = value;
    const caption = document.createElement('span');
    caption.textContent = label;
    card.append(number, caption);
    panel.append(card);
  }
  panel.append(buildPrivacyWeekChart(stats));
  return panel;
}

function getPrivacyWeekData(stats) {
  const byDate = new Map((Array.isArray(stats.daily) ? stats.daily : []).map((day) => [day.date, day]));
  const today = new Date();
  return Array.from({ length: 7 }, (_unused, index) => {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 6 + index));
    const key = date.toISOString().slice(0, 10);
    const day = byDate.get(key) || { ads: 0, trackers: 0, custom: 0 };
    const total = day.ads + day.trackers + day.custom;
    const label = date.toLocaleDateString([], { weekday: 'short', timeZone: 'UTC' });
    return { date: key, label, total };
  });
}

function buildPrivacyWeekChart(stats) {
  const chart = document.createElement('section');
  chart.className = 'privacy-week-chart';
  chart.dataset.privacyWeekChart = 'true';
  const title = document.createElement('span');
  title.className = 'privacy-week-title';
  title.textContent = 'Requests blocked · 7 days';
  chart.append(title);
  renderPrivacyWeekChart(chart, stats);
  return chart;
}

function renderPrivacyWeekChart(chart, stats) {
  const days = getPrivacyWeekData(stats);
  const peak = Math.max(1, ...days.map((day) => day.total));
  const total = days.reduce((sum, day) => sum + day.total, 0);
  chart.setAttribute('role', 'img');
  chart.setAttribute('aria-label', `Requests blocked over the last seven days: ${days.map((day) => `${day.label} ${day.total}`).join(', ')}. Total ${total}.`);
  chart.querySelector('.privacy-week-days')?.remove();
  const columns = document.createElement('div');
  columns.className = 'privacy-week-days';
  for (const day of days) {
    const column = document.createElement('div');
    column.className = 'privacy-week-day';
    const track = document.createElement('span');
    track.className = 'privacy-week-track';
    const fill = document.createElement('i');
    fill.style.setProperty('--activity-scale', String(day.total ? Math.max(.08, day.total / peak) : .035));
    track.append(fill);
    const label = document.createElement('time');
    label.dateTime = day.date;
    label.textContent = day.label;
    column.title = `${day.label}: ${day.total} requests blocked`;
    column.append(track, label);
    columns.append(column);
  }
  chart.append(columns);
}

function buildShortcut(entry, isCustom = false) {
  const tile = document.createElement('article');
  tile.className = 'start-shortcut';
  const shortcutId = isCustom ? entry.id : null;
  if (shortcutId) {
    tile.dataset.shortcutId = shortcutId;
    tile.draggable = true;
  }
  const open = document.createElement('button');
  open.className = 'start-shortcut-open';
  open.type = 'button';
  open.title = entry.url;
  open.setAttribute('aria-label', `${entry.title || entry.url}, ${entry.url}`);
  if (shortcutId) open.setAttribute('aria-keyshortcuts', 'Control+ArrowLeft Control+ArrowRight');
  const favicon = document.createElement('span');
  favicon.className = 'start-shortcut-icon';
  favicon.setAttribute('aria-hidden', 'true');
  favicon.textContent = (entry.title || entry.url).trim().slice(0, 1).toUpperCase();
  const shortcutColors = ['#28385d', '#264253', '#3d315c', '#3f3545', '#31503f', '#4a3830', '#29465a', '#34424d'];
  const shortcutHash = [...(entry.url || entry.title || '')].reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 7);
  favicon.style.setProperty('--shortcut-color', shortcutColors[shortcutHash % shortcutColors.length]);
  const label = document.createElement('span');
  label.className = 'start-shortcut-label';
  label.textContent = entry.title || entry.url;
  open.append(favicon, label);
  open.addEventListener('click', () => run(window.browser.navigate(entry.url)));
  tile.append(open);
  if (isCustom) {
    const actions = document.createElement('details');
    actions.className = 'start-shortcut-actions';
    const summary = document.createElement('summary');
    summary.textContent = '⋯';
    summary.setAttribute('aria-label', `More options for ${entry.title}`);
    const actionList = document.createElement('div');
    actionList.className = 'start-shortcut-action-list';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => {
      actions.open = false;
      openShortcutDialog(entry);
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove shortcut ${entry.title}`);
    remove.addEventListener('click', () => {
      const shortcuts = startPageValues().shortcuts.filter((shortcut) => shortcut.id !== entry.id);
      run(window.browser.updateStartPage({ shortcuts }));
    });
    actionList.append(edit, remove);
    actions.append(summary, actionList);
    tile.append(actions);
    tile.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/dino-shortcut-id', shortcutId);
      event.dataTransfer.effectAllowed = 'move';
      tile.classList.add('dragging');
    });
    tile.addEventListener('dragend', () => tile.classList.remove('dragging'));
    tile.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      tile.classList.add('drop-target');
    });
    tile.addEventListener('dragleave', () => tile.classList.remove('drop-target'));
    tile.addEventListener('drop', (event) => {
      event.preventDefault();
      tile.classList.remove('drop-target');
      const sourceId = event.dataTransfer.getData('text/dino-shortcut-id');
      if (!sourceId || sourceId === shortcutId) return;
      moveStartShortcut(sourceId, shortcutId);
    });
    open.addEventListener('keydown', (event) => {
      if (!event.ctrlKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const shortcuts = [...startPageValues().shortcuts];
      const index = shortcuts.findIndex((shortcut) => shortcut.id === shortcutId);
      const nextIndex = Math.max(0, Math.min(shortcuts.length - 1, index + (event.key === 'ArrowLeft' ? -1 : 1)));
      if (nextIndex === index) return;
      [shortcuts[index], shortcuts[nextIndex]] = [shortcuts[nextIndex], shortcuts[index]];
      run(window.browser.updateStartPage({ shortcuts }).then(() => showToast(`Moved ${entry.title || 'shortcut'}.`)));
    });
  }
  return tile;
}

function moveStartShortcut(sourceId, targetId) {
  const shortcuts = [...startPageValues().shortcuts];
  const sourceIndex = shortcuts.findIndex((shortcut) => shortcut.id === sourceId);
  const targetIndex = shortcuts.findIndex((shortcut) => shortcut.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
  const [moved] = shortcuts.splice(sourceIndex, 1);
  shortcuts.splice(targetIndex, 0, moved);
  run(window.browser.updateStartPage({ shortcuts }));
}

function makeShortcutDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'shortcut-dialog';
  const form = document.createElement('form');
  const heading = document.createElement('h2');
  heading.textContent = 'Add shortcut';
  const name = document.createElement('input');
  name.maxLength = 50;
  name.required = true;
  name.placeholder = 'Name';
  name.setAttribute('aria-label', 'Shortcut name');
  const url = document.createElement('input');
  url.type = 'url';
  url.required = true;
  url.placeholder = 'https://example.com';
  url.setAttribute('aria-label', 'Shortcut address');
  const actions = document.createElement('div');
  actions.className = 'shortcut-dialog-actions';
  const cancel = document.createElement('button');
  cancel.className = 'secondary-button';
  cancel.type = 'button';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => dialog.close());
  const save = document.createElement('button');
  save.className = 'primary-button';
  save.type = 'submit';
  save.textContent = 'Add';
  actions.append(cancel, save);
  form.append(heading, name, url, actions);
  dialog._shortcutForm = { heading, name, url, save };
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    let parsed;
    try { parsed = new URL(url.value); } catch {}
    if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) {
      showToast('Enter a valid HTTP or HTTPS address.');
      return;
    }
    const title = name.value.trim();
    if (!title) {
      showToast('Enter a name for this shortcut.');
      name.focus();
      return;
    }
    const editingId = dialog.dataset.editingShortcutId;
    if (!editingId && startPageValues().shortcuts.length >= 20) {
      showToast('You can save up to 20 custom shortcuts.');
      return;
    }
    const shortcuts = [...startPageValues().shortcuts];
    if (editingId) {
      const index = shortcuts.findIndex((shortcut) => shortcut.id === editingId);
      if (index < 0) {
        showToast('That shortcut is no longer available.');
        dialog.close();
        return;
      }
      shortcuts[index] = { ...shortcuts[index], title, url: parsed.href };
    } else {
      shortcuts.push({ id: `shortcut-${Date.now()}-${++shortcutSequence}`, title, url: parsed.href });
    }
    window.browser.updateStartPage({ shortcuts }).then(() => {
      dialog.close();
      showToast(editingId ? 'Shortcut updated.' : 'Shortcut added.');
    }, (error) => showToast(error.message || 'The shortcut could not be saved.'));
  });
  dialog.append(form);
  return dialog;
}

function openShortcutDialog(shortcut = null) {
  const dialog = document.querySelector('#shortcut-dialog');
  if (!dialog?._shortcutForm) return;
  const { heading, name, url, save } = dialog._shortcutForm;
  dialog.dataset.editingShortcutId = shortcut?.id || '';
  heading.textContent = shortcut ? 'Edit shortcut' : 'Add shortcut';
  name.value = shortcut?.title || '';
  url.value = shortcut?.url || '';
  save.textContent = shortcut ? 'Save' : 'Add';
  dialog.showModal();
}

function createWidgetCard(widget) {
  const card = document.createElement('article');
  const size = startPageValues().widgetSizes?.[widget.id] || 'm';
  card.className = `start-widget widget-${widget.id} widget-size-${size}`;
  card.dataset.widgetId = widget.id;
  const headingRow = document.createElement('header');
  headingRow.className = 'start-widget-heading';
  const heading = document.createElement('h2');
  heading.textContent = widget.name;
  const dragHandle = document.createElement('button');
  dragHandle.className = 'start-widget-drag';
  dragHandle.type = 'button';
  dragHandle.draggable = true;
  dragHandle.textContent = '⠿';
  dragHandle.title = 'Drag to reorder widget';
  dragHandle.setAttribute('aria-label', `Drag to reorder ${widget.name} widget`);
  dragHandle.setAttribute('aria-keyshortcuts', 'Control+ArrowUp Control+ArrowDown');
  dragHandle.addEventListener('keydown', (event) => {
    if (!event.ctrlKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const widgets = [...startPageValues().widgets];
    const index = widgets.indexOf(widget.id);
    const nextIndex = Math.max(0, Math.min(widgets.length - 1, index + (event.key === 'ArrowUp' ? -1 : 1)));
    if (index < 0 || nextIndex === index) return;
    const [moved] = widgets.splice(index, 1);
    widgets.splice(nextIndex, 0, moved);
    run(window.browser.updateStartPage({ widgets }).then(() => showToast(`Moved ${widget.name} widget.`)));
  });
  dragHandle.addEventListener('dragstart', (event) => {
    event.dataTransfer.setData('text/dino-widget-id', widget.id);
    event.dataTransfer.effectAllowed = 'move';
    card.classList.add('dragging');
  });
  dragHandle.addEventListener('dragend', () => card.classList.remove('dragging'));
  card.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    card.classList.add('drop-target');
  });
  card.addEventListener('dragleave', () => card.classList.remove('drop-target'));
  card.addEventListener('drop', (event) => {
    event.preventDefault();
    card.classList.remove('drop-target');
    const sourceId = event.dataTransfer.getData('text/dino-widget-id');
    if (!sourceId || sourceId === widget.id) return;
    moveStartWidget(sourceId, widget.id);
  });
  headingRow.append(heading, dragHandle);
  card.append(headingRow);
  if (widget.id === 'quote') {
    const quotes = [
      'The secret of getting ahead is getting started.',
      'Great things are done by a series of small things brought together.',
      'It always seems impossible until it is done.',
      'Simplicity boils down to two steps: identify the essential, eliminate the rest.',
    ];
    const day = Math.floor(Date.now() / 86400000);
    const quote = document.createElement('p');
    quote.textContent = `“${quotes[day % quotes.length]}”`;
    card.append(quote);
  } else if (widget.id === 'bookmarks' || widget.id === 'recent') {
    const entries = widget.id === 'bookmarks' ? library.bookmarks.slice(0, 5) : library.history.slice(0, 5);
    const list = document.createElement('ul');
    list.className = 'start-widget-list';
    for (const entry of entries) {
      const item = document.createElement('li');
      const link = document.createElement('button');
      link.type = 'button';
      link.textContent = entry.title || entry.url;
      link.title = entry.url;
      link.addEventListener('click', () => run(window.browser.navigate(entry.url)));
      item.append(link);
      list.append(item);
    }
    if (!entries.length) list.append(makeEmptyState(widget.id === 'bookmarks' ? 'No bookmarks yet.' : 'No recent pages yet.'));
    card.append(list);
  } else if (widget.id === 'todo') {
    const form = document.createElement('form');
    form.className = 'todo-form';
    const input = document.createElement('input');
    input.maxLength = 140;
    input.placeholder = 'Add a task';
    input.setAttribute('aria-label', 'New to-do item');
    const add = document.createElement('button');
    add.type = 'submit';
    add.textContent = 'Add';
    form.append(input, add);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      const todoItems = [...startPageValues().todoItems, { id: `todo-${Date.now()}-${++shortcutSequence}`, text, done: false }].slice(-50);
      run(window.browser.updateStartPage({ todoItems }).then((startPage) => {
        library.startPage = startPage;
        renderStartPageContent();
      }));
    });
    const list = document.createElement('ul');
    list.className = 'todo-list';
    for (const todo of startPageValues().todoItems) {
      const item = document.createElement('li');
      const toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.checked = todo.done;
      toggle.setAttribute('aria-label', `Complete ${todo.text}`);
      const text = document.createElement('span');
      text.textContent = todo.text;
      text.classList.toggle('todo-done', todo.done);
      item.classList.toggle('is-done', todo.done);
      toggle.addEventListener('change', () => {
        const todoItems = startPageValues().todoItems.map((saved) => saved.id === todo.id ? { ...saved, done: toggle.checked } : saved);
        text.classList.toggle('todo-done', toggle.checked);
        item.classList.toggle('is-done', toggle.checked);
        run(window.browser.updateStartPage({ todoItems }));
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'todo-remove';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Remove ${todo.text}`);
      remove.addEventListener('click', () => {
        const todoItems = startPageValues().todoItems.filter((saved) => saved.id !== todo.id);
        run(window.browser.updateStartPage({ todoItems }).then((startPage) => {
          library.startPage = startPage;
          renderStartPageContent();
        }));
      });
      item.append(toggle, text, remove);
      list.append(item);
    }
    if (!list.childElementCount) list.append(makeEmptyState('You’re all caught up. Add a task above when you need one.'));
    card.append(form, list);
  } else if (widget.id === 'notes') {
    const notesEditor = document.createElement('div');
    notesEditor.className = 'quick-notes-editor';
    const notes = document.createElement('textarea');
    notes.className = 'quick-notes';
    notes.maxLength = 5000;
    notes.value = startPageValues().notes;
    notes.placeholder = 'Write a note…';
    notes.setAttribute('aria-label', 'Quick notes');
    const saveStatus = document.createElement('span');
    saveStatus.className = 'quick-notes-status';
    saveStatus.setAttribute('role', 'status');
    saveStatus.setAttribute('aria-live', 'polite');
    saveStatus.textContent = 'Saved locally';
    notes.addEventListener('input', () => {
      window.clearTimeout(notesSaveTimer);
      const value = notes.value;
      saveStatus.textContent = 'Saving…';
      notesSaveTimer = window.setTimeout(() => {
        window.browser.updateStartPage({ notes: value }).then(
          () => { saveStatus.textContent = 'Saved locally'; },
          (error) => {
            saveStatus.textContent = 'Could not save';
            showToast(error.message || 'Your note could not be saved.');
          },
        );
      }, 500);
    });
    notes.addEventListener('blur', () => {
      window.clearTimeout(notesSaveTimer);
      window.browser.updateStartPage({ notes: notes.value }).then(
        () => { saveStatus.textContent = 'Saved locally'; },
        (error) => {
          saveStatus.textContent = 'Could not save';
          showToast(error.message || 'Your note could not be saved.');
        },
      );
    });
    notesEditor.append(notes, saveStatus);
    card.append(notesEditor);
  }
  return card;
}

function moveStartWidget(sourceId, targetId) {
  const widgets = [...startPageValues().widgets];
  const sourceIndex = widgets.indexOf(sourceId);
  const targetIndex = widgets.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
  const [moved] = widgets.splice(sourceIndex, 1);
  widgets.splice(targetIndex, 0, moved);
  run(window.browser.updateStartPage({ widgets }));
}

function renderStartPageContent(focusSearch = false) {
  const root = document.querySelector('#start-page');
  if (!root) return;
  const previousSearch = root.querySelector('.home-search-input');
  const previousSearchValue = previousSearch?.value || '';
  const shouldRefocusSearch = document.activeElement === previousSearch;
  const focusedShortcutId = document.activeElement?.closest('.start-shortcut')?.dataset.shortcutId;
  const focusedWidgetId = document.activeElement?.closest('.start-widget')?.dataset.widgetId;
  const playEntrance = !root.dataset.entrancePlayed
    && !document.body.classList.contains('reduce-motion')
    && !document.body.classList.contains('reduce-effects');
  root.dataset.entrancePlayed = 'true';
  bindStartPageParallax(root);
  const settings = startPageValues();
  root.dataset.wallpaper = settings.wallpaper;
  root.dataset.layout = settings.layout;
  updateTimeWallpaper(root);
  window.clearInterval(wallpaperTimer);
  if (settings.wallpaper === 'time') {
    wallpaperTimer = window.setInterval(() => updateTimeWallpaper(root), 60000);
  }
  applyStartPageVisualSettings(settings);
  let contentHost = root.querySelector('#start-content-layer');
  if (!contentHost) {
    contentHost = document.createElement('div');
    contentHost.id = 'start-content-layer';
    contentHost.className = 'start-content-layer';
    root.prepend(contentHost);
  }
  contentHost.replaceChildren();
  root.querySelector('.start-wallpaper')?.remove();
  if (settings.wallpaperUrl) {
    const wallpaper = document.createElement('img');
    wallpaper.className = 'start-wallpaper';
    wallpaper.alt = '';
    wallpaper.addEventListener('load', () => wallpaper.classList.add('is-loaded'), { once: true });
    wallpaper.src = settings.wallpaperUrl;
    wallpaper.addEventListener('error', () => wallpaper.remove(), { once: true });
    root.prepend(wallpaper);
  }
  const content = document.createElement('div');
  content.className = 'start-content';
  if (settings.showPrivacyStats) content.append(buildStartPageStats());
  const center = document.createElement('section');
  center.className = 'start-center';
  if (settings.showGreeting) {
    const greeting = document.createElement('p');
    greeting.className = 'start-greeting';
    const hour = new Date().getHours();
    const salutation = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    greeting.textContent = `${salutation}${settings.greetingName ? `, ${settings.greetingName}` : ''}`;
    center.append(greeting);
  }
  if (settings.showClock) {
    const clock = document.createElement('time');
    clock.id = 'start-clock';
    clock.className = 'start-clock';
    const date = document.createElement('span');
    date.id = 'start-date';
    date.className = 'start-date';
    center.append(clock, date);
  }
  const form = document.createElement('form');
  form.className = 'home-search';
  const engine = document.createElement('select');
  engine.className = 'home-search-engine';
  engine.setAttribute('aria-label', 'Search engine');
  for (const [value, label] of [['google', 'Google'], ['bing', 'Bing'], ['duckduckgo', 'DuckDuckGo']]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    engine.append(option);
  }
  engine.value = library.settings.searchEngine;
  engine.addEventListener('change', () => run(window.browser.updateSettings({ searchEngine: engine.value })));
  const search = document.createElement('input');
  search.className = 'home-search-input';
  search.type = 'search';
  search.autocomplete = 'off';
  search.placeholder = 'Search or type a URL';
  search.value = previousSearchValue;
  search.setAttribute('aria-label', 'Search or type a URL');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = search.value.trim();
    if (query) run(window.browser.navigate(query));
  });
  form.append(engine, search);
  center.append(form);
  content.append(center);

  if (settings.showShortcuts) {
    const shortcutSection = document.createElement('section');
    shortcutSection.className = 'start-shortcuts';
    shortcutSection.setAttribute('aria-label', 'Shortcuts');
    const customEntries = settings.shortcuts.map((shortcut) => ({ ...shortcut, custom: true }));
    const customUrls = new Set(settings.shortcuts.map((shortcut) => shortcut.url));
    const topSites = getStartPageTopSites()
      .filter((entry) => !customUrls.has(entry.url))
      .slice(0, Math.max(0, 10 - customEntries.length));
    for (const entry of [...customEntries, ...topSites]) shortcutSection.append(buildShortcut(entry, entry.custom));
    const add = document.createElement('button');
    add.className = 'start-shortcut-add';
    add.type = 'button';
    add.textContent = '+ Add shortcut';
    add.addEventListener('click', () => openShortcutDialog());
    shortcutSection.append(add);
    content.append(shortcutSection);
  }

  if (settings.layout === 'cards' && settings.widgets.length) {
    const widgets = document.createElement('section');
    widgets.className = 'start-widget-grid';
    widgets.setAttribute('aria-label', 'Start page widgets');
    for (const id of settings.widgets) {
      const definition = START_PAGE_WIDGET_MANIFEST.find((item) => item.id === id);
      if (definition) widgets.append(createWidgetCard(definition));
    }
    content.append(widgets);
  }
  contentHost.append(content);
  if (playEntrance) {
    const centerChildren = [...center.children];
    const entranceItems = [
      ...[...content.children].filter((child) => child !== center),
      ...centerChildren,
    ];
    entranceItems.forEach((item, index) => {
      item.classList.add('start-entrance-item');
      item.style.setProperty('--entrance-delay', `${Math.min(index * 38, 190)}ms`);
    });
    window.setTimeout(() => entranceItems.forEach((item) => item.classList.remove('start-entrance-item')), 500);
  }
  if (!root.querySelector('#shortcut-dialog')) root.append(makeShortcutDialog());
  updatePrivacyStats();
  syncStartPageControls();
  window.clearInterval(clockTimer);
  if (settings.showClock) {
    const updateClock = () => {
      const clock = document.querySelector('#start-clock');
      const date = document.querySelector('#start-date');
      if (!clock || !date) return;
      const now = new Date();
      clock.textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: !settings.use24Hour });
      date.textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    };
    updateClock();
    clockTimer = window.setInterval(updateClock, 1000);
  }
  const searchInput = root.querySelector('.home-search-input');
  if (
    searchInput
    && (focusSearch || shouldRefocusSearch)
    && !document.querySelector('#customize-drawer:not([hidden])')
  ) searchInput.focus();
  else if (focusedShortcutId) {
    root.querySelector(`[data-shortcut-id="${CSS.escape(focusedShortcutId)}"] .start-shortcut-open`)?.focus();
  } else if (focusedWidgetId) {
    root.querySelector(`.start-widget[data-widget-id="${CSS.escape(focusedWidgetId)}"] .start-widget-drag`)?.focus();
  }
}

function bindStartPageParallax(root) {
  if (root.dataset.parallaxBound) return;
  root.dataset.parallaxBound = 'true';
  root.addEventListener('pointermove', (event) => {
    if (document.body.classList.contains('reduce-motion') || document.body.classList.contains('reduce-effects')) return;
    const bounds = root.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / Math.max(1, bounds.width) - 0.5) * -16;
    const y = ((event.clientY - bounds.top) / Math.max(1, bounds.height) - 0.5) * -16;
    root.style.setProperty('--parallax-x', `${x.toFixed(1)}px`);
    root.style.setProperty('--parallax-y', `${y.toFixed(1)}px`);
  });
  root.addEventListener('pointerleave', () => {
    root.style.setProperty('--parallax-x', '0px');
    root.style.setProperty('--parallax-y', '0px');
  });
}

function updateTimeWallpaper(root) {
  if (root.dataset.wallpaper !== 'time') return;
  const hour = new Date().getHours();
  root.dataset.timeOfDay = hour < 11 ? 'morning' : hour < 17 ? 'day' : hour < 21 ? 'evening' : 'night';
}

function applyStartPageVisualSettings(settings) {
  const root = document.querySelector('#start-page');
  if (!root) return;
  root.style.setProperty('--wallpaper-dim', String(settings.wallpaperDim / 100));
  root.style.setProperty('--wallpaper-blur', `${settings.wallpaperBlur}px`);
  root.style.setProperty('--start-card-opacity', `${settings.cardOpacity}%`);
  root.style.setProperty('--start-card-opacity-hover', `${settings.cardOpacity + 5}%`);
}

function renderCustomizeDrawer() {
  const root = document.querySelector('#start-page');
  const customize = document.createElement('button');
  customize.className = 'start-customize-button';
  customize.type = 'button';
  customize.textContent = 'Customize';
  customize.setAttribute('aria-expanded', 'false');
  const backdrop = document.createElement('button');
  backdrop.className = 'customize-backdrop';
  backdrop.type = 'button';
  backdrop.setAttribute('aria-label', 'Close customize drawer');
  backdrop.hidden = true;
  const drawer = document.createElement('aside');
  drawer.id = 'customize-drawer';
  drawer.className = 'customize-drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-label', 'Customize start page');
  drawer.hidden = true;
  const close = document.createElement('button');
  close.className = 'customize-close';
  close.type = 'button';
  close.textContent = 'Done';
  close.addEventListener('click', () => closeCustomizeDrawer());
  const heading = document.createElement('h2');
  heading.textContent = 'Customize';
  drawer.append(close, heading);
  const backgroundTitle = document.createElement('h3');
  backgroundTitle.textContent = 'Background';
  const backgrounds = document.createElement('div');
  backgrounds.className = 'wallpaper-presets';
  const presetNames = [
    ['aurora', 'Aurora'], ['sunset', 'Sunset'], ['forest', 'Forest'], ['ocean', 'Ocean'], ['dune', 'Dune'], ['time', 'Time of day'],
  ];
  for (const [id, label] of presetNames) {
    const button = document.createElement('button');
    button.className = 'wallpaper-preset';
    button.type = 'button';
    button.dataset.wallpaper = id;
    button.dataset.startWallpaper = id;
    button.setAttribute('aria-label', `${label} background`);
    button.title = label;
    button.addEventListener('click', () => run(window.browser.updateStartPage({ wallpaper: id, wallpaperPath: null })));
    backgrounds.append(button);
  }
  const dim = makeStartRange('wallpaperDim', 'Background dim', 0, 65, '%', 'Darken the wallpaper to keep text readable.');
  addDrawerSetting(drawer, 'Background dim', 'Darken the wallpaper to keep text readable.', dim);
  const blur = makeStartRange('wallpaperBlur', 'Wallpaper blur', 0, 8, 'px', 'Blur stays off when Reduce effects is enabled.');
  blur.querySelector('input').disabled = Boolean(library.settings.reduceEffects);
  addDrawerSetting(drawer, 'Wallpaper blur', 'Soften the wallpaper behind the page content.', blur);
  const cardOpacity = makeStartRange('cardOpacity', 'Card opacity', 8, 45, '%', 'Adjust privacy and widget card surfaces.');
  addDrawerSetting(drawer, 'Card opacity', 'Adjust privacy and widget card surfaces.', cardOpacity);
  const customWallpaper = document.createElement('button');
  customWallpaper.className = 'secondary-button';
  customWallpaper.type = 'button';
  customWallpaper.textContent = 'Choose image…';
  customWallpaper.addEventListener('click', () => run(window.browser.pickWallpaper().then((result) => {
    if (result) showToast('Wallpaper updated.');
  })));
  drawer.append(backgroundTitle, backgrounds, customWallpaper);

  const savedTheme = library.settings.theme === 'dark' ? 'night'
    : library.settings.theme === 'light' ? 'daylight' : library.settings.theme;
  const theme = makeSelect(
    [['system', 'System'], ['daylight', 'Daylight'], ['night', 'Dino Night'], ['aurora', 'Aurora'], ['ember', 'Ember'], ['green', 'Dino Green'], ['high-contrast', 'High contrast']],
    savedTheme,
    (value) => window.browser.updateSettings({ theme: value }),
  );
  theme.dataset.startTheme = 'true';
  theme.setAttribute('aria-label', 'Start page color theme');
  addDrawerSetting(drawer, 'Theme', 'Apply a browser theme without leaving the start page.', theme);

  const layout = makeSelect([['clean', 'Clean'], ['cards', 'Cards']], startPageValues().layout, (value) => window.browser.updateStartPage({ layout: value }));
  layout.dataset.startKey = 'layout';
  addDrawerSetting(drawer, 'Layout', 'Choose a clean page or show widget cards.', layout);
  const name = document.createElement('input');
  name.className = 'greeting-name';
  name.maxLength = 40;
  name.value = startPageValues().greetingName;
  name.placeholder = 'Your name (optional)';
  name.setAttribute('aria-label', 'Greeting name');
  name.dataset.startKey = 'greetingName';
  name.addEventListener('change', () => run(window.browser.updateStartPage({ greetingName: name.value.trim() })));
  addDrawerSetting(drawer, 'Greeting', 'Use a name on your welcome line.', name);
  for (const [key, label] of [
    ['showGreeting', 'Show greeting'], ['showClock', 'Show clock and date'],
    ['use24Hour', 'Use 24-hour clock'], ['showPrivacyStats', 'Show privacy statistics'],
    ['showShortcuts', 'Show shortcut tiles'],
  ]) {
    const control = makeToggle(startPageValues()[key], label, (value) => run(window.browser.updateStartPage({ [key]: value })));
    control.dataset.startKey = key;
    addDrawerSetting(drawer, label, '', control);
  }
  const widgetHeading = document.createElement('h3');
  widgetHeading.textContent = 'Widgets';
  drawer.append(widgetHeading);
  const widgetGallery = document.createElement('div');
  widgetGallery.className = 'widget-gallery';
  for (const widget of START_PAGE_WIDGET_MANIFEST) {
    const row = document.createElement('div');
    row.className = 'widget-gallery-item';
    const copy = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = widget.name;
    const description = document.createElement('small');
    description.textContent = widget.description;
    copy.append(title, description);
    const toggle = makeToggle(startPageValues().widgets.includes(widget.id), `Show ${widget.name}`, (enabled) => {
      const widgets = startPageValues().widgets.filter((id) => id !== widget.id);
      if (enabled) widgets.push(widget.id);
      run(window.browser.updateStartPage({ widgets, layout: 'cards' }));
    });
    toggle.dataset.widgetId = widget.id;
    const size = makeSelect(
      [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']],
      startPageValues().widgetSizes?.[widget.id] || 'm',
      (value) => window.browser.updateStartPage({ widgetSizes: { ...startPageValues().widgetSizes, [widget.id]: value } }),
    );
    size.dataset.widgetSizeId = widget.id;
    size.setAttribute('aria-label', `${widget.name} widget size`);
    const controls = document.createElement('div');
    controls.className = 'widget-gallery-controls';
    controls.append(size, toggle);
    row.append(copy, controls);
    widgetGallery.append(row);
  }
  drawer.append(widgetGallery);
  const reset = document.createElement('button');
  reset.className = 'secondary-button start-reset';
  reset.type = 'button';
  reset.textContent = 'Reset start page';
  reset.addEventListener('click', () => {
    if (!window.confirm('Reset the start page and remove its custom shortcuts, tasks, and notes?')) return;
    run(window.browser.updateStartPage({
      wallpaper: 'aurora', wallpaperPath: null, layout: 'clean', greetingName: '',
      wallpaperDim: 18, wallpaperBlur: 0, cardOpacity: 13,
      showGreeting: true, showClock: true, use24Hour: false, showPrivacyStats: true,
      showShortcuts: true, widgets: [], widgetSizes: {}, shortcuts: [], todoItems: [], notes: '',
    }).then(() => showToast('Start page reset.')));
  });
  drawer.append(reset);
  customize.addEventListener('click', () => openCustomizeDrawer());
  backdrop.addEventListener('click', () => closeCustomizeDrawer());
  root.append(customize, backdrop, drawer);
  syncStartPageControls();
}

function addDrawerSetting(drawer, titleText, descriptionText, control) {
  const row = document.createElement('div');
  row.className = 'drawer-setting';
  const copy = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = titleText;
  copy.append(title);
  if (descriptionText) {
    const description = document.createElement('small');
    description.textContent = descriptionText;
    copy.append(description);
  }
  row.append(copy, control);
  drawer.append(row);
}

function syncStartPageControls() {
  const settings = startPageValues();
  const drawer = document.querySelector('#customize-drawer');
  if (!drawer) return;
  drawer.querySelectorAll('[data-start-key]').forEach((control) => {
    const value = settings[control.dataset.startKey];
    if (control.type === 'checkbox') control.checked = Boolean(value);
    else control.value = value;
    if (control.dataset.startKey === 'wallpaperBlur') control.disabled = Boolean(library.settings.reduceEffects);
  });
  drawer.querySelectorAll('[data-start-range-output]').forEach((output) => {
    const value = settings[output.dataset.startRangeOutput];
    output.value = `${value}${output.dataset.suffix || ''}`;
    output.textContent = output.value;
  });
  drawer.querySelectorAll('[data-widget-id]').forEach((control) => {
    control.checked = settings.widgets.includes(control.dataset.widgetId);
  });
  drawer.querySelectorAll('[data-widget-size-id]').forEach((control) => {
    control.value = settings.widgetSizes?.[control.dataset.widgetSizeId] || 'm';
  });
  drawer.querySelectorAll('[data-start-theme]').forEach((control) => {
    control.value = library.settings.theme === 'dark' ? 'night'
      : library.settings.theme === 'light' ? 'daylight' : library.settings.theme;
  });
  drawer.querySelectorAll('[data-start-wallpaper]').forEach((control) => {
    control.setAttribute('aria-pressed', String(settings.wallpaper === control.dataset.startWallpaper));
  });
}

function makeStartRange(key, label, min, max, suffix, description) {
  const wrapper = document.createElement('div');
  wrapper.className = 'start-range-control';
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = '1';
  input.value = String(startPageValues()[key]);
  input.dataset.startKey = key;
  input.setAttribute('aria-label', `${label}. ${description}`);
  const output = document.createElement('output');
  output.dataset.startRangeOutput = key;
  output.dataset.suffix = suffix;
  output.value = `${input.value}${suffix}`;
  output.textContent = output.value;
  input.addEventListener('input', () => {
    output.value = `${input.value}${suffix}`;
    output.textContent = output.value;
    applyStartPageVisualSettings({ ...startPageValues(), [key]: Number(input.value) });
  });
  input.addEventListener('change', () => {
    run(window.browser.updateStartPage({ [key]: Number(input.value) }));
  });
  wrapper.append(input, output);
  return wrapper;
}

function openCustomizeDrawer() {
  const drawer = document.querySelector('#customize-drawer');
  const backdrop = document.querySelector('.customize-backdrop');
  if (!drawer || !backdrop) return;
  drawer.hidden = false;
  backdrop.hidden = false;
  document.querySelector('.start-customize-button')?.setAttribute('aria-expanded', 'true');
  drawer.querySelector('.customize-close')?.focus();
}

function closeCustomizeDrawer() {
  const drawer = document.querySelector('#customize-drawer');
  const backdrop = document.querySelector('.customize-backdrop');
  if (!drawer || !backdrop) return;
  drawer.hidden = true;
  backdrop.hidden = true;
  document.querySelector('.start-customize-button')?.setAttribute('aria-expanded', 'false');
  document.querySelector('.start-customize-button')?.focus();
}

function updatePrivacyStats() {
  const stats = library.shieldsStats || { ads: 0, trackers: 0, custom: 0 };
  const totalBlocked = stats.ads + stats.trackers + stats.custom;
  const values = [
    totalBlocked.toLocaleString(),
    formatBytes(totalBlocked * 50 * 1024),
    formatSavedTime(totalBlocked * 100),
  ];
  internalPage.querySelectorAll('[data-privacy-stat]').forEach((element) => {
    element.textContent = values[Number(element.dataset.privacyStat)] || '';
  });
  internalPage.querySelectorAll('[data-privacy-week-chart]').forEach((chart) => renderPrivacyWeekChart(chart, stats));
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatSavedTime(milliseconds) {
  if (milliseconds < 1000) return `${milliseconds} ms`;
  if (milliseconds < 60000) return `${(milliseconds / 1000).toFixed(1)} sec`;
  return `${Math.round(milliseconds / 60000)} min`;
}

function getActiveSite() {
  const tab = browserState.tabs.find((candidate) => candidate.id === browserState.activeTabId);
  try {
    const parsed = new URL(tab?.url || '');
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return { tab, host: parsed.hostname.toLowerCase(), url: parsed.href };
  } catch {
    return null;
  }
}

function siteHasShieldException(host) {
  return (library.settings.shieldExceptions || []).some((domain) => (
    host === domain || host.endsWith(`.${domain}`)
  ));
}

function changeSiteShields(enabled, reportBreakage = false) {
  const site = getActiveSite();
  if (!site) return;
  const oldExceptions = library.settings.shieldExceptions || [];
  const shieldExceptions = enabled
    ? oldExceptions.filter((domain) => site.host !== domain && !site.host.endsWith(`.${domain}`))
    : [...new Set([...oldExceptions, site.host])];
  run(window.browser.updateSettings({ shieldExceptions }).then(() => {
    showToast(`${reportBreakage ? 'Reported site issue. ' : ''}Reloading ${site.host}…`);
    return window.browser.reload();
  }));
}

function addPopupToggle(container, label, key, checked) {
  const row = document.createElement('label');
  row.className = 'shield-popup-toggle';
  const text = document.createElement('span');
  text.textContent = label;
  const toggle = makeToggle(checked, label, (value) => {
    run(window.browser.updateSettings({ [key]: value }).then(() => window.browser.reload()));
  });
  row.append(text, toggle);
  container.append(row);
}

function renderShieldsPopup() {
  const advancedWasOpen = Boolean(shieldsPopup.querySelector('.shield-advanced')?.open);
  shieldsPopup.replaceChildren();
  const site = getActiveSite();
  if (!site) {
    shieldsPopup.append(makePageHeading('Shields', 'Open a website to see page protection details.'));
    return;
  }
  const tab = site.tab;
  const siteEnabled = library.settings.shieldsEnabled && !siteHasShieldException(site.host);
  const header = document.createElement('header');
  header.className = 'shields-popup-heading';
  const title = document.createElement('strong');
  title.textContent = site.host;
  const subtitle = document.createElement('span');
  subtitle.textContent = siteEnabled ? 'Shields are on for this site' : 'Shields are off for this site';
  header.append(title, subtitle);
  const toggle = document.createElement('button');
  toggle.className = `shield-primary-toggle${siteEnabled ? ' enabled' : ''}`;
  toggle.type = 'button';
  toggle.textContent = siteEnabled ? 'Shields on' : 'Shields off';
  toggle.setAttribute('aria-pressed', String(siteEnabled));
  toggle.disabled = !library.settings.shieldsEnabled;
  toggle.addEventListener('click', () => changeSiteShields(!siteEnabled));
  const blocked = document.createElement('div');
  blocked.className = 'shield-total';
  const count = document.createElement('strong');
  count.textContent = String(tab.shieldsBlockedCount || 0);
  const countLabel = document.createElement('span');
  countLabel.textContent = 'requests blocked on this page';
  blocked.append(count, countLabel);
  const advanced = document.createElement('details');
  advanced.className = 'shield-advanced';
  const summary = document.createElement('summary');
  summary.textContent = 'Advanced protections';
  const options = document.createElement('div');
  options.className = 'shield-advanced-options';
  addPopupToggle(options, 'Ads', 'adsBlocking', library.settings.adsBlocking);
  addPopupToggle(options, 'Trackers', 'trackersBlocking', library.settings.trackersBlocking);
  addPopupToggle(options, 'HTTPS-first', 'httpsFirst', library.settings.httpsFirst);
  addPopupToggle(options, 'URL cleaning', 'urlCleaning', library.settings.urlCleaning);
  const categoryCounts = tab.shieldsBlockedByCategory || {};
  const categoryLine = document.createElement('p');
  categoryLine.className = 'shield-category-counts';
  categoryLine.textContent = `Ads ${categoryCounts.ads || 0} · Trackers ${categoryCounts.trackers || 0} · Custom ${categoryCounts.custom || 0}`;
  const domainList = document.createElement('ul');
  domainList.className = 'shield-domain-list';
  for (const domain of tab.shieldsBlockedDomains || []) {
    const item = document.createElement('li');
    item.textContent = domain;
    domainList.append(item);
  }
  if (!domainList.childElementCount) {
    const item = document.createElement('li');
    item.textContent = 'No blocked requests recorded on this page.';
    domainList.append(item);
  }
  const broken = document.createElement('button');
  broken.className = 'secondary-button shield-report';
  broken.type = 'button';
  broken.textContent = 'Report a broken site · turn Shields off here';
  broken.addEventListener('click', () => changeSiteShields(false, true));
  options.append(categoryLine, domainList, broken);
  advanced.append(summary, options);
  advanced.open = advancedWasOpen;
  shieldsPopup.append(header, toggle, blocked, advanced);
}

function renderShieldsButton() {
  const site = getActiveSite();
  const tab = site?.tab;
  const count = tab?.shieldsBlockedCount || 0;
  shieldsCount.textContent = count > 99 ? '99+' : String(count);
  shieldsCount.hidden = !tab || count === 0;
  const enabled = Boolean(site && library.settings.shieldsEnabled && !siteHasShieldException(site.host));
  shieldsButton.classList.toggle('shields-off', !enabled);
  shieldsButton.setAttribute('aria-label', `Shields${enabled ? ' on' : ' off'}${count ? `, ${count} blocked` : ''}`);
  shieldsButton.title = enabled ? `Shields · ${count} blocked` : 'Shields off for this site';
  if (!shieldsPopup.hidden) renderShieldsPopup();
}

function renderHistoryPage() {
  internalPage.append(
    makePageHeading('History', 'Pages you have visited on this device.'),
  );
  const actions = document.createElement('div');
  actions.className = 'page-actions';
  const search = document.createElement('input');
  search.className = 'page-search';
  search.type = 'search';
  search.placeholder = 'Search history';
  search.setAttribute('aria-label', 'Search history');
  const clear = document.createElement('button');
  clear.className = 'secondary-button';
  clear.type = 'button';
  clear.textContent = 'Clear browsing data';
  clear.addEventListener('click', () => confirmClearData());
  actions.append(search, clear);

  const list = document.createElement('section');
  list.className = 'entry-list';
  const renderEntries = () => {
    list.replaceChildren();
    const query = search.value.trim().toLowerCase();
    const entries = library.history.filter((entry) => (
      entry.title.toLowerCase().includes(query) || entry.url.toLowerCase().includes(query)
    ));
    if (!entries.length) {
      list.append(makeEmptyState(query ? 'No matching pages.' : 'Your history is empty.'));
      return;
    }

    for (const entry of entries) {
      const row = document.createElement('article');
      row.className = 'entry-row';
      const open = document.createElement('button');
      open.className = 'entry-open';
      open.type = 'button';
      open.textContent = entry.title;
      open.addEventListener('click', () => run(window.browser.navigate(entry.url)));
      const details = document.createElement('p');
      details.className = 'entry-details';
      details.textContent = `${entry.url} · ${new Date(entry.visitedAt).toLocaleString()}`;
      row.append(open, details);
      list.append(row);
    }
  };
  search.addEventListener('input', renderEntries);
  renderEntries();
  internalPage.append(actions, list);
}

function renderBookmarksPage() {
  internalPage.append(
    makePageHeading('Bookmarks', 'Saved pages, ready when you are.'),
  );
  const list = document.createElement('section');
  list.className = 'entry-list';
  if (!library.bookmarks.length) {
    list.append(makeEmptyState('No bookmarks yet. Select the star beside the address bar to save a page.'));
  }
  for (const bookmark of library.bookmarks) {
    const row = document.createElement('article');
    row.className = 'entry-row bookmark-row';
    const open = document.createElement('button');
    open.className = 'entry-open';
    open.type = 'button';
    open.textContent = bookmark.title;
    open.addEventListener('click', () => run(window.browser.navigate(bookmark.url)));
    const details = document.createElement('p');
    details.className = 'entry-details';
    details.textContent = bookmark.url;
    const remove = document.createElement('button');
    remove.className = 'secondary-button remove-bookmark';
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => run(window.browser.removeBookmark(bookmark.id)));
    row.append(open, details, remove);
    list.append(row);
  }
  internalPage.append(list);
}

function addSetting(title, description, control, destination = settingsDestination || internalPage) {
  const row = document.createElement('section');
  row.className = 'setting-row';
  row.dataset.settingTitle = title;
  row.dataset.settingDescription = description;
  const copy = document.createElement('div');
  const label = document.createElement('h2');
  label.textContent = title;
  const detail = document.createElement('p');
  detail.textContent = description;
  copy.append(label, detail);
  row.append(copy);
  if (control) row.append(control);
  destination.append(row);
}

function makeSelect(options, value, onChange) {
  const select = document.createElement('select');
  select.className = 'setting-select';
  for (const [optionValue, label] of options) {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = label;
    select.append(option);
  }
  select.value = value;
  select.addEventListener('change', () => run(onChange(select.value)));
  return select;
}

function makeToggle(checked, label, onChange) {
  const toggle = document.createElement('input');
  toggle.className = 'setting-toggle';
  toggle.type = 'checkbox';
  toggle.checked = checked;
  toggle.setAttribute('aria-label', label);
  toggle.addEventListener('change', () => onChange(toggle.checked));
  return toggle;
}

function confirmClearData() {
  const dialog = document.createElement('dialog');
  dialog.className = 'shortcut-dialog clear-data-dialog';
  const form = document.createElement('form');
  form.method = 'dialog';
  const heading = document.createElement('h2');
  heading.textContent = 'Clear browsing data';
  const summary = document.createElement('p');
  summary.textContent = 'Bookmarks and saved browser settings will stay. The time range applies to history; selected website data and cache are cleared completely.';
  const rangeLabel = document.createElement('label');
  rangeLabel.textContent = 'Time range';
  const range = document.createElement('select');
  range.className = 'setting-select';
  for (const [value, label] of [['hour', 'Last hour'], ['day', 'Last 24 hours'], ['week', 'Last 7 days'], ['month', 'Last 30 days'], ['all', 'All time']]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    range.append(option);
  }
  rangeLabel.append(range);
  const options = document.createElement('div');
  options.className = 'clear-data-options';
  const checks = [];
  for (const [key, label] of [['history', 'Browsing history'], ['websiteData', 'Cookies and site data'], ['cache', 'Cached files and images']]) {
    const item = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.dataset.clearDataKey = key;
    item.append(checkbox, document.createTextNode(label));
    options.append(item);
    checks.push(checkbox);
  }
  const actions = document.createElement('div');
  actions.className = 'shortcut-dialog-actions';
  const cancel = document.createElement('button');
  cancel.className = 'secondary-button';
  cancel.type = 'button';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => dialog.close());
  const clear = document.createElement('button');
  clear.className = 'primary-button danger-button';
  clear.type = 'submit';
  clear.textContent = 'Clear data';
  actions.append(cancel, clear);
  form.append(heading, summary, rangeLabel, options, actions);
  dialog.append(form);
  document.body.append(dialog);
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const selected = Object.fromEntries(checks.map((checkbox) => [checkbox.dataset.clearDataKey, checkbox.checked]));
    if (!Object.values(selected).some(Boolean)) {
      showToast('Select at least one type of data to clear.');
      return;
    }
    clear.disabled = true;
    cancel.disabled = true;
    clear.textContent = 'Clearing…';
    run(window.browser.clearBrowsingData({ ...selected, timeRange: range.value }).then((cleared) => {
      if (cleared) showToast('Browsing data cleared.');
      dialog.close();
    }).catch((error) => {
      clear.disabled = false;
      cancel.disabled = false;
      clear.textContent = 'Clear data';
      showToast(error.message || 'Browsing data could not be cleared.');
    }));
  });
  dialog.showModal();
}

function saveSetting(patch) {
  return window.browser.updateSettings(patch).then((settings) => {
    showToast('Saved');
    return settings;
  });
}

function addUnavailableSetting(title, description) {
  const control = document.createElement('button');
  control.className = 'unsupported-control';
  control.type = 'button';
  control.textContent = 'Not available yet';
  control.disabled = true;
  addSetting(title, description, control);
}

function createSettingsSection(nav, content, id, title, description) {
  const section = document.createElement('section');
  section.className = 'settings-section';
  section.id = `settings-section-${id}`;
  section.dataset.settingsSection = id;
  const heading = document.createElement('h2');
  heading.textContent = title;
  const detail = document.createElement('p');
  detail.className = 'settings-section-description';
  detail.textContent = description;
  section.append(heading, detail);
  content.append(section);
  const navButton = document.createElement('button');
  navButton.className = 'settings-nav-link';
  navButton.type = 'button';
  navButton.textContent = title;
  navButton.setAttribute('aria-controls', section.id);
  navButton.setAttribute('aria-current', 'false');
  navButton.addEventListener('click', () => {
    nav.querySelectorAll('.settings-nav-link').forEach((button) => button.setAttribute('aria-current', String(button === navButton)));
    section.scrollIntoView({ behavior: document.body.classList.contains('reduce-motion') ? 'instant' : 'smooth', block: 'start' });
  });
  nav.append(navButton);
  return { section, navButton };
}

function setHighlightedText(element, source, terms) {
  element.replaceChildren();
  if (!terms.length) {
    element.textContent = source;
    return;
  }
  const pattern = new RegExp(`(${terms.map((term) => term.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')).join('|')})`, 'gi');
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    const index = match.index;
    if (index > cursor) element.append(document.createTextNode(source.slice(cursor, index)));
    const highlight = document.createElement('mark');
    highlight.textContent = match[0];
    element.append(highlight);
    cursor = index + match[0].length;
  }
  element.append(document.createTextNode(source.slice(cursor)));
}

function filterSettings(query, content, nav, noResults) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let matches = 0;
  for (const section of content.querySelectorAll('.settings-section')) {
    let sectionMatches = 0;
    for (const row of section.querySelectorAll('.setting-row')) {
      const title = row.dataset.settingTitle || '';
      const description = row.dataset.settingDescription || '';
      const normalized = `${title} ${description}`.toLowerCase();
      const visible = terms.every((term) => normalized.includes(term));
      row.hidden = !visible;
      if (visible) {
        sectionMatches += 1;
        setHighlightedText(row.querySelector('h2'), title, terms);
        setHighlightedText(row.querySelector('p'), description, terms);
      }
    }
    section.hidden = sectionMatches === 0;
    const navButton = nav.querySelector(`[aria-controls="${section.id}"]`);
    if (navButton) navButton.hidden = section.hidden;
    matches += sectionMatches;
  }
  noResults.hidden = matches > 0;
}

function renderSettingsPage() {
  internalPage.append(makePageHeading('Settings', 'Find and update browser preferences.'));
  const shell = document.createElement('div');
  shell.className = 'settings-shell';
  const sidebar = document.createElement('aside');
  sidebar.className = 'settings-sidebar';
  const search = document.createElement('input');
  search.className = 'settings-search';
  search.type = 'search';
  search.placeholder = 'Search settings';
  search.setAttribute('aria-label', 'Search all settings');
  const nav = document.createElement('nav');
  nav.className = 'settings-nav';
  nav.setAttribute('aria-label', 'Settings sections');
  sidebar.append(search, nav);
  const content = document.createElement('div');
  content.className = 'settings-content';
  const noResults = makeEmptyState('No settings match that search.');
  noResults.classList.add('settings-no-results');
  noResults.hidden = true;
  content.append(noResults);
  shell.append(sidebar, content);
  internalPage.append(shell);
  const previousDestination = settingsDestination;

  const section = (id, title, description) => {
    const result = createSettingsSection(nav, content, id, title, description);
    settingsDestination = result.section;
    return result.section;
  };
  const toggleSetting = (key, label, checked, description) => {
    const control = makeToggle(checked, label, (value) => run(saveSetting({ [key]: value })));
    control.dataset.settingKey = key;
    addSetting(label, description, control);
    return control;
  };
  const buttonSetting = (title, description, label, action, className = 'secondary-button') => {
    const button = document.createElement('button');
    button.className = className;
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', action);
    addSetting(title, description, button);
    return button;
  };

  section('get-started', 'Get started', 'Profile basics and local browser data import.');
  const profileName = document.createElement('input');
  profileName.className = 'profile-name-input';
  profileName.type = 'text';
  profileName.maxLength = 40;
  profileName.value = library.settings.profileName;
  profileName.setAttribute('aria-label', 'Profile name');
  profileName.dataset.settingKey = 'profileName';
  profileName.addEventListener('change', () => run(saveSetting({ profileName: profileName.value })));
  addSetting('Profile name', 'A local label for this browser profile.', profileName);
  addUnavailableSetting('Profile avatar', 'Custom profile images are not supported in this build.');
  buttonSetting(
    'Import bookmarks',
    'Import exported HTML bookmarks from Chrome, Edge, Firefox, or Safari, or a Chromium Bookmarks JSON file. History and passwords are not imported.',
    'Choose bookmarks file…',
    () => run(window.browser.importBookmarks().then((count) => showToast(count ? `Imported ${count} bookmarks.` : 'No new bookmarks imported.'))),
  );
  addUnavailableSetting('Default browser', 'Changing Windows default-app associations is not supported in this build.');
  const startupBehavior = makeSelect(
    [['home', 'Open start page'], ['continue', 'Continue where you left off']],
    library.settings.startupBehavior,
    (value) => saveSetting({ startupBehavior: value }),
  );
  startupBehavior.dataset.settingKey = 'startupBehavior';
  addSetting('Startup behavior', 'Choose whether to open the start page or restore your previous web tabs.', startupBehavior);

  section('appearance', 'Appearance', 'Set the browser frame and start page look.');
  const themePicker = document.createElement('div');
  themePicker.className = 'theme-picker';
  themePicker.dataset.settingKey = 'theme';
  themePicker.setAttribute('role', 'group');
  themePicker.setAttribute('aria-label', 'Color theme');
  const selectedTheme = library.settings.theme === 'light' ? 'daylight' : library.settings.theme === 'dark' ? 'night' : library.settings.theme;
  const themes = [
    ['system', 'System', 'Follow Windows appearance'],
    ['daylight', 'Daylight', 'A clear light palette'],
    ['night', 'Dino Night', 'A calm violet night palette'],
    ['aurora', 'Aurora', 'Teal and indigo'],
    ['ember', 'Ember', 'Warm coral and gold'],
    ['green', 'Dino Green', 'Fresh green accents'],
    ['high-contrast', 'High contrast', 'Strong black and white contrast'],
  ];
  for (const [value, label, description] of themes) {
    const button = document.createElement('button');
    button.className = `theme-card theme-card-${value}`;
    button.type = 'button';
    button.dataset.themeOption = value;
    button.setAttribute('aria-pressed', String(selectedTheme === value));
    button.setAttribute('aria-label', `${label}. ${description}`);
    const preview = document.createElement('span');
    preview.className = `theme-preview${value === 'system' ? ' theme-preview-system' : ` palette-${value === 'high-contrast' ? 'night' : value}`}`;
    preview.setAttribute('aria-hidden', 'true');
    const miniTabs = document.createElement('span');
    miniTabs.className = 'theme-preview-tabs';
    const miniToolbar = document.createElement('span');
    miniToolbar.className = 'theme-preview-toolbar';
    const miniPage = document.createElement('span');
    miniPage.className = 'theme-preview-page';
    const miniAccent = document.createElement('span');
    miniAccent.className = 'theme-preview-accent';
    miniPage.append(miniAccent);
    preview.append(miniTabs, miniToolbar, miniPage);
    const text = document.createElement('span');
    text.className = 'theme-card-label';
    text.textContent = label;
    button.append(preview, text);
    button.addEventListener('click', () => {
      run(saveSetting({ theme: value }));
    });
    themePicker.append(button);
  }
  addSetting('Color theme', 'Preview and apply a palette. System follows Windows light or dark mode.', themePicker);
  const density = makeSelect(
    [['comfortable', 'Comfortable'], ['compact', 'Compact']],
    library.settings.density,
    (value) => saveSetting({ density: value }),
  );
  density.dataset.settingKey = 'density';
  addSetting('Density', 'Choose a roomier toolbar or a compact browser frame.', density);
  const accentControl = document.createElement('div');
  accentControl.className = 'accent-control';
  const swatches = document.createElement('div');
  swatches.className = 'accent-swatches';
  for (const accent of ['#496fe8', '#6750a4', '#008577', '#c04b72', '#b26a00']) {
    const swatch = document.createElement('button');
    swatch.className = 'accent-swatch';
    swatch.type = 'button';
    swatch.style.setProperty('--swatch-color', accent);
    swatch.dataset.accentValue = accent;
    swatch.setAttribute('aria-label', `Set accent color ${accent}`);
    swatch.setAttribute('aria-pressed', String(library.settings.accentMode === 'custom' && library.settings.accent.toLowerCase() === accent));
    swatch.addEventListener('click', () => run(saveSetting({ accent, accentMode: 'custom' })));
    swatches.append(swatch);
  }
  const accentHex = document.createElement('input');
  accentHex.className = 'accent-hex';
  accentHex.type = 'text';
  accentHex.value = library.settings.accent;
  accentHex.maxLength = 7;
  accentHex.autocomplete = 'off';
  accentHex.spellcheck = false;
  accentHex.setAttribute('aria-label', 'Custom accent color in hexadecimal');
  accentHex.dataset.settingKey = 'accent';
  accentHex.addEventListener('change', () => {
    if (!/^#[0-9a-fA-F]{6}$/.test(accentHex.value)) {
      accentHex.setAttribute('aria-invalid', 'true');
      accentHex.value = library.settings.accent;
      showToast('Enter a color in #RRGGBB format.');
      return;
    }
    accentHex.removeAttribute('aria-invalid');
    run(saveSetting({ accent: accentHex.value, accentMode: 'custom' }));
  });
  const paletteAccent = document.createElement('button');
  paletteAccent.className = 'secondary-button theme-accent-reset';
  paletteAccent.type = 'button';
  paletteAccent.textContent = 'Use theme accent';
  paletteAccent.dataset.accentModeOption = 'theme';
  paletteAccent.setAttribute('aria-pressed', String(library.settings.accentMode === 'theme'));
  paletteAccent.addEventListener('click', () => run(saveSetting({ accentMode: 'theme' })));
  const wallpaperAccent = document.createElement('button');
  wallpaperAccent.className = 'secondary-button theme-accent-reset';
  wallpaperAccent.type = 'button';
  wallpaperAccent.textContent = 'Use wallpaper color';
  wallpaperAccent.dataset.accentModeOption = 'wallpaper';
  wallpaperAccent.setAttribute('aria-pressed', String(library.settings.accentMode === 'wallpaper'));
  wallpaperAccent.addEventListener('click', () => run(setWallpaperAccentMode()));
  accentControl.append(swatches, accentHex, paletteAccent, wallpaperAccent);
  addSetting('Accent color', 'Choose a custom accent, use the theme default, or sample your local wallpaper.', accentControl);
  toggleSetting('ambient', 'Ambient glow', library.settings.ambient, 'Show a soft animated color glow around the toolbar.');
  toggleSetting('reduceEffects', 'Reduce effects', library.settings.reduceEffects, 'Turn off blur, glow, and heavy shadows.');
  const roundness = makeSelect(
    [['sharp', 'Sharp'], ['default', 'Default'], ['round', 'Round']],
    library.settings.roundness,
    (value) => saveSetting({ roundness: value }),
  );
  roundness.dataset.settingKey = 'roundness';
  addSetting('Corner roundness', 'Adjust the shape of controls and cards.', roundness);
  toggleSetting('showBookmarksBar', 'Bookmarks bar', library.settings.showBookmarksBar, 'Show or hide the bookmarks bar below the toolbar.');
  buttonSetting('Start page', 'Choose wallpaper, shortcuts, and local widgets.', 'Open start page', () => run(window.browser.openInternal('home')));
  addUnavailableSetting('Tab strip and toolbar buttons', 'Vertical tabs and button visibility are not implemented yet.');

  section('privacy', 'Privacy and security', 'Control local data and Shields.');
  buttonSetting('Shields', 'Manage request blocking, exceptions, and local counters.', 'Open Shields settings', () => run(window.browser.openInternal('shields')));
  addSetting('Website data', 'Website cookies and storage are temporary for this browser session. Passwords are not saved.');
  buttonSetting('Clear browsing data', 'Remove saved history, cookies, website storage, and cache.', 'Clear browsing data…', () => confirmClearData(), 'danger-button');
  addUnavailableSetting('Site permissions and certificates', 'Camera, microphone, location, per-site permissions, and certificate management are not configured in this build.');
  addUnavailableSetting('Do Not Track and Global Privacy Control', 'These request signals are not sent by this build.');
  addUnavailableSetting('DNS over HTTPS, WebRTC policy, Safe Browsing', 'These network and reputation controls are not configured in this Electron shell.');

  section('search-engine', 'Search engine', 'Choose the engine used for searches from the address bar and start page.');
  const searchEngine = makeSelect(
    [['google', 'Google'], ['bing', 'Bing'], ['duckduckgo', 'DuckDuckGo']],
    library.settings.searchEngine,
    (value) => saveSetting({ searchEngine: value }),
  );
  searchEngine.dataset.settingKey = 'searchEngine';
  addSetting('Default search engine', 'Used when you enter words instead of a website address.', searchEngine);
  addUnavailableSetting('Search suggestions and private search', 'Suggestions are not fetched; private windows and separate private search settings are not implemented.');

  section('extensions', 'Extensions', 'Manage experimental local unpacked extensions.');
  buttonSetting('Extensions manager', 'Load unpacked folders and review extension permissions. Electron supports only a subset of Chrome extension APIs.', 'Manage extensions', () => run(window.browser.openInternal('extensions')));
  addUnavailableSetting('Extension keyboard shortcuts', 'The browser does not provide an editor for extension commands.');

  section('autofill-passwords', 'Autofill and passwords', 'Manage form data and credentials.');
  addSetting('Passwords', 'This browser does not save passwords. Password CSV files are not accepted or stored.');
  addUnavailableSetting('Addresses and payment methods', 'Autofill data and payment information are not stored by this build.');

  section('languages', 'Languages', 'Language tools for page content.');
  addUnavailableSetting('Preferred languages', 'The browser UI is currently English-only.');
  addUnavailableSetting('Spell check and translation', 'Spell-check dictionaries and page translation are not integrated.');

  section('downloads', 'Downloads', 'Download handling and saved files.');
  addUnavailableSetting('Download location and prompts', 'Download management, save-location prompts, and open-after-download rules are not implemented.');

  section('accessibility', 'Accessibility', 'Motion and keyboard visibility.');
  toggleSetting('reduceMotion', 'Reduce motion', library.settings.reduceMotion, 'Reduce browser UI animation. Motion is also reduced when Windows requests it.');
  toggleSetting('highContrast', 'High contrast', library.settings.highContrast, 'Use strong text and control contrast for the browser interface.');
  addSetting('Keyboard focus', 'Browser controls keep a visible focus ring. Caret browsing is not available.');

  section('system', 'System', 'Engine and operating-system integration.');
  addUnavailableSetting('Background running and battery saver', 'The browser runs only while its window is open. Battery-aware throttling is not configured.');
  addUnavailableSetting('Hardware acceleration, proxy, and memory saver', 'These controls require Electron launch and session integration that this build does not provide.');

  section('reset', 'Reset settings', 'Restore browser preferences or clear local browsing data.');
  buttonSetting('Restore default settings', 'Reset appearance, search, profile label, and Shields preferences. Bookmarks and start-page data stay.', 'Reset settings', () => {
    if (!window.confirm('Restore the browser settings to their defaults? Bookmarks and start-page data will stay.')) return;
    run(window.browser.resetSettings().then(() => showToast('Settings reset.')));
  }, 'danger-button');
  buttonSetting('Clear browsing data', 'Clear saved history and the temporary website session.', 'Clear browsing data…', () => confirmClearData(), 'danger-button');

  section('about', 'About', 'Version and open-source components.');
  const about = document.createElement('p');
  about.className = 'about-version';
  about.textContent = 'Loading version information…';
  settingsDestination.append(about);
  window.browser.getAbout().then((info) => {
    about.textContent = `Chromium Browser ${info.version} · Electron ${info.electron} · Chromium ${info.chromium}`;
  }).catch(() => {
    about.textContent = 'Version information is not available.';
  });
  addSetting('Updates', 'This build has no browser updater. Install a newer signed release when one is available.');
  addSetting('Open-source credits', 'Built with Electron and Chromium. See the Electron and Chromium license notices in the installed application.');

  settingsDestination = previousDestination;
  const firstNav = nav.querySelector('.settings-nav-link');
  firstNav?.setAttribute('aria-current', 'true');
  search.addEventListener('input', () => filterSettings(search.value, content, nav, noResults));
}

function renderShieldsSettingsPage() {
  internalPage.append(makePageHeading('Shields', 'Manage local ad and tracker blocking for this browser.'));
  const mode = makeSelect(
    [['standard', 'Standard'], ['off', 'Off']],
    library.settings.shieldsEnabled ? 'standard' : 'off',
    (value) => window.browser.updateSettings({ shieldsEnabled: value === 'standard' }),
  );
  addSetting('Default mode', 'Standard blocks the bundled ad and tracker host rules. Off disables request blocking.', mode);
  addSetting('Ads', 'Block requests matching bundled ad domains.', makeToggle(
    library.settings.adsBlocking,
    'Block ads',
    (adsBlocking) => run(window.browser.updateSettings({ adsBlocking })),
  ));
  addSetting('Trackers', 'Block requests matching bundled analytics and tracker domains.', makeToggle(
    library.settings.trackersBlocking,
    'Block trackers',
    (trackersBlocking) => run(window.browser.updateSettings({ trackersBlocking })),
  ));
  addSetting('HTTPS-first', 'Upgrade typed HTTP addresses when possible; certificate failures stay blocked.', makeToggle(
    library.settings.httpsFirst,
    'Enable HTTPS-first',
    (httpsFirst) => run(window.browser.updateSettings({ httpsFirst })),
  ));
  addSetting('URL cleaning', 'Remove common tracking parameters from typed addresses before opening them.', makeToggle(
    library.settings.urlCleaning,
    'Enable URL cleaning',
    (urlCleaning) => run(window.browser.updateSettings({ urlCleaning })),
  ));

  internalPage.append(makePageHeading('Filter rules', 'Bundled rules work offline. This build does not download filter lists.'));
  const bundled = document.createElement('section');
  bundled.className = 'shields-list-card';
  const bundledTitle = document.createElement('strong');
  bundledTitle.textContent = 'Browser starter rules';
  const bundledDescription = document.createElement('p');
  bundledDescription.textContent = '14 bundled ad and tracker domains · always available · no update check';
  bundled.append(bundledTitle, bundledDescription);
  internalPage.append(bundled);

  const customTitle = document.createElement('h2');
  customTitle.className = 'shields-section-title';
  customTitle.textContent = 'Custom host rules';
  const customHelp = document.createElement('p');
  customHelp.className = 'shields-help';
  customHelp.textContent = 'One hostname per line, for example ads.example.com. Adblock Plus filter syntax is not supported.';
  const customRules = document.createElement('textarea');
  customRules.className = 'custom-host-rules';
  customRules.value = (library.settings.customBlockedHosts || []).join('\n');
  customRules.setAttribute('aria-label', 'Custom blocked host names, one per line');
  const saveRules = document.createElement('button');
  saveRules.className = 'secondary-button';
  saveRules.type = 'button';
  saveRules.textContent = 'Save custom rules';
  saveRules.addEventListener('click', () => {
    const customBlockedHosts = [...new Set(customRules.value.split(/\r?\n/).map((host) => host.trim()).filter(Boolean))];
    run(window.browser.updateSettings({ customBlockedHosts }).then(() => showToast('Custom host rules saved.')));
  });
  internalPage.append(customTitle, customHelp, customRules, saveRules);

  internalPage.append(makePageHeading('Site exceptions', 'Shields stay off for these hosts until you remove them.'));
  const exceptions = document.createElement('section');
  exceptions.className = 'entry-list';
  for (const host of library.settings.shieldExceptions || []) {
    const row = document.createElement('article');
    row.className = 'entry-row shields-exception-row';
    const name = document.createElement('span');
    name.textContent = host;
    const remove = document.createElement('button');
    remove.className = 'secondary-button';
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      const shieldExceptions = library.settings.shieldExceptions.filter((entry) => entry !== host);
      run(window.browser.updateSettings({ shieldExceptions }));
    });
    row.append(name, remove);
    exceptions.append(row);
  }
  if (!exceptions.childElementCount) exceptions.append(makeEmptyState('No site exceptions.'));
  internalPage.append(exceptions);

  const reset = document.createElement('button');
  reset.className = 'danger-button';
  reset.type = 'button';
  reset.textContent = 'Reset Shields settings';
  reset.addEventListener('click', () => {
    if (!window.confirm('Reset Shields settings and remove custom rules and site exceptions?')) return;
    run(window.browser.updateSettings({
      shieldsEnabled: true,
      adsBlocking: true,
      trackersBlocking: true,
      httpsFirst: true,
      urlCleaning: true,
      shieldExceptions: [],
      customBlockedHosts: [],
    }).then(() => showToast('Shields settings reset.')));
  });
  internalPage.append(reset);
}

function renderInternalPage(page) {
  if (page !== 'home') window.clearInterval(clockTimer);
  internalPage.replaceChildren();
  internalPage.classList.toggle('home-page', page === 'home');
  if (page === 'home') renderHomePage();
  else if (page === 'history') renderHistoryPage();
  else if (page === 'bookmarks') renderBookmarksPage();
  else if (page === 'settings') renderSettingsPage();
  else if (page === 'shields') renderShieldsSettingsPage();
  else if (page === 'extensions') renderExtensionsPage();
  else if (page === 'tab-search') renderTabSearchPage();
  else if (page === 'downloads') renderDownloadsPage();
  else if (page === 'error') renderErrorPage(browserState.error);
}

function renderTabSearchPage() {
  const previousSearch = internalPage.querySelector('.tab-search-input');
  const previousQuery = previousSearch?.value || '';
  const restoreSearchFocus = document.activeElement === previousSearch;
  tabSearchSignature = getTabSearchSignature();
  internalPage.append(makePageHeading('Search tabs', 'Find an open tab or restore a recently closed one.'));
  const search = document.createElement('input');
  search.className = 'page-search tab-search-input';
  search.type = 'search';
  search.value = previousQuery;
  search.placeholder = 'Search open tabs';
  search.setAttribute('aria-label', 'Search open tabs');
  internalPage.append(search);
  const list = document.createElement('section');
  list.className = 'entry-list tab-search-list';
  const closedTitle = document.createElement('h2');
  closedTitle.className = 'shields-section-title';
  closedTitle.textContent = 'Recently closed';
  const closed = document.createElement('section');
  closed.className = 'entry-list';
  for (const tab of browserState.recentlyClosedTabs || []) {
    const row = document.createElement('article');
    row.className = 'entry-row';
    const title = document.createElement('strong');
    title.textContent = tab.title || tab.url;
    const restore = document.createElement('button');
    restore.className = 'secondary-button';
    restore.type = 'button';
    restore.textContent = 'Restore';
    restore.addEventListener('click', () => run(window.browser.restoreClosedTab()));
    row.append(title, restore);
    closed.append(row);
  }
  if (!closed.childElementCount) closed.append(makeEmptyState('No recently closed tabs.'));
  internalPage.append(list, closedTitle, closed);
  const renderMatches = () => {
    list.replaceChildren();
    const query = search.value.trim().toLowerCase();
    const matches = browserState.tabs.filter((tab) => tab.id !== browserState.activeTabId
      && `${tab.title} ${tab.url}`.toLowerCase().includes(query));
    for (const tab of matches) {
      const row = document.createElement('article');
      row.className = 'entry-row';
      const open = document.createElement('button');
      open.className = 'entry-open';
      open.type = 'button';
      open.textContent = tab.title || tab.url || 'New tab';
      open.setAttribute('aria-label', `Switch to ${tab.title || tab.url || 'New tab'}`);
      open.addEventListener('click', () => run(window.browser.switchTab(tab.id)));
      const details = document.createElement('p');
      details.className = 'entry-details';
      details.textContent = tab.url || 'Start page';
      row.append(open, details);
      list.append(row);
    }
    if (!list.childElementCount) list.append(makeEmptyState('No other tabs match.'));
  };
  search.addEventListener('input', renderMatches);
  renderMatches();
  if (restoreSearchFocus || !previousSearch) search.focus();
}

function renderDownloadsPage() {
  internalPage.append(makePageHeading('Downloads', 'Download controls are not implemented in this build.'));
  internalPage.append(makeEmptyState('Downloads will appear here when download management is added.'));
}

function renderExtensionsPage() {
  internalPage.append(makePageHeading('Extensions', 'Load and manage unpacked browser extensions.'));
  const notice = document.createElement('section');
  notice.className = 'extension-notice';
  notice.textContent = 'Experimental support: this Electron browser loads local unpacked folders only. Chrome Web Store installs, CRX files, extension action popups, and some Chrome APIs are not supported. An extension can read or change sites named in its permissions.';
  internalPage.append(notice);

  if (library.extensionSupportRestartRequired) {
    const restartPanel = document.createElement('section');
    restartPanel.className = 'extension-restart-panel';
    const detail = document.createElement('p');
    detail.textContent = library.settings.extensionSupportEnabled
      ? 'Extension support is ready to start. Restart to switch this profile to its extension-enabled session.'
      : 'Extension support has been disabled and its saved site data cleared. Restart to return to a temporary website session.';
    const restart = document.createElement('button');
    restart.className = 'primary-button';
    restart.type = 'button';
    restart.textContent = 'Restart browser';
    restart.addEventListener('click', () => run(window.browser.restart()));
    restartPanel.append(detail, restart);
    internalPage.append(restartPanel);
  }

  const actions = document.createElement('div');
  actions.className = 'extension-actions';
  const load = document.createElement('button');
  load.className = 'primary-button';
  load.type = 'button';
  load.textContent = 'Load unpacked extension…';
  load.disabled = Boolean(library.extensionSupportRestartRequired);
  load.addEventListener('click', () => run(window.browser.inspectExtension().then((details) => {
    if (details) showExtensionInstallDialog(details);
  })));
  actions.append(load);
  internalPage.append(actions);

  const extensionList = document.createElement('div');
  extensionList.className = 'extension-list';
  for (const extension of library.extensions || []) {
    const card = document.createElement('article');
    card.className = 'extension-card';
    const info = document.createElement('div');
    info.className = 'extension-card-info';
    const title = document.createElement('h2');
    title.textContent = extension.name;
    const version = document.createElement('p');
    version.textContent = `Version ${extension.version} · Manifest V${extension.manifestVersion}`;
    const status = document.createElement('p');
    status.className = `extension-status status-${extension.status}`;
    status.textContent = extension.status === 'active' ? 'Enabled'
      : extension.status === 'disabled' ? 'Disabled'
        : extension.status === 'restart-required' ? 'Restart required'
          : extension.runtimeError || 'Could not load';
    info.append(title, version, status);
    const permissions = document.createElement('details');
    permissions.className = 'extension-permissions';
    const summary = document.createElement('summary');
    summary.textContent = 'Permissions';
    const permissionText = document.createElement('p');
    const permissionList = [...extension.permissions, ...extension.hostPermissions];
    permissionText.textContent = permissionList.length ? permissionList.join(', ') : 'No manifest permissions requested.';
    permissions.append(summary, permissionText);
    info.append(permissions);

    const controls = document.createElement('div');
    controls.className = 'extension-card-controls';
    const enabled = document.createElement('input');
    enabled.type = 'checkbox';
    enabled.className = 'setting-toggle';
    enabled.checked = extension.enabled;
    enabled.disabled = extension.status === 'restart-required';
    enabled.setAttribute('aria-label', `Enable ${extension.name}`);
    enabled.addEventListener('change', () => run(window.browser.setExtensionEnabled(extension.key, enabled.checked)));
    const remove = document.createElement('button');
    remove.className = 'danger-button';
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      if (!window.confirm(`Remove ${extension.name} from this browser?`)) return;
      run(window.browser.removeExtension(extension.key));
    });
    remove.disabled = extension.status === 'restart-required';
    controls.append(enabled, remove);
    card.append(info, controls);
    extensionList.append(card);
  }
  if (!extensionList.childElementCount) extensionList.append(makeEmptyState('No extensions installed.'));
  internalPage.append(extensionList);

  if (library.settings.extensionSupportEnabled && !library.extensionSupportRestartRequired) {
    const disable = document.createElement('button');
    disable.className = 'danger-button extension-disable';
    disable.type = 'button';
    disable.textContent = 'Disable extension support';
    disable.addEventListener('click', () => {
      if (!window.confirm('Disable extension support, remove installed extensions, and clear cookies, site data, extension data, and cache from the persistent extension profile? The browser will return to a temporary website session after restart.')) return;
      run(window.browser.disableExtensionSupport().then(() => showToast('Extension support disabled. Restart the browser to finish.')));
    });
    internalPage.append(disable);
  }
}

function showExtensionInstallDialog(extension) {
  const dialog = document.createElement('dialog');
  dialog.className = 'shortcut-dialog extension-install-dialog';
  const form = document.createElement('form');
  form.method = 'dialog';
  const heading = document.createElement('h2');
  heading.textContent = `Install ${extension.name}?`;
  const detail = document.createElement('p');
  detail.textContent = `Version ${extension.version} · Manifest V${extension.manifestVersion}. Extension code runs in this browser profile. Install only software you trust.`;
  const permissionHeading = document.createElement('strong');
  permissionHeading.textContent = 'Requested permissions';
  const permissionList = document.createElement('ul');
  const requested = [...extension.permissions, ...extension.hostPermissions];
  for (const permission of (requested.length ? requested : ['No manifest permissions requested'])) {
    const item = document.createElement('li');
    item.textContent = permission;
    permissionList.append(item);
  }
  const actions = document.createElement('div');
  actions.className = 'shortcut-dialog-actions';
  const cancel = document.createElement('button');
  cancel.className = 'secondary-button';
  cancel.type = 'button';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => dialog.close());
  const install = document.createElement('button');
  install.className = 'primary-button';
  install.type = 'submit';
  install.textContent = 'Add extension';
  actions.append(cancel, install);
  form.append(heading, detail, permissionHeading, permissionList);
  if (!library.settings.extensionSupportEnabled) {
    const privacy = document.createElement('p');
    privacy.className = 'extension-persistence-note';
    privacy.textContent = 'Enabling extensions requires a persistent browser session. If you continue, cookies and website data will be kept between launches. You can disable extension support later to clear that profile and return to temporary website storage.';
    form.append(privacy);
  }
  form.append(actions);
  dialog.append(form);
  document.body.append(dialog);
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    install.disabled = true;
    cancel.disabled = true;
    install.textContent = 'Adding…';
    run(window.browser.installExtension(extension.ticket).then((result) => {
      dialog.close();
      showToast(result.restartRequired ? 'Extension added. Restart the browser to enable it.' : 'Extension added.');
    }).catch((error) => {
      install.disabled = false;
      cancel.disabled = false;
      install.textContent = 'Add extension';
      showToast(error.message || 'The extension could not be installed.');
    }));
  });
  dialog.showModal();
}

function renderExtensionsPopup() {
  extensionsPopup.replaceChildren();
  const heading = document.createElement('h2');
  heading.textContent = 'Extensions';
  extensionsPopup.append(heading);
  const installed = (library.extensions || []).filter((extension) => extension.enabled);
  if (!installed.length) {
    const empty = document.createElement('p');
    empty.className = 'extension-popup-empty';
    empty.textContent = 'No enabled extensions.';
    extensionsPopup.append(empty);
  }
  for (const extension of installed) {
    const row = document.createElement('div');
    row.className = 'extension-popup-row';
    const name = document.createElement('span');
    name.textContent = extension.name;
    const state = document.createElement('small');
    state.textContent = extension.status === 'active' ? 'Enabled' : 'Needs attention';
    row.append(name, state);
    extensionsPopup.append(row);
  }
  const manage = document.createElement('button');
  manage.className = 'secondary-button';
  manage.type = 'button';
  manage.textContent = 'Manage extensions';
  manage.addEventListener('click', () => {
    extensionsPopup.hidden = true;
    extensionsButton.setAttribute('aria-expanded', 'false');
    run(window.browser.openInternal('extensions'));
  });
  extensionsPopup.append(manage);
}

function renderErrorPage(error) {
  const page = document.createElement('section');
  page.className = 'error-page';
  const badge = document.createElement('div');
  badge.className = 'error-mark';
  badge.setAttribute('aria-hidden', 'true');
  badge.textContent = '!';
  const title = document.createElement('h1');
  title.textContent = error?.title || 'This page can’t be reached';
  const description = document.createElement('p');
  description.textContent = error?.description || 'The page could not be opened.';
  const actions = document.createElement('div');
  actions.className = 'error-actions';
  const retry = document.createElement('button');
  retry.className = 'primary-button';
  retry.type = 'button';
  retry.textContent = 'Reload';
  retry.addEventListener('click', () => run(window.browser.reload()));
  actions.append(retry);

  const details = document.createElement('details');
  details.className = 'error-details';
  const summary = document.createElement('summary');
  summary.textContent = 'Technical details';
  const code = document.createElement('code');
  code.textContent = error?.code || 'Unknown navigation error';
  details.append(summary, code);
  page.append(badge, title, description, actions, details);
  if (error?.canUseHttpFallback) {
    const fallback = document.createElement('button');
    fallback.className = 'secondary-button insecure-fallback';
    fallback.type = 'button';
    fallback.textContent = 'Open over HTTP (not secure)';
    fallback.addEventListener('click', () => run(window.browser.openHttpFallback()));
    page.append(fallback);
  }
  internalPage.append(page);
}

function renderWindowControls() {
  const maximize = document.querySelector('#window-maximize');
  setIcon(maximize, browserState.isMaximized ? 'restore' : 'maximize');
  maximize.setAttribute(
    'aria-label',
    browserState.isMaximized ? 'Restore window' : 'Maximize window',
  );
}

function renderState(state) {
  const previousInternalPage = browserState.internalPage;
  const previousError = browserState.error;
  browserState = state;
  if (state.internalPage !== 'home') {
    window.clearInterval(clockTimer);
    window.clearInterval(wallpaperTimer);
  }
  document.body.classList.toggle('fullscreen', Boolean(state.isFullScreen));
  renderTabs();
  renderShieldsButton();
  const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId);
  if (activeTab && document.activeElement !== addressInput) {
    addressInput.value = activeTab.url;
  }
  backButton.disabled = !state.canGoBack;
  forwardButton.disabled = !state.canGoForward;
  backButton.title = 'Back · Alt+Left';
  backButton.setAttribute('aria-label', 'Go back');
  backButton.setAttribute('aria-keyshortcuts', 'Alt+ArrowLeft');
  forwardButton.title = 'Forward · Alt+Right';
  forwardButton.setAttribute('aria-label', 'Go forward');
  forwardButton.setAttribute('aria-keyshortcuts', 'Alt+ArrowRight');
  const reloadButton = document.querySelector('#reload');
  const canStop = Boolean(activeTab?.isLoading && !activeTab.internalPage);
  setIcon(reloadButton, canStop ? 'stop' : 'reload');
  reloadButton.title = canStop ? 'Stop loading · Esc' : 'Reload page · F5 or Ctrl+R';
  reloadButton.setAttribute('aria-label', canStop ? 'Stop loading' : 'Reload page');
  reloadButton.setAttribute('aria-keyshortcuts', canStop ? 'Escape' : 'F5 Control+R');
  bookmarkButton.disabled = !activeTab || Boolean(activeTab.internalPage || activeTab.error);
  setIcon(bookmarkButton, activeTab?.isBookmarked ? 'starFilled' : 'star');
  bookmarkButton.title = activeTab?.isBookmarked ? 'Remove bookmark · Ctrl+D' : 'Bookmark this page · Ctrl+D';
  bookmarkButton.setAttribute('aria-label', activeTab?.isBookmarked ? 'Remove bookmark' : 'Bookmark this page');
  bookmarkButton.setAttribute('aria-pressed', String(Boolean(activeTab?.isBookmarked)));
  bookmarkButton.setAttribute('aria-keyshortcuts', 'Control+D');
  const pageProtocol = (() => {
    try { return new URL(activeTab?.url || '').protocol; } catch { return ''; }
  })();
  const security = pageProtocol === 'https:'
    ? { state: 'secure', icon: 'lock', label: 'Secure connection (HTTPS)' }
    : pageProtocol === 'http:'
      ? { state: 'insecure', icon: 'warning', label: 'Not secure (HTTP)' }
      : { state: 'internal', icon: 'globe', label: 'Browser or local page' };
  secureMark.dataset.security = security.state;
  secureMark.title = security.label;
  secureMark.setAttribute('role', 'img');
  secureMark.setAttribute('aria-label', security.label);
  secureMark.removeAttribute('aria-hidden');
  secureMark.replaceChildren(makeIcon(security.icon));
  internalPage.hidden = !state.internalPage;
  const tabSearchChanged = state.internalPage === 'tab-search'
    && getTabSearchSignature() !== tabSearchSignature;
  if (state.internalPage && (
    state.internalPage !== previousInternalPage
    || (state.internalPage === 'error' && state.error !== previousError)
    || tabSearchChanged
  )) {
    renderInternalPage(state.internalPage);
  }
  renderWindowControls();
}

function getTabSearchSignature() {
  return JSON.stringify({
    tabs: browserState.tabs.map(({ id, title, url }) => [id, title, url]),
    recentlyClosedTabs: browserState.recentlyClosedTabs || [],
  });
}

function applyAppearance(animate = false) {
  const settings = library.settings;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const requestedTheme = settings.theme;
  const resolvedTheme = requestedTheme === 'system'
    ? (systemDark ? 'night' : 'daylight')
    : requestedTheme === 'dark' ? 'night' : requestedTheme === 'light' ? 'daylight' : requestedTheme;
  const useDark = ['night', 'aurora', 'ember', 'green'].includes(resolvedTheme)
    || (resolvedTheme === 'high-contrast' && systemDark);
  const highContrast = settings.highContrast || resolvedTheme === 'high-contrast';
  for (const name of ['daylight', 'night', 'aurora', 'ember', 'green']) {
    document.body.classList.toggle(`palette-${name}`, resolvedTheme === name);
  }
  document.body.classList.toggle('theme-dark', useDark);
  document.body.classList.toggle('ambient-off', !settings.ambient);
  document.body.classList.toggle('density-compact', settings.density === 'compact');
  document.body.classList.toggle('reduce-motion', Boolean(settings.reduceMotion) || window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  document.body.classList.toggle('reduce-effects', Boolean(settings.reduceEffects));
  document.body.classList.toggle('roundness-sharp', settings.roundness === 'sharp');
  document.body.classList.toggle('roundness-round', settings.roundness === 'round');
  document.body.classList.toggle('high-contrast', Boolean(highContrast));
  if (!highContrast && settings.accentMode !== 'theme') {
    document.body.style.setProperty('--accent', settings.accent);
    document.body.style.setProperty('--text-on-accent', textColorForAccent(settings.accent));
    document.body.style.setProperty('--accent-hover', `color-mix(in srgb, ${settings.accent} 88%, ${useDark ? '#080d16' : '#263552'})`);
    document.body.style.setProperty('--accent-soft', `color-mix(in srgb, ${settings.accent} 16%, transparent)`);
  } else {
    document.body.style.removeProperty('--accent');
    document.body.style.removeProperty('--text-on-accent');
    document.body.style.removeProperty('--accent-hover');
    document.body.style.removeProperty('--accent-soft');
  }
  if (animate && !document.body.classList.contains('reduce-motion')) {
    document.body.classList.add('theme-transition');
    window.setTimeout(() => document.body.classList.remove('theme-transition'), 240);
  }
}

function wallpaperAccentFromRgb(red, green, blue) {
  const r = red / 255, g = green / 255, b = blue / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
  }
  hue = (hue * 60 + 360) % 360;
  const saturation = Math.min(.76, Math.max(.48, delta));
  const lightness = .55;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const section = hue / 60;
  const second = chroma * (1 - Math.abs(section % 2 - 1));
  let channels;
  if (section < 1) channels = [chroma, second, 0];
  else if (section < 2) channels = [second, chroma, 0];
  else if (section < 3) channels = [0, chroma, second];
  else if (section < 4) channels = [0, second, chroma];
  else if (section < 5) channels = [second, 0, chroma];
  else channels = [chroma, 0, second];
  const match = lightness - chroma / 2;
  return `#${channels.map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, '0')).join('')}`;
}

function textColorForAccent(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map((value) => parseInt(value, 16) / 255);
  const luminance = channels
    .map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  const whiteContrast = 1.05 / (luminance + .05);
  const darkContrast = (luminance + .05) / .054;
  return whiteContrast >= darkContrast ? '#ffffff' : '#101522';
}

async function updateWallpaperAccent() {
  const wallpaper = library.startPage;
  const builtInAccents = { aurora: '#45cfc1', sunset: '#fb8761', forest: '#57bd79', ocean: '#45a7dc', dune: '#d49a56', time: '#7b6cff' };
  let accent = builtInAccents[wallpaper.wallpaper] || '#7b6cff';
  if (wallpaper.wallpaper === 'custom' && wallpaper.wallpaperUrl?.startsWith('file:')) {
    try {
      const image = new Image();
      image.src = wallpaper.wallpaperUrl;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 24;
      canvas.height = 24;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0, 24, 24);
      const pixels = context.getImageData(0, 0, 24, 24).data;
      let red = 0, green = 0, blue = 0, samples = 0;
      for (let index = 0; index < pixels.length; index += 16) {
        red += pixels[index];
        green += pixels[index + 1];
        blue += pixels[index + 2];
        samples += 1;
      }
      if (samples) accent = wallpaperAccentFromRgb(red / samples, green / samples, blue / samples);
    } catch (error) {
      console.warn('Could not sample the local wallpaper; keeping the current accent.', error);
      return;
    }
  }
  if (accent !== library.settings.accent) await window.browser.updateSettings({ accent });
}

async function setWallpaperAccentMode() {
  await saveSetting({ accentMode: 'wallpaper' });
  await updateWallpaperAccent();
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (library.settings.theme === 'system' || library.settings.theme === 'high-contrast') applyAppearance(true);
});
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => applyAppearance());

function setLibrary(data) {
  const previousLibrary = library;
  library = data;
  applyAppearance(previousLibrary.settings.theme !== library.settings.theme);
  renderBookmarksBar();
  updatePrivacyStats();
  renderShieldsButton();
  const changedHistory = JSON.stringify(previousLibrary.history) !== JSON.stringify(library.history);
  const changedBookmarks = JSON.stringify(previousLibrary.bookmarks) !== JSON.stringify(library.bookmarks);
  const changedSettings = JSON.stringify(previousLibrary.settings) !== JSON.stringify(library.settings);
  if (library.settings.accentMode === 'wallpaper' && (
    previousLibrary.startPage?.wallpaper !== library.startPage.wallpaper
    || previousLibrary.startPage?.wallpaperUrl !== library.startPage.wallpaperUrl
  )) void updateWallpaperAccent();
  const changedExtensions = JSON.stringify(previousLibrary.extensions) !== JSON.stringify(library.extensions)
    || previousLibrary.extensionSupportRestartRequired !== library.extensionSupportRestartRequired;
  const startPageDisplay = (startPage) => startPage && JSON.stringify({
    wallpaper: startPage.wallpaper,
    wallpaperUrl: startPage.wallpaperUrl,
    layout: startPage.layout,
    greetingName: startPage.greetingName,
    showGreeting: startPage.showGreeting,
    showClock: startPage.showClock,
    use24Hour: startPage.use24Hour,
    showPrivacyStats: startPage.showPrivacyStats,
    showShortcuts: startPage.showShortcuts,
    widgets: startPage.widgets,
    widgetSizes: startPage.widgetSizes,
    shortcuts: startPage.shortcuts,
  });
  const changedStartPageDisplay = startPageDisplay(previousLibrary.startPage) !== startPageDisplay(library.startPage);
  const pageNeedsRefresh = browserState.internalPage === 'history' ? changedHistory
    : browserState.internalPage === 'bookmarks' ? changedBookmarks
      : browserState.internalPage === 'shields' ? changedSettings
        : browserState.internalPage === 'extensions' ? changedExtensions
        : false;
  if (pageNeedsRefresh) {
    renderInternalPage(browserState.internalPage);
  }
  if (browserState.internalPage === 'settings' && changedSettings) syncSettingsControls();
  if (browserState.internalPage === 'home' && changedStartPageDisplay) {
    renderStartPageContent(!previousLibrary.startPage);
  }
  if (browserState.internalPage === 'home') {
    applyStartPageVisualSettings(library.startPage);
    syncStartPageControls();
  }
  const homeEngine = document.querySelector('.home-search-engine');
  if (homeEngine) homeEngine.value = library.settings.searchEngine;
  if (!extensionsPopup.hidden) renderExtensionsPopup();
}

function syncSettingsControls() {
  const page = internalPage;
  page.querySelectorAll('[data-setting-key]').forEach((control) => {
    const value = library.settings[control.dataset.settingKey];
    if (control.type === 'checkbox') control.checked = Boolean(value);
    else if (value !== undefined) control.value = value;
  });
  page.querySelectorAll('[data-accent-value]').forEach((control) => {
    control.setAttribute('aria-pressed', String(library.settings.accentMode === 'custom' && library.settings.accent.toLowerCase() === control.dataset.accentValue));
  });
  page.querySelectorAll('[data-accent-mode-option]').forEach((control) => {
    control.setAttribute('aria-pressed', String(library.settings.accentMode === control.dataset.accentModeOption));
  });
  const selectedTheme = library.settings.theme === 'light' ? 'daylight' : library.settings.theme === 'dark' ? 'night' : library.settings.theme;
  page.querySelectorAll('[data-theme-option]').forEach((control) => {
    control.setAttribute('aria-pressed', String(control.dataset.themeOption === selectedTheme));
  });
}

let scheduledBrowserState;
let stateRenderScheduled = false;
window.browser.onState((state) => {
  scheduledBrowserState = state;
  if (stateRenderScheduled) return;
  stateRenderScheduled = true;
  requestAnimationFrame(() => {
    stateRenderScheduled = false;
    if (scheduledBrowserState) renderState(scheduledBrowserState);
  });
});
window.browser.onLibrary(setLibrary);
window.browser.onError(showToast);
window.browser.getLibrary().then(setLibrary).catch((error) => {
  showToast(error.message || 'Browser data could not be loaded.');
});

window.browser.onFocusAddress(() => {
  addressInput.focus();
  addressInput.select();
});
window.browser.onFocusBookmarks(() => bookmarksBar.querySelector('button')?.focus());
window.browser.onShowFind(() => openFindBar());
window.browser.onFindNext((options) => submitFind(options?.reverse !== true, false));
window.browser.onFindResult((result) => {
  findCount.textContent = `${result.activeMatchOrdinal || 0} of ${result.matchCount || 0}`;
});
window.browser.onFindClosed(() => {
  findBar.hidden = true;
  document.body.classList.remove('find-open');
  findCount.textContent = '0 of 0';
});
window.browser.onClearData(() => confirmClearData());
window.browser.onFocusCycle((options) => cycleChromeFocus(options?.reverse));
window.browser.onFocusInternalPage(() => {
  const heading = internalPage.querySelector('h1');
  if (heading) heading.focus();
  else internalPage.focus();
});
tabsElement.addEventListener('wheel', (event) => {
  if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
    tabsElement.scrollLeft += event.deltaY;
    event.preventDefault();
  }
}, { passive: false });
newTabButton.addEventListener('auxclick', (event) => {
  if (event.button === 1) {
    event.preventDefault();
    run(window.browser.newTab());
  }
});
document.querySelector('#address-form').addEventListener('submit', (event) => {
  event.preventDefault();
  run(window.browser.navigate(addressInput.value));
  addressInput.blur();
});
addressInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  if (event.altKey && addressInput.value.trim()) {
    event.preventDefault();
    run(window.browser.newTab(addressInput.value));
  } else if (event.ctrlKey && !event.altKey && addressInput.value.trim() && !/\s/.test(addressInput.value.trim()) && !addressInput.value.includes('.')) {
    event.preventDefault();
    const candidate = `${addressInput.value.trim()}.com`;
    addressInput.value = candidate;
    run(window.browser.navigate(candidate));
  }
});
findQuery.addEventListener('input', () => submitFind(true, true));
findMatchCase.addEventListener('change', () => submitFind(true, true));
document.querySelector('#find-previous').addEventListener('click', () => submitFind(false, false));
document.querySelector('#find-next').addEventListener('click', () => submitFind(true, false));
document.querySelector('#find-close').addEventListener('click', () => closeFindBar());
findQuery.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    submitFind(!event.shiftKey, false);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    closeFindBar();
  }
});
shieldsButton.addEventListener('click', () => {
  openToolbarMenu(shieldsButton, 360, window.browser.showShieldsMenu);
});
extensionsButton.addEventListener('click', () => {
  openToolbarMenu(extensionsButton, 320, window.browser.showExtensionsMenu);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'F6') {
    event.preventDefault();
    cycleChromeFocus(event.shiftKey);
    return;
  }
  const drawer = document.querySelector('#customize-drawer');
  if (event.key === 'Escape' && drawer && !drawer.hidden) {
    closeCustomizeDrawer();
    event.stopImmediatePropagation();
    return;
  }
  if (event.key === 'Tab' && drawer && !drawer.hidden) {
    const focusable = [...drawer.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
    return;
  }
  if (event.key === 'Escape' && !shieldsPopup.hidden) {
    shieldsPopup.hidden = true;
    shieldsButton.setAttribute('aria-expanded', 'false');
    shieldsButton.focus();
  }
  if (event.key === 'Escape' && !extensionsPopup.hidden) {
    extensionsPopup.hidden = true;
    extensionsButton.setAttribute('aria-expanded', 'false');
    extensionsButton.focus();
  }
});
backButton.addEventListener('click', () => run(window.browser.back()));
forwardButton.addEventListener('click', () => run(window.browser.forward()));
document.querySelector('#reload').addEventListener('click', () => {
  const activeTab = browserState.tabs.find((tab) => tab.id === browserState.activeTabId);
  run(activeTab?.isLoading ? window.browser.stop() : window.browser.reload());
});
bookmarkButton.addEventListener('click', () => run(window.browser.toggleBookmark()));
menuButton.addEventListener('click', () => {
  openToolbarMenu(menuButton, 240, window.browser.showBrowserMenu);
});
window.browser.onToolbarMenuClosed((kind) => {
  const button = {
    browser: menuButton,
    shields: shieldsButton,
    extensions: extensionsButton,
  }[kind];
  button?.setAttribute('aria-expanded', 'false');
});
document.querySelector('#window-minimize').addEventListener('click', () => run(window.browser.minimize()));
document.querySelector('#window-maximize').addEventListener('click', () => run(window.browser.toggleMaximize()));
document.querySelector('#window-close').addEventListener('click', () => run(window.browser.closeWindow()));
document.querySelector('.tab-strip').addEventListener('dblclick', (event) => {
  if (!event.target.closest('button, .tab')) {
    run(window.browser.toggleMaximize());
  }
});

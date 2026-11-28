const toast = document.querySelector('#toast-message');

window.toastBridge.onShow((payload) => {
  if (!payload || typeof payload.message !== 'string') return;
  document.body.className = /^[a-z-]+$/.test(payload.themeClass) ? payload.themeClass : 'palette-night';
  if (/^#[0-9a-fA-F]{6}$/.test(payload.accent || '')) {
    document.body.style.setProperty('--accent', payload.accent);
  } else {
    document.body.style.removeProperty('--accent');
  }
  document.body.classList.toggle('reduce-motion', Boolean(payload.reduceMotion));
  toast.textContent = payload.message;
  document.body.classList.add('toast-visible');
  requestAnimationFrame(() => window.toastBridge.painted(payload.sequence));
});

window.toastBridge.ready();

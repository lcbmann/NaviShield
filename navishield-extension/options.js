// options.js

/**
 * Save user’s preferences (autoCheckEnabled, bannerEnabled) to chrome.storage.sync.
 */
function saveOptions() {
  const autoCheckEnabled = document.getElementById('autoCheckCheckbox').checked;
  const bannerEnabled = document.getElementById('bannerCheckbox').checked;
  
  chrome.storage.sync.set({ autoCheckEnabled, bannerEnabled }, () => {
    const statusEl = document.getElementById('status');
    statusEl.textContent = 'Options saved.';
    setTimeout(() => {
      statusEl.textContent = '';
    }, 1200);
  });
}

/**
 * Restore existing preferences from chrome.storage.sync
 */
function restoreOptions() {
  chrome.storage.sync.get(
    { autoCheckEnabled: false, bannerEnabled: true },
    (items) => {
      const autoCheckEl = document.getElementById('autoCheckCheckbox');
      const bannerEl = document.getElementById('bannerCheckbox');
      
      autoCheckEl.checked = items.autoCheckEnabled;
      bannerEl.checked = items.bannerEnabled;

      // Ensure the banner checkbox is enabled/disabled correctly on load
      syncBannerCheckbox();
    }
  );
}

/**
 * Enable or disable the banner checkbox based on the autoCheck setting.
 */
function syncBannerCheckbox() {
  const autoCheckEl = document.getElementById('autoCheckCheckbox');
  const bannerEl = document.getElementById('bannerCheckbox');

  if (!autoCheckEl.checked) {
    bannerEl.disabled = true;
    bannerEl.checked = false;
  } else {
    bannerEl.disabled = false;
  }
}

/**
 * Main event listeners.
 */
document.addEventListener('DOMContentLoaded', () => {
  restoreOptions();

  const autoCheckEl = document.getElementById('autoCheckCheckbox');
  const bannerEl = document.getElementById('bannerCheckbox');

  autoCheckEl.addEventListener('change', () => {
    syncBannerCheckbox();
    saveOptions();
  });

  bannerEl.addEventListener('change', saveOptions);
});

// options.js

// Save the user’s preference to chrome.storage
function saveOptions() {
  const autoCheckEnabled = document.getElementById('autoCheckCheckbox').checked;
  chrome.storage.sync.set({ autoCheckEnabled }, () => {
    const statusEl = document.getElementById('status');
    statusEl.textContent = 'Options saved.';
    setTimeout(() => {
      statusEl.textContent = '';
    }, 1200);
  });
}

// Restore the user’s saved preference
function restoreOptions() {
  chrome.storage.sync.get({ autoCheckEnabled: false }, (items) => {
    document.getElementById('autoCheckCheckbox').checked = items.autoCheckEnabled;
  });
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  restoreOptions();
  document.getElementById('autoCheckCheckbox').addEventListener('change', saveOptions);
});

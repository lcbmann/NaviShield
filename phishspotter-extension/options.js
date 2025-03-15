// Save options to chrome.storage
function saveOptions(e) {
    e.preventDefault();
    const threshold = document.getElementById('confidenceThreshold').value;
    chrome.storage.sync.set({
      confidenceThreshold: threshold
    }, function() {
      // Update status to let user know options were saved.
      document.getElementById('status').textContent = 'Options saved.';
      setTimeout(() => {
        document.getElementById('status').textContent = '';
      }, 1500);
    });
  }
  
  // Restore options from chrome.storage
  function restoreOptions() {
    chrome.storage.sync.get({
      confidenceThreshold: '0.80'
    }, function(items) {
      document.getElementById('confidenceThreshold').value = items.confidenceThreshold;
    });
  }
  
  document.addEventListener('DOMContentLoaded', restoreOptions);
  document.getElementById('optionsForm').addEventListener('submit', saveOptions);
  
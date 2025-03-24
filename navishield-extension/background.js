// background.js

function getDomainFromUrl(url) {
  try {
    const parsed = new URL(url);
    let domain = parsed.host; 
    return domain;
  } catch (err) {
    return null;
  }
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // 1) Check if auto-check is enabled
    const { autoCheckEnabled } = await new Promise((resolve) =>
      chrome.storage.sync.get({ autoCheckEnabled: false }, resolve)
    );
    if (!autoCheckEnabled) return;

    // 2) Must be http/https
    if (!/^https?:\/\//i.test(tab.url)) return;

    // 3) Extract domain
    const domain = getDomainFromUrl(tab.url);
    if (!domain) return;

    try {
      // 4) Get info from local storage => { domain => { lastChecked, lastSuspicionScore } }
      const storageData = await new Promise((resolve) =>
        chrome.storage.local.get({ domainCheckInfo: {} }, resolve)
      );
      const domainCheckInfo = storageData.domainCheckInfo;

      // If we have an entry for this domain, read it
      const record = domainCheckInfo[domain] || { lastChecked: 0, lastSuspicionScore: 0 };
      const now = Date.now();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

      // 5) Check if last check is within 30 days
      if (now - record.lastChecked < thirtyDaysMs) {
        // Already checked recently => No new call
        console.log(`Skipping domain ${domain}: last check < 30 days ago.`);

        // But if it was suspicious, still inject banner
        if (record.lastSuspicionScore >= 3) {
          await injectSuspiciousBanner(tabId, record.lastSuspicionScore);
        }

        return;
      }

      // 6) Otherwise, do a fresh call to /predict
      const response = await fetch('https://phishspotter.onrender.com/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: tab.url })
      });

      let newSuspicionScore = 0;
      if (response.ok) {
        const data = await response.json();
        newSuspicionScore = data.suspicion_score || 0;

        // If suspicious => inject banner now
        if (true) {
          await injectSuspiciousBanner(tabId, newSuspicionScore);
        }
      } else {
        console.error(`Auto-check error: ${response.status}`);
      }

      // 7) Update local storage with new timestamp & suspicion
      domainCheckInfo[domain] = {
        lastChecked: now,
        lastSuspicionScore: newSuspicionScore
      };
      chrome.storage.local.set({ domainCheckInfo });

    } catch (error) {
      console.error('Auto-check error:', error);
    }
  }
});

/**
 * Helper to inject a "Suspicious" banner into the page.
 * 
 * @param {number} tabId - The ID of the tab to inject
 * @param {number} suspicionScore - The suspicion score to display
 */
async function injectSuspiciousBanner(tabId, suspicionScore) {
  console.log(`Injecting suspicious banner (score=${suspicionScore}) for tab ${tabId}`);

  // Option 1: Provide a single file "banner.js" that creates a banner 
  // Option 2: Insert a dynamic script with a message
  // We'll do Option 1 with a standard "banner.js" here:

  await chrome.scripting.executeScript({
    target: { tabId },
    func: (score) => { 
      // Attach the score to window
      window.phishspotterScore = score;
    },
    args: [suspicionScore] // pass the numeric score
  });
  
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['banner.js']
  });
  
}

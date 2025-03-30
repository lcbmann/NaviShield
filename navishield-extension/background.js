// background.js

function getDomainFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.host;
  } catch (err) {
    return null;
  }
}

/**
 * Helper: Sets the extension badge text and color based on suspicion score.
 * - Score >= 6 => "PH" (red)
 * - Score >= 3 => "??" (orange)
 * - Otherwise   => "OK" (green)
 * 
 * If no check was performed or invalid result, use a default blank badge.
 */
function setBadgeForScore(score, tabId) {
  let text = '';
  let color = '#000000'; // default to black if unknown

  if (typeof score === 'number') {
    if (score >= 6) {
      text = 'PH';
      color = '#FF0000';
    } else if (score >= 3) {
      text = '??';
      color = '#FFA500';
    } else {
      text = 'OK';
      color = '#28a745';
    }
  } else {
    // If no score or invalid data, consider clearing the badge
    chrome.action.setBadgeText({ text: '', tabId });
    return;
  }

  chrome.action.setBadgeText({ text, tabId });
  chrome.action.setBadgeBackgroundColor({ color, tabId });
}

/**
 * Helper to inject a "Suspicious" banner into the page (if user has enabled it).
 */
async function injectSuspiciousBanner(tabId, suspicionScore) {
  // Before injecting, check if banner is allowed by user preference:
  const { bannerEnabled } = await new Promise((resolve) =>
    chrome.storage.sync.get({ bannerEnabled: true }, resolve)
  );
  if (!bannerEnabled) return; // if user turned it off, skip

  console.log(`Injecting suspicious banner (score=${suspicionScore}) for tab ${tabId}`);

  // Attach the score to window, then run banner.js
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (score) => {
      window.phishspotterScore = score;
    },
    args: [suspicionScore],
  });
  
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['banner.js'],
  });
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // 1) Check if auto-check is enabled
    const { autoCheckEnabled } = await new Promise((resolve) =>
      chrome.storage.sync.get({ autoCheckEnabled: false }, resolve)
    );
    if (!autoCheckEnabled) {
      // If disabled, clear the badge
      chrome.action.setBadgeText({ text: '', tabId });
      return;
    }

    // 2) Must be http/https
    if (!/^https?:\/\//i.test(tab.url)) {
      chrome.action.setBadgeText({ text: '', tabId });
      return;
    }

    // 3) Extract domain
    const domain = getDomainFromUrl(tab.url);
    if (!domain) {
      chrome.action.setBadgeText({ text: '', tabId });
      return;
    }

    try {
      // 4) Check local storage if domain was recently checked
      const storageData = await new Promise((resolve) =>
        chrome.storage.local.get({ domainCheckInfo: {} }, resolve)
      );
      const domainCheckInfo = storageData.domainCheckInfo;

      const record = domainCheckInfo[domain] || { lastChecked: 0, lastSuspicionScore: 0 };
      const now = Date.now();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

      // If last check is within 30 days => Use that data
      if (now - record.lastChecked < thirtyDaysMs) {
        console.log(`Skipping domain ${domain}: last check < 30 days ago.`);

        // Update the badge color
        setBadgeForScore(record.lastSuspicionScore, tabId);

        // If it was suspicious, possibly show the banner (if user hasn’t disabled it)
        if (record.lastSuspicionScore >= 3) {
          await injectSuspiciousBanner(tabId, record.lastSuspicionScore);
        }

        return;
      }

      // 5) Otherwise, do a fresh call to /predict
      const response = await fetch('https://phishspotter.onrender.com/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: tab.url }),
      });

      let newSuspicionScore = 0;
      if (response.ok) {
        const data = await response.json();
        newSuspicionScore = data.suspicion_score || 0;

        // Update the badge color
        setBadgeForScore(newSuspicionScore, tabId);

        // If suspicious => inject banner
        if (newSuspicionScore >= 3) {
          await injectSuspiciousBanner(tabId, newSuspicionScore);
        }
      } else {
        console.error(`Auto-check error: ${response.status}`);
        // Clear or set a fallback badge
        chrome.action.setBadgeText({ text: '', tabId });
      }

      // 6) Update local storage
      domainCheckInfo[domain] = {
        lastChecked: now,
        lastSuspicionScore: newSuspicionScore,
      };
      chrome.storage.local.set({ domainCheckInfo });

    } catch (error) {
      console.error('Auto-check error:', error);
      // Clear or set a fallback badge
      chrome.action.setBadgeText({ text: '', tabId });
    }
  }
});

// We'll store the server’s response here for the "More Details" page
let lastResultData = null;

/**
 * Typing effect function
 * @param {HTMLElement} element - The DOM element to place typed text
 * @param {string} text - The text to type out
 * @param {number} speed - Delay in ms between each character
 */
function typeText(element, text, speed = 30) {
  element.textContent = '';
  let idx = 0;
  const timer = setInterval(() => {
    element.textContent += text.charAt(idx);
    idx++;
    if (idx >= text.length) {
      clearInterval(timer);
    }
  }, speed);
}

/**
 * Helper function to call /predict API with retries
 */
async function fetchPredictWithRetry(urlInput, maxRetries = 3, delayMs = 5000) {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const response = await fetch('https://phishspotter.onrender.com/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput })
      });

      if (!response.ok) {
        throw new Error(`Navi encountered a server error: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      attempt++;
      console.log(`Predict attempt #${attempt} failed: ${error.message}`);

      if (attempt < maxRetries) {
        const errorBox = document.getElementById('errorOutput');
        // We'll do typed text for the "retry" message too, if you like
        errorBox.classList.remove('hidden');
        typeText(
          errorBox,
          `Navi is still warming up. Retrying in ${delayMs / 1000}s... (Attempt ${attempt + 1} of ${maxRetries})`
        );
        
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        throw new Error(`Navi tried ${maxRetries} times, but still failed: ${error.message}. Try again?`);
      }
    }
  }
}

// "Check URL" button
document.getElementById('checkButton').addEventListener('click', async () => {
  const urlInput = document.getElementById('urlInput').value.trim();
  const resultBox = document.getElementById('resultOutput');
  const resultLabel = document.getElementById('resultLabel');
  const suspicionScoreEl = document.getElementById('suspicionScore');
  const errorBox = document.getElementById('errorOutput');

  // Clear old results
  resultBox.classList.add('hidden');
  errorBox.classList.add('hidden');
  errorBox.textContent = '';
  suspicionScoreEl.textContent = '';
  resultLabel.textContent = '';

  if (!urlInput) {
    errorBox.textContent = "Navi says: Please provide a link for me to check.";
    errorBox.classList.remove('hidden');
    return;
  }

  // Instead of direct text: typed text for "Checking..."
  errorBox.classList.remove('hidden');
  typeText(errorBox, "Navi is checking that site now… Please wait...");

  try {
    const data = await fetchPredictWithRetry(urlInput, 3, 5000);
    lastResultData = data;

    let suspicionVal = "N/A";
    if (typeof data.suspicion_score === "number") {
      suspicionVal = data.suspicion_score;
    }

    const finalLabel = data.prediction || "Unknown";

    if (finalLabel === "Invalid URL") {
      resultLabel.textContent = "🤔 Navi doesn’t recognize this as a valid URL.";
      resultLabel.style.color = "orange";
    } else if (finalLabel === "Phishing" || finalLabel === "Unsafe (Google Safe Browsing)") {
      resultLabel.textContent = finalLabel === "Phishing"
        ? "🚨 Navi sees PHISHING signals here!"
        : "🚫 Google Safe Browsing flags this site as unsafe!";
      resultLabel.style.color = "red";
    } else if (finalLabel === "Uncertain") {
      resultLabel.textContent = "❓ Navi is suspicious… proceed with caution!";
      resultLabel.style.color = "orange";
    } else if (finalLabel === "Safe") {
      resultLabel.textContent = "✅ Navi thinks this site is safe! Enjoy browsing.";
      resultLabel.style.color = "green";
    } else {
      resultLabel.textContent = `ℹ️ Navi can’t fully decide. Label: ${finalLabel}`;
      resultLabel.style.color = "black";
    }

    // Show the suspicion score
    suspicionScoreEl.textContent = suspicionVal;

    // Hide the error box, show the results
    resultBox.classList.remove('hidden');
    errorBox.classList.add('hidden');

  } catch (error) {
    errorBox.textContent = `Navi had trouble: ${error.message}`;
    errorBox.classList.remove('hidden');
  }
});

// Autofill
document.getElementById('autofillButton').addEventListener('click', async () => {
  try {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      document.getElementById('urlInput').value = tab.url;
    }
  } catch (error) {
    console.error("Error getting current tab URL:", error);
  }
});

// “Learn More” button
document.getElementById('learnMoreButton').addEventListener('click', () => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('learn_more.html')
  });
});

// “More Details” button
document.getElementById('detailsButton').addEventListener('click', () => {
  if (lastResultData) {
    const paramString = encodeURIComponent(JSON.stringify(lastResultData));
    const detailsURL = chrome.runtime.getURL(`result_details.html?data=${paramString}`);
    chrome.tabs.create({ url: detailsURL });
  }
});

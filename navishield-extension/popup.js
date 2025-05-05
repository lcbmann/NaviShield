// popup.js

let lastResultData = null;
let typingInterval = null; // track the current typing effect timer

/**
 * Updates the Navi mascot image based on a given state.
 * Possible states: "happy", "worried", "thinking", ...
 */
function setNaviState(state) {
  const mascotEl = document.getElementById('naviMascot');
  
  switch (state) {
    case 'thinking':
      mascotEl.src = 'navithinking.png';
      break;
    case 'worried':
      mascotEl.src = 'naviworried.png';
      break;
    case 'happy':
    default:
      mascotEl.src = 'navihappy.png';
      break;
  }
}

/**
 * Typing effect function. Animates text in the provided element,
 * and applies/removes a pulsing animation to the mascot.
 */
function typeText(element, text, speed = 30) {
  // Clear old interval if any
  if (typingInterval) {
    clearInterval(typingInterval);
    typingInterval = null;
  }

  // Start the mascot pulsing (if desired) when we begin typing
  const mascotEl = document.getElementById('naviMascot');
  mascotEl.classList.add('mascot-typing');

  element.textContent = '';
  let idx = 0;

  typingInterval = setInterval(() => {
    element.textContent += text.charAt(idx);
    idx++;
    if (idx >= text.length) {
      clearInterval(typingInterval);
      typingInterval = null;

      // Stop pulsing when done typing
      mascotEl.classList.remove('mascot-typing');
    }
  }, speed);
}

/**
 * Helper function to call /predict with retries
 */
async function fetchPredictWithRetry(urlInput, maxRetries = 3, delayMs = 8000) {
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
        errorBox.classList.remove('hidden');
        // typed text for the "retry" message
        const msg = `Navi is still warming up. Retrying in ${delayMs / 1000}s... (Attempt ${attempt + 1} of ${maxRetries})`;
        typeText(errorBox, msg);

        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        throw new Error(`Navi tried ${maxRetries} times, but still failed: ${error.message}. Try again?`);
      }
    }
  }
}

/**
 * "Check URL" button handler
 */
document.getElementById('checkButton').addEventListener('click', async () => {
  const checkBtn = document.getElementById('checkButton');
  const urlInputEl = document.getElementById('urlInput');
  const urlInput = urlInputEl.value.trim();
  const resultBox = document.getElementById('resultOutput');
  const errorBox = document.getElementById('errorOutput');
  const resultLabel = document.getElementById('resultLabel');
  const suspicionScoreEl = document.getElementById('suspicionScore');

  // Disable the button to prevent double clicks
  checkBtn.disabled = true;

  // Reset UI
  resultBox.classList.add('hidden');
  errorBox.classList.add('hidden');
  errorBox.textContent = '';
  suspicionScoreEl.textContent = '';
  resultLabel.textContent = '';

  if (!urlInput) {
    errorBox.textContent = "Navi says: Please provide a link for me to check.";
    errorBox.classList.remove('hidden');
    checkBtn.disabled = false;
    return;
  }

  // Show a typing effect for the checking message
  errorBox.classList.remove('hidden');
  typeText(errorBox, "Navi is checking that site now… Please wait...");

  // While checking, Navi is 'thinking'
  setNaviState('thinking');

  try {
    const data = await fetchPredictWithRetry(urlInput, 3, 8000);
    lastResultData = data;

    let suspicionVal = "N/A";
    if (typeof data.suspicion_score === "number") {
      suspicionVal = data.suspicion_score;
    }

    const finalLabel = data.prediction || "Unknown";

    // Decide the label text & color, plus Navi state
    if (finalLabel === "Invalid URL") {
      resultLabel.textContent = "🤔 Navi doesn’t recognize this as a valid URL.";
      resultLabel.style.color = "orange";
      setNaviState('worried');
    } else if (finalLabel === "Phishing" || finalLabel === "Unsafe (Google Safe Browsing)") {
      resultLabel.textContent = (finalLabel === "Phishing")
        ? "🚨 Navi sees PHISHING signals here!"
        : "🚫 Google Safe Browsing flags this site as unsafe!";
      resultLabel.style.color = "red";
      setNaviState('worried');
    } else if (finalLabel === "Uncertain") {
      resultLabel.textContent = "❓ Navi is suspicious… proceed with caution!";
      resultLabel.style.color = "orange";
      setNaviState('worried');
    } else if (finalLabel === "Safe") {
      resultLabel.textContent = "✅ Navi thinks this site is safe! Enjoy browsing.";
      resultLabel.style.color = "green";
      setNaviState('happy');
    } else {
      resultLabel.textContent = `ℹ️ Navi can’t fully decide. Label: ${finalLabel}`;
      resultLabel.style.color = "black";
      setNaviState('worried'); // Or 'happy', depending on your preference
    }

    suspicionScoreEl.textContent = suspicionVal;

    // Hide error, show final results
    resultBox.classList.remove('hidden');
    errorBox.classList.add('hidden');

  } catch (error) {
    errorBox.textContent = `Navi had trouble: ${error.message}`;
    errorBox.classList.remove('hidden');
    // Show 'worried' because an error occurred
    setNaviState('worried');
  } finally {
    checkBtn.disabled = false;
  }
});

/**
 * Autofill Button
 */
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

/**
 * Learn More Button
 */
document.getElementById('learnMoreButton').addEventListener('click', () => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('learn_more.html')
  });
});

/**
 * More Details Button
 */
document.getElementById('detailsButton').addEventListener('click', () => {
  if (lastResultData) {
    const paramString = encodeURIComponent(JSON.stringify(lastResultData));
    const detailsURL = chrome.runtime.getURL(`result_details.html?data=${paramString}`);
    chrome.tabs.create({ url: detailsURL });
  }
});

/**
 * Options Button
 */
document.getElementById('optionsButton').addEventListener('click', () => {
  // This calls the built-in method to open options.html
  chrome.runtime.openOptionsPage();
});

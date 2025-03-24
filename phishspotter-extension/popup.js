// We'll store the server’s response here for the "More Details" page
let lastResultData = null;

// Helper function to call /predict API with retries
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
        // e.g. 500 or 502 might indicate "model loading" or server error
        throw new Error(`Server error: ${response.status}`);
      }

      // If we get a valid response, parse and return it
      return await response.json();

    } catch (error) {
      // If it's a network or server error, we can decide to retry
      // (Only retry if it's likely the model is just warming up or a transient error)
      attempt++;
      console.log(`Predict attempt #${attempt} failed: ${error.message}`);

      if (attempt < maxRetries) {
        const errorBox = document.getElementById('errorOutput');
        errorBox.textContent = `Model warming up, retrying in ${delayMs / 1000}s... (Attempt ${attempt + 1} of ${maxRetries})`;
        errorBox.classList.remove('hidden');

        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        // After maxRetries, throw the error so we can display a final message
        throw new Error(`Failed after ${maxRetries} retries: ${error.message}`);
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

  // Clear previous results/messages
  resultBox.classList.add('hidden');
  errorBox.classList.add('hidden');
  errorBox.textContent = '';
  suspicionScoreEl.textContent = '';
  resultLabel.textContent = '';

  // If empty input, show an error
  if (!urlInput) {
    errorBox.textContent = "⚠️ Please enter a valid URL to check.";
    errorBox.classList.remove('hidden');
    return;
  }

  // Show a "Checking..." message
  errorBox.textContent = "⏳ Checking URL...";
  errorBox.classList.remove('hidden');

  try {
    // Use our retry helper instead of a direct fetch
    const data = await fetchPredictWithRetry(urlInput, 3, 5000);

    // Save for "More Details" button
    lastResultData = data;

    // If your server includes a "suspicion_score" field, read it; otherwise use "N/A"
    let suspicionVal = "N/A";
    if (typeof data.suspicion_score === "number") {
      suspicionVal = data.suspicion_score;
    }

    // Decide how to display the result label & color
    const finalLabel = data.prediction || "Unknown";

    if (finalLabel === "Invalid URL") {
      resultLabel.textContent = "⚠️ Invalid URL";
      resultLabel.style.color = "orange";
    } else if (finalLabel === "Phishing" || finalLabel === "Unsafe (Google Safe Browsing)") {
      resultLabel.textContent = finalLabel === "Phishing" 
        ? "🚨 Phishing 🚨"
        : "🚫 Unsafe (GSB) 🚫";
      resultLabel.style.color = "red";
    } else if (finalLabel === "Uncertain") {
      resultLabel.textContent = "❓ Uncertain ❓";
      resultLabel.style.color = "orange";
    } else {
      // If not Invalid/Phishing/Uncertain/Unsafe => treat as "Safe"
      resultLabel.textContent = "✅ Safe";
      resultLabel.style.color = "green";
    }

    // Show suspicion score in the UI
    suspicionScoreEl.textContent = suspicionVal;

    // Show the result box, hide the error box
    resultBox.classList.remove('hidden');
    errorBox.classList.add('hidden');

  } catch (error) {
    // If all retries fail or another error occurs
    errorBox.textContent = `❌ Error after retries: ${error.message}`;
    errorBox.classList.remove('hidden');
  }
});


// Autofill current tab's URL
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

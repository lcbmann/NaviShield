// We store the server’s response in this variable for the “More Details” page.
let lastResultData = null;

// Check URL button
document.getElementById('checkButton').addEventListener('click', async () => {
  const urlInput = document.getElementById('urlInput').value.trim();
  const resultBox = document.getElementById('resultOutput');
  const resultLabel = document.getElementById('resultLabel');
  const resultConfidence = document.getElementById('resultConfidence');
  const errorBox = document.getElementById('errorOutput');

  // Clear previous results/messages
  resultBox.classList.add('hidden');
  errorBox.classList.add('hidden');
  errorBox.textContent = '';

  // If empty input, show an error
  if (!urlInput) {
    errorBox.textContent = "⚠️ Please enter a valid URL to check.";
    errorBox.classList.remove('hidden');
    return;
  }

  // Show a “Checking...” message
  errorBox.textContent = "⏳ Checking URL...";
  errorBox.classList.remove('hidden');

  try {
    // Call your Flask endpoint
    const response = await fetch('https://phishspotter.onrender.com/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlInput })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    // Save for “More Details”
    lastResultData = data;

    // Now determine how to display the result
    if (data.prediction === "Invalid URL") {
      resultLabel.textContent = "⚠️ Invalid URL";
      resultLabel.style.color = "orange";
      // Usually confidence is 0 for invalid
      resultConfidence.textContent = (data.confidence * 100).toFixed(2) + "% confidence";
    } else if (data.prediction === "Phishing") {
      resultLabel.textContent = "🚨 Phishing 🚨";
      resultLabel.style.color = "red";
      resultConfidence.textContent = (data.confidence * 100).toFixed(2) + "% confidence";
    } else if (data.prediction === "Uncertain") {
      resultLabel.textContent = "❓ Uncertain ❓";
      resultLabel.style.color = "orange";
      resultConfidence.textContent = (data.confidence * 100).toFixed(2) + "% confidence";
    } else {
      // If not Invalid, Phishing, or Uncertain => treat as “Safe”
      resultLabel.textContent = "✅ Safe";
      resultLabel.style.color = "green";
      resultConfidence.textContent = (data.confidence * 100).toFixed(2) + "% confidence";
    }

    // Show the result box, hide the error box
    resultBox.classList.remove('hidden');
    errorBox.classList.add('hidden');

  } catch (error) {
    // If fetch or JSON parsing fails
    errorBox.textContent = `❌ Error: ${error.message}`;
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
  // Open your learn_more.html in a new tab
  chrome.tabs.create({
    url: chrome.runtime.getURL('learn_more.html')
  });
});

// “More Details” button
document.getElementById('detailsButton').addEventListener('click', () => {
  if (lastResultData) {
    // Pass lastResultData in ?data=... param
    const paramString = encodeURIComponent(JSON.stringify(lastResultData));
    const detailsURL = chrome.runtime.getURL(`result_details.html?data=${paramString}`);
    chrome.tabs.create({ url: detailsURL });
  }
});

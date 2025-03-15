document.getElementById('checkButton').addEventListener('click', async function () {
  const urlInput = document.getElementById('urlInput').value.trim();
  const resultBox = document.getElementById('resultOutput');
  const resultLabel = document.getElementById('resultLabel');
  const resultConfidence = document.getElementById('resultConfidence');
  const errorBox = document.getElementById('errorOutput');

  // Clear previous results
  resultBox.classList.add('hidden');
  errorBox.classList.add('hidden');
  errorBox.textContent = '';

  if (!urlInput) {
    errorBox.textContent = "⚠️ Please enter a valid URL to check.";
    errorBox.classList.remove('hidden');
    return;
  }

  errorBox.textContent = "⏳ Checking URL...";
  errorBox.classList.remove('hidden');

  try {
    // Updated API URL to your Render endpoint
    const response = await fetch('https://phishspotter.onrender.com/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlInput })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();

    // Update UI with result based on prediction
    if (data.prediction === "Phishing") {
      resultLabel.textContent = "🚨 Phishing 🚨";
      resultLabel.style.color = "red";
    } else if (data.prediction === "Uncertain") {
      resultLabel.textContent = "❓ Uncertain ❓";
      resultLabel.style.color = "orange";
    } else {
      resultLabel.textContent = "✅ Safe";
      resultLabel.style.color = "green";
    }
    resultConfidence.textContent = (data.confidence * 100).toFixed(2) + "% confidence";

    resultBox.classList.remove('hidden');
    errorBox.classList.add('hidden');

  } catch (error) {
    errorBox.textContent = `❌ Error: ${error.message}`;
    errorBox.classList.remove('hidden');
  }
});


// Autofill current tab's URL
document.getElementById('autofillButton').addEventListener('click', async function () {
  try {
    // Query the active tab in the current window.
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      document.getElementById('urlInput').value = tab.url;
    }
  } catch (error) {
    console.error("Error getting current tab URL:", error);
  }
});

// Check URL button functionality (existing)
document.getElementById('checkButton').addEventListener('click', async function () {
  const urlInput = document.getElementById('urlInput').value.trim();
  const resultBox = document.getElementById('resultOutput');
  const resultLabel = document.getElementById('resultLabel');
  const resultConfidence = document.getElementById('resultConfidence');
  const errorBox = document.getElementById('errorOutput');

  // Clear previous results
  resultBox.classList.add('hidden');
  errorBox.classList.add('hidden');
  errorBox.textContent = '';

  if (!urlInput) {
    errorBox.textContent = "⚠️ Please enter a valid URL to check.";
    errorBox.classList.remove('hidden');
    return;
  }

  errorBox.textContent = "⏳ Checking URL...";
  errorBox.classList.remove('hidden');

  try {
    const response = await fetch('https://phishspotter.onrender.com/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlInput })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();

    // Update UI with result based on prediction
    if (data.prediction === "Phishing") {
      resultLabel.textContent = "🚨 Phishing 🚨";
      resultLabel.style.color = "red";
    } else if (data.prediction === "Uncertain") {
      resultLabel.textContent = "❓ Uncertain ❓";
      resultLabel.style.color = "orange";
    } else {
      resultLabel.textContent = "✅ Safe";
      resultLabel.style.color = "green";
    }
    resultConfidence.textContent = (data.confidence * 100).toFixed(2) + "% confidence";

    resultBox.classList.remove('hidden');
    errorBox.classList.add('hidden');

  } catch (error) {
    errorBox.textContent = `❌ Error: ${error.message}`;
    errorBox.classList.remove('hidden');
  }
});

// Learn More button functionality
document.getElementById('learnMoreButton').addEventListener('click', function () {
  // Open a new tab or popup with a detailed explanation
  chrome.tabs.create({ url: 'learn_more.html' });
});

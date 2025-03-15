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
      const response = await fetch('http://127.0.0.1:5000/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput })
      });
  
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
  
      const data = await response.json();
  
      // Update UI with result
      resultLabel.textContent = data.prediction === "Phishing" ? "🚨 Phishing 🚨" : "✅ Safe";
      resultLabel.style.color = data.prediction === "Phishing" ? "red" : "green";
      resultConfidence.textContent = (data.confidence * 100).toFixed(2) + "% confidence";
  
      resultBox.classList.remove('hidden');
      errorBox.classList.add('hidden');
  
    } catch (error) {
      errorBox.textContent = `❌ Error: ${error.message}`;
      errorBox.classList.remove('hidden');
    }
  });
  
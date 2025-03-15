from flask import Flask, request, jsonify
import requests
import os

app = Flask(__name__)

# Hugging Face API Setup
HF_API_URL = "https://api-inference.huggingface.co/models/ealvaradob/bert-finetuned-phishing"
HF_API_TOKEN = "REMOVED"  # Replace with your actual key or better use env var in prod

headers = {
    "Authorization": f"Bearer {HF_API_TOKEN}"
}

@app.route('/', methods=['GET'])
def home():
    return "✅ PhishSpotter API (Powered by Hugging Face ealvaradob/bert-finetuned-phishing) is running!"

@app.route('/test', methods=['GET'])
def test_page():
    return """
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>PhishSpotter API</title>
</head>
<body>
  <h1>🔒 PhishSpotter URL Classifier (via Hugging Face API)</h1>
  <p>Enter a URL to check if it's Safe or Phishing:</p>
  <input type="text" id="urlInput" size="50" placeholder="https://example.com" />
  <button onclick="submitUrl()">Check URL</button>
  <pre id="output" style="background: #eee; padding: 10px; margin-top: 10px;"></pre>

  <script>
    async function submitUrl() {
      const urlText = document.getElementById('urlInput').value.trim();
      if (!urlText) {
        alert("Please enter a URL.");
        return;
      }

      const outputEl = document.getElementById('output');
      outputEl.textContent = "Checking URL...";

      try {
        const response = await fetch('/predict', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ url: urlText })
        });

        if (!response.ok) {
          throw new Error('Server error: ' + response.status);
        }

        const data = await response.json();
        outputEl.textContent = "Result: " + JSON.stringify(data, null, 2);
      } catch (error) {
        outputEl.textContent = "Error: " + error;
      }
    }
  </script>
</body>
</html>
"""

@app.route('/predict', methods=['POST'])
def predict():
    data = request.json
    if not data or 'url' not in data:
        return jsonify({"error": "No URL provided"}), 400

    url = data['url']
    payload = {"inputs": url}

    # Call Hugging Face Inference API
    response = requests.post(HF_API_URL, headers=headers, json=payload)

    if response.status_code != 200:
        return jsonify({"error": "Failed to get prediction", "details": response.json()}), 500

    # Interpret response
    prediction_data = response.json()
    # Hugging Face returns list like [{'label': 'LABEL_1', 'score': 0.98}]
    predicted_label = prediction_data[0]['label']
    confidence = prediction_data[0]['score']

    # Map LABEL_0 / LABEL_1 to Safe/Phishing
    label = "Phishing" if predicted_label == "LABEL_1" else "Safe"

    return jsonify({
        "url": url,
        "prediction": label,
        "confidence": confidence
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))  # For Render dynamic ports
    app.run(host='0.0.0.0', port=port)

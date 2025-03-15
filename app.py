from flask import Flask, request, jsonify
import requests
import os
from urllib.parse import urlparse, urlunparse

app = Flask(__name__)

# -------------------------------
# Configuration for external APIs
# -------------------------------

# Hugging Face API settings for the phishing model
HF_API_URL = "https://api-inference.huggingface.co/models/ealvaradob/bert-finetuned-phishing"
HF_API_TOKEN = os.environ.get("HF_API_TOKEN", "REMOVED")  # Use secret in production
headers = {
    "Authorization": f"Bearer {HF_API_TOKEN}",
    "Content-Type": "application/json"
}

# Google Safe Browsing API key (v4 is used here)
SAFE_BROWSING_API_KEY = "REMOVED"

# Label mapping for the Hugging Face model's output
label_map = {
    "benign": "Benign",
    "phishing": "Phishing"
}

# -------------------------------
# Helper functions
# -------------------------------

def normalize_url(url):
    """
    Ensures the URL has 'https://' as the scheme and 'www.' as the prefix.
    This helps standardize the URL before it is processed.
    """
    parsed = urlparse(url, scheme='https')
    if not parsed.netloc:
        parsed = urlparse("https://" + url)
    netloc = parsed.netloc
    if not netloc.startswith("www."):
        netloc = "www." + netloc
    normalized = parsed._replace(scheme="https", netloc=netloc)
    return urlunparse(normalized)

def safe_browsing_check(url):
    """
    Calls the Google Safe Browsing API (v4) to check if the URL is
    potentially unsafe. Returns a tuple: (is_safe, result_data)
    """
    sb_url = f"https://safebrowsing.googleapis.com/v4/threatMatches:find?key={SAFE_BROWSING_API_KEY}"
    payload = {
      "client": {
          "clientId": "phishspotter",
          "clientVersion": "1.0"
      },
      "threatInfo": {
         "threatTypes": [
             "MALWARE",
             "SOCIAL_ENGINEERING",
             "UNWANTED_SOFTWARE",
             "POTENTIALLY_HARMFUL_APPLICATION"
         ],
         "platformTypes": ["ANY_PLATFORM"],
         "threatEntryTypes": ["URL"],
         "threatEntries": [{"url": url}]
      }
    }
    try:
         response = requests.post(sb_url, json=payload, timeout=5)
         response.raise_for_status()
         result = response.json()
         # If there are matches, then Google considers the URL unsafe.
         if "matches" in result:
             return False, result
         else:
             return True, {}
    except Exception as e:
         # In case of an error, assume the URL is safe.
         return True, {"error": str(e)}

# -------------------------------
# Flask Routes
# -------------------------------

@app.route('/', methods=['GET'])
def home():
    return "✅ PhishSpotter API using ealvaradob's model is live!"

@app.route('/test', methods=['GET'])
def test_page():
    # A simple HTML page for manual testing.
    return """
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>PhishSpotter v2</title>
</head>
<body>
  <h1>🔒 PhishSpotter (Phishing Detector)</h1>
  <p>Enter a URL to check if it's benign or phishing:</p>
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

    original_url = data['url']
    # Normalize the URL to a standard format
    normalized_url = normalize_url(original_url)

    # -------------------------------
    # Step 1: Preliminary Safe Browsing Check
    # -------------------------------
    is_safe, sb_result = safe_browsing_check(normalized_url)
    if not is_safe:
        # If Google Safe Browsing flags the URL, return an "Unsafe" response.
        return jsonify({
            "original_url": original_url,
            "normalized_url": normalized_url,
            "prediction": "Unsafe (Google Safe Browsing)",
            "confidence": 1.0,
            "safe_browsing": sb_result
        })

    # -------------------------------
    # Step 2: Proceed with Hugging Face Inference
    # -------------------------------
    payload = {"inputs": normalized_url}
    try:
        response = requests.post(HF_API_URL, headers=headers, json=payload)
        response.raise_for_status()
        prediction_data = response.json()

        # Handle possible nested list responses
        if isinstance(prediction_data, list) and len(prediction_data) > 0 and isinstance(prediction_data[0], list):
            predictions = prediction_data[0]
        else:
            predictions = prediction_data

        # Get the prediction with the highest confidence score
        best_prediction = max(predictions, key=lambda x: x["score"])
        label = best_prediction["label"]
        confidence = best_prediction["score"]

        # Map the model's label to a human-friendly label
        human_label = label_map.get(label.lower(), label)
        
        # If Safe Browsing passed but the model predicts "Phishing", override with "Uncertain"
        if human_label.lower() == "phishing":
            human_label = "Uncertain"

        return jsonify({
            "original_url": original_url,
            "normalized_url": normalized_url,
            "prediction": human_label,
            "confidence": confidence,
            "safe_browsing": sb_result
        })
    except Exception as e:
        return jsonify({"error": "Failed to get prediction", "details": str(e)}), 500

# -------------------------------
# Run the Flask app (Render will set the PORT environment variable)
# -------------------------------
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)

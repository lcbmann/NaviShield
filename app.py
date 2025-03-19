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
    Attempt to parse and normalize the URL. Consider it invalid if:
    - It's empty or all whitespace
    - Its scheme is not http/https
    - There's no valid netloc (hostname/domain)
    """
    url = (url or "").strip()
    if not url:
        raise ValueError("Empty or missing URL")

    parsed = urlparse(url)

    # If the user didn't provide a scheme, scheme might be ""
    scheme = parsed.scheme.lower() or "https"

    # Reject anything that's NOT http or https
    if scheme not in ["http", "https"]:
        raise ValueError("Unsupported scheme: " + scheme)

    # If netloc is missing, try prepending the scheme
    if not parsed.netloc:
        parsed = urlparse(f"{scheme}://{url}")

    if not parsed.netloc:
        raise ValueError("Invalid URL netloc")

    netloc = parsed.netloc
    # Optionally force "www." if you like that approach:
    if not netloc.startswith("www."):
        netloc = "www." + netloc

    # Construct the normalized URL
    return urlunparse(parsed._replace(scheme=scheme, netloc=netloc))


def safe_browsing_check(url):
    """
    Calls the Google Safe Browsing API (v4) to check if the URL is potentially unsafe.
    Returns a tuple: (is_safe, result_data)
      - is_safe: bool (False if unsafe/invalid, True otherwise)
      - result_data: dict with either "matches" or "error"
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
        response.raise_for_status()  # raises HTTPError on 4xx/5xx
        result = response.json()
        if "matches" in result:
            # GSB found threats
            return False, result
        else:
            # No matches => safe
            return True, {}
    except requests.exceptions.HTTPError as e:
        # If it's a 400 error => GSB saw it as invalid request
        if response.status_code == 400:
            return False, {
                "error": "Invalid URL",
                "details": str(e)
            }
        else:
            # For other HTTP errors, we treat it as "safe" but pass the error
            return True, {"error": f"HTTPError: {e}"}
    except Exception as e:
        # On network timeouts or other issues, treat as safe but note the error
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
    """
    Main prediction route:
      1. Normalize URL. If invalid, return "Invalid URL" immediately.
      2. Check Google Safe Browsing. If flagged or invalid, return.
      3. Call Hugging Face API for classification.
      4. Return final JSON result.
    """
    data = request.json
    if not data or 'url' not in data:
        return jsonify({"error": "No URL provided"}), 400

    original_url = data['url']

    # -------------------------------
    # Step 0: Normalize & Validate
    # -------------------------------
    try:
        normalized_url = normalize_url(original_url)
    except ValueError:
        # If normalization fails => "Invalid URL"
        return jsonify({
            "original_url": original_url,
            "normalized_url": "",
            "prediction": "Invalid URL",
            "confidence": 0.0,
            "safe_browsing": {"error": "Malformed or invalid URL."}
        })

    # -------------------------------
    # Step 1: Google Safe Browsing
    # -------------------------------
    is_safe, sb_result = safe_browsing_check(normalized_url)

    if not is_safe:
        # If GSB sees a 400 => invalid
        if sb_result.get("error") == "Invalid URL":
            return jsonify({
                "original_url": original_url,
                "normalized_url": normalized_url,
                "prediction": "Invalid URL",
                "confidence": 0.0,
                "safe_browsing": sb_result
            })
        else:
            # Otherwise, GSB flagged it as unsafe
            return jsonify({
                "original_url": original_url,
                "normalized_url": normalized_url,
                "prediction": "Unsafe (Google Safe Browsing)",
                "confidence": 1.0,
                "safe_browsing": sb_result
            })

    # -------------------------------
    # Step 2: Hugging Face Inference
    # -------------------------------
    payload = {"inputs": normalized_url}
    try:
        response = requests.post(HF_API_URL, headers=headers, json=payload)
        response.raise_for_status()
        prediction_data = response.json()

        # Some HF models return a nested list
        if (isinstance(prediction_data, list)
            and len(prediction_data) > 0
            and isinstance(prediction_data[0], list)):
            predictions = prediction_data[0]
        else:
            predictions = prediction_data

        # Take the highest-confidence prediction
        best_prediction = max(predictions, key=lambda x: x["score"])
        label = best_prediction["label"]
        confidence = best_prediction["score"]

        # Convert model label to user-friendly label
        human_label = label_map.get(label.lower(), label)

        # If the model says "Phishing" but GSB said safe => "Uncertain"
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
        return jsonify({
            "error": "Failed to get prediction",
            "details": str(e)
        }), 500

# -------------------------------
# Run the Flask app
# -------------------------------
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)

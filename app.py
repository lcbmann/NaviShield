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

# Google Safe Browsing API key (v4)
SAFE_BROWSING_API_KEY = "REMOVED"

# WhoisXML API key
WHOIS_API_KEY = "REMOVED"  # <--- Your key

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
    if not netloc.startswith("www."):
        netloc = "www." + netloc

    return urlunparse(parsed._replace(scheme=scheme, netloc=netloc))

def safe_browsing_check(url):
    """
    Calls the Google Safe Browsing API (v4) to check if the URL is potentially unsafe.
    Returns (is_safe, result_data).
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
        if "matches" in result:
            return False, result
        else:
            return True, {}
    except requests.exceptions.HTTPError as e:
        if response.status_code == 400:
            return False, {"error": "Invalid URL", "details": str(e)}
        else:
            return True, {"error": f"HTTPError: {e}"}
    except Exception as e:
        # In other exceptions, assume safe but pass the error info
        return True, {"error": str(e)}

def whois_lookup(normalized_url):
    """
    Calls WhoisXML API to fetch WHOIS data about the domain in normalized_url.
    Returns a dict with WHOIS JSON or an "error" field if it fails.
    """
    from urllib.parse import urlparse

    # Extract domain from the normalized URL
    parsed = urlparse(normalized_url)
    domain = parsed.netloc

    # If 'www.' is at the start, strip it out for the WHOIS query
    if domain.startswith("www."):
        domain = domain[4:]

    whois_url = (
        "https://www.whoisxmlapi.com/whoisserver/WhoisService"
        f"?apiKey={WHOIS_API_KEY}"
        f"&domainName={domain}"
        f"&outputFormat=json"
    )

    try:
        resp = requests.get(whois_url, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        return data
    except Exception as e:
        return {"error": f"WHOIS lookup failed: {str(e)}"}

# -------------------------------
# Flask Routes
# -------------------------------

@app.route('/', methods=['GET'])
def home():
    return "✅ PhishSpotter API is live!"

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

    # Step 0: Normalize & Validate
    try:
        normalized_url = normalize_url(original_url)
    except ValueError:
        return jsonify({
            "original_url": original_url,
            "normalized_url": "",
            "prediction": "Invalid URL",
            "confidence": 0.0,
            "safe_browsing": {"error": "Malformed or invalid URL."}
        })

    # Step 1: Google Safe Browsing
    is_safe, sb_result = safe_browsing_check(normalized_url)
    if not is_safe:
        if sb_result.get("error") == "Invalid URL":
            return jsonify({
                "original_url": original_url,
                "normalized_url": normalized_url,
                "prediction": "Invalid URL",
                "confidence": 0.0,
                "safe_browsing": sb_result
            })
        else:
            return jsonify({
                "original_url": original_url,
                "normalized_url": normalized_url,
                "prediction": "Unsafe (Google Safe Browsing)",
                "confidence": 1.0,
                "safe_browsing": sb_result
            })

    # Step 1.5: WHOIS Lookup
    whois_data = whois_lookup(normalized_url)

    # Step 2: Hugging Face Inference
    payload = {"inputs": normalized_url}
    try:
        response = requests.post(HF_API_URL, headers=headers, json=payload)
        response.raise_for_status()
        prediction_data = response.json()

        if (isinstance(prediction_data, list)
            and len(prediction_data) > 0
            and isinstance(prediction_data[0], list)):
            predictions = prediction_data[0]
        else:
            predictions = prediction_data

        best_prediction = max(predictions, key=lambda x: x["score"])
        label = best_prediction["label"]
        confidence = best_prediction["score"]

        human_label = label_map.get(label.lower(), label)

        if human_label.lower() == "phishing":
            human_label = "Uncertain"

        return jsonify({
            "original_url": original_url,
            "normalized_url": normalized_url,
            "prediction": human_label,
            "confidence": confidence,
            "safe_browsing": sb_result,
            # We attach the raw WHOIS JSON or the error message
            "whois_info": whois_data  
        })

    except Exception as e:
        return jsonify({
            "error": "Failed to get prediction",
            "details": str(e)
        }), 500

# Run the Flask app
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)

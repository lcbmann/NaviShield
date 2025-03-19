from flask import Flask, request, jsonify
import requests
import os
from urllib.parse import urlparse, urlunparse
import datetime

app = Flask(__name__)

# -------------------------------
# Configuration for external APIs
# -------------------------------

# Hugging Face
HF_API_URL = "https://api-inference.huggingface.co/models/ealvaradob/bert-finetuned-phishing"
HF_API_TOKEN = os.environ.get("HF_API_TOKEN", "REMOVED")
headers = {
    "Authorization": f"Bearer {HF_API_TOKEN}",
    "Content-Type": "application/json"
}

# Google Safe Browsing
SAFE_BROWSING_API_KEY = "REMOVED"

# WhoisXML
WHOIS_API_KEY = "REMOVED"

# HF model label mapping
label_map = {
    "benign": "Benign",
    "phishing": "Phishing"
}

# -------------------------------
# Helper Functions
# -------------------------------
def normalize_url(url):
    """
    Validate that URL is non-empty, has http/https scheme, and a valid netloc.
    Returns normalized URL or raises ValueError.
    """
    url = (url or "").strip()
    if not url:
        raise ValueError("Empty or missing URL")

    parsed = urlparse(url)
    scheme = parsed.scheme.lower() or "https"

    if scheme not in ["http", "https"]:
        raise ValueError("Unsupported scheme: " + scheme)

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
    Calls Google Safe Browsing (GSB). Returns (is_safe, sb_result).
    is_safe = False if flagged/invalid, True otherwise.
    sb_result includes "matches" or "error".
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
        resp = requests.post(sb_url, json=payload, timeout=5)
        resp.raise_for_status()
        result = resp.json()
        if "matches" in result:
            return False, result
        return True, {}
    except requests.exceptions.HTTPError as e:
        if resp.status_code == 400:
            return False, {"error": "Invalid URL", "details": str(e)}
        return True, {"error": f"HTTPError: {e}"}
    except Exception as e:
        return True, {"error": str(e)}

def call_hf_model(url):
    """
    Call the Hugging Face phishing model. Returns (label, confidence).
    Raises Exception if it fails.
    """
    payload = {"inputs": url}
    resp = requests.post(HF_API_URL, headers=headers, json=payload, timeout=15)
    resp.raise_for_status()
    prediction_data = resp.json()

    if (isinstance(prediction_data, list)
        and len(prediction_data) > 0
        and isinstance(prediction_data[0], list)):
        predictions = prediction_data[0]
    else:
        predictions = prediction_data

    best = max(predictions, key=lambda x: x["score"])
    return best["label"], best["score"]

def whois_lookup(url):
    """
    Fetch WHOIS data for the domain in the normalized URL
    via WhoisXML API. Returns JSON or {"error": "..."} on fail.
    """
    parsed = urlparse(url)
    domain = parsed.netloc
    if domain.startswith("www."):
        domain = domain[4:]

    api_url = (
        "https://www.whoisxmlapi.com/whoisserver/WhoisService"
        f"?apiKey={WHOIS_API_KEY}"
        f"&domainName={domain}"
        "&outputFormat=json"
    )
    try:
        r = requests.get(api_url, timeout=10)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        return {"error": f"Whois lookup failed: {str(e)}"}

def domain_age_is_suspicious(whois_data, max_days=30):
    """
    Return True if domain is younger than max_days, else False.
    If missing or invalid data, returns False by default.
    """
    record = whois_data.get("WhoisRecord")
    if not record:
        # Could treat no data as suspicious, if you prefer
        return False

    created_str = record.get("createdDate")
    if not created_str:
        return False
    try:
        created_dt = datetime.datetime.strptime(created_str, "%Y-%m-%dT%H:%M:%SZ")
        age_days = (datetime.datetime.utcnow() - created_dt).days
        return age_days < max_days
    except:
        return False

# -------------------------------
# Flask Routes
# -------------------------------
@app.route('/', methods=['GET'])
def home():
    return "✅ PhishSpotter with WHOIS Integration is live!"

@app.route('/test', methods=['GET'])
def test_page():
    """
    Simple route for manual testing in the browser:
    http://localhost:5000/test
    """
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
    Main route: GSB -> HF -> WHOIS logic
    """
    data = request.json
    if not data or 'url' not in data:
        return jsonify({"error": "No URL provided"}), 400

    original_url = data['url']

    # 1) Normalize or fail
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

    # 2) Google Safe Browsing
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
        return jsonify({
            "original_url": original_url,
            "normalized_url": normalized_url,
            "prediction": "Unsafe (Google Safe Browsing)",
            "confidence": 1.0,
            "safe_browsing": sb_result
        })

    # 3) Hugging Face Model
    try:
        hf_label, hf_conf = call_hf_model(normalized_url)
    except Exception as e:
        return jsonify({"error": "HF model error", "details": str(e)}), 500

    # Map HF label -> user-friendly
    mapped_label = label_map.get(hf_label.lower(), hf_label)
    if mapped_label.lower() == "phishing":
        final_label = "Uncertain"
    else:
        final_label = "Safe"

    # 4) Whois Integration (only if GSB/HF didn't fail)
    whois_data = whois_lookup(normalized_url)
    if domain_age_is_suspicious(whois_data, max_days=30):
        if final_label == "Uncertain":
            # If HF said "Phishing" => "Uncertain", domain is new => "Phishing"
            final_label = "Phishing"
        elif final_label == "Safe":
            # If HF said "Benign" => "Safe", domain is new => "Uncertain"
            final_label = "Uncertain"

    # Return final result
    return jsonify({
        "original_url": original_url,
        "normalized_url": normalized_url,
        "prediction": final_label,
        "confidence": hf_conf,
        "safe_browsing": sb_result,
        "whois_info": whois_data
    })

# Run the Flask app
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)

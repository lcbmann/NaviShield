from flask import Flask, request, jsonify
import requests
import os
import datetime
from urllib.parse import urlparse, urlunparse
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# -----------------------------------
# Config for external APIs (ENV Vars)
# -----------------------------------
HF_API_URL = "https://api-inference.huggingface.co/models/ealvaradob/bert-finetuned-phishing"

# Get your tokens from the environment
HF_API_TOKEN = os.getenv("HF_API_TOKEN")
SAFE_BROWSING_API_KEY = os.getenv("SAFE_BROWSING_API_KEY")
WHOIS_API_KEY = os.getenv("WHOIS_API_KEY")

# Optional: ensure keys are loaded
if not HF_API_TOKEN or not SAFE_BROWSING_API_KEY or not WHOIS_API_KEY:
    raise ValueError("Missing one or more API keys in environment variables. Check your .env file.")

# Hugging Face auth headers
hf_headers = {
    "Authorization": f"Bearer {HF_API_TOKEN}",
    "Content-Type": "application/json"
}

# Label mapping for HF model
label_map = {
    "benign": "Benign",
    "phishing": "Phishing"
}

def normalize_url(url):
    """
    Validate that URL is non-empty, has http/https scheme, and a valid netloc.
    Returns normalized URL or raises ValueError if invalid.
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
    sb_url = f"https://safebrowsing.googleapis.com/v4/threatMatches:find?key={SAFE_BROWSING_API_KEY}"
    payload = {
        "client": {"clientId": "phishspotter", "clientVersion": "1.0"},
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
        else:
            return True, {}
    except requests.exceptions.HTTPError as e:
        if resp.status_code == 400:
            return False, {"error": "Invalid URL", "details": str(e)}
        return True, {"error": f"HTTPError: {e}"}
    except Exception as e:
        return True, {"error": f"GSB Error: {e}"}

def call_hf_model(url):
    payload = {"inputs": url}
    resp = requests.post(HF_API_URL, headers=hf_headers, json=payload, timeout=15)
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

def parse_created_date(created_str):
    for fmt in ["%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S%z"]:
        try:
            return datetime.datetime.strptime(created_str, fmt)
        except:
            pass
    return None

def domain_age_days(whois_data):
    record = whois_data.get("WhoisRecord")
    if not record:
        return None

    created_str = record.get("createdDate")
    if not created_str:
        return None

    created_dt = parse_created_date(created_str)
    if created_dt is None:
        return None

    if created_dt.tzinfo is not None and created_dt.utcoffset() is not None:
        created_dt = created_dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)

    return (datetime.datetime.utcnow() - created_dt).days

def is_private_registration(whois_data):
    record = whois_data.get("WhoisRecord")
    if not record:
        return False

    suspicious_keywords = ["privacy", "whoisguard", "private", "privateregistration", "perfect privacy"]
    for contact_key in ["registrant", "administrativeContact", "technicalContact"]:
        contact = record.get(contact_key, {})
        raw_text = (contact.get("rawText") or "").lower()
        if any(kw in raw_text for kw in suspicious_keywords):
            return True
    
    return False

def compute_suspicion_score(gsb_safe, hf_label, hf_conf, whois_data):
    score = 0

    if not gsb_safe:
        score += 10

    hf_label_lower = hf_label.lower()
    if hf_label_lower == "phishing":
        if hf_conf > 0.7:
            score += 3
        else:
            score += 2
    else:
        if hf_conf < 0.6:
            score += 1

    age = domain_age_days(whois_data)
    if age is not None:
        if age < 30:
            score += 3
        elif age < 90:
            score += 2
        elif age < 365:
            score += 1
    else:
        score += 3

    if is_private_registration(whois_data):
        score += 1

    return score

def map_score_to_label(score):
    if score >= 6:
        return "Phishing"
    elif score >= 3:
        return "Uncertain"
    else:
        return "Safe"

@app.route('/', methods=['GET'])
def home():
    return "✅ NaviShield with Suspicion Score is live!"

@app.route('/test', methods=['GET'])
def test_page():
    return """
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>NaviShield v2</title>
</head>
<body>
  <h1>🔒 NaviShield (Phishing Detector)</h1>
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

    try:
        normalized_url = normalize_url(original_url)
    except ValueError:
        return jsonify({
            "original_url": original_url,
            "normalized_url": "",
            "prediction": "Invalid URL",
            "confidence": 0.0,
            "suspicion_score": 0,
            "safe_browsing": {"error": "Malformed or invalid URL."}
        })

    is_safe_gsb, sb_result = safe_browsing_check(normalized_url)
    if not is_safe_gsb:
        if sb_result.get("error") == "Invalid URL":
            return jsonify({
                "original_url": original_url,
                "normalized_url": normalized_url,
                "prediction": "Invalid URL",
                "confidence": 0.0,
                "suspicion_score": 0,
                "safe_browsing": sb_result
            })
        return jsonify({
            "original_url": original_url,
            "normalized_url": normalized_url,
            "prediction": "Unsafe (Google Safe Browsing)",
            "confidence": 1.0,
            "suspicion_score": 10,
            "safe_browsing": sb_result
        })

    try:
        hf_label, hf_conf = call_hf_model(normalized_url)
    except Exception as e:
        return jsonify({"error": "HF model error", "details": str(e)}), 500

    mapped_label = label_map.get(hf_label.lower(), hf_label)
    whois_data = whois_lookup(normalized_url)

    score = compute_suspicion_score(
        gsb_safe=is_safe_gsb,
        hf_label=mapped_label,
        hf_conf=hf_conf,
        whois_data=whois_data
    )

    final_label = map_score_to_label(score)

    return jsonify({
        "original_url": original_url,
        "normalized_url": normalized_url,
        "prediction": final_label,
        "confidence": hf_conf,
        "suspicion_score": score,
        "safe_browsing": sb_result,
        "whois_info": whois_data
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)

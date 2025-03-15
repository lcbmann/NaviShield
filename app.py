from flask import Flask, request, jsonify
import requests
import os

app = Flask(__name__)

# Hugging Face API Setup
HF_API_URL = "https://api-inference.huggingface.co/models/r3ddkahili/final-complete-malicious-url-model"
HF_API_TOKEN = os.environ.get("HF_API_TOKEN", "REMOVED")  # Or embed directly

headers = {
    "Authorization": f"Bearer {HF_API_TOKEN}"
}

# Labels Mapping
label_map = {
    0: "Benign",
    1: "Defacement",
    2: "Phishing",
    3: "Malware"
}

@app.route('/', methods=['GET'])
def home():
    return "✅ PhishSpotter API using r3ddkahili's model is running!"

@app.route('/test', methods=['GET'])
def test_page():
    return """
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>PhishSpotter v2</title>
</head>
<body>
  <h1>🔒 PhishSpotter (Multi-Class URL Classifier)</h1>
  <p>Enter a URL to check if it's Benign, Phishing, Malware, or Defacement:</p>
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

    try:
        # Call Hugging Face API
        response = requests.post(HF_API_URL, headers=headers, json=payload)
        response.raise_for_status()
        prediction_data = response.json()
        print("Raw HF response:", prediction_data)  # Log the raw output

        # Example response: [{'label': 'LABEL_2', 'score': 0.92}, ...]
        best_prediction = max(prediction_data, key=lambda x: x['score'])
        label = best_prediction['label']
        confidence = best_prediction['score']

        # Convert 'LABEL_2' to number
        label_number = int(label.split("_")[1])
        human_readable_label = label_map.get(label_number, "Unknown")

        return jsonify({
            "url": url,
            "prediction": human_readable_label,
            "confidence": confidence
        })

    except Exception as e:
        print("Error occurred:", str(e))  # Log the error
        return jsonify({"error": "Failed to get prediction", "details": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)

from flask import Flask, request, jsonify
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

app = Flask(__name__)

# Load SecureBERT model and tokenizer
model_path = "./Securebert-website-phishing-prediction"  # Change if you put it somewhere else
tokenizer = AutoTokenizer.from_pretrained(model_path)
model = AutoModelForSequenceClassification.from_pretrained(model_path)
model.eval()  # Set model to evaluation mode

# Home route just to check if the server is up
@app.route('/', methods=['GET'])
def home():
    return "✅ SecureBERT Phishing URL Classifier is running!"

# Serve a simple HTML page with a form to input URL
@app.route('/test', methods=['GET'])
def test_page():
    return """
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>SecureBERT URL Classifier</title>
</head>
<body>
  <h1>🔒 SecureBERT Phishing URL Classifier</h1>
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

# Prediction route (API)
@app.route('/predict', methods=['POST'])
def predict():
    data = request.json
    if not data or 'url' not in data:
        return jsonify({"error": "No URL provided"}), 400

    url = data['url']

    # Tokenize and predict
    encoding = tokenizer(url, truncation=True, padding=True, max_length=512, return_tensors="pt")
    with torch.no_grad():
        output = model(**encoding)

    predicted_class = torch.argmax(output.logits, dim=1).item()
    probs = torch.nn.functional.softmax(output.logits, dim=-1)[0]
    confidence = float(probs[predicted_class])

    label = "Phishing" if predicted_class == 1 else "Safe"

    return jsonify({
        "url": url,
        "prediction": label,
        "confidence": confidence
    })

if __name__ == '__main__':
    app.run(debug=True)

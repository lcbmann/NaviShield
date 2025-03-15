# 🔐 **PhishSpotter**

**PhishSpotter** is an AI-powered phishing **URL detection system** combining **machine learning** and **Google Safe Browsing** to assess whether a URL is potentially malicious. Using a **BERT-based transformer model** trained on real phishing and benign URLs, alongside Google’s trusted security database, PhishSpotter offers a **double-layered check** to help users stay safe — all via a **simple web interface or browser extension**.

⚠️ **Note:** PhishSpotter currently focuses **only on URL classification** (e.g., Phishing, Benign). Advanced features like **full webpage scanning**, **email detection**, or **automated bulk checks** are **planned future developments**.

---

## ✨ **Key Features**

- ✅ **Real-Time URL Detection**: Instantly check any URL for signs of phishing, malware, and other threats.
- 🛡 **Google Safe Browsing Integration**: Leverages Google's security intelligence for known dangerous URLs.
- 🤖 **Transformer-Based AI Model**: Uses a fine-tuned BERT model hosted on Hugging Face to analyze URL patterns.
- 🌐 **Web Interface & Browser Extension**: User-friendly tools to analyze URLs on the fly.
- 🔀 **Multi-Source Analysis**: Results combine **Google Safe Browsing verdict** and **AI model prediction** for higher accuracy.
- 📊 **Clear Results with Confidence Scores**: Provides a transparent confidence level for AI assessments.
- 💡 **Open Source & Extensible**: Full source code available for auditing, customization, and extension.

---

## 🛠 **Tech Stack**
- **Languages:** Python, JavaScript, HTML/CSS
- **Frameworks & Tools:** Flask, Hugging Face Transformers (BERT), Google Safe Browsing API, REST APIs
- **Deployment:** Render.com (backend), Chrome Extension (frontend)

---

## 🚀 **How It Works**

1. **User Input:** User submits a URL via the web app or browser extension.
2. **Normalization & Pre-check:** The system formats the URL and checks it against **Google Safe Browsing** for known threats.
3. **Machine Learning Analysis:** If Safe Browsing passes, the system runs a **BERT-based AI model** to detect suspicious URL patterns.
4. **Dual-Layer Verdict:** Both Safe Browsing status and AI predictions are combined to provide a comprehensive risk assessment.
5. **Result Display:** The final result with confidence scores and Safe Browsing details is shown to the user.

---

## 📚 **Technologies Used**
- Python
- Flask (API backend)
- Hugging Face Transformers (BERT-based model)
- Google Safe Browsing API (v4)
- HTML/CSS/JavaScript (frontend and extension)

---

## ⚙️ **Project Structure**

```
PhishSpotter/
├── app.py                     # Flask backend with Safe Browsing & AI model logic
├── phishspotter-extension/    # Chrome Extension frontend
├── requirements.txt           # Python backend dependencies
└── README.md                  # This file
```

---

## 🚀 **Example Output**

```json
{
  "original_url": "http://example.com",
  "normalized_url": "https://www.example.com",
  "prediction": "Benign",
  "confidence": 0.92,
  "safe_browsing": {
    "status": "No threats detected"
  }
}
```

---

## 🎯 **Planned Future Enhancements**
- 🕷 **Full page content analysis** (HTML/DOM structure inspection)
- 📧 **Email phishing detection and analysis**
- 🗂 **Bulk URL scanning automation** for security teams and researchers
- 📊 **Interactive dashboards** for threat visualization and historical data
- 🔁 **Continuous model retraining** with fresh phishing datasets for better accuracy

---

## 🤝 **Contributing**

Contributions are welcome!  
If you have ideas, improvements, or want to help extend PhishSpotter, feel free to:
- Open an issue
- Submit a pull request
- Discuss in the project’s issues tab

---

## 📄 **License**

MIT License — free to use, modify, and distribute.

---

## 🚨 **Disclaimer**

PhishSpotter is a tool for educational and research purposes. No system is 100% accurate — **always exercise caution when interacting with suspicious URLs**, even if marked "benign."

---

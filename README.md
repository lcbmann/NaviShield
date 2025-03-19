

# 🔐 **PhishSpotter: URL Risk Assessment Tool**

PhishSpotter is a phishing detection system that evaluates URLs using **machine learning** and **Google Safe Browsing**. It combines a **BERT-based transformer model** trained on real phishing data with Google’s security database, providing a **layered approach** to identifying threats. The tool is available via a **web API** and **browser extension**.

> ⚠ **Note:** PhishSpotter focuses solely on URL classification (e.g., phishing, benign). Features like **full webpage scanning** and **email analysis** are planned for future updates.

---

## 🚀 **Features**

- **Real-Time URL Analysis** – Instantly assess URLs for phishing indicators.
- **Google Safe Browsing Integration** – Leverages Google’s security database to flag known malicious sites.
- **AI-Powered Detection** – Uses a fine-tuned **BERT model** to analyze URL patterns and structure.
- **Multi-Layered Risk Assessment** – Combines AI prediction, Safe Browsing status, and **WHOIS domain data** (age, registrar, private registration).
- **Clear Confidence Scores** – Provides transparency in classification.
- **Browser Extension & Web API** – Accessible for both individual users and developers.

---

## 🛠 **Technology Stack**

- **Languages** – Python, JavaScript, HTML/CSS
- **Frameworks & Tools** – Flask, Hugging Face Transformers (BERT), Google Safe Browsing API, WHOIS XML API
- **Deployment** – Hosted on Render.com, Chrome Extension frontend

---

## 🔍 **How It Works**

1. **Input & Normalization** – The user submits a URL, which is standardized.
2. **Google Safe Browsing Check** – The system checks the URL against Google’s database of unsafe websites.
3. **AI Model Analysis** – If Safe Browsing does not flag the URL, the system runs a **BERT-based AI model** to detect phishing patterns.
4. **WHOIS Data Lookup** – Retrieves domain registration details, such as **age, registrar, and privacy settings**.
5. **Final Risk Score** – The system calculates a **suspicion score** by combining all factors.
6. **Result Display** – The user receives a classification: **Safe, Phishing, or Uncertain**, with supporting confidence scores.

---

## 📁 **Project Structure**

```
PhishSpotter/
├── app.py                     # Flask backend (Safe Browsing & AI model logic)
├── phishspotter-extension/    # Chrome Extension frontend
├── requirements.txt           # Backend dependencies
└── README.md                  # Project documentation
```

---

## 📊 **Example API Output**

```json
{
  "original_url": "http://example.com",
  "normalized_url": "https://www.example.com",
  "prediction": "Safe",
  "confidence": 0.92,
  "suspicion_score": 1,
  "safe_browsing": {
    "status": "No threats detected"
  },
  "whois_info": {
    "domain": "example.com",
    "created_date": "2001-07-20T04:00:00Z",
    "domain_age_days": 8000
  }
}
```

---

## 🎯 **Upcoming Enhancements**
- **Full Page Content Analysis** – Inspect HTML/DOM structures for hidden phishing elements.
- **Email Phishing Detection** – Scan suspicious emails for fraud indicators.
- **Bulk URL Scanning** – Automate security assessments for enterprises.
- **Interactive Dashboards** – Provide historical threat insights.
- **Continuous Model Training** – Improve accuracy with real-time phishing dataset updates.

---

## 🤝 **Contributing**
Contributions are welcome! To contribute:
- **Submit Issues** – Report bugs or suggest improvements.
- **Fork & Pull Requests** – Help enhance the tool.
- **Discussion** – Engage with the community via GitHub Issues.

---

## 📜 **License**
PhishSpotter is licensed under the **MIT License** – free to use, modify, and distribute.

---

## ⚠ **Disclaimer**
PhishSpotter assists in phishing detection but **cannot guarantee 100% accuracy**. Users should exercise caution and verify URLs independently when in doubt.

---


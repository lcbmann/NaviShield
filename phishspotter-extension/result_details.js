function loadDetails() {
  const params = new URLSearchParams(window.location.search);
  const paramString = params.get('data');

  // If the param is missing or empty, display a helpful message
  if (!paramString) {
    document.getElementById('explanation').textContent =
      "No data found in URL. Please open this page via the 'Details' button in the popup.";
    return;
  }

  let data;
  try {
    data = JSON.parse(decodeURIComponent(paramString));
  } catch (error) {
    document.getElementById('explanation').textContent =
      "Error parsing details data.";
    return;
  }

  // Basic details
  document.getElementById('originalUrl').textContent = data.original_url || "N/A";
  document.getElementById('normalizedUrl').textContent = data.normalized_url || "N/A";
  document.getElementById('finalPrediction').textContent = data.prediction || "Unknown";
  document.getElementById('modelConfidence').textContent = data.confidence ? (data.confidence * 100).toFixed(2) + "%" : "N/A";

  // Google Safe Browsing result
  let sbResult = data.safe_browsing || {};
  let sbMessage = "";
  if (sbResult.error) {
    sbMessage = "Google Safe Browsing Error: " + sbResult.error;
  } else if (sbResult.matches) {
    const threatTypes = sbResult.matches.map(match => match.threatType).join(", ");
    sbMessage = "Flagged as unsafe. Threat types: " + threatTypes;
  } else {
    sbMessage = "No threats detected by Google Safe Browsing.";
  }
  document.getElementById('safeBrowsingResult').textContent = sbMessage;

  // User-friendly explanation based on prediction
  let explanation = "";
  if (data.prediction === "Unsafe (Google Safe Browsing)") {
    explanation = "🚫 Google Safe Browsing determined this URL is unsafe...";
  } else if (data.prediction === "Phishing") {
    explanation = "⚠️ The AI model identified this URL as phishing...";
  } else if (data.prediction === "Uncertain") {
    explanation = "❓ The AI model flagged this URL as suspicious...";
  } else if (data.prediction === "Benign" || data.prediction === "Safe") {
    explanation = "✅ Both the AI model and Google Safe Browsing consider this URL safe...";
  } else if (data.prediction === "Invalid URL") {
    explanation = "⚠️ The URL appears to be malformed or invalid. Please double-check the address and try again.";
  } else {
    explanation = "ℹ️ No clear decision could be made regarding this URL. Please exercise caution.";
  }
  document.getElementById('explanation').textContent = explanation;
}

document.addEventListener('DOMContentLoaded', loadDetails);

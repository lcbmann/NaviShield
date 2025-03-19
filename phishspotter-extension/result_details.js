function loadDetails() {
  const params = new URLSearchParams(window.location.search);
  const rawData = params.get('data');

  // If the param is missing or empty, display a helpful message
  if (!rawData) {
    document.getElementById('explanation').textContent =
      "No data found in URL. Please open this page via the 'More Details' button in the popup.";
    return;
  }

  let data;
  try {
    data = JSON.parse(decodeURIComponent(rawData));
  } catch (error) {
    document.getElementById('explanation').textContent =
      "Error parsing details data.";
    return;
  }

  // --- Basic details (already in your code) ---
  document.getElementById('originalUrl').textContent = data.original_url || "N/A";
  document.getElementById('normalizedUrl').textContent = data.normalized_url || "N/A";
  document.getElementById('finalPrediction').textContent = data.prediction || "Unknown";
  let confStr = "N/A";
  if (typeof data.confidence === "number") {
    confStr = (data.confidence * 100).toFixed(2) + "%";
  }
  document.getElementById('modelConfidence').textContent = confStr;

  // Google Safe Browsing result
  const sbResult = data.safe_browsing || {};
  let sbMessage = "";
  if (sbResult.error) {
    sbMessage = "Google Safe Browsing Error: " + sbResult.error;
  } else if (sbResult.matches) {
    const threatTypes = sbResult.matches.map(m => m.threatType).join(", ");
    sbMessage = "Flagged as unsafe. Threat types: " + threatTypes;
  } else {
    sbMessage = "No threats detected by Google Safe Browsing.";
  }
  document.getElementById('safeBrowsingResult').textContent = sbMessage;

  // Explanation for final prediction
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

  // --- WHOIS Data Parsing ---
  const whoisBox = document.getElementById('whoisInfo');
  
  // If the server returned an error or no whois_info:
  if (!data.whois_info) {
    whoisBox.innerHTML = "<p>No WHOIS data returned for this domain.</p>";
    return;
  }
  if (data.whois_info.error) {
    whoisBox.innerHTML = `<p>WHOIS Error: ${data.whois_info.error}</p>`;
    return;
  }

  // Try to parse actual WHOIS data from data.whois_info.WhoisRecord
  const whoisRecord = data.whois_info.WhoisRecord;
  if (!whoisRecord) {
    whoisBox.innerHTML = "<p>No WHOIS record found.</p>";
    return;
  }

  // Fill each field if present
  document.getElementById('whoisDomainName').textContent = whoisRecord.domainName || "N/A";
  document.getElementById('whoisRegistrar').textContent = whoisRecord.registrarName || "N/A";
  document.getElementById('whoisCreatedDate').textContent = whoisRecord.createdDate || "N/A";
  document.getElementById('whoisExpiresDate').textContent = whoisRecord.expiresDate || "N/A";
  document.getElementById('whoisDomainAge').textContent = whoisRecord.estimatedDomainAge || "N/A";
  document.getElementById('whoisDomainStatus').textContent = whoisRecord.status || "N/A";
}

document.addEventListener('DOMContentLoaded', loadDetails);

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

  // If 'confidence' is a number, display it as a percentage
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

  // WHOIS references (if we want to weave them into explanations)
  // We'll parse them before building the final explanation text
  let whoisBox = document.getElementById('whoisInfo');
  let whoisRecord = null;
  let whoisAvailable = false; // We'll use this to decide if we want extra detail in the explanation

  if (!data.whois_info) {
    whoisBox.innerHTML = "<p>No WHOIS data returned for this domain.</p>";
  } else if (data.whois_info.error) {
    whoisBox.innerHTML = `<p>WHOIS Error: ${data.whois_info.error}</p>`;
  } else {
    whoisRecord = data.whois_info.WhoisRecord;
    if (!whoisRecord) {
      whoisBox.innerHTML = "<p>No WHOIS record found.</p>";
    } else {
      // Mark that we do have WHOIS data for the explanation
      whoisAvailable = true;

      // Fill each field if present
      document.getElementById('whoisDomainName').textContent = whoisRecord.domainName || "N/A";
      document.getElementById('whoisRegistrar').textContent = whoisRecord.registrarName || "N/A";
      document.getElementById('whoisCreatedDate').textContent = whoisRecord.createdDate || "N/A";
      document.getElementById('whoisExpiresDate').textContent = whoisRecord.expiresDate || "N/A";
      document.getElementById('whoisDomainAge').textContent = whoisRecord.estimatedDomainAge || "N/A";
      document.getElementById('whoisDomainStatus').textContent = whoisRecord.status || "N/A";
    }
  }

  // --- Building a more descriptive explanation ---
  let explanation = "";
  // If we have whois data, let's gather some short references
  let whoisSummary = "";
  if (whoisAvailable) {
    const age = whoisRecord.estimatedDomainAge; // sometimes an integer (days)
    const registrar = whoisRecord.registrarName;
    // We'll build a short snippet with WHOIS references
    whoisSummary = "\n\nAdditionally, our WHOIS check shows:";
    if (registrar) {
      whoisSummary += `\n• Registrar: ${registrar}`;
    }
    if (typeof age === "number") {
      whoisSummary += `\n• Approx. domain age: ${age} days`;
    }
    if (!registrar && !age) {
      whoisSummary += "\n• We did not find registrar or domain age info, which can be unusual.";
    }
  }

  // Construct the explanation based on the finalPrediction
  switch (data.prediction) {
    case "Unsafe (Google Safe Browsing)":
      explanation =
        "🚫 Google Safe Browsing has flagged this URL as unsafe, indicating it might host " +
        "malware, phishing, or other harmful content. It is strongly recommended to avoid " +
        "visiting or sharing this link." + whoisSummary;
      break;

    case "Phishing":
      explanation =
        "⚠️ The AI model identified this URL as phishing, suggesting it may be designed to " +
        "steal personal information or credentials. Exercise extreme caution before proceeding." +
        whoisSummary;
      break;

    case "Uncertain":
      explanation =
        "❓ The AI model flagged this URL as suspicious. While Google Safe Browsing did not find " +
        "any immediate threats, the URL might still be risky. Consider verifying the source or " +
        "investigating further." + whoisSummary;
      break;

    case "Benign":
    case "Safe":
      explanation =
        "✅ Both the AI model and Google Safe Browsing consider this URL safe. However, " +
        "always stay alert for unexpected requests or forms on the site." + whoisSummary;
      break;

    case "Invalid URL":
      explanation =
        "⚠️ The URL appears to be malformed or invalid. Please double-check the address and " +
        "try again if you believe it was a mistake.";
      break;

    default:
      explanation =
        "ℹ️ No clear decision could be made regarding this URL. " +
        "Please exercise caution and further investigate if needed." + whoisSummary;
      break;
  }

  document.getElementById('explanation').textContent = explanation;
}

document.addEventListener('DOMContentLoaded', loadDetails);

// banner.js
(function() {
    // If the background script stored the suspicion score on window, read it:
    const suspicionScore = window.phishspotterScore || 0;
  
    // Create a container for the banner
    const banner = document.createElement('div');
    banner.style.position = 'fixed';
    banner.style.top = '0';
    banner.style.left = '0';
    banner.style.right = '0';
    banner.style.backgroundColor = '#d9534f'; // a Bootstrap 'danger'-like color
    banner.style.color = '#fff';
    banner.style.fontWeight = 'bold';
    banner.style.fontFamily = 'Arial, sans-serif';
    banner.style.padding = '10px 15px';
    banner.style.zIndex = '999999';
    banner.style.display = 'flex';
    banner.style.alignItems = 'center';
    banner.style.justifyContent = 'space-between';
  
    // Create the text portion
    const textEl = document.createElement('span');
    textEl.innerText = `PhishSpotter Alert: Suspicious site detected! (Score: ${suspicionScore})`;
  
    // Create the close button
    const closeBtn = document.createElement('button');
    closeBtn.innerText = 'X';
    closeBtn.style.backgroundColor = 'transparent';
    closeBtn.style.color = '#fff';
    closeBtn.style.border = 'none';
    closeBtn.style.fontSize = '16px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.marginLeft = '10px';
  
    // On click, remove the banner
    closeBtn.addEventListener('click', () => {
      banner.remove();
    });
  
    // Append text and button to the banner
    banner.appendChild(textEl);
    banner.appendChild(closeBtn);
  
    // Finally, attach the banner to the DOM
    document.body.appendChild(banner);
  })();
  
// banner.js

(function() {
  // If the background script stored the suspicion score on window, read it:
  const suspicionScore = window.phishspotterScore || 0;

  // Insert a style block for our fade-in animation
  const styleBlock = document.createElement('style');
  styleBlock.textContent = `
    @keyframes naviBannerSlideDown {
      0% {
        opacity: 0;
        transform: translateY(-100%);
      }
      100% {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
  document.head.appendChild(styleBlock);

  // Create a container for the banner
  const banner = document.createElement('div');
  banner.style.position = 'fixed';
  banner.style.top = '0';
  banner.style.left = '0';
  banner.style.right = '0';
  banner.style.backgroundColor = '#d9534f'; // a danger red
  banner.style.color = '#fff';
  banner.style.fontFamily = 'Arial, sans-serif';
  banner.style.fontSize = '14px';
  banner.style.padding = '12px 15px';
  banner.style.zIndex = '999999';
  banner.style.display = 'flex';
  banner.style.alignItems = 'center';
  banner.style.justifyContent = 'space-between';
  banner.style.animation = 'naviBannerSlideDown 0.5s ease forwards';

  // Create an optional avatar on the left (like a small Navi icon)
  const avatarEl = document.createElement('img');
  avatarEl.src = chrome.runtime.getURL('icon128.png');
  avatarEl.alt = 'Navi Avatar';
  avatarEl.style.marginRight = '8px';
  avatarEl.style.borderRadius = '50%'; // circle
  avatarEl.style.width = '32px';
  avatarEl.style.height = '32px';

  // Text portion (friendly message)
  // You can tweak the language to be more/less casual
  const textEl = document.createElement('span');
  textEl.innerText = `Navi says: “Heads up! This site might be risky... suspicion score is ${suspicionScore}!”`;

  // Put the avatar and text together
  const leftSection = document.createElement('div');
  leftSection.style.display = 'flex';
  leftSection.style.alignItems = 'center';
  leftSection.appendChild(avatarEl);
  leftSection.appendChild(textEl);

  // Create the close button (X)
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

  // Append sections to the banner
  banner.appendChild(leftSection);
  banner.appendChild(closeBtn);

  // Finally, attach the banner to the DOM
  document.body.appendChild(banner);
})();

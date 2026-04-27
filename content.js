// Content script for Student Focus Helper Chrome Extension

let currentOverlay = null;
let timerInterval = null;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'sessionEnded':
      removeOverlay();
      break;
    case 'updateTimer':
      updateOverlayTimer(message.timeRemaining);
      break;
    case 'blockSite':
      createBlockOverlay(message.hostname);
      break;
  }
});

// Create blocking overlay
function createBlockOverlay(blockedHostname) {
  // Remove any existing overlay
  removeOverlay();

  // Create the overlay element
  currentOverlay = document.createElement('div');
  currentOverlay.id = 'focus-blocker-overlay';
  currentOverlay.innerHTML = `
    <div class="focus-blocker-content">
      <div class="focus-blocker-icon">🎯</div>
      <h2>Stay Focused!</h2>
      <p>This site (${blockedHostname}) is blocked during your focus session.</p>
      <p>Return to your focus site to continue studying.</p>
      <div class="focus-blocker-timer">
        <span id="overlay-time-remaining">25:00</span> remaining
      </div>
      <div class="focus-blocker-actions">
        <button id="temp-unblock-btn" class="btn btn-warning">Temporarily Unblock (5 min)</button>
        <button id="end-session-btn" class="btn btn-danger">End Focus Session</button>
      </div>
      <div class="focus-motivation">
        <p>💪 Remember your goals!</p>
        <p>Every focused minute brings you closer to success.</p>
      </div>
    </div>
  `;

  // Add the overlay to the page
  document.body.appendChild(currentOverlay);
  document.body.style.overflow = 'hidden';

  // Add event listeners
  document.getElementById('temp-unblock-btn').addEventListener('click', temporarilyUnblock);
  document.getElementById('end-session-btn').addEventListener('click', endFocusSession);

  // Start timer updates
  startTimerUpdates();

  // Prevent scrolling
  preventScrolling();
}

// Remove the blocking overlay
function removeOverlay() {
  if (currentOverlay) {
    currentOverlay.remove();
    currentOverlay = null;
    document.body.style.overflow = '';
  }
  
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// Update timer display on overlay
function updateOverlayTimer(timeString) {
  const timerElement = document.getElementById('overlay-time-remaining');
  if (timerElement) {
    timerElement.textContent = timeString;
  }
}

// Start timer updates
function startTimerUpdates() {
  timerInterval = setInterval(() => {
    chrome.runtime.sendMessage({ action: 'getTimerUpdate' }, (response) => {
      if (response && response.timeRemaining) {
        const minutes = Math.floor(response.timeRemaining / 60000);
        const seconds = Math.floor((response.timeRemaining % 60000) / 1000);
        const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        updateOverlayTimer(timeString);
      }
    });
  }, 1000);
}

// Temporarily unblock the site
function temporarilyUnblock() {
  const hostname = window.location.hostname;
  chrome.runtime.sendMessage({ 
    action: 'temporarilyUnblock', 
    site: hostname 
  });
  removeOverlay();
}

// End focus session
function endFocusSession() {
  chrome.runtime.sendMessage({ action: 'endFocusSession' });
  removeOverlay();
}

// Prevent scrolling when overlay is active
function preventScrolling() {
  const preventDefault = (e) => {
    e.preventDefault();
    return false;
  };

  document.addEventListener('wheel', preventDefault, { passive: false });
  document.addEventListener('touchmove', preventDefault, { passive: false });
  document.addEventListener('keydown', (e) => {
    if ([32, 33, 34, 35, 36, 37, 38, 39, 40].includes(e.keyCode)) {
      e.preventDefault();
      return false;
    }
  });

  // Clean up event listeners when overlay is removed
  const cleanup = () => {
    document.removeEventListener('wheel', preventDefault);
    document.removeEventListener('touchmove', preventDefault);
    document.removeEventListener('keydown', arguments.callee);
  };

  // Store cleanup function for later use
  window.focusBlockerCleanup = cleanup;
}

// Check if page should be blocked on load
document.addEventListener('DOMContentLoaded', () => {
  checkIfShouldBlock();
});

// Also check on navigation
window.addEventListener('beforeunload', () => {
  removeOverlay();
});

window.addEventListener('load', () => {
  checkIfShouldBlock();
});

// Check if current site should be blocked
function checkIfShouldBlock() {
  chrome.runtime.sendMessage({ action: 'getFocusSession' }, (response) => {
    if (response && response.isActive) {
      const hostname = window.location.hostname;
      
      // Check if this is the focus site or allowed site
      if (hostname.includes(response.focusSite)) {
        return; // This is the focus site, don't block
      }
      
      if (response.allowedSites) {
        for (let allowed of response.allowedSites) {
          if (hostname.includes(allowed)) {
            return; // This is an allowed site
          }
        }
      }
      
      // This site should be blocked
      createBlockOverlay(hostname);
    }
  });
}

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (currentOverlay) {
    // Escape key to close overlay (if allowed)
    if (e.key === 'Escape') {
      // Don't allow escape to bypass the block
      e.preventDefault();
      return;
    }
    
    // Ctrl+Shift+F to temporarily unblock
    if (e.ctrlKey && e.shiftKey && e.key === 'F') {
      temporarilyUnblock();
    }
    
    // Ctrl+Shift+X to end session
    if (e.ctrlKey && e.shiftKey && e.key === 'X') {
      endFocusSession();
    }
  }
});

// Add visual feedback when trying to interact with blocked page
document.addEventListener('click', (e) => {
  if (currentOverlay && !currentOverlay.contains(e.target)) {
    e.preventDefault();
    e.stopPropagation();
    
    // Flash the overlay to draw attention
    currentOverlay.style.animation = 'pulse 0.5s';
    setTimeout(() => {
      if (currentOverlay) {
        currentOverlay.style.animation = '';
      }
    }, 500);
  }
}, true);

// Add CSS animations dynamically
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0% { opacity: 0.95; }
    50% { opacity: 1; }
    100% { opacity: 0.95; }
  }
  
  #focus-blocker-overlay {
    animation: fadeIn 0.3s ease-in;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;
document.head.appendChild(style);

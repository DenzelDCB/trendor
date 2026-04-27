// Content script for Student Focus Helper Chrome Extension

let currentOverlay = null;
let timerInterval = null;
let lastUrl = window.location.href;
let focusModeIndicator = null;
let isBlocked = false;
let lastBlockedUrl = null;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'sessionEnded':
      removeOverlay();
      removeFocusModeIndicator();
      break;
    case 'updateTimer':
      updateOverlayTimer(message.timeRemaining);
      break;
    case 'blockSite':
      createBlockOverlay(message.hostname);
      break;
    case 'showFocusMode':
      showFocusModeIndicator();
      break;
    case 'hideFocusMode':
      removeFocusModeIndicator();
      break;
  }
});

// Monitor URL changes in real-time
function monitorUrlChanges() {
  const currentUrl = window.location.href;
  
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    // Check if new URL should be blocked
    checkCurrentUrl();
  }
}

// Check current URL against focus session
function checkCurrentUrl() {
  chrome.runtime.sendMessage({ action: 'getFocusSession' }, (response) => {
    if (response && response.isActive) {
      const hostname = window.location.hostname;
      const currentUrl = window.location.href;
      
      // Check if this is focus site or allowed site
      if (hostname.includes(response.focusSite)) {
        if (isBlocked) {
          removeOverlay();
          isBlocked = false;
        }
        showFocusModeIndicator();
        return;
      }
      
      if (response.allowedSites) {
        for (let allowed of response.allowedSites) {
          if (hostname.includes(allowed)) {
            if (isBlocked) {
              removeOverlay();
              isBlocked = false;
            }
            showFocusModeIndicator();
            return;
          }
        }
      }
      
      // This site should be blocked - only create overlay if not already blocked
      if (!isBlocked || lastBlockedUrl !== currentUrl) {
        createBlockOverlay(hostname);
        isBlocked = true;
        lastBlockedUrl = currentUrl;
        // Hide focus mode indicator when site is blocked
        removeFocusModeIndicator();
      }
    } else {
      if (isBlocked) {
        removeOverlay();
        isBlocked = false;
      }
      removeFocusModeIndicator();
    }
  });
}

// Show focus mode indicator
function showFocusModeIndicator() {
  if (focusModeIndicator) return;
  
  focusModeIndicator = document.createElement('div');
  focusModeIndicator.id = 'focus-mode-indicator';
  focusModeIndicator.innerHTML = `
    <div class="focus-indicator-content">
      🎯 Focus Mode Active
    </div>
  `;
  
  focusModeIndicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #28a745;
    color: white;
    padding: 8px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: bold;
    z-index: 999997;
    animation: pulse 2s infinite;
    box-shadow: 0 2px 10px rgba(40, 167, 69, 0.3);
  `;
  
  document.body.appendChild(focusModeIndicator);
}

// Remove focus mode indicator
function removeFocusModeIndicator() {
  if (focusModeIndicator) {
    focusModeIndicator.remove();
    focusModeIndicator = null;
  }
}

// Set up multiple monitoring methods
function setupMonitoring() {
  // Monitor URL changes every 2 seconds (reduced frequency to prevent refresh loops)
  setInterval(monitorUrlChanges, 2000);
  
  // Monitor pushState and replaceState for SPA navigation
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function() {
    originalPushState.apply(this, arguments);
    setTimeout(monitorUrlChanges, 100);
  };
  
  history.replaceState = function() {
    originalReplaceState.apply(this, arguments);
    setTimeout(monitorUrlChanges, 100);
  };
  
  // Monitor hash changes
  window.addEventListener('hashchange', monitorUrlChanges);
  
  // Monitor popstate for browser back/forward
  window.addEventListener('popstate', monitorUrlChanges);
  
  // Initial check
  setTimeout(checkCurrentUrl, 100);
}

// Create blocking notification
function createBlockOverlay(blockedHostname) {
  // Remove any existing notification
  removeOverlay();

  // Create small notification instead of full overlay
  currentOverlay = document.createElement('div');
  currentOverlay.id = 'focus-blocker-notification';
  currentOverlay.innerHTML = `
    <div class="focus-notification-content">
      <div class="focus-notification-icon">🎯</div>
      <div class="focus-notification-text">
        <strong>${blockedHostname}</strong> blocked • 
        <span id="notification-time-remaining">25:00</span> remaining
      </div>
      <div class="focus-notification-actions">
        <button id="temp-unblock-btn" title="Temporarily Unblock (5 min)">⏰</button>
        <button id="end-session-btn" title="End Focus Session">⏹️</button>
      </div>
    </div>
  `;

  // Add styles for small notification
  currentOverlay.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #ff6b6b, #ee5a24);
    color: white;
    padding: 12px 16px;
    border-radius: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 1000000;
    box-shadow: 0 4px 20px rgba(238, 90, 36, 0.4);
    max-width: 400px;
    animation: slideIn 0.3s ease-out;
    cursor: pointer;
  `;

  // Add content styles
  const content = currentOverlay.querySelector('.focus-notification-content');
  content.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
  `;

  const icon = currentOverlay.querySelector('.focus-notification-icon');
  icon.style.cssText = `
    font-size: 16px;
    flex-shrink: 0;
  `;

  const text = currentOverlay.querySelector('.focus-notification-text');
  text.style.cssText = `
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `;

  const actions = currentOverlay.querySelector('.focus-notification-actions');
  actions.style.cssText = `
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  `;

  const buttons = currentOverlay.querySelectorAll('button');
  buttons.forEach(btn => {
    btn.style.cssText = `
      background: rgba(255, 255, 255, 0.2);
      border: none;
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.2s;
    `;
  });

  // Add the notification to the page
  document.body.appendChild(currentOverlay);

  // Add event listeners
  document.getElementById('temp-unblock-btn').addEventListener('click', temporarilyUnblock);
  document.getElementById('end-session-btn').addEventListener('click', endFocusSession);

  // Start timer updates
  startTimerUpdates();

  // Block page interaction (but keep page visible)
  blockPageInteraction();

  // Auto-hide after 8 seconds
  setTimeout(() => {
    if (currentOverlay && currentOverlay.parentNode) {
      currentOverlay.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        if (currentOverlay && currentOverlay.parentNode) {
          removeOverlay();
        }
      }, 300);
    }
  }, 8000);
}

// Block page interaction without hiding content
function blockPageInteraction() {
  // Create a full-page blocking overlay
  const pageBlocker = document.createElement('div');
  pageBlocker.id = 'focus-page-blocker';
  pageBlocker.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #f8f9fa, #e9ecef);
    z-index: 999996;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
  `;
  
  // Create blocking message content
  const messageContent = document.createElement('div');
  messageContent.style.cssText = `
    text-align: center;
    color: #495057;
    padding: 40px;
    max-width: 500px;
  `;
  messageContent.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 20px;">🚫</div>
    <div style="font-size: 24px; font-weight: 600; color: #e74c3c; margin-bottom: 15px;">This Page is Blocked</div>
    <div style="font-size: 16px; color: #6c757d; line-height: 1.6;">
      Please move to your focus page to continue studying.<br>
      Your focus session is still active.
    </div>
  `;
  
  pageBlocker.appendChild(messageContent);
  document.body.appendChild(pageBlocker);
  
  // Prevent scrolling
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
  
  // Create invisible overlay to block clicks
  const blocker = document.createElement('div');
  blocker.id = 'focus-interaction-blocker';
  blocker.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: transparent;
    z-index: 999998;
    cursor: not-allowed;
  `;
  document.body.appendChild(blocker);

  // Prevent keyboard shortcuts and interactions
  const preventInteraction = (e) => {
    // Allow interaction with notification elements
    if (e.target.closest('#focus-blocker-notification')) {
      return;
    }
    
    // Block most interactions
    if (e.type === 'click' || e.type === 'mousedown' || e.type === 'mouseup') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    
    // Block keyboard shortcuts except for our focus shortcuts
    if (e.type === 'keydown') {
      // Allow our shortcuts
      if (e.ctrlKey && e.shiftKey && (e.key === 'F' || e.key === 'X')) {
        return;
      }
      // Block other potentially disruptive keys
      if ([32, 33, 34, 35, 36, 37, 38, 39, 40, 8, 46].includes(e.keyCode)) {
        e.preventDefault();
        return false;
      }
    }
  };

  // Add event listeners
  document.addEventListener('click', preventInteraction, true);
  document.addEventListener('mousedown', preventInteraction, true);
  document.addEventListener('keydown', preventInteraction, true);
  
  // Store cleanup function
  window.focusBlockerCleanup = () => {
    const blocker = document.getElementById('focus-interaction-blocker');
    if (blocker) blocker.remove();
    
    const pageBlocker = document.getElementById('focus-page-blocker');
    if (pageBlocker) pageBlocker.remove();
    
    // Restore scrolling
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    
    document.removeEventListener('click', preventInteraction, true);
    document.removeEventListener('mousedown', preventInteraction, true);
    document.removeEventListener('keydown', preventInteraction, true);
  };
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
  
  // Clean up interaction blocking
  if (window.focusBlockerCleanup) {
    window.focusBlockerCleanup();
    window.focusBlockerCleanup = null;
  }
  
  // Reset blocking state
  isBlocked = false;
  lastBlockedUrl = null;
  
  // Restart monitoring when overlay is removed
  setupMonitoring();
}

// Update timer display on notification
function updateOverlayTimer(timeString) {
  const timerElement = document.getElementById('notification-time-remaining');
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

// Initialize monitoring when page loads
document.addEventListener('DOMContentLoaded', () => {
  setupMonitoring();
});

// Also check on navigation
window.addEventListener('beforeunload', () => {
  removeOverlay();
});

window.addEventListener('load', () => {
  setupMonitoring();
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
  
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
  
  #focus-blocker-notification {
    animation: slideIn 0.3s ease-out;
  }
`;
document.head.appendChild(style);

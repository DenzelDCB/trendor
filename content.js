// Student Focus Helper 2.0 - Enhanced Content Script

let currentOverlay = null;
let timerInterval = null;
let lastUrl = window.location.href;
let focusModeIndicator = null;
let isBlocked = false;
let lastBlockedUrl = null;
let interactionBlocker = null;
let motivationalQuotes = [
  "Stay focused! Great things take time. 🎯",
  "You're doing amazing! Keep going! 💪",
  "Focus on progress, not perfection. 📈",
  "Every expert was once a beginner. 🌟",
  "Your future self will thank you! 🚀",
  "Small steps lead to big results. 👣",
  "Stay disciplined, stay focused. 🎓",
  "Success is the sum of small efforts. ✨"
];

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
      createEnhancedBlockOverlay(message.hostname);
      break;
    case 'showFocusMode':
      showFocusModeIndicator();
      break;
    case 'hideFocusMode':
      removeFocusModeIndicator();
      break;
  }
});

// Enhanced URL monitoring
function monitorUrlChanges() {
  const currentUrl = window.location.href;
  
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    checkCurrentUrl();
  }
}

// Check current URL against focus session
function checkCurrentUrl() {
  chrome.runtime.sendMessage({ action: 'getFocusSession' }, (response) => {
    if (response && response.isActive && !response.isPaused) {
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
      
      // This site should be blocked
      if (!isBlocked || lastBlockedUrl !== currentUrl) {
        createEnhancedBlockOverlay(hostname);
        isBlocked = true;
        lastBlockedUrl = currentUrl;
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

// Enhanced focus mode indicator
function showFocusModeIndicator() {
  if (focusModeIndicator) return;
  
  focusModeIndicator = document.createElement('div');
  focusModeIndicator.id = 'focus-mode-indicator';
  
  const motivationalQuote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
  
  focusModeIndicator.innerHTML = `
    <div class="focus-indicator-content">
      <div class="focus-indicator-icon">🎯</div>
      <div class="focus-indicator-text">
        <div class="focus-indicator-title">Focus Mode Active</div>
        <div class="focus-indicator-quote">${motivationalQuote}</div>
      </div>
      <div class="focus-indicator-timer" id="indicator-timer">--:--</div>
    </div>
  `;
  
  focusModeIndicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #28a745, #20c997);
    color: white;
    padding: 16px;
    border-radius: 12px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 999997;
    animation: slideIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    box-shadow: 0 4px 20px rgba(40, 167, 69, 0.3);
    max-width: 300px;
    backdrop-filter: blur(10px);
  `;
  
  const content = focusModeIndicator.querySelector('.focus-indicator-content');
  content.style.cssText = `
    display: flex;
    align-items: center;
    gap: 12px;
  `;
  
  const icon = focusModeIndicator.querySelector('.focus-indicator-icon');
  icon.style.cssText = `
    font-size: 20px;
    flex-shrink: 0;
  `;
  
  const text = focusModeIndicator.querySelector('.focus-indicator-text');
  text.style.cssText = `
    flex: 1;
  `;
  
  const title = focusModeIndicator.querySelector('.focus-indicator-title');
  title.style.cssText = `
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 4px;
  `;
  
  const quote = focusModeIndicator.querySelector('.focus-indicator-quote');
  quote.style.cssText = `
    font-size: 12px;
    opacity: 0.9;
    font-style: italic;
  `;
  
  const timer = focusModeIndicator.querySelector('.focus-indicator-timer');
  timer.style.cssText = `
    font-family: 'Courier New', monospace;
    font-weight: 600;
    font-size: 16px;
    flex-shrink: 0;
  `;
  
  document.body.appendChild(focusModeIndicator);
  
  // Start timer updates
  startIndicatorTimer();
  
  // Auto-hide after 10 seconds
  setTimeout(() => {
    if (focusModeIndicator && focusModeIndicator.parentNode) {
      focusModeIndicator.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        if (focusModeIndicator && focusModeIndicator.parentNode) {
          focusModeIndicator.remove();
          focusModeIndicator = null;
        }
      }, 300);
    }
  }, 10000);
}

// Start indicator timer
function startIndicatorTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  timerInterval = setInterval(() => {
    chrome.runtime.sendMessage({ action: 'getTimerUpdate' }, (response) => {
      if (response && response.timeRemaining && focusModeIndicator) {
        const timerElement = document.getElementById('indicator-timer');
        if (timerElement) {
          const minutes = Math.floor(response.timeRemaining / 60000);
          const seconds = Math.floor((response.timeRemaining % 60000) / 1000);
          timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
      }
    });
  }, 1000);
}

// Remove focus mode indicator
function removeFocusModeIndicator() {
  if (focusModeIndicator) {
    focusModeIndicator.remove();
    focusModeIndicator = null;
  }
  
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// Enhanced monitoring setup
function setupMonitoring() {
  // Monitor URL changes every 2 seconds
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

// Enhanced block overlay with better UX
function createEnhancedBlockOverlay(blockedHostname) {
  // Remove any existing overlay
  removeOverlay();

  // Create full-page blocking overlay
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
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    backdrop-filter: blur(5px);
  `;
  
  // Create motivational blocking message
  const messageContent = document.createElement('div');
  messageContent.style.cssText = `
    text-align: center;
    color: #495057;
    padding: 40px;
    max-width: 600px;
    animation: fadeIn 0.6s ease-out;
  `;
  
  const blockQuote = motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
  
  messageContent.innerHTML = `
    <div class="block-icon">🚫</div>
    <div class="block-title">This Page is Blocked</div>
    <div class="block-subtitle">${blockedHostname}</div>
    <div class="block-message">
      <p>Stay focused on your goals! 🎯</p>
      <p class="motivational-quote">${blockQuote}</p>
      <p>Please navigate to your focus page to continue studying.</p>
    </div>
    <div class="block-timer">
      <div class="timer-display" id="block-timer">--:--</div>
      <div class="timer-label">Time Remaining</div>
    </div>
    <div class="block-actions">
      <button class="block-btn btn-primary" id="temp-unblock-btn">
        <span class="btn-icon">⏰</span>
        Temporarily Unblock (5 min)
      </button>
      <button class="block-btn btn-secondary" id="extend-session-btn">
        <span class="btn-icon">➕</span>
        Extend Session (+5 min)
      </button>
      <button class="block-btn btn-danger" id="end-session-btn">
        <span class="btn-icon">⏹️</span>
        End Focus Session
      </button>
    </div>
    <div class="keyboard-shortcuts">
      <p><strong>Keyboard Shortcuts:</strong></p>
      <p>Ctrl+Shift+F - Temporarily Unblock</p>
      <p>Ctrl+Shift+X - End Session</p>
    </div>
  `;
  
  // Style the message content
  const style = document.createElement('style');
  style.textContent = `
    .block-icon {
      font-size: 64px;
      margin-bottom: 20px;
      animation: pulse 2s infinite;
    }
    
    .block-title {
      font-size: 32px;
      font-weight: 700;
      color: #e74c3c;
      margin-bottom: 10px;
    }
    
    .block-subtitle {
      font-size: 18px;
      color: #666;
      margin-bottom: 20px;
      font-weight: 500;
    }
    
    .block-message {
      font-size: 16px;
      color: #6c757d;
      line-height: 1.6;
      margin-bottom: 30px;
    }
    
    .motivational-quote {
      font-style: italic;
      color: #28a745;
      font-weight: 500;
      margin: 15px 0;
    }
    
    .block-timer {
      margin: 30px 0;
      padding: 20px;
      background: white;
      border-radius: 12px;
      border: 2px solid #e9ecef;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }
    
    .timer-display {
      font-size: 48px;
      font-weight: 700;
      color: #667eea;
      font-family: 'Courier New', monospace;
      margin-bottom: 8px;
    }
    
    .timer-label {
      font-size: 14px;
      color: #6c757d;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .block-actions {
      display: flex;
      gap: 15px;
      justify-content: center;
      flex-wrap: wrap;
      margin: 30px 0;
    }
    
    .block-btn {
      padding: 12px 20px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 180px;
      justify-content: center;
    }
    
    .btn-primary {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
    }
    
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);
    }
    
    .btn-secondary {
      background: #6c757d;
      color: white;
    }
    
    .btn-secondary:hover {
      background: #5a6268;
      transform: translateY(-2px);
    }
    
    .btn-danger {
      background: #dc3545;
      color: white;
    }
    
    .btn-danger:hover {
      background: #c82333;
      transform: translateY(-2px);
    }
    
    .btn-icon {
      font-size: 16px;
    }
    
    .keyboard-shortcuts {
      margin-top: 30px;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }
    
    .keyboard-shortcuts p {
      margin: 5px 0;
      font-size: 14px;
      color: #495057;
    }
    
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
  `;
  
  pageBlocker.appendChild(messageContent);
  pageBlocker.appendChild(style);
  document.body.appendChild(pageBlocker);
  
  // Prevent scrolling
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
  
  // Create invisible overlay to block clicks
  interactionBlocker = document.createElement('div');
  interactionBlocker.id = 'focus-interaction-blocker';
  interactionBlocker.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: transparent;
    z-index: 999998;
    cursor: not-allowed;
  `;
  document.body.appendChild(interactionBlocker);

  // Enhanced interaction prevention
  const preventInteraction = (e) => {
    // Allow interaction with block overlay elements
    if (e.target.closest('#focus-page-blocker')) {
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

  // Add event listeners to buttons
  document.getElementById('temp-unblock-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ action: 'temporarilyUnblock', site: blockedHostname });
    removeOverlay();
  });

  document.getElementById('extend-session-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ action: 'extendSession', extension: 5 * 60 * 1000 });
    removeOverlay();
  });

  document.getElementById('end-session-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ action: 'endFocusSession' });
    removeOverlay();
  });

  // Start timer updates
  startBlockTimer();
}

// Start block timer
function startBlockTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  timerInterval = setInterval(() => {
    chrome.runtime.sendMessage({ action: 'getTimerUpdate' }, (response) => {
      if (response && response.timeRemaining) {
        const timerElement = document.getElementById('block-timer');
        if (timerElement) {
          const minutes = Math.floor(response.timeRemaining / 60000);
          const seconds = Math.floor((response.timeRemaining % 60000) / 1000);
          timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
      }
    });
  }, 1000);
}

// Remove the blocking overlay
function removeOverlay() {
  if (currentOverlay) {
    currentOverlay.remove();
    currentOverlay = null;
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
  
  // Restore scrolling
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
  
  // Restart monitoring when overlay is removed
  setupMonitoring();
}

// Update timer display on overlay
function updateOverlayTimer(timeString) {
  const timerElement = document.getElementById('notification-time-remaining');
  if (timerElement) {
    timerElement.textContent = timeString;
  }
}

// Enhanced keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (isBlocked) {
    // Ctrl+Shift+F to temporarily unblock
    if (e.ctrlKey && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      const hostname = window.location.hostname;
      chrome.runtime.sendMessage({ 
        action: 'temporarilyUnblock', 
        site: hostname 
      });
      removeOverlay();
    }
    
    // Ctrl+Shift+X to end session
    if (e.ctrlKey && e.shiftKey && e.key === 'X') {
      e.preventDefault();
      chrome.runtime.sendMessage({ action: 'endFocusSession' });
      removeOverlay();
    }
  }
});

// Enhanced visual feedback
document.addEventListener('click', (e) => {
  if (isBlocked && !e.target.closest('#focus-page-blocker')) {
    e.preventDefault();
    e.stopPropagation();
    
    // Flash the overlay to draw attention
    const pageBlocker = document.getElementById('focus-page-blocker');
    if (pageBlocker) {
      pageBlocker.style.animation = 'shake 0.5s';
      setTimeout(() => {
        pageBlocker.style.animation = '';
      }, 500);
    }
  }
}, true);

// Add shake animation
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-10px); }
    75% { transform: translateX(10px); }
  }
`;
document.head.appendChild(shakeStyle);

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

// Performance optimization - debounce rapid URL changes
let debounceTimer;
const debouncedCheckUrl = () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(checkCurrentUrl, 300);
};

// Enhanced monitoring for single-page applications
const observer = new MutationObserver((mutations) => {
  let shouldCheck = false;
  
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      // Check if significant content changes occurred
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE && 
            (node.tagName === 'DIV' || node.tagName === 'SECTION' || node.tagName === 'MAIN')) {
          shouldCheck = true;
        }
      });
    }
  });
  
  if (shouldCheck) {
    debouncedCheckUrl();
  }
});

// Start observing the document
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: false,
  characterData: false
});

// Handle visibility changes (when user switches tabs)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    // User returned to the tab, check if we should block
    checkCurrentUrl();
  }
});

// Enhanced error handling
window.addEventListener('error', (e) => {
  console.error('Content script error:', e.error);
});

// Cleanup on page unload
window.addEventListener('unload', () => {
  if (observer) {
    observer.disconnect();
  }
  removeOverlay();
});

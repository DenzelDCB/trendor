// Background script for Student Focus Helper Chrome Extension

let focusSession = null;
let focusTimer = null;
let blockedSites = new Set();

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Student Focus Helper installed');
  loadStoredData();
});

// Load stored data from chrome.storage
async function loadStoredData() {
  try {
    const result = await chrome.storage.sync.get(['focusSession', 'blockedSites', 'statistics']);
    if (result.focusSession) {
      focusSession = result.focusSession;
      if (focusSession.isActive) {
        startFocusTimer();
      }
    }
    if (result.blockedSites) {
      blockedSites = new Set(result.blockedSites);
    }
  } catch (error) {
    console.error('Error loading stored data:', error);
  }
}

// Listen for tab updates to check if site should be blocked
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check on any URL change, not just complete
  if (changeInfo.url || (changeInfo.status === 'complete' && tab.url)) {
    const url = changeInfo.url || tab.url;
    checkAndBlockSite(tabId, url);
  }
});

// Listen for tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      checkAndBlockSite(activeInfo.tabId, tab.url);
    }
  } catch (error) {
    console.error('Error checking activated tab:', error);
  }
});

// Listen for tab creation (new tabs)
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.url && tab.url !== 'chrome://newtab/') {
    setTimeout(() => {
      checkAndBlockSite(tab.id, tab.url);
    }, 100); // Small delay to ensure tab is ready
  }
});

// Listen for tab replacement (when navigating to existing tab)
chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  chrome.tabs.get(addedTabId, (tab) => {
    if (tab.url) {
      checkAndBlockSite(addedTabId, tab.url);
    }
  });
});

// Continuous monitoring for active focus session
setInterval(() => {
  if (focusSession && focusSession.isActive) {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.url) {
          checkAndBlockSite(tab.id, tab.url);
        }
      });
    });
  }
}, 500); // Check every 500ms for more responsive updates

// Check if a site should be blocked and block it if necessary
function checkAndBlockSite(tabId, url) {
  if (!focusSession || !focusSession.isActive) {
    return;
  }

  // Skip chrome://, chrome-extension://, and file:// URLs
  if (url.startsWith('chrome://') || 
      url.startsWith('chrome-extension://') || 
      url.startsWith('file://') ||
      url.startsWith('moz-extension://') ||
      url.startsWith('edge://')) {
    return;
  }

  try {
    const hostname = new URL(url).hostname;
    
    // Allow focus site and allowed sites
    if (isAllowedSite(hostname)) {
      return;
    }

    // Block the site
    blockSite(tabId, hostname);
  } catch (error) {
    console.error('Error parsing URL:', url, error);
  }
}

// Check if a site is allowed
function isAllowedSite(hostname) {
  if (!focusSession) return false;
  
  // Check if it's the focus site
  if (hostname.includes(focusSession.focusSite)) {
    return true;
  }
  
  // Check if it's in allowed sites
  if (focusSession.allowedSites) {
    return focusSession.allowedSites.some(allowed => hostname.includes(allowed));
  }
  
  return false;
}

// Block a site by injecting content script
function blockSite(tabId, hostname) {
  try {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: createBlockOverlay,
      args: [hostname]
    }).catch(error => {
      console.error('Error injecting script:', error);
    });
  } catch (error) {
    console.error('Error blocking site:', hostname, error);
  }
}

// Function to be injected into blocked pages
function createBlockOverlay(blockedHostname) {
  // Remove any existing notification
  const existingNotification = document.getElementById('focus-blocker-notification');
  if (existingNotification) {
    existingNotification.remove();
  }

  // Create small notification instead of full overlay
  const notification = document.createElement('div');
  notification.id = 'focus-blocker-notification';
  notification.innerHTML = `
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
  notification.style.cssText = `
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
  const content = notification.querySelector('.focus-notification-content');
  content.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
  `;

  const icon = notification.querySelector('.focus-notification-icon');
  icon.style.cssText = `
    font-size: 16px;
    flex-shrink: 0;
  `;

  const text = notification.querySelector('.focus-notification-text');
  text.style.cssText = `
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `;

  const actions = notification.querySelector('.focus-notification-actions');
  actions.style.cssText = `
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  `;

  const buttons = notification.querySelectorAll('button');
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

  document.body.appendChild(notification);

  // Add event listeners
  document.getElementById('temp-unblock-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ action: 'temporarilyUnblock', site: blockedHostname });
    cleanupAndRemove();
  });

  document.getElementById('end-session-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ action: 'endFocusSession' });
    cleanupAndRemove();
  });

  // Cleanup function
  function cleanupAndRemove() {
    // Clean up interaction blocking
    if (window.focusBlockerCleanup) {
      window.focusBlockerCleanup();
      window.focusBlockerCleanup = null;
    }
    notification.remove();
  }

  // Auto-hide after 8 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        if (notification.parentNode) {
          // Clean up interaction blocking
          if (window.focusBlockerCleanup) {
            window.focusBlockerCleanup();
            window.focusBlockerCleanup = null;
          }
          notification.remove();
        }
      }, 300);
    }
  }, 8000);

  // Block page interaction (but keep page visible)
  blockPageInteraction();

  // Request timer updates
  requestTimerUpdate();

  // Add CSS animations
  const style = document.createElement('style');
  style.textContent = `
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
  `;
  document.head.appendChild(style);
}

// Block page interaction without hiding content (for background script injection)
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

// Request timer updates from background script
function requestTimerUpdate() {
  chrome.runtime.sendMessage({ action: 'getTimerUpdate' });
}


// Start focus timer
function startFocusTimer() {
  if (focusTimer) {
    clearInterval(focusTimer);
  }

  focusTimer = setInterval(() => {
    if (focusSession && focusSession.endTime) {
      const now = Date.now();
      const remaining = focusSession.endTime - now;
      
      if (remaining <= 0) {
        endFocusSession();
        showSessionCompleteNotification();
      } else {
        updateTimerDisplay(remaining);
      }
    }
  }, 1000);
}

// Update timer display
function updateTimerDisplay(remaining) {
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  // Update all timer displays
  chrome.runtime.sendMessage({ 
    action: 'updateTimer', 
    timeRemaining: timeString 
  });
}

// End focus session
async function endFocusSession() {
  if (focusTimer) {
    clearInterval(focusTimer);
    focusTimer = null;
  }

  if (focusSession) {
    // Update statistics
    await updateStatistics(focusSession.duration);
    
    // Clear session
    focusSession = null;
    await chrome.storage.sync.set({ focusSession: null });
    
    // Notify all tabs to remove overlays and indicators
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      try {
        chrome.tabs.sendMessage(tab.id, { action: 'sessionEnded' });
      } catch (error) {
        // Ignore errors for tabs that can't receive messages
      }
    });
  }
}

// Update statistics
async function updateStatistics(duration) {
  try {
    const result = await chrome.storage.sync.get(['statistics']);
    let stats = result.statistics || {
      todaySessions: 0,
      weekSessions: 0,
      totalTime: 0,
      lastUpdate: Date.now()
    };

    // Check if it's a new day
    const now = new Date();
    const lastUpdate = new Date(stats.lastUpdate);
    if (now.toDateString() !== lastUpdate.toDateString()) {
      stats.todaySessions = 0;
    }

    // Update stats
    stats.todaySessions++;
    stats.weekSessions++;
    stats.totalTime += duration;
    stats.lastUpdate = Date.now();

    await chrome.storage.sync.set({ statistics: stats });
  } catch (error) {
    console.error('Error updating statistics:', error);
  }
}

// Show session complete notification
function showSessionCompleteNotification() {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon48.png',
    title: 'Focus Session Complete!',
    message: 'Great job! You completed your focus session. Take a break!'
  });
}

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    switch (message.action) {
      case 'startFocusSession':
        startFocusSession(message.data);
        sendResponse({ success: true });
        break;
      case 'endFocusSession':
        endFocusSession();
        sendResponse({ success: true });
        break;
      case 'getFocusSession':
        sendResponse(focusSession);
        return true; // Keep message channel open for async response
      case 'temporarilyUnblock':
        temporarilyUnblockSite(message.site);
        sendResponse({ success: true });
        break;
      case 'getTimerUpdate':
        if (focusSession && focusSession.endTime) {
          const remaining = focusSession.endTime - Date.now();
          sendResponse({ timeRemaining: remaining });
        } else {
          sendResponse({ timeRemaining: 0 });
        }
        return true; // Keep message channel open for async response
      default:
        sendResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ error: error.message });
  }
  return true; // Keep message channel open
});

// Start focus session
async function startFocusSession(data) {
  focusSession = {
    isActive: true,
    focusSite: data.focusSite,
    allowedSites: data.allowedSites || [],
    duration: data.duration,
    startTime: Date.now(),
    endTime: Date.now() + (data.duration * 60 * 1000)
  };

  await chrome.storage.sync.set({ focusSession: focusSession });
  startFocusTimer();

  // Check all current tabs immediately
  const tabs = await chrome.tabs.query({});
  tabs.forEach(tab => {
    if (tab.url) {
      checkAndBlockSite(tab.id, tab.url);
    }
  });

  // Notify all tabs about focus mode start
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      try {
        chrome.tabs.sendMessage(tab.id, { action: 'showFocusMode' });
      } catch (error) {
        // Ignore errors for tabs that can't receive messages
      }
    });
  });
}

// Temporarily unblock a site
async function temporarilyUnblockSite(hostname) {
  const unblockTime = Date.now() + (5 * 60 * 1000); // 5 minutes
  blockedSites.add(hostname);
  await chrome.storage.sync.set({ blockedSites: Array.from(blockedSites) });

  setTimeout(() => {
    blockedSites.delete(hostname);
    chrome.storage.sync.set({ blockedSites: Array.from(blockedSites) });
  }, 5 * 60 * 1000);
}

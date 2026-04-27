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
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs.length > 0 && tabs[0].url) {
        checkAndBlockSite(tabs[0].id, tabs[0].url);
      }
    });
  }
}, 1000); // Check every second for real-time blocking

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
  // Remove any existing overlay
  const existingOverlay = document.getElementById('focus-blocker-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  // Create blocking overlay
  const overlay = document.createElement('div');
  overlay.id = 'focus-blocker-overlay';
  overlay.innerHTML = `
    <div class="focus-blocker-content">
      <div class="focus-blocker-icon">🎯</div>
      <h2>Stay Focused!</h2>
      <p>This site (${blockedHostname}) is blocked during your focus session.</p>
      <p>Return to your focus site to continue studying.</p>
      <div class="focus-blocker-timer">
        <span id="overlay-time-remaining">25:00</span> remaining
      </div>
      <button id="unblock-btn" class="btn btn-warning">Temporarily Unblock (5 min)</button>
      <button id="end-session-btn" class="btn btn-danger">End Focus Session</button>
    </div>
  `;

  // Add styles
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(255, 235, 59, 0.95);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: Arial, sans-serif;
  `;

  // Add content styles
  const content = overlay.querySelector('.focus-blocker-content');
  content.style.cssText = `
    text-align: center;
    padding: 40px;
    background: white;
    border-radius: 15px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    max-width: 500px;
  `;

  document.body.appendChild(overlay);

  // Add event listeners
  document.getElementById('unblock-btn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'temporarilyUnblock', site: blockedHostname });
    overlay.remove();
  });

  document.getElementById('end-session-btn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'endFocusSession' });
    overlay.remove();
  });

  // Request timer updates
  requestTimerUpdate();
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

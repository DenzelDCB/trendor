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
  if (changeInfo.status === 'complete' && tab.url) {
    checkAndBlockSite(tabId, tab.url);
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

// Check if a site should be blocked and block it if necessary
function checkAndBlockSite(tabId, url) {
  if (!focusSession || !focusSession.isActive) {
    return;
  }

  const hostname = new URL(url).hostname;
  
  // Allow focus site and allowed sites
  if (isAllowedSite(hostname)) {
    return;
  }

  // Block the site
  blockSite(tabId, hostname);
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
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: createBlockOverlay,
    args: [hostname]
  });
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
    
    // Notify all tabs
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action: 'sessionEnded' });
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
  switch (message.action) {
    case 'startFocusSession':
      startFocusSession(message.data);
      break;
    case 'endFocusSession':
      endFocusSession();
      break;
    case 'getFocusSession':
      sendResponse(focusSession);
      break;
    case 'temporarilyUnblock':
      temporarilyUnblockSite(message.site);
      break;
    case 'getTimerUpdate':
      if (focusSession && focusSession.endTime) {
        const remaining = focusSession.endTime - Date.now();
        sendResponse({ timeRemaining: remaining });
      }
      break;
  }
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

  // Check all current tabs
  const tabs = await chrome.tabs.query({});
  tabs.forEach(tab => {
    if (tab.url) {
      checkAndBlockSite(tab.id, tab.url);
    }
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

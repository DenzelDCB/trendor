// Student Focus Helper 2.0 - Enhanced Background Script

let focusSession = null;
let focusTimer = null;
let blockedSites = new Set();
let scheduleData = null;
let analyticsData = null;
let isPaused = false;
let breakTimer = null;
let pomodoroState = null;
let sessionTracker = null;
let websiteVisits = new Map();
let sessionReports = [];

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Student Focus Helper 2.0 installed');
  loadStoredData();
  setupAlarms();
  setupContextMenus();
  initializeAnalytics();
});

// Load stored data from chrome.storage
async function loadStoredData() {
  try {
    const result = await chrome.storage.sync.get(['focusSession', 'blockedSites', 'statistics', 'schedule', 'settings', 'sessionReports']);
    
    if (result.focusSession) {
      focusSession = result.focusSession;
      if (focusSession.isActive && !focusSession.isPaused) {
        startFocusTimer();
        startSessionTracking();
      }
    }
    
    if (result.blockedSites) {
      blockedSites = new Set(result.blockedSites);
    }
    
    analyticsData = result.statistics || {
      todaySessions: 0,
      weekSessions: 0,
      totalTime: 0,
      currentStreak: 0,
      longestStreak: 0,
      averageSessionTime: 0,
      mostProductiveTime: 'morning',
      dailyHistory: {},
      weeklyHistory: {}
    };
    
    scheduleData = result.schedule || {
      type: 'manual',
      timeSlots: [],
      upcomingSessions: []
    };
    
    sessionReports = result.sessionReports || [];
    
    // Check for scheduled sessions
    checkScheduledSessions();
    
  } catch (error) {
    console.error('Error loading stored data:', error);
  }
}

// Setup alarms
function setupAlarms() {
  chrome.alarms.onAlarm.addListener((alarm) => {
    switch (alarm.name) {
      case 'focusSessionEnd':
        endFocusSession();
        showSessionCompleteNotification();
        break;
      case 'breakEnd':
        handleBreakEnd();
        break;
      case 'scheduledSession':
        startScheduledSession(alarm.scheduledSessionData);
        break;
      case 'dailyReset':
        resetDailyStats();
        break;
      case 'weeklyReset':
        resetWeeklyStats();
        break;
    }
  });
  
  // Setup periodic alarms
  chrome.alarms.create('dailyReset', {
    periodInMinutes: 24 * 60, // Daily
    scheduledTime: getNextMidnight()
  });
  
  chrome.alarms.create('weeklyReset', {
    periodInMinutes: 7 * 24 * 60, // Weekly
    scheduledTime: getNextSunday()
  });
}

// Setup context menus
function setupContextMenus() {
  chrome.contextMenus.create({
    id: 'startFocus',
    title: 'Start Focus Session',
    contexts: ['page']
  });
  
  chrome.contextMenus.create({
    id: 'blockSite',
    title: 'Block This Site',
    contexts: ['page']
  });
  
  chrome.contextMenus.create({
    id: 'allowSite',
    title: 'Allow This Site',
    contexts: ['page']
  });
  
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    switch (info.menuItemId) {
      case 'startFocus':
        startQuickFocusSession(tab.url);
        break;
      case 'blockSite':
        blockCurrentSite(tab.url);
        break;
      case 'allowSite':
        allowCurrentSite(tab.url);
        break;
    }
  });
}

// Initialize analytics
function initializeAnalytics() {
  // Track installation
  trackEvent('extension_installed', {
    version: '2.0.0',
    timestamp: Date.now()
  });
}

// Enhanced tab monitoring
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || (changeInfo.status === 'complete' && tab.url)) {
    const url = changeInfo.url || tab.url;
    checkAndBlockSite(tabId, url);
    
    // Track site visits for analytics
    if (focusSession && focusSession.isActive && !isPaused) {
      trackSiteVisit(url);
      trackWebsiteTime(tabId, url);
    }
  }
});

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

chrome.tabs.onCreated.addListener((tab) => {
  setTimeout(() => {
    if (tab.url && tab.url !== 'chrome://newtab/') {
      checkAndBlockSite(tab.id, tab.url);
    }
    enforceTabLimit();
  }, 100);
});

chrome.tabs.onRemoved.addListener(enforceTabLimit);

chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  chrome.tabs.get(addedTabId, (tab) => {
    if (tab.url) {
      checkAndBlockSite(addedTabId, tab.url);
    }
  });
});

// Continuous monitoring for active focus session
setInterval(() => {
  if (focusSession && focusSession.isActive && !isPaused) {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.url) {
          checkAndBlockSite(tab.id, tab.url);
        }
      });
    });
  }
}, 500);

// Enhanced site blocking with AI-powered detection
function checkAndBlockSite(tabId, url) {
  if (!focusSession || !focusSession.isActive || isPaused) {
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
    if (isAllowedSite(url)) {
      return;
    }

    // Check if site should be blocked based on settings
    if (shouldBlockSite(hostname, url)) {
      blockSite(tabId, hostname);
    }
  } catch (error) {
    console.error('Error parsing URL:', url, error);
  }
}

// Enhanced allowed site checking
function isAllowedSite(url) {
  if (!focusSession) return false;
  
  try {
    const urlObj = new URL(url);
    const fullUrl = url;
    const hostname = urlObj.hostname;
    
    // Check if it's the focus site
    if (hostname.includes(focusSession.focusSite)) {
      return true;
    }
    
    // Check if it's in allowed sites
    if (focusSession.allowedSites) {
      return focusSession.allowedSites.some(allowed => {
        const cleanAllowed = allowed.trim();
        
        if (cleanAllowed.startsWith('http://') || cleanAllowed.startsWith('https://')) {
          return fullUrl.startsWith(cleanAllowed) || cleanAllowed.startsWith(fullUrl);
        }
        
        return hostname.includes(cleanAllowed);
      });
    }
    
    return false;
  } catch (error) {
    console.error('Error checking allowed site:', url, error);
    return false;
  }
}

// AI-powered site blocking decision
function shouldBlockSite(hostname, url) {
  // Check if site is in temporary unblock list
  if (blockedSites.has(hostname)) {
    return false;
  }
  
  // Get settings
  chrome.storage.sync.get(['settings'], (result) => {
    const settings = result.settings || {};
    
    if (settings.smartBlocking) {
      // AI-powered blocking logic
      return isDistractingSite(hostname, url, settings);
    } else {
      // Simple blocking - block everything not allowed
      return true;
    }
  });
  
  return true; // Default to blocking
}

// AI-powered distracting site detection
function isDistractingSite(hostname, url, settings) {
  const distractingCategories = [
    'social', 'entertainment', 'gaming', 'news', 'shopping', 'video'
  ];
  
  const distractingKeywords = [
    'facebook', 'twitter', 'instagram', 'youtube', 'reddit', 'tiktok',
    'netflix', 'hulu', 'amazon', 'ebay', 'game', 'steam'
  ];
  
  const educationalKeywords = [
    'khan', 'coursera', 'edx', 'udemy', 'duolingo', 'wikipedia',
    'stackoverflow', 'github', 'documentation'
  ];
  
  // Check if it's educational
  if (educationalKeywords.some(keyword => hostname.includes(keyword))) {
    return false;
  }
  
  // Check if it's distracting
  if (distractingKeywords.some(keyword => hostname.includes(keyword))) {
    return true;
  }
  
  // Check URL patterns
  if (url.includes('/watch') || url.includes('/video') || url.includes('/game')) {
    return true;
  }
  
  // Default to blocking for unknown sites in strict mode
  return settings.strictMode || false;
}

// Enhanced site blocking with better UI
function blockSite(tabId, hostname) {
  try {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: createEnhancedBlockOverlay,
      args: [hostname, focusSession]
    }).catch(error => {
      console.error('Error injecting script:', error);
    });
  } catch (error) {
    console.error('Error blocking site:', hostname, error);
  }
}

// Enhanced block overlay function
function createEnhancedBlockOverlay(blockedHostname, sessionData) {
  // Remove any existing notification
  const existingNotification = document.getElementById('focus-blocker-notification');
  if (existingNotification) {
    existingNotification.remove();
  }

  // Create enhanced notification
  const notification = document.createElement('div');
  notification.id = 'focus-blocker-notification';
  notification.innerHTML = `
    <div class="focus-notification-content">
      <div class="focus-notification-header">
        <div class="focus-notification-icon">🎯</div>
        <div class="focus-notification-title">Focus Mode Active</div>
        <div class="focus-notification-close" id="close-notification">×</div>
      </div>
      <div class="focus-notification-body">
        <div class="focus-notification-text">
          <strong>${blockedHostname}</strong> is blocked during your focus session
        </div>
        <div class="focus-notification-timer">
          <span id="notification-time-remaining">${formatTime(sessionData.endTime - Date.now())}</span> remaining
        </div>
        <div class="focus-notification-progress">
          <div class="progress-bar">
            <div class="progress-fill" id="progress-fill"></div>
          </div>
        </div>
      </div>
      <div class="focus-notification-actions">
        <button id="temp-unblock-btn" class="btn btn-small">⏰ 5 min</button>
        <button id="extend-session-btn" class="btn btn-small">➕ +5 min</button>
        <button id="end-session-btn" class="btn btn-small btn-danger">⏹️ End</button>
      </div>
    </div>
  `;

  // Enhanced styles
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    padding: 0;
    border-radius: 16px;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 1000000;
    box-shadow: 0 10px 40px rgba(102, 126, 234, 0.3);
    max-width: 400px;
    animation: slideIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    backdrop-filter: blur(10px);
  `;

  // Add content styles
  const content = notification.querySelector('.focus-notification-content');
  content.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 0;
  `;

  const header = notification.querySelector('.focus-notification-header');
  header.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  `;

  const icon = notification.querySelector('.focus-notification-icon');
  icon.style.cssText = `
    font-size: 20px;
    flex-shrink: 0;
  `;

  const title = notification.querySelector('.focus-notification-title');
  title.style.cssText = `
    font-weight: 600;
    font-size: 16px;
    flex: 1;
    margin: 0 12px;
  `;

  const closeBtn = notification.querySelector('#close-notification');
  closeBtn.style.cssText = `
    background: none;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.2s;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  `;
  closeBtn.addEventListener('mouseenter', () => closeBtn.style.opacity = '1');
  closeBtn.addEventListener('mouseleave', () => closeBtn.style.opacity = '0.7');

  const body = notification.querySelector('.focus-notification-body');
  body.style.cssText = `
    padding: 12px 20px;
  `;

  const text = notification.querySelector('.focus-notification-text');
  text.style.cssText = `
    margin-bottom: 8px;
    line-height: 1.4;
  `;

  const timer = notification.querySelector('.focus-notification-timer');
  timer.style.cssText = `
    font-size: 12px;
    opacity: 0.8;
    margin-bottom: 12px;
  `;

  const progress = notification.querySelector('.focus-notification-progress');
  progress.style.cssText = `
    margin-bottom: 8px;
  `;

  const progressBar = notification.querySelector('.progress-bar');
  progressBar.style.cssText = `
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    overflow: hidden;
  `;

  const progressFill = notification.querySelector('.progress-fill');
  progressFill.style.cssText = `
    height: 100%;
    background: white;
    border-radius: 2px;
    transition: width 1s ease;
  `;

  const actions = notification.querySelector('.focus-notification-actions');
  actions.style.cssText = `
    display: flex;
    gap: 8px;
    padding: 12px 20px 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  `;

  const buttons = notification.querySelectorAll('.btn');
  buttons.forEach(btn => {
    btn.style.cssText = `
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s;
      color: white;
      font-weight: 500;
      flex: 1;
    `;
  });

  const dangerBtn = notification.querySelector('.btn-danger');
  dangerBtn.style.cssText += `
    background: rgba(220, 53, 69, 0.8);
    border-color: rgba(220, 53, 69, 0.9);
  `;

  document.body.appendChild(notification);

  // Event listeners
  document.getElementById('close-notification').addEventListener('click', cleanupAndRemove);
  document.getElementById('temp-unblock-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ action: 'temporarilyUnblock', site: blockedHostname });
    cleanupAndRemove();
  });
  document.getElementById('extend-session-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ action: 'extendSession', extension: 5 * 60 * 1000 });
    cleanupAndRemove();
  });
  document.getElementById('end-session-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.runtime.sendMessage({ action: 'endFocusSession' });
    cleanupAndRemove();
  });

  // Update progress bar
  function updateProgress() {
    if (sessionData && sessionData.endTime) {
      const remaining = sessionData.endTime - Date.now();
      const total = sessionData.duration * 60 * 1000;
      const progress = ((total - remaining) / total) * 100;
      progressFill.style.width = `${progress}%`;
    }
  }

  // Update timer and progress
  const updateInterval = setInterval(() => {
    const timerElement = document.getElementById('notification-time-remaining');
    if (timerElement && sessionData && sessionData.endTime) {
      const remaining = sessionData.endTime - Date.now();
      if (remaining > 0) {
        timerElement.textContent = formatTime(remaining);
        updateProgress();
      } else {
        clearInterval(updateInterval);
        cleanupAndRemove();
      }
    }
  }, 1000);

  // Cleanup function
  function cleanupAndRemove() {
    clearInterval(updateInterval);
    if (window.focusBlockerCleanup) {
      window.focusBlockerCleanup();
      window.focusBlockerCleanup = null;
    }
    notification.remove();
  }

  // Auto-hide after 15 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(cleanupAndRemove, 300);
    }
  }, 15000);

  // Add CSS animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%) scale(0.8);
        opacity: 0;
      }
      to {
        transform: translateX(0) scale(1);
        opacity: 1;
      }
    }
    
    @keyframes slideOut {
      from {
        transform: translateX(0) scale(1);
        opacity: 1;
      }
      to {
        transform: translateX(100%) scale(0.8);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

// Format time helper
function formatTime(milliseconds) {
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Enhanced tab limit enforcement
async function enforceTabLimit() {
  try {
    const settings = await chrome.storage.sync.get(['settings']);
    const tabLimit = settings.settings?.tabLimit || 0;
    
    if (tabLimit <= 0) return;
    
    const tabs = await chrome.tabs.query({});
    const normalTabs = tabs.filter(tab => 
      tab.url && 
      !tab.url.startsWith('chrome-extension://') &&
      !tab.url.startsWith('about:') &&
      tab.url !== 'chrome://newtab/'
    );
    
    if (normalTabs.length > tabLimit) {
      const tabsToClose = normalTabs.slice(tabLimit);
      for (const tab of tabsToClose) {
        try {
          await chrome.tabs.remove(tab.id);
          console.log(`Tab limit exceeded: closed tab ${tab.id} (${tab.url})`);
        } catch (error) {
          console.error('Error closing tab:', error);
        }
      }
      
      if (settings.settings?.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Tab Limit Reached',
          message: `Closed ${tabsToClose.length} tab(s) to maintain limit of ${tabLimit} tabs`
        });
      }
    }
  } catch (error) {
    console.error('Error enforcing tab limit:', error);
  }
}

// Enhanced focus timer
function startFocusTimer() {
  if (focusTimer) {
    clearInterval(focusTimer);
  }

  focusTimer = setInterval(() => {
    if (focusSession && focusSession.endTime && !isPaused) {
      const now = Date.now();
      const remaining = focusSession.endTime - now;
      
      if (remaining <= 0) {
        endFocusSession();
        showSessionCompleteNotification();
        
        // Handle Pomodoro breaks
        if (focusSession.sessionType === 'study' && pomodoroState) {
          startBreak();
        }
      } else {
        updateTimerDisplay(remaining);
      }
    }
  }, 1000);
}

// Update timer display
function updateTimerDisplay(remaining) {
  const timeString = formatTime(remaining);
  
  chrome.runtime.sendMessage({ 
    action: 'updateTimer', 
    timeRemaining: timeString 
  });
}

// Enhanced focus session management
async function startFocusSession(data) {
  focusSession = {
    isActive: true,
    focusSite: data.focusSite,
    allowedSites: data.allowedSites || [],
    duration: data.duration,
    sessionType: data.sessionType || 'study',
    startTime: Date.now(),
    endTime: Date.now() + (data.duration * 60 * 1000),
    isPaused: false
  };

  // Initialize Pomodoro state if study session
  if (data.sessionType === 'study') {
    pomodoroState = {
      currentCycle: 1,
      totalCycles: 4,
      workDuration: data.duration,
      breakDuration: 5,
      longBreakDuration: 15
    };
  }

  await chrome.storage.sync.set({ focusSession: focusSession });
  startFocusTimer();
  startSessionTracking();

  // Set alarm for session end
  chrome.alarms.create('focusSessionEnd', {
    scheduledTime: focusSession.endTime
  });

  // Check all current tabs
  const tabs = await chrome.tabs.query({});
  tabs.forEach(tab => {
    if (tab.url) {
      checkAndBlockSite(tab.id, tab.url);
    }
  });

  // Track session start
  trackEvent('session_started', {
    duration: data.duration,
    sessionType: data.sessionType,
    focusSite: data.focusSite
  });

  // Notify all tabs
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

// End focus session
async function endFocusSession() {
  if (focusTimer) {
    clearInterval(focusTimer);
    focusTimer = null;
  }

  if (focusSession) {
    // Calculate actual duration
    const actualDuration = Math.min(focusSession.duration, Math.floor((Date.now() - focusSession.startTime) / 60000));
    
    // Stop session tracking and generate report
    stopSessionTracking();
    
    // Update statistics
    await updateStatistics(actualDuration);
    
    // Track session end
    trackEvent('session_ended', {
      plannedDuration: focusSession.duration,
      actualDuration: actualDuration,
      sessionType: focusSession.sessionType
    });
    
    // Clear session
    focusSession = null;
    pomodoroState = null;
    await chrome.storage.sync.set({ focusSession: null });
    
    // Clear alarm
    chrome.alarms.clear('focusSessionEnd');
    
    // Notify all tabs
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

// Enhanced statistics tracking
async function updateStatistics(duration) {
  try {
    const result = await chrome.storage.sync.get(['statistics']);
    let stats = result.statistics || analyticsData;

    // Check if it's a new day
    const now = new Date();
    const lastUpdate = new Date(stats.lastUpdate || 0);
    if (now.toDateString() !== lastUpdate.toDateString()) {
      stats.todaySessions = 0;
      stats.currentStreak = checkStreak(stats);
    }

    // Update stats
    stats.todaySessions++;
    stats.weekSessions++;
    stats.totalTime += duration * 60000; // Convert to milliseconds
    stats.lastUpdate = Date.now();

    // Calculate average session time
    const totalSessions = stats.todaySessions + (stats.weekSessions - stats.todaySessions);
    stats.averageSessionTime = Math.round(stats.totalTime / (totalSessions * 60000));

    // Update daily history
    const today = now.toISOString().split('T')[0];
    if (!stats.dailyHistory[today]) {
      stats.dailyHistory[today] = { sessions: 0, totalTime: 0 };
    }
    stats.dailyHistory[today].sessions++;
    stats.dailyHistory[today].totalTime += duration * 60000;

    // Determine most productive time
    stats.mostProductiveTime = getProductiveTime(stats);

    await chrome.storage.sync.set({ statistics: stats });
    analyticsData = stats;
  } catch (error) {
    console.error('Error updating statistics:', error);
  }
}

// Check streak
function checkStreak(stats) {
  // Simple streak calculation - can be enhanced
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().split('T')[0];
  
  if (stats.dailyHistory[yesterdayKey] && stats.dailyHistory[yesterdayKey].sessions > 0) {
    return stats.currentStreak + 1;
  } else {
    return 1;
  }
}

// Get most productive time
function getProductiveTime(stats) {
  // Analyze session times to find most productive period
  // This is a simplified version
  return 'morning'; // Can be enhanced with actual time analysis
}

// Track events for analytics
function trackEvent(eventName, data) {
  console.log('Event tracked:', eventName, data);
  // Can be enhanced to send to analytics service
}

// Enhanced notifications
function showSessionCompleteNotification() {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'Focus Session Complete! 🎉',
    message: 'Great job! You completed your focus session. Take a well-deserved break!',
    buttons: [
      { title: 'Start New Session' },
      { title: 'View Stats' }
    ]
  });
}

// Message handling
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
      case 'togglePause':
        isPaused = message.isPaused;
        sendResponse({ success: true });
        break;
      case 'extendSession':
        if (focusSession) {
          focusSession.endTime += message.extension;
          focusSession.duration += Math.floor(message.extension / 60000);
          chrome.alarms.create('focusSessionEnd', {
            scheduledTime: focusSession.endTime
          });
        }
        sendResponse({ success: true });
        break;
      case 'skipBreak':
        skipBreak();
        sendResponse({ success: true });
        break;
      case 'getFocusSession':
        sendResponse(focusSession);
        return true;
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
        return true;
      case 'getSessionReports':
        sendResponse(sessionReports);
        return true;
      case 'getSessionReport':
        const report = sessionReports.find(r => r.sessionId === message.sessionId);
        sendResponse(report);
        return true;
      case 'deleteSessionReport':
        sessionReports = sessionReports.filter(r => r.sessionId !== message.sessionId);
        chrome.storage.sync.set({ sessionReports: sessionReports });
        sendResponse({ success: true });
        break;
      default:
        sendResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ error: error.message });
  }
  return true;
});

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

// Scheduled sessions
function checkScheduledSessions() {
  if (!scheduleData || !scheduleData.timeSlots) return;
  
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
  
  scheduleData.timeSlots.forEach(slot => {
    if (slot.startTime === currentTime && slot.status !== 'completed') {
      startScheduledSession(slot);
    }
  });
}

function startScheduledSession(slotData) {
  // Create alarm for scheduled session
  chrome.alarms.create('scheduledSession', {
    scheduledTime: new Date().getTime(),
    scheduledSessionData: slotData
  });
}

// Quick focus session from context menu
async function startQuickFocusSession(currentUrl) {
  try {
    const url = new URL(currentUrl);
    const hostname = url.hostname;
    
    await startFocusSession({
      focusSite: hostname,
      duration: 25,
      sessionType: 'study',
      allowedSites: [hostname]
    });
  } catch (error) {
    console.error('Error starting quick focus session:', error);
  }
}

// Block current site from context menu
async function blockCurrentSite(currentUrl) {
  try {
    const url = new URL(currentUrl);
    const hostname = url.hostname;
    
    // Add to blocked sites list
    blockedSites.add(hostname);
    await chrome.storage.sync.set({ blockedSites: Array.from(blockedSites) });
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Site Blocked',
      message: `${hostname} has been added to your blocked sites list`
    });
  } catch (error) {
    console.error('Error blocking current site:', error);
  }
}

// Allow current site from context menu
async function allowCurrentSite(currentUrl) {
  try {
    const url = new URL(currentUrl);
    const hostname = url.hostname;
    
    // Remove from blocked sites
    blockedSites.delete(hostname);
    await chrome.storage.sync.set({ blockedSites: Array.from(blockedSites) });
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Site Allowed',
      message: `${hostname} has been removed from your blocked sites list`
    });
  } catch (error) {
    console.error('Error allowing current site:', error);
  }
}

// Pomodoro break management
function startBreak() {
  if (!pomodoroState) return;
  
  const breakDuration = pomodoroState.currentCycle % 4 === 0 ? 
    pomodoroState.longBreakDuration * 60000 : 
    pomodoroState.breakDuration * 60000;
  
  chrome.alarms.create('breakEnd', {
    scheduledTime: Date.now() + breakDuration
  });
  
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'Break Time! ☕',
    message: `Take a ${Math.floor(breakDuration / 60000)}-minute break. You've earned it!`
  });
}

function handleBreakEnd() {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'Break Over! 📚',
    message: 'Time to get back to your focus session!'
  });
}

function skipBreak() {
  chrome.alarms.clear('breakEnd');
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'Break Skipped',
    message: 'Break skipped. Ready to continue focusing!'
  });
}

// Track site visits for analytics
function trackSiteVisit(url) {
  try {
    const hostname = new URL(url).hostname;
    const now = new Date();
    const hour = now.getHours();
    
    // Track which sites are visited during focus sessions
    if (!analyticsData.siteVisits) {
      analyticsData.siteVisits = {};
    }
    
    if (!analyticsData.siteVisits[hostname]) {
      analyticsData.siteVisits[hostname] = { count: 0, totalTime: 0 };
    }
    
    analyticsData.siteVisits[hostname].count++;
    
    // Track time of day for productivity analysis
    if (!analyticsData.hourlyActivity) {
      analyticsData.hourlyActivity = new Array(24).fill(0);
    }
    
    analyticsData.hourlyActivity[hour]++;
  } catch (error) {
    console.error('Error tracking site visit:', error);
  }
}

// Helper functions for time calculations
function getNextMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime();
}

function getNextSunday() {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(sunday.getDate() + (7 - sunday.getDay()));
  sunday.setHours(0, 0, 0, 0);
  return sunday.getTime();
}

// Reset daily stats
function resetDailyStats() {
  if (analyticsData) {
    analyticsData.todaySessions = 0;
    chrome.storage.sync.set({ statistics: analyticsData });
  }
}

// Reset weekly stats
function resetWeeklyStats() {
  if (analyticsData) {
    analyticsData.weekSessions = 0;
    chrome.storage.sync.set({ statistics: analyticsData });
  }
}

// Session tracking functions
function startSessionTracking() {
  if (sessionTracker) {
    clearInterval(sessionTracker);
  }
  
  websiteVisits.clear();
  
  sessionTracker = setInterval(() => {
    if (focusSession && focusSession.isActive && !isPaused) {
      updateActiveTabTime();
    }
  }, 5000); // Track every 5 seconds
}

function stopSessionTracking() {
  if (sessionTracker) {
    clearInterval(sessionTracker);
    sessionTracker = null;
  }
  
  // Generate session report
  generateSessionReport();
}

function trackWebsiteTime(tabId, url) {
  try {
    const hostname = new URL(url).hostname;
    const now = Date.now();
    
    if (!websiteVisits.has(hostname)) {
      websiteVisits.set(hostname, {
        url: url,
        hostname: hostname,
        totalTime: 0,
        visitCount: 0,
        firstVisit: now,
        lastVisit: now,
        category: categorizeWebsite(hostname),
        isRelevant: isWebsiteRelevant(hostname, focusSession)
      });
    }
    
    const visitData = websiteVisits.get(hostname);
    visitData.visitCount++;
    visitData.lastVisit = now;
    
  } catch (error) {
    console.error('Error tracking website time:', error);
  }
}

function updateActiveTabTime() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0 && tabs[0].url) {
      const url = tabs[0].url;
      try {
        const hostname = new URL(url).hostname;
        
        if (websiteVisits.has(hostname)) {
          const visitData = websiteVisits.get(hostname);
          visitData.totalTime += 5000; // Add 5 seconds
        }
      } catch (error) {
        console.error('Error updating active tab time:', error);
      }
    }
  });
}

function categorizeWebsite(hostname) {
  const categories = {
    educational: ['khanacademy', 'coursera', 'edx', 'udemy', 'duolingo', 'wikipedia', 'stackoverflow', 'github', 'python', 'programiz', 'realpython', 'exercism', 'w3schools', 'pythontutor'],
    productivity: ['google', 'gmail', 'mail', 'calendar', 'drive', 'docs', 'sheets'],
    social: ['facebook', 'twitter', 'instagram', 'linkedin', 'reddit', 'tiktok'],
    entertainment: ['youtube', 'netflix', 'hulu', 'twitch'],
    shopping: ['amazon', 'ebay', 'etsy'],
    news: ['cnn', 'bbc', 'reuters', 'washingtonpost'],
    other: []
  };
  
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => hostname.includes(keyword))) {
      return category;
    }
  }
  
  return 'other';
}

function isWebsiteRelevant(hostname, session) {
  if (!session) return false;
  
  // Check if it's the focus site
  if (hostname.includes(session.focusSite)) return true;
  
  // Check if it's in allowed sites
  if (session.allowedSites && session.allowedSites.some(site => hostname.includes(site))) {
    return true;
  }
  
  // Check if it's educational
  const category = categorizeWebsite(hostname);
  return category === 'educational';
}

function generateSessionReport() {
  if (!focusSession || websiteVisits.size === 0) return;
  
  const actualDuration = Math.min(focusSession.duration, Math.floor((Date.now() - focusSession.startTime) / 60000));
  const totalTrackedTime = Array.from(websiteVisits.values()).reduce((sum, site) => sum + site.totalTime, 0);
  
  const report = {
    sessionId: Date.now(),
    date: new Date().toISOString(),
    sessionType: focusSession.sessionType,
    focusSite: focusSession.focusSite,
    plannedDuration: focusSession.duration,
    actualDuration: actualDuration,
    totalTrackedTime: Math.floor(totalTrackedTime / 60000), // Convert to minutes
    websiteVisits: Array.from(websiteVisits.values()).map(visit => ({
      ...visit,
      totalTime: Math.floor(visit.totalTime / 60000), // Convert to minutes
      percentage: ((visit.totalTime / totalTrackedTime) * 100).toFixed(1)
    })).sort((a, b) => b.totalTime - a.totalTime),
    productivity: calculateProductivityScore(),
    insights: generateSessionInsights()
  };
  
  sessionReports.unshift(report);
  
  // Keep only last 30 reports
  if (sessionReports.length > 30) {
    sessionReports = sessionReports.slice(0, 30);
  }
  
  // Save reports
  chrome.storage.sync.set({ sessionReports: sessionReports });
  
  console.log('Session report generated:', report);
}

function calculateProductivityScore() {
  let productiveTime = 0;
  let totalTime = 0;
  
  websiteVisits.forEach((visit) => {
    totalTime += visit.totalTime;
    if (visit.isRelevant || visit.category === 'educational') {
      productiveTime += visit.totalTime;
    }
  });
  
  if (totalTime === 0) return 0;
  
  return Math.round((productiveTime / totalTime) * 100);
}

function generateSessionInsights() {
  const insights = [];
  
  // Most visited site
  const sortedVisits = Array.from(websiteVisits.values()).sort((a, b) => b.totalTime - a.totalTime);
  if (sortedVisits.length > 0) {
    const topSite = sortedVisits[0];
    insights.push(`Most time spent on ${topSite.hostname} (${Math.floor(topSite.totalTime / 60000)} minutes)`);
  }
  
  // Productivity insight
  const productivityScore = calculateProductivityScore();
  if (productivityScore >= 80) {
    insights.push('Excellent focus! Very productive session. 🎯');
  } else if (productivityScore >= 60) {
    insights.push('Good focus session with room for improvement. 💪');
  } else {
    insights.push('Consider blocking more distracting sites for better focus. 📚');
  }
  
  // Category breakdown
  const categoryTime = {};
  websiteVisits.forEach((visit) => {
    if (!categoryTime[visit.category]) {
      categoryTime[visit.category] = 0;
    }
    categoryTime[visit.category] += visit.totalTime;
  });
  
  const topCategory = Object.keys(categoryTime).reduce((a, b) => 
    categoryTime[a] > categoryTime[b] ? a : b
  );
  
  insights.push(`Primary activity: ${topCategory} websites`);
  
  return insights;
}

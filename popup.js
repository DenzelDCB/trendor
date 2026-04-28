// Student Focus Helper 2.0 - Enhanced Popup Script

let currentSession = null;
let timerInterval = null;
let isPaused = false;
let currentTab = 'focus';
let analyticsData = null;
let scheduleData = null;
let sessionReports = [];

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initializePopup();
  loadSettings();
  loadStatistics();
  loadSchedule();
  setupEventListeners();
  initializeAnalytics();
  setupTabNavigation();
});

// Initialize popup
async function initializePopup() {
  try {
    // Check if Chrome APIs are available
    if (!chrome || !chrome.runtime) {
      console.log('Chrome runtime API not available, running in standalone mode');
      currentSession = null;
      updateUI();
      return;
    }
    
    // Get current focus session
    const response = await sendMessage({ action: 'getFocusSession' });
    currentSession = response;
    
    updateUI();
    
    if (currentSession && currentSession.isActive) {
      startTimerDisplay();
    }
  } catch (error) {
    console.error('Error initializing popup:', error);
    currentSession = null;
    updateUI();
  }
}

// Setup tab navigation
function setupTabNavigation() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.dataset.tab;
      
      // Update button states
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Update content visibility
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `${targetTab}-tab`) {
          content.classList.add('active');
        }
      });
      
      currentTab = targetTab;
      
      // Load tab-specific data
      if (targetTab === 'analytics') {
        updateAnalyticsDisplay();
      } else if (targetTab === 'reports') {
        loadSessionReports();
      } else if (targetTab === 'schedule') {
        updateScheduleDisplay();
      }
    });
  });
}

// Setup event listeners
function setupEventListeners() {
  // Focus session controls
  document.getElementById('start-focus').addEventListener('click', startFocusSession);
  document.getElementById('stop-focus').addEventListener('click', stopFocusSession);
  document.getElementById('pause-focus').addEventListener('click', togglePauseSession);
  document.getElementById('extend-session').addEventListener('click', extendSession);
  document.getElementById('skip-break').addEventListener('click', skipBreak);
  document.getElementById('quick-start').addEventListener('click', quickStartSession);
  
  // Quick action buttons
  document.getElementById('quick-25').addEventListener('click', () => quickStartSession(25));
  document.getElementById('quick-45').addEventListener('click', () => quickStartSession(45));
  document.getElementById('quick-60').addEventListener('click', () => quickStartSession(60));
  document.getElementById('quick-pomodoro').addEventListener('click', startPomodoroSession);
  
  // Duration slider
  const durationSlider = document.getElementById('focus-duration');
  const durationDisplay = document.querySelector('.duration-display');
  durationSlider.addEventListener('input', (e) => {
    durationDisplay.textContent = `${e.target.value} min`;
  });
  
  // Settings
  document.getElementById('strict-mode').addEventListener('change', saveSettings);
  document.getElementById('smart-blocking').addEventListener('change', saveSettings);
  document.getElementById('break-reminders').addEventListener('change', saveSettings);
  document.getElementById('notifications').addEventListener('change', saveSettings);
  document.getElementById('sound-alerts').addEventListener('change', saveSettings);
  document.getElementById('desktop-notifications').addEventListener('change', saveSettings);
  document.getElementById('theme').addEventListener('change', saveSettings);
  document.getElementById('accent-color').addEventListener('change', saveSettings);
  
  // Tab limit
  document.getElementById('tab-limit').addEventListener('change', saveSettings);
  document.getElementById('auto-detect').addEventListener('click', autoDetectTabLimit);
  
  // Schedule
  document.getElementById('add-time-slot').addEventListener('click', addTimeSlot);
  
  // Data management
  document.getElementById('export-data').addEventListener('click', exportData);
  document.getElementById('clear-data').addEventListener('click', clearAllData);
  
  // Footer actions
  document.getElementById('help-btn').addEventListener('click', showHelp);
  document.getElementById('feedback-btn').addEventListener('click', showFeedback);
  
  // Report controls
  document.getElementById('refresh-reports').addEventListener('click', loadSessionReports);
  document.getElementById('export-reports').addEventListener('click', exportAllReports);
  document.getElementById('clear-reports').addEventListener('click', clearAllReports);
  document.getElementById('close-modal').addEventListener('click', closeReportModal);
  
  // Input validation
  document.getElementById('focus-site').addEventListener('input', validateFocusSite);
  document.getElementById('allowed-sites').addEventListener('input', updateSiteTags);
}

// Start focus session
async function startFocusSession() {
  const focusSite = document.getElementById('focus-site').value.trim();
  const duration = parseInt(document.getElementById('focus-duration').value);
  const sessionType = document.getElementById('session-type').value;
  const allowedSitesText = document.getElementById('allowed-sites').value.trim();
  
  // Validate inputs
  if (!focusSite) {
    showError('Please enter a focus website');
    return;
  }
  
  if (!duration || duration < 5 || duration > 180) {
    showError('Please enter a valid duration (5-180 minutes)');
    return;
  }
  
  // Parse allowed sites
  const allowedSites = allowedSitesText
    .split('\n')
    .map(site => site.trim())
    .filter(site => site.length > 0);
  
  // Check if Chrome APIs are available
  if (!chrome || !chrome.runtime) {
    console.log('Chrome runtime API not available, running in standalone mode');
    createLocalSession(focusSite, duration, sessionType, allowedSites);
    return;
  }
  
  // Start session
  try {
    await sendMessage({
      action: 'startFocusSession',
      data: {
        focusSite: focusSite,
        duration: duration,
        sessionType: sessionType,
        allowedSites: allowedSites
      }
    });
    
    createLocalSession(focusSite, duration, sessionType, allowedSites);
    showSuccess('Focus session started! Stay focused! 🎯');
    
  } catch (error) {
    console.error('Error starting focus session:', error);
    showError('Failed to start focus session');
  }
}

// Create local session
function createLocalSession(focusSite, duration, sessionType, allowedSites) {
  currentSession = {
    isActive: true,
    focusSite: focusSite,
    duration: duration,
    sessionType: sessionType,
    allowedSites: allowedSites,
    startTime: Date.now(),
    endTime: Date.now() + (duration * 60 * 1000),
    isPaused: false
  };
  
  updateUI();
  startTimerDisplay();
}

// Quick start session
async function quickStartSession(duration = 25) {
  document.getElementById('focus-duration').value = duration;
  document.querySelector('.duration-display').textContent = `${duration} min`;
  
  // Set default focus site if empty
  const focusSiteInput = document.getElementById('focus-site');
  if (!focusSiteInput.value.trim()) {
    focusSiteInput.value = 'khanacademy.org';
  }
  
  await startFocusSession();
}

// Start Pomodoro session
async function startPomodoroSession() {
  document.getElementById('focus-duration').value = 25;
  document.getElementById('session-type').value = 'study';
  document.querySelector('.duration-display').textContent = '25 min';
  
  const focusSiteInput = document.getElementById('focus-site');
  if (!focusSiteInput.value.trim()) {
    focusSiteInput.value = 'khanacademy.org';
  }
  
  await startFocusSession();
}

// Stop focus session
async function stopFocusSession() {
  // Check if Chrome APIs are available
  if (!chrome || !chrome.runtime) {
    console.log('Chrome runtime API not available, stopping local session');
    currentSession = null;
    updateUI();
    stopTimerDisplay();
    showSuccess('Demo focus session ended! Great job! 💪');
    return;
  }
  
  try {
    await sendMessage({ action: 'endFocusSession' });
    
    currentSession = null;
    updateUI();
    stopTimerDisplay();
    showSuccess('Focus session ended! Great job! 💪');
    
  } catch (error) {
    console.error('Error stopping focus session:', error);
    showError('Failed to stop focus session');
  }
}

// Toggle pause session
async function togglePauseSession() {
  if (!currentSession) return;
  
  isPaused = !isPaused;
  currentSession.isPaused = isPaused;
  
  const pauseBtn = document.getElementById('pause-focus');
  if (isPaused) {
    pauseBtn.innerHTML = '<span class="btn-icon">▶️</span> Resume';
    pauseBtn.classList.remove('btn-warning');
    pauseBtn.classList.add('btn-primary');
    showSuccess('Session paused');
  } else {
    pauseBtn.innerHTML = '<span class="btn-icon">⏸️</span> Pause';
    pauseBtn.classList.remove('btn-primary');
    pauseBtn.classList.add('btn-warning');
    showSuccess('Session resumed');
  }
  
  if (chrome && chrome.runtime) {
    await sendMessage({ action: 'togglePause', isPaused: isPaused });
  }
}

// Extend session
async function extendSession() {
  if (!currentSession) return;
  
  const extension = 5 * 60 * 1000; // 5 minutes
  currentSession.endTime += extension;
  currentSession.duration += 5;
  
  showSuccess('Session extended by 5 minutes');
  
  if (chrome && chrome.runtime) {
    await sendMessage({ action: 'extendSession', extension: extension });
  }
}

// Skip break
async function skipBreak() {
  showSuccess('Break skipped');
  
  if (chrome && chrome.runtime) {
    await sendMessage({ action: 'skipBreak' });
  }
}

// Update UI based on current session state
function updateUI() {
  const startBtn = document.getElementById('start-focus');
  const stopBtn = document.getElementById('stop-focus');
  const pauseBtn = document.getElementById('pause-focus');
  const sessionInfo = document.getElementById('session-info');
  const noSession = document.getElementById('no-session');
  const inputs = document.querySelectorAll('.focus-setup input, .focus-setup textarea, .focus-setup select');
  
  if (currentSession && currentSession.isActive) {
    // Session is active
    startBtn.disabled = true;
    stopBtn.disabled = false;
    pauseBtn.disabled = false;
    sessionInfo.classList.remove('hidden');
    noSession.classList.add('hidden');
    
    // Disable inputs during session
    inputs.forEach(input => input.disabled = true);
    
    // Update session info
    document.getElementById('current-focus-site').textContent = currentSession.focusSite;
    document.getElementById('current-session-type').textContent = getSessionTypeLabel(currentSession.sessionType);
    
    // Update pause button state
    if (currentSession.isPaused) {
      pauseBtn.innerHTML = '<span class="btn-icon">▶️</span> Resume';
      pauseBtn.classList.remove('btn-warning');
      pauseBtn.classList.add('btn-primary');
    } else {
      pauseBtn.innerHTML = '<span class="btn-icon">⏸️</span> Pause';
      pauseBtn.classList.remove('btn-primary');
      pauseBtn.classList.add('btn-warning');
    }
    
  } else {
    // No active session
    startBtn.disabled = false;
    stopBtn.disabled = true;
    pauseBtn.disabled = true;
    sessionInfo.classList.add('hidden');
    noSession.classList.remove('hidden');
    
    // Enable inputs
    inputs.forEach(input => input.disabled = false);
  }
}

// Get session type label
function getSessionTypeLabel(type) {
  const labels = {
    study: '📚 Study Session',
    work: '💼 Work Session',
    reading: '📖 Reading',
    coding: '💻 Coding',
    creative: '🎨 Creative Work'
  };
  return labels[type] || '📚 Study Session';
}

// Start timer display
function startTimerDisplay() {
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  timerInterval = setInterval(() => {
    if (currentSession && currentSession.endTime && !currentSession.isPaused) {
      const now = Date.now();
      const remaining = currentSession.endTime - now;
      
      if (remaining <= 0) {
        // Session ended
        currentSession = null;
        updateUI();
        stopTimerDisplay();
        showSuccess('Focus session completed! 🎉');
      } else {
        // Update timer display
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
  
  document.getElementById('time-remaining').textContent = timeString;
  
  // Update circular progress
  const totalDuration = currentSession.duration * 60 * 1000;
  const progress = ((totalDuration - remaining) / totalDuration) * 100;
  const progressCircle = document.querySelector('.circle-progress');
  if (progressCircle) {
    const circumference = 2 * Math.PI * 15.9155;
    const offset = circumference - (progress / 100) * circumference;
    progressCircle.style.strokeDasharray = `${offset}, ${circumference}`;
  }
}

// Stop timer display
function stopTimerDisplay() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// Load settings from storage
async function loadSettings() {
  try {
    if (!chrome || !chrome.storage) {
      console.log('Chrome storage API not available, using defaults');
      return;
    }
    
    const result = await chrome.storage.sync.get(['settings']);
    const settings = result.settings || {
      strictMode: false,
      smartBlocking: true,
      breakReminders: true,
      notifications: true,
      soundAlerts: true,
      desktopNotifications: true,
      theme: 'light',
      accentColor: '#667eea',
      tabLimit: 0
    };
    
    document.getElementById('strict-mode').checked = settings.strictMode;
    document.getElementById('smart-blocking').checked = settings.smartBlocking;
    document.getElementById('break-reminders').checked = settings.breakReminders;
    document.getElementById('notifications').checked = settings.notifications;
    document.getElementById('sound-alerts').checked = settings.soundAlerts;
    document.getElementById('desktop-notifications').checked = settings.desktopNotifications;
    document.getElementById('theme').value = settings.theme;
    document.getElementById('accent-color').value = settings.accentColor;
    document.getElementById('tab-limit').value = settings.tabLimit || 0;
    
    // Apply theme
    applyTheme(settings.theme, settings.accentColor);
    
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Save settings to storage
async function saveSettings() {
  try {
    if (!chrome || !chrome.storage) {
      console.log('Chrome storage API not available, settings not saved');
      return;
    }
    
    const settings = {
      strictMode: document.getElementById('strict-mode').checked,
      smartBlocking: document.getElementById('smart-blocking').checked,
      breakReminders: document.getElementById('break-reminders').checked,
      notifications: document.getElementById('notifications').checked,
      soundAlerts: document.getElementById('sound-alerts').checked,
      desktopNotifications: document.getElementById('desktop-notifications').checked,
      theme: document.getElementById('theme').value,
      accentColor: document.getElementById('accent-color').value,
      tabLimit: parseInt(document.getElementById('tab-limit').value) || 0
    };
    
    await chrome.storage.sync.set({ settings });
    
    // Apply theme immediately
    applyTheme(settings.theme, settings.accentColor);
    
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

// Apply theme
function applyTheme(theme, accentColor) {
  document.body.classList.remove('theme-light', 'theme-dark', 'theme-auto');
  document.body.classList.add(`theme-${theme}`);
  
  // Update accent color
  document.documentElement.style.setProperty('--accent-color', accentColor);
}

// Load statistics from storage
async function loadStatistics() {
  try {
    if (!chrome || !chrome.storage) {
      console.log('Chrome storage API not available, using default stats');
      setDefaultStats();
      return;
    }
    
    const result = await chrome.storage.sync.get(['statistics']);
    const stats = result.statistics || {
      todaySessions: 0,
      weekSessions: 0,
      totalTime: 0,
      currentStreak: 0,
      longestStreak: 0,
      averageSessionTime: 0,
      mostProductiveTime: 'morning'
    };
    
    analyticsData = stats;
    updateStatisticsDisplay(stats);
    
  } catch (error) {
    console.error('Error loading statistics:', error);
    setDefaultStats();
  }
}

// Set default statistics
function setDefaultStats() {
  const defaultStats = {
    todaySessions: 0,
    weekSessions: 0,
    totalTime: 0,
    currentStreak: 0,
    longestStreak: 0,
    averageSessionTime: 0,
    mostProductiveTime: 'morning'
  };
  analyticsData = defaultStats;
  updateStatisticsDisplay(defaultStats);
}

// Update statistics display
function updateStatisticsDisplay(stats) {
  document.getElementById('today-sessions').textContent = stats.todaySessions;
  document.getElementById('week-sessions').textContent = stats.weekSessions;
  document.getElementById('current-streak').textContent = stats.currentStreak;
  
  // Format total time
  const hours = Math.floor(stats.totalTime / 3600000);
  const minutes = Math.floor((stats.totalTime % 3600000) / 60000);
  if (hours > 0) {
    document.getElementById('total-time').textContent = `${hours}h ${minutes}m`;
  } else {
    document.getElementById('total-time').textContent = `${minutes}m`;
  }
  
  // Update session status
  document.getElementById('sessions-completed').textContent = stats.todaySessions;
  document.getElementById('total-focus-time').textContent = `${Math.floor(stats.totalTime / 60000)} min`;
}

// Initialize analytics
function initializeAnalytics() {
  // Create simple chart using canvas
  const canvas = document.getElementById('focus-chart');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    drawSimpleChart(ctx);
  }
}

// Draw simple chart
function drawSimpleChart(ctx) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  // Draw simple bar chart
  const data = [3, 5, 2, 4, 6, 3, 5]; // Sample data for 7 days
  const barWidth = width / data.length - 10;
  const maxValue = Math.max(...data);
  
  ctx.fillStyle = '#667eea';
  data.forEach((value, index) => {
    const barHeight = (value / maxValue) * (height - 20);
    const x = index * (barWidth + 10) + 5;
    const y = height - barHeight - 10;
    
    ctx.fillRect(x, y, barWidth, barHeight);
  });
}

// Update analytics display
function updateAnalyticsDisplay() {
  if (!analyticsData) return;
  
  // Generate insights based on data
  const insights = generateInsights(analyticsData);
  const insightsList = document.getElementById('insights-list');
  insightsList.innerHTML = insights.map(insight => 
    `<div class="insight-item">${insight}</div>`
  ).join('');
}

// Generate insights
function generateInsights(data) {
  const insights = [];
  
  if (data.mostProductiveTime) {
    insights.push(`Your most productive time is in the ${data.mostProductiveTime}`);
  }
  
  if (data.averageSessionTime > 0) {
    insights.push(`Your average session length is ${Math.round(data.averageSessionTime)} minutes`);
  }
  
  if (data.currentStreak > 3) {
    insights.push(`Great job! You're on a ${data.currentStreak}-day streak! 🔥`);
  }
  
  return insights;
}

// Load schedule
async function loadSchedule() {
  try {
    if (!chrome || !chrome.storage) {
      console.log('Chrome storage API not available, using default schedule');
      return;
    }
    
    const result = await chrome.storage.sync.get(['schedule']);
    scheduleData = result.schedule || {
      type: 'manual',
      timeSlots: [],
      upcomingSessions: []
    };
    
  } catch (error) {
    console.error('Error loading schedule:', error);
  }
}

// Update schedule display
function updateScheduleDisplay() {
  if (!scheduleData) return;
  
  const upcomingList = document.getElementById('upcoming-list');
  if (scheduleData.upcomingSessions && scheduleData.upcomingSessions.length > 0) {
    upcomingList.innerHTML = scheduleData.upcomingSessions.map(session => `
      <div class="upcoming-item">
        <span class="time">${session.startTime} - ${session.endTime}</span>
        <span class="activity">${session.activity}</span>
        <span class="status">${session.status}</span>
      </div>
    `).join('');
  }
}

// Add time slot
function addTimeSlot() {
  const timeSlotsList = document.getElementById('time-slots-list');
  const newSlot = document.createElement('div');
  newSlot.className = 'time-slot';
  newSlot.innerHTML = `
    <input type="time" value="09:00" class="slot-time">
    <input type="time" value="10:30" class="slot-end">
    <input type="text" placeholder="Activity" class="slot-activity">
    <button class="btn btn-small btn-danger remove-slot">Remove</button>
  `;
  
  timeSlotsList.appendChild(newSlot);
  
  // Add remove button listener
  newSlot.querySelector('.remove-slot').addEventListener('click', () => {
    newSlot.remove();
  });
}

// Auto-detect tab limit
async function autoDetectTabLimit() {
  try {
    if (chrome && chrome.tabs) {
      const tabs = await chrome.tabs.query({});
      const normalTabs = tabs.filter(tab => 
        tab.url && 
        !tab.url.startsWith('chrome-extension://') &&
        !tab.url.startsWith('about:') &&
        tab.url !== 'chrome://newtab/'
      );
      
      document.getElementById('tab-limit').value = normalTabs.length;
      showSuccess(`Auto-detected ${normalTabs.length} tabs`);
    }
  } catch (error) {
    console.error('Error auto-detecting tab limit:', error);
    showError('Failed to auto-detect tab limit');
  }
}

// Update site tags
function updateSiteTags() {
  const allowedSitesText = document.getElementById('allowed-sites').value;
  const siteTags = document.getElementById('site-tags');
  const sites = allowedSitesText
    .split('\n')
    .map(site => site.trim())
    .filter(site => site.length > 0);
  
  siteTags.innerHTML = sites.map(site => 
    `<span class="site-tag">${site}</span>`
  ).join('');
}

// Validate focus site input
function validateFocusSite() {
  const input = document.getElementById('focus-site');
  const value = input.value.trim();
  
  if (value && !isValidSite(value)) {
    input.setCustomValidity('Please enter a valid website (e.g., khanacademy.org)');
  } else {
    input.setCustomValidity('');
  }
}

// Check if site is valid
function isValidSite(site) {
  return /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(site);
}

// Export data
async function exportData() {
  try {
    if (!chrome || !chrome.storage) {
      showError('Export not available in standalone mode');
      return;
    }
    
    const result = await chrome.storage.sync.get(['settings', 'statistics', 'schedule']);
    const data = {
      settings: result.settings || {},
      statistics: result.statistics || {},
      schedule: result.schedule || {},
      exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'focus-helper-data.json';
    a.click();
    URL.revokeObjectURL(url);
    
    showSuccess('Data exported successfully');
  } catch (error) {
    console.error('Error exporting data:', error);
    showError('Failed to export data');
  }
}

// Clear all data
async function clearAllData() {
  if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
    try {
      if (chrome && chrome.storage) {
        await chrome.storage.sync.clear();
        showSuccess('All data cleared successfully');
        loadSettings();
        loadStatistics();
        loadSchedule();
      }
    } catch (error) {
      console.error('Error clearing data:', error);
      showError('Failed to clear data');
    }
  }
}

// Show help
function showHelp() {
  alert('Student Focus Helper 2.0 Help\n\n' +
        '• Set focus sessions to block distracting websites\n' +
        '• Use quick actions for fast session starts\n' +
        '• View analytics to track your progress\n' +
        '• Schedule focus sessions in advance\n' +
        '• Customize settings for your needs\n\n' +
        'Keyboard shortcuts:\n' +
        '• Ctrl+Shift+F: Temporarily unblock site\n' +
        '• Ctrl+Shift+X: End focus session');
}

// Show feedback
function showFeedback() {
  alert('Thank you for using Student Focus Helper 2.0!\n\n' +
        'We appreciate your feedback. Please report any issues or suggestions ' +
        'to help us improve the extension.');
}

// Show success message
function showSuccess(message) {
  showMessage(message, 'success');
}

// Show error message
function showError(message) {
  showMessage(message, 'error');
}

// Show message to user
function showMessage(message, type) {
  // Remove any existing messages
  const existingMessage = document.querySelector('.message');
  if (existingMessage) {
    existingMessage.remove();
  }
  
  // Create message element
  const messageElement = document.createElement('div');
  messageElement.className = `message ${type}`;
  messageElement.textContent = message;
  
  // Add styles
  messageElement.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    padding: 12px 20px;
    border-radius: 8px;
    color: white;
    font-weight: bold;
    z-index: 1000;
    animation: slideIn 0.3s ease;
    ${type === 'success' ? 'background: #4CAF50;' : 'background: #f44336;'}
  `;
  
  document.body.appendChild(messageElement);
  
  // Remove after 3 seconds
  setTimeout(() => {
    if (messageElement.parentNode) {
      messageElement.remove();
    }
  }, 3000);
}

// Send message to background script
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Report functions
async function loadSessionReports() {
  try {
    if (!chrome || !chrome.runtime) {
      console.log('Chrome runtime API not available');
      return;
    }
    
    const reports = await sendMessage({ action: 'getSessionReports' });
    sessionReports = reports || [];
    displayReports();
  } catch (error) {
    console.error('Error loading session reports:', error);
  }
}

function displayReports() {
  const reportsList = document.getElementById('reports-list');
  
  if (sessionReports.length === 0) {
    reportsList.innerHTML = `
      <div class="report-placeholder">
        <div class="placeholder-icon">📈</div>
        <p>No session reports available yet.</p>
        <p>Complete a focus session to see detailed reports here.</p>
      </div>
    `;
    return;
  }
  
  reportsList.innerHTML = sessionReports.map(report => `
    <div class="report-card" data-session-id="${report.sessionId}">
      <div class="report-header">
        <div class="report-title">
          <h4>${getSessionTypeLabel(report.sessionType)} Session</h4>
          <span class="report-date">${formatDate(report.date)}</span>
        </div>
        <div class="report-score">
          <div class="productivity-score ${getProductivityClass(report.productivity)}">
            ${report.productivity}% Productive
          </div>
        </div>
      </div>
      <div class="report-summary">
        <div class="summary-item">
          <span class="label">Duration:</span>
          <span class="value">${report.actualDuration} min</span>
        </div>
        <div class="summary-item">
          <span class="label">Focus Site:</span>
          <span class="value">${report.focusSite}</span>
        </div>
        <div class="summary-item">
          <span class="label">Sites Visited:</span>
          <span class="value">${report.websiteVisits.length}</span>
        </div>
      </div>
      <div class="report-actions">
        <button class="btn btn-small btn-primary view-report" data-session-id="${report.sessionId}">
          View Details
        </button>
        <button class="btn btn-small btn-danger delete-report" data-session-id="${report.sessionId}">
          Delete
        </button>
      </div>
    </div>
  `).join('');
  
  // Add event listeners to report cards
  document.querySelectorAll('.view-report').forEach(btn => {
    btn.addEventListener('click', () => viewReport(btn.dataset.sessionId));
  });
  
  document.querySelectorAll('.delete-report').forEach(btn => {
    btn.addEventListener('click', () => deleteReport(btn.dataset.sessionId));
  });
}

function viewReport(sessionId) {
  const report = sessionReports.find(r => r.sessionId == sessionId);
  if (!report) return;
  
  const modal = document.getElementById('report-modal');
  const modalBody = document.getElementById('report-detail');
  
  modalBody.innerHTML = `
    <div class="report-overview">
      <h4>Session Overview</h4>
      <div class="overview-grid">
        <div class="overview-item">
          <span class="label">Session Type:</span>
          <span class="value">${getSessionTypeLabel(report.sessionType)}</span>
        </div>
        <div class="overview-item">
          <span class="label">Date:</span>
          <span class="value">${formatDate(report.date)}</span>
        </div>
        <div class="overview-item">
          <span class="label">Focus Site:</span>
          <span class="value">${report.focusSite}</span>
        </div>
        <div class="overview-item">
          <span class="label">Planned Duration:</span>
          <span class="value">${report.plannedDuration} minutes</span>
        </div>
        <div class="overview-item">
          <span class="label">Actual Duration:</span>
          <span class="value">${report.actualDuration} minutes</span>
        </div>
        <div class="overview-item">
          <span class="label">Tracked Time:</span>
          <span class="value">${report.totalTrackedTime} minutes</span>
        </div>
        <div class="overview-item">
          <span class="label">Productivity Score:</span>
          <span class="value productivity-score ${getProductivityClass(report.productivity)}">
            ${report.productivity}%
          </span>
        </div>
      </div>
    </div>
    
    <div class="website-analysis">
      <h4>Website Analysis</h4>
      <div class="website-list">
        ${report.websiteVisits.map(site => `
          <div class="website-item ${site.isRelevant ? 'relevant' : 'irrelevant'}">
            <div class="website-info">
              <div class="website-name">${site.hostname}</div>
              <div class="website-category">${site.category}</div>
            </div>
            <div class="website-stats">
              <div class="time-spent">${site.totalTime} min</div>
              <div class="percentage">${site.percentage}%</div>
              <div class="relevance-badge ${site.isRelevant ? 'relevant' : 'irrelevant'}">
                ${site.isRelevant ? '✓ Relevant' : '✗ Irrelevant'}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    
    <div class="insights">
      <h4>Session Insights</h4>
      <div class="insights-list">
        ${report.insights.map(insight => `
          <div class="insight-item">${insight}</div>
        `).join('')}
      </div>
    </div>
  `;
  
  modal.classList.add('active');
}

function closeReportModal() {
  const modal = document.getElementById('report-modal');
  modal.classList.remove('active');
}

async function deleteReport(sessionId) {
  if (!confirm('Are you sure you want to delete this report?')) return;
  
  try {
    await sendMessage({ action: 'deleteSessionReport', sessionId: sessionId });
    sessionReports = sessionReports.filter(r => r.sessionId != sessionId);
    displayReports();
    showSuccess('Report deleted successfully');
  } catch (error) {
    console.error('Error deleting report:', error);
    showError('Failed to delete report');
  }
}

async function exportAllReports() {
  try {
    const data = {
      reports: sessionReports,
      exportDate: new Date().toISOString(),
      version: '2.0'
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `focus-helper-reports-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showSuccess('Reports exported successfully');
  } catch (error) {
    console.error('Error exporting reports:', error);
    showError('Failed to export reports');
  }
}

async function clearAllReports() {
  if (!confirm('Are you sure you want to clear all reports? This action cannot be undone.')) return;
  
  try {
    await sendMessage({ action: 'clearAllReports' });
    sessionReports = [];
    displayReports();
    showSuccess('All reports cleared successfully');
  } catch (error) {
    console.error('Error clearing reports:', error);
    showError('Failed to clear reports');
  }
}

// Helper functions for reports
function getSessionTypeLabel(type) {
  const labels = {
    study: '📚 Study',
    work: '💼 Work',
    reading: '📖 Reading',
    coding: '💻 Coding',
    creative: '🎨 Creative'
  };
  return labels[type] || '📚 Study';
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getProductivityClass(score) {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  return 'needs-improvement';
}

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
  
  .hidden {
    display: none !important;
  }
  
  .no-session {
    text-align: center;
    color: #666;
    font-style: italic;
    padding: 20px;
  }
  
  .site-tag {
    display: inline-block;
    background: #667eea;
    color: white;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
    margin: 2px;
  }
`;
document.head.appendChild(style);

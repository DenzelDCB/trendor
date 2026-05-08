// Popup script for Student Focus Helper Chrome Extension

let currentSession = null;
let timerInterval = null;

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initializePopup();
  loadSettings();
  loadBlocklist();
  loadStatistics();
  setupEventListeners();
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

// Setup event listeners
function setupEventListeners() {
  // Start focus session button
  document.getElementById('start-focus').addEventListener('click', startFocusSession);
  
  // Stop focus session button
  document.getElementById('stop-focus').addEventListener('click', stopFocusSession);
  
  // Settings checkboxes
  document.getElementById('strict-mode').addEventListener('change', saveSettings);
  document.getElementById('notifications').addEventListener('change', saveSettings);
  document.getElementById('sound-alerts').addEventListener('change', saveSettings);
  document.getElementById('tab-limit').addEventListener('change', saveSettings);
  
  // Blocklist button
  document.getElementById('save-blocklist').addEventListener('click', saveBlocklist);
  
  // Input validation
  document.getElementById('focus-duration').addEventListener('input', validateDuration);
  document.getElementById('focus-site').addEventListener('input', validateFocusSite);
}

// Start focus session
async function startFocusSession() {
  const focusSite = document.getElementById('focus-site').value.trim();
  const duration = parseInt(document.getElementById('focus-duration').value);
  const allowedSitesText = document.getElementById('allowed-sites').value.trim();
  
  // Validate inputs
  if (!focusSite) {
    showError('Please enter a focus website');
    return;
  }
  
  if (!duration || duration < 1 || duration > 180) {
    showError('Please enter a valid duration (1-180 minutes)');
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
    // Create local session for demo purposes
    currentSession = {
      isActive: true,
      focusSite: focusSite,
      duration: duration,
      allowedSites: allowedSites,
      startTime: Date.now(),
      endTime: Date.now() + (duration * 60 * 1000)
    };
    
    updateUI();
    startTimerDisplay();
    showSuccess('Demo focus session started! (Extension mode required for blocking)');
    return;
  }
  
  // Start session
  try {
    await sendMessage({
      action: 'startFocusSession',
      data: {
        focusSite: focusSite,
        duration: duration,
        allowedSites: allowedSites
      }
    });
    
    // Update UI
    currentSession = {
      isActive: true,
      focusSite: focusSite,
      duration: duration,
      allowedSites: allowedSites,
      startTime: Date.now(),
      endTime: Date.now() + (duration * 60 * 1000)
    };
    
    updateUI();
    startTimerDisplay();
    showSuccess('Focus session started! Stay focused! 🎯');
    
  } catch (error) {
    console.error('Error starting focus session:', error);
    showError('Failed to start focus session');
  }
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

// Update UI based on current session state
function updateUI() {
  const startBtn = document.getElementById('start-focus');
  const stopBtn = document.getElementById('stop-focus');
  const sessionInfo = document.getElementById('session-info');
  const noSession = document.getElementById('no-session');
  const inputs = document.querySelectorAll('.focus-setup input, .focus-setup textarea');
  
  if (currentSession && currentSession.isActive) {
    // Session is active
    startBtn.disabled = true;
    stopBtn.disabled = false;
    sessionInfo.classList.remove('hidden');
    noSession.classList.add('hidden');
    
    // Disable inputs during session
    inputs.forEach(input => input.disabled = true);
    
    // Update session info
    document.getElementById('current-focus-site').textContent = currentSession.focusSite;
    
  } else {
    // No active session
    startBtn.disabled = false;
    stopBtn.disabled = true;
    sessionInfo.classList.add('hidden');
    noSession.classList.remove('hidden');
    
    // Enable inputs
    inputs.forEach(input => input.disabled = false);
  }
}

// Start timer display
function startTimerDisplay() {
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  timerInterval = setInterval(() => {
    if (currentSession && currentSession.endTime) {
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
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        document.getElementById('time-remaining').textContent = timeString;
      }
    }
  }, 1000);
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
    // Check if Chrome APIs are available
    if (!chrome || !chrome.storage) {
      console.log('Chrome storage API not available, using defaults');
      return;
    }
    
    const result = await chrome.storage.sync.get(['settings']);
    const settings = result.settings || {
      strictMode: false,
      notifications: true,
      soundAlerts: true,
      tabLimit: 0
    };
    
    document.getElementById('strict-mode').checked = settings.strictMode;
    document.getElementById('notifications').checked = settings.notifications;
    document.getElementById('sound-alerts').checked = settings.soundAlerts;
    document.getElementById('tab-limit').value = settings.tabLimit || 0;
    
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Save settings to storage
async function saveSettings() {
  try {
    // Check if Chrome APIs are available
    if (!chrome || !chrome.storage) {
      console.log('Chrome storage API not available, settings not saved');
      return;
    }
    
    const settings = {
      strictMode: document.getElementById('strict-mode').checked,
      notifications: document.getElementById('notifications').checked,
      soundAlerts: document.getElementById('sound-alerts').checked,
      tabLimit: parseInt(document.getElementById('tab-limit').value) || 0
    };
    
    await chrome.storage.sync.set({ settings });
    
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

// Load statistics from storage
async function loadStatistics() {
  try {
    // Check if Chrome APIs are available
    if (!chrome || !chrome.storage) {
      console.log('Chrome storage API not available, using default stats');
      // Set default values
      document.getElementById('today-sessions').textContent = '0';
      document.getElementById('week-sessions').textContent = '0';
      document.getElementById('total-time').textContent = '0m';
      document.getElementById('sessions-completed').textContent = '0';
      document.getElementById('total-focus-time').textContent = '0 min';
      return;
    }
    
    const result = await chrome.storage.sync.get(['statistics']);
    const stats = result.statistics || {
      todaySessions: 0,
      weekSessions: 0,
      totalTime: 0
    };
    
    // Update statistics display
    document.getElementById('today-sessions').textContent = stats.todaySessions;
    document.getElementById('week-sessions').textContent = stats.weekSessions;
    
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
    
  } catch (error) {
    console.error('Error loading statistics:', error);
  }
}

// Load permanent blocklist from storage
async function loadBlocklist() {
  try {
    // Check if Chrome APIs are available
    if (!chrome || !chrome.storage) {
      console.log('Chrome storage API not available, using default blocklist');
      return;
    }
    
    const result = await chrome.storage.sync.get(['permanentBlocklist']);
    const blocklist = result.permanentBlocklist || [];
    
    document.getElementById('blocklist-sites').value = blocklist.join('\n');
    
  } catch (error) {
    console.error('Error loading blocklist:', error);
  }
}

// Save permanent blocklist to storage
async function saveBlocklist() {
  try {
    // Check if Chrome APIs are available
    if (!chrome || !chrome.storage) {
      console.log('Chrome storage API not available, blocklist not saved');
      showError('Chrome storage API not available');
      return;
    }
    
    const blocklistText = document.getElementById('blocklist-sites').value.trim();
    const blocklist = blocklistText
      .split('\n')
      .map(site => site.trim().toLowerCase())
      .filter(site => site.length > 0);
    
    await chrome.storage.sync.set({ permanentBlocklist: blocklist });
    
    // Show success message
    const statusDiv = document.getElementById('blocklist-status');
    statusDiv.textContent = `✓ Blocklist saved (${blocklist.length} site${blocklist.length !== 1 ? 's' : ''})`;
    statusDiv.style.background = '#d4edda';
    statusDiv.style.color = '#155724';
    statusDiv.classList.remove('hidden');
    
    setTimeout(() => {
      statusDiv.classList.add('hidden');
    }, 3000);
    
  } catch (error) {
    console.error('Error saving blocklist:', error);
    showError('Failed to save blocklist');
  }
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

// Validate duration input
function validateDuration() {
  const input = document.getElementById('focus-duration');
  const value = parseInt(input.value);
  
  if (value < 1 || value > 180) {
    input.setCustomValidity('Duration must be between 1 and 180 minutes');
  } else {
    input.setCustomValidity('');
  }
}

// Check if site is valid
function isValidSite(site) {
  // Simple validation - check if it looks like a domain
  return /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(site);
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
    display: none;
  }
  
  .no-session {
    text-align: center;
    color: #666;
    font-style: italic;
    padding: 20px;
  }
`;
document.head.appendChild(style);

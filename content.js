(() => {
  if (window.__deskbuddyInjected) return;
  window.__deskbuddyInjected = true;

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------
  const state = {
    active: false,
    pose: "idle",
    mood: "neutral",
    speed: "normal",
    notes: [],
    actionTimer: null,
    consoleOpen: false,
    dragging: false,
    dragOffX: 0,
    dragOffY: 0,
    setupType: null,
    setupElements: [],
    sleeping: false,
    basketballShots: 0,
    basketballMade: 0,
    setupTimeout: null,
    sleepTimeout: null,
    petActive: false,
    petElements: [],
    petTimer: null,
    petRaf: null,
    needs: {
      hunger: 100,
      energy: 100,
      happiness: 100,
      social: 100,
      thirst: 100,
      hygiene: 100,
      fun: 100,
      comfort: 100,
    },
    needsTimer: null,
    isYellow: true,
    personality: "balanced",
    accessory: null,
    achievements: [],
    taskQueue: [],
    currentTask: null,
  };

  // AI Brain
  let aiConfig = { enabled: false, provider: "builtin", apiUrl: "", apiKey: "", model: "" };
  let aiBusy = false;

  function aiLoadConfig() {
    try {
      chrome.storage.local.get("deskbuddy_ai", (res) => {
        if (res && res.deskbuddy_ai) aiConfig = Object.assign({ enabled: false, provider: "builtin" }, res.deskbuddy_ai);
        syncAiPanelInputs();
      });
    } catch (e) {}
  }

  function aiSaveConfig() {
    try { chrome.storage.local.set({ deskbuddy_ai: aiConfig }); } catch (e) {}
  }

  // Weather system
  let currentWeather = "sunny";
  const WEATHER_TYPES = ["sunny", "rainy", "snowy", "cloudy"];
  
  function setWeather(weather) {
    if (!WEATHER_TYPES.includes(weather)) {
      showBubble("unknown weather type!", 1500);
      return;
    }
    
    currentWeather = weather;
    showBubble(`weather changed to ${weather}! ${getWeatherEmoji(weather)}`, 2000);
    
    // Apply weather effects
    applyWeatherEffects();
  }
  
  function getWeatherEmoji(weather) {
    const emojis = {
      sunny: "☀️",
      rainy: "🌧️",
      snowy: "❄️",
      cloudy: "☁️"
    };
    return emojis[weather] || "☀️";
  }
  
  function applyWeatherEffects() {
    // Remove existing weather effects
    document.querySelectorAll(".deskbuddy-weather-effect").forEach(el => el.remove());
    
    if (currentWeather === "rainy") {
      createRainEffect();
    } else if (currentWeather === "snowy") {
      createSnowEffect();
    } else if (currentWeather === "cloudy") {
      createCloudEffect();
    }
    
    // Track weather for achievement
    weatherTypesExperienced.add(currentWeather);
    
    // Weather affects stickman behavior
    if (currentWeather === "rainy") {
      // Rain makes stickmen more likely to stay indoors (less active)
      state.needs.energy = Math.max(0, state.needs.energy - 5);
      showBubble("staying inside from rain...", 1500);
    } else if (currentWeather === "sunny") {
      // Sunshine boosts happiness
      state.needs.happiness = Math.min(100, state.needs.happiness + 10);
      showBubble("loving this sunshine! ☀️", 1500);
    } else if (currentWeather === "snowy") {
      // Snow makes them playful but cold
      state.needs.fun = Math.min(100, state.needs.fun + 15);
      state.needs.comfort = Math.max(0, state.needs.comfort - 10);
      showBubble("so much fun in the snow! ❄️", 1500);
    }
    
    updateNeedsUI();
    checkAchievements();
  }
  
  function createRainEffect() {
    const rain = document.createElement("div");
    rain.className = "deskbuddy-weather-effect deskbuddy-rain";
    rain.innerHTML = Array(20).fill("💧").join("");
    document.documentElement.appendChild(rain);
    
    // Animate rain drops
    const drops = rain.querySelectorAll("span");
    drops.forEach((drop, i) => {
      drop.style.position = "fixed";
      drop.style.left = Math.random() * 100 + "vw";
      drop.style.top = "-20px";
      drop.style.animation = `db-rain-fall ${2 + Math.random() * 2}s linear infinite`;
      drop.style.animationDelay = Math.random() * 2 + "s";
    });
  }
  
  function createSnowEffect() {
    const snow = document.createElement("div");
    snow.className = "deskbuddy-weather-effect deskbuddy-snow";
    snow.innerHTML = Array(30).fill("❄️").join("");
    document.documentElement.appendChild(snow);
    
    // Animate snowflakes
    const flakes = snow.querySelectorAll("span");
    flakes.forEach((flake, i) => {
      flake.style.position = "fixed";
      flake.style.left = Math.random() * 100 + "vw";
      flake.style.top = "-20px";
      flake.style.animation = `db-snow-fall ${3 + Math.random() * 3}s linear infinite`;
      flake.style.animationDelay = Math.random() * 3 + "s";
    });
  }
  
  function createCloudEffect() {
    const clouds = document.createElement("div");
    clouds.className = "deskbuddy-weather-effect deskbuddy-clouds";
    clouds.innerHTML = "☁️☁️☁️";
    clouds.style.position = "fixed";
    clouds.style.top = "10px";
    clouds.style.left = "50%";
    clouds.style.transform = "translateX(-50%)";
    clouds.style.fontSize = "30px";
    clouds.style.zIndex = "2147482997";
    document.documentElement.appendChild(clouds);
  }
  
  function randomWeatherChange() {
    // Randomly change weather every 5-10 minutes
    setInterval(() => {
      const newWeather = WEATHER_TYPES[Math.floor(Math.random() * WEATHER_TYPES.length)];
      setWeather(newWeather);
    }, 300000 + Math.random() * 300000);
  }

  // Time-based behaviors
  function getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 21) return "evening";
    return "night";
  }
  
  function applyTimeBasedBehavior() {
    const timeOfDay = getTimeOfDay();
    
    switch (timeOfDay) {
      case "morning":
        // Morning: more energetic, likely to exercise
        state.needs.energy = Math.min(100, state.needs.energy + 5);
        if (Math.random() > 0.7 && !state.setupType && !state.sleeping) {
          showBubble("good morning! time to be productive! ☀️", 2000);
        }
        break;
      case "afternoon":
        // Afternoon: normal activity
        if (Math.random() > 0.8 && !state.setupType && !state.sleeping) {
          showBubble("afternoon slump... need coffee ☕", 2000);
          state.needs.energy = Math.max(0, state.needs.energy - 5);
        }
        break;
      case "evening":
        // Evening: winding down, more social
        state.needs.social = Math.min(100, state.needs.social + 5);
        if (Math.random() > 0.7 && !state.setupType && !state.sleeping) {
          showBubble("evening relaxation time 🌅", 2000);
        }
        break;
      case "night":
        // Night: tired, likely to sleep
        state.needs.energy = Math.max(0, state.needs.energy - 10);
        if (state.needs.energy < 30 && !state.sleeping && !state.setupType) {
          showBubble("getting sleepy... 😴", 2000);
          if (Math.random() > 0.5) {
            setTimeout(() => sleep(), 3000);
          }
        }
        break;
    }
    
    updateNeedsUI();
  }
  
  function startTimeBasedBehavior() {
    // Check time-based behavior every minute
    setInterval(() => {
      if (state.active && !state.sleeping) {
        applyTimeBasedBehavior();
      }
    }, 60000);
  }

  // ---------------------------------------------------------------------
  // Mini-Games
  // ---------------------------------------------------------------------
  
  let currentGame = null;
  
  function playRockPaperScissors() {
    if (currentGame) {
      showBubble("already playing a game!", 1500);
      return;
    }
    
    currentGame = "rps";
    showBubble("let's play rock-paper-scissors! choose: rock, paper, or scissors", 3000);
    logLine("Game: Rock-Paper-Scissors started. Type your choice: rock, paper, or scissors");
  }
  
  function handleGameChoice(choice) {
    if (!currentGame) return;
    
    if (currentGame === "rps") {
      const choices = ["rock", "paper", "scissors"];
      if (!choices.includes(choice.toLowerCase())) {
        showBubble("invalid choice! pick rock, paper, or scissors", 1500);
        return;
      }
      
      const stickmanChoice = choices[Math.floor(Math.random() * choices.length)];
      let result = "";
      
      if (choice.toLowerCase() === stickmanChoice) {
        result = "tie!";
        showBubble(`I chose ${stickmanChoice} too! it's a tie! 🤝`, 2000);
      } else if (
        (choice.toLowerCase() === "rock" && stickmanChoice === "scissors") ||
        (choice.toLowerCase() === "paper" && stickmanChoice === "rock") ||
        (choice.toLowerCase() === "scissors" && stickmanChoice === "paper")
      ) {
        result = "you win!";
        showBubble(`I chose ${stickmanChoice}... you win! 🏆`, 2000);
        fulfillNeed("fun", 15);
        spawnParticles("🏆", 3);
      } else {
        result = "I win!";
        showBubble(`I chose ${stickmanChoice}... I win! 😎`, 2000);
        state.needs.happiness = Math.min(100, state.needs.happiness + 10);
      }
      
      logLine(`Game: You chose ${choice}, I chose ${stickmanChoice}. Result: ${result}`);
      currentGame = null;
      updateNeedsUI();
    }
  }
  
  function playGuessNumber() {
    if (currentGame) {
      showBubble("already playing a game!", 1500);
      return;
    }
    
    currentGame = "guess";
    state.gameTargetNumber = Math.floor(Math.random() * 100) + 1;
    showBubble("guess a number between 1 and 100!", 3000);
    logLine(`Game: Guess the number (1-100). Type your guess.`);
  }
  
  function handleNumberGuess(guess) {
    if (!currentGame || currentGame !== "guess") return;
    
    const num = parseInt(guess);
    if (isNaN(num) || num < 1 || num > 100) {
      showBubble("pick a number between 1 and 100!", 1500);
      return;
    }
    
    if (num === state.gameTargetNumber) {
      showBubble(`you got it! it was ${num}! 🎉`, 2000);
      fulfillNeed("fun", 20);
      spawnParticles("🎉", 5);
      logLine(`Game: You guessed ${num}. Correct!`);
      currentGame = null;
    } else if (num < state.gameTargetNumber) {
      showBubble("higher! ⬆️", 1500);
      logLine(`Game: You guessed ${num}. Higher!`);
    } else {
      showBubble("lower! ⬇️", 1500);
      logLine(`Game: You guessed ${num}. Lower!`);
    }
    
    updateNeedsUI();
  }

  // ---------------------------------------------------------------------
  // Customization (Accessories, Hats, Clothing)
  // ---------------------------------------------------------------------
  
  const ACCESSORIES = {
    none: { emoji: "", name: "None" },
    hat: { emoji: "🎩", name: "Top Hat" },
    crown: { emoji: "👑", name: "Crown" },
    glasses: { emoji: "👓", name: "Glasses" },
    sunglasses: { emoji: "🕶️", name: "Sunglasses" },
    bow: { emoji: "🎀", name: "Bow" },
    flower: { emoji: "🌸", name: "Flower" },
    headphones: { emoji: "🎧", name: "Headphones" },
    scarf: { emoji: "🧣", name: "Scarf" },
    cape: { emoji: "🦸", name: "Cape" },
  };
  
  function equipAccessory(accessoryName) {
    const accessoryKey = Object.keys(ACCESSORIES).find(
      key => key === accessoryName.toLowerCase() || ACCESSORIES[key].name.toLowerCase() === accessoryName.toLowerCase()
    );
    
    if (!accessoryKey) {
      showBubble("unknown accessory! try: hat, crown, glasses, sunglasses, bow, flower, headphones, scarf, cape", 2000);
      return;
    }
    
    state.accessory = accessoryKey;
    accessoriesEquipped.add(accessoryKey);
    showBubble(`equipped ${ACCESSORIES[accessoryKey].name}! ${ACCESSORIES[accessoryKey].emoji}`, 1500);
    updateAccessoryUI();
    checkAchievements();
  }
  
  function removeAccessory() {
    state.accessory = null;
    showBubble("accessory removed!", 1500);
    updateAccessoryUI();
  }
  
  function updateAccessoryUI() {
    const accessoryEl = document.getElementById("deskbuddy-accessory");
    if (!accessoryEl) return;
    
    if (state.accessory && ACCESSORIES[state.accessory]) {
      accessoryEl.textContent = ACCESSORIES[state.accessory].emoji;
      accessoryEl.style.display = "block";
    } else {
      accessoryEl.style.display = "none";
    }
  }
  
  function listAccessories() {
    logLine("Available accessories:");
    for (const [key, data] of Object.entries(ACCESSORIES)) {
      if (key !== "none") {
        logLine(`  ${data.name} (${data.emoji}) - type: ${key}`);
      }
    }
  }

  // ---------------------------------------------------------------------
  // Achievements System
  // ---------------------------------------------------------------------
  
  const ACHIEVEMENTS = {
    first_feed: { name: "First Meal", description: "Feed your stickman for the first time", emoji: "🍽️" },
    social_butterfly: { name: "Social Butterfly", description: "Reach 100 social need", emoji: "🦋" },
    night_owl: { name: "Night Owl", description: "Stay awake past 2 AM", emoji: "🦉" },
    early_bird: { name: "Early Bird", description: "Wake up before 6 AM", emoji: "🐦" },
    gamer: { name: "Gamer", description: "Play 5 games", emoji: "🎮" },
    fisherman: { name: "Fisherman", description: "Catch a fish", emoji: "🎣" },
    gardener: { name: "Gardener", description: "Complete gardening", emoji: "🌻" },
    weather_master: { name: "Weather Master", description: "Experience all weather types", emoji: "🌤️" },
    fashionista: { name: "Fashionista", description: "Equip 5 different accessories", emoji: "👗" },
    high_fiver: { name: "High Fiver", description: "High-five 10 times", emoji: "✋" },
    champion: { name: "Champion", description: "Win a competition", emoji: "🏆" },
    perfect_care: { name: "Perfect Care", description: "Keep all needs above 80% for 1 minute", emoji: "💎" },
  };
  
  let weatherTypesExperienced = new Set();
  let accessoriesEquipped = new Set();
  let highFiveCount = 0;
  
  function unlockAchievement(achievementId) {
    if (state.achievements.includes(achievementId)) return;
    
    const achievement = ACHIEVEMENTS[achievementId];
    if (!achievement) return;
    
    state.achievements.push(achievementId);
    showBubble(`achievement unlocked: ${achievement.name}! ${achievement.emoji}`, 3000);
    spawnParticles(achievement.emoji, 5);
    logLine(`🏆 Achievement: ${achievement.name} - ${achievement.description}`);
    
    // Bonus for achievements
    fulfillNeed("happiness", 15);
    fulfillNeed("fun", 10);
  }
  
  function checkAchievements() {
    // Check for various achievements
    if (state.needs.social >= 100 && !state.achievements.includes("social_butterfly")) {
      unlockAchievement("social_butterfly");
    }
    
    if (weatherTypesExperienced.size >= 4 && !state.achievements.includes("weather_master")) {
      unlockAchievement("weather_master");
    }
    
    if (accessoriesEquipped.size >= 5 && !state.achievements.includes("fashionista")) {
      unlockAchievement("fashionista");
    }
    
    if (highFiveCount >= 10 && !state.achievements.includes("high_fiver")) {
      unlockAchievement("high_fiver");
    }
    
    // Perfect care achievement
    const allNeedsHigh = Object.values(state.needs).every(need => need >= 80);
    if (allNeedsHigh && !state.achievements.includes("perfect_care")) {
      // Need to sustain for 1 minute - simplified for now
      unlockAchievement("perfect_care");
    }
  }
  
  function listAchievements() {
    logLine("Achievements:");
    if (state.achievements.length === 0) {
      logLine("  No achievements yet. Keep playing!");
    } else {
      state.achievements.forEach(id => {
        const achievement = ACHIEVEMENTS[id];
        if (achievement) {
          logLine(`  ✓ ${achievement.name} ${achievement.emoji}`);
        }
      });
    }
    
    logLine("\nLocked achievements:");
    for (const [id, achievement] of Object.entries(ACHIEVEMENTS)) {
      if (!state.achievements.includes(id)) {
        logLine(`  ✗ ${achievement.name} ${achievement.emoji} - ${achievement.description}`);
      }
    }
  }

  // ---------------------------------------------------------------------
  // Smart Task System
  // ---------------------------------------------------------------------
  
  let contextMenuOpen = false;
  let selectedStickman = null; // The stickman being clicked on
  let selectedAction = null;    // The action chosen
  let selectedTarget = null;    // The target stickman for the action
  
  const TASK_ACTIONS = {
    attack: { name: "Attack", description: "Attack another stickman", emoji: "⚔️" },
  };
  
  function openContextMenu(stickman) {
    closeContextMenu();
    selectedStickman = stickman;
    contextMenuOpen = true;
    
    const menu = document.createElement("div");
    menu.id = "deskbuddy-context-menu";
    menu.className = "deskbuddy-context-menu";
    
    const stickmanName = stickman === state ? "yellow" : stickman.name;
    const selectedColor = stickman === state ? "yellow" : stickman.name;
    const stickmanEmoji = selectedColor === 'yellow' ? '💛' : selectedColor === 'red' ? '❤️' : selectedColor === 'blue' ? '💙' : '💚';
    
    // Build list of available targets (all stickmen except the selected one)
    const availableTargets = [];
    // Always include yellow if not selected
    if (selectedColor !== "yellow") {
      availableTargets.push({ color: "yellow", emoji: "💛" });
    }
    // Include all gang members except selected
    for (const color of Object.keys(gangMembers)) {
      if (color !== selectedColor) {
        const emoji = color === 'red' ? '❤️' : color === 'blue' ? '💙' : color === 'green' ? '💚' : '💛';
        availableTargets.push({ color, emoji });
      }
    }
    
    // Build all action combinations
    const actionOptions = [];
    // Add page target for each action
    for (const [actionKey, action] of Object.entries(TASK_ACTIONS)) {
      actionOptions.push({
        action: actionKey,
        target: "page",
        targetEmoji: "📄",
        targetName: "Page Elements",
        display: `${stickmanEmoji} ${stickmanName.toUpperCase()}: ${action.name} 📄`
      });
    }
    // Add stickman targets for each action
    for (const [actionKey, action] of Object.entries(TASK_ACTIONS)) {
      for (const t of availableTargets) {
        actionOptions.push({
          action: actionKey,
          target: t.color,
          targetEmoji: t.emoji,
          targetName: t.color.toUpperCase(),
          display: `${stickmanEmoji} ${stickmanName.toUpperCase()}: ${action.name} ${t.emoji} ${t.color.toUpperCase()}`
        });
      }
    }
    
    menu.innerHTML = `
      <div class="deskbuddy-context-header">
        <span>${stickmanName.toUpperCase()}</span>
        <button class="deskbuddy-context-close">×</button>
      </div>
      <div class="deskbuddy-context-body">
        <div class="deskbuddy-context-section">
          ${actionOptions.map(opt => `
            <button class="deskbuddy-context-action" data-action="${opt.action}" data-target="${opt.target}" title="${TASK_ACTIONS[opt.action].description}">
              <span class="deskbuddy-action-display">${opt.display}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
    
    document.documentElement.appendChild(menu);
    
    // Position menu near the stickman
    const targetEl = stickman === state ? stage : stickman.wrap;
    if (targetEl) {
      const rect = targetEl.getBoundingClientRect();
      menu.style.left = Math.min(window.innerWidth - 350, rect.right + 10) + "px";
      menu.style.top = Math.min(window.innerHeight - 500, rect.top) + "px";
    }
    
    // Event listeners
    menu.querySelector(".deskbuddy-context-close").addEventListener("click", closeContextMenu);
    
    menu.querySelectorAll(".deskbuddy-context-action").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedAction = btn.dataset.action;
        selectedTarget = btn.dataset.target;
        assignTask();
        closeContextMenu();
      });
    });
  }
  
  function closeContextMenu() {
    const menu = document.getElementById("deskbuddy-context-menu");
    if (menu) menu.remove();
    contextMenuOpen = false;
    selectedStickman = null;
    selectedAction = null;
    selectedTarget = null;
  }
  
  function showTargetSelection() {
    closeContextMenu();
    
    const selector = document.createElement("div");
    selector.id = "deskbuddy-target-selector";
    selector.className = "deskbuddy-target-selector";
    
    const action = TASK_ACTIONS[selectedAction];
    const stickmanName = selectedStickman === state ? "yellow" : selectedStickman.name;
    const selectedColor = selectedStickman === state ? "yellow" : selectedStickman.name;
    const stickmanEmoji = selectedColor === 'yellow' ? '💛' : selectedColor === 'red' ? '❤️' : selectedColor === 'blue' ? '💙' : '💚';
    
    // Build list of available targets (all stickmen except the selected one)
    const availableTargets = [];
    // Always include yellow if not selected
    if (selectedColor !== "yellow") {
      availableTargets.push({ color: "yellow", emoji: "💛" });
    }
    // Include all gang members except selected
    for (const color of Object.keys(gangMembers)) {
      if (color !== selectedColor) {
        const emoji = color === 'red' ? '❤️' : color === 'blue' ? '💙' : color === 'green' ? '💚' : '💛';
        availableTargets.push({ color, emoji });
      }
    }
    
    selector.innerHTML = `
      <div class="deskbuddy-target-header">
        <span>${action.emoji} ${action.name}</span>
        <button class="deskbuddy-target-close">×</button>
      </div>
      <div class="deskbuddy-target-body">
        <div class="deskbuddy-target-section">
          <div class="deskbuddy-target-title">Choose Target</div>
          <button class="deskbuddy-target-option" data-target="page">
            <span class="deskbuddy-target-full-action">${stickmanEmoji} ${stickmanName.toUpperCase()}: ${action.name} 📄</span>
          </button>
          ${availableTargets.map(t => `
            <button class="deskbuddy-target-option" data-target="${t.color}">
              <span class="deskbuddy-target-full-action">${stickmanEmoji} ${stickmanName.toUpperCase()}: ${action.name} ${t.emoji} ${t.color.toUpperCase()}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
    
    document.documentElement.appendChild(selector);
    
    // Center the selector
    selector.style.left = "50%";
    selector.style.top = "50%";
    selector.style.transform = "translate(-50%, -50%)";
    
    selector.querySelector(".deskbuddy-target-close").addEventListener("click", closeTargetSelector);
    
    selector.querySelectorAll(".deskbuddy-target-option").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedTarget = btn.dataset.target;
        assignTask();
        closeTargetSelector();
      });
    });
  }
  
  function closeTargetSelector() {
    const selector = document.getElementById("deskbuddy-target-selector");
    if (selector) selector.remove();
    selectedStickman = null;
    selectedAction = null;
    selectedTarget = null;
  }
  
  function assignTask() {
    if (!selectedStickman || !selectedAction) return;
    
    const task = {
      action: selectedAction,
      target: selectedTarget,
      assignedAt: Date.now(),
      status: "pending"
    };
    
    selectedStickman.taskQueue.push(task);
    
    const stickmanName = selectedStickman === state ? "yellow" : selectedStickman.name;
    const actionName = TASK_ACTIONS[selectedAction].name;
    const targetName = selectedTarget === "page" ? "page elements" : selectedTarget.toUpperCase();
    
    showBubble(`${stickmanName} assigned to ${actionName} ${targetName}!`, 2000);
    logLine(`Task assigned: ${stickmanName} → ${actionName} → ${targetName}`);
    
    // Start executing tasks if not already
    if (!selectedStickman.currentTask) {
      executeNextTask(selectedStickman);
    }
  }
  
  function executeNextTask(stickman) {
    if (stickman.taskQueue.length === 0) {
      stickman.currentTask = null;
      return;
    }
    
    const task = stickman.taskQueue.shift();
    stickman.currentTask = task;
    task.status = "executing";
    
    const stickmanName = stickman === state ? "yellow" : stickman.name;
    const actionName = TASK_ACTIONS[task.action].name;
    
    if (stickman === state) {
      showBubble(`executing: ${actionName}!`, 1500);
    } else {
      gangBubble(stickman, `executing: ${actionName}!`, 1500);
    }
    
    // Execute the task
    switch (task.action) {
      case "eliminate":
        executeEliminateTask(stickman, task);
        break;
      case "eat":
        executeEatTask(stickman, task);
        break;
      case "follow":
        executeFollowTask(stickman, task);
        break;
      case "attack":
        executeAttackTask(stickman, task);
        break;
      case "protect":
        executeProtectTask(stickman, task);
        break;
      case "collect":
        executeCollectTask(stickman, task);
        break;
      case "build":
        executeBuildTask(stickman, task);
        break;
      case "explore":
        executeExploreTask(stickman, task);
        break;
    }
  }
  
  function executeEliminateTask(stickman, task) {
    if (task.target === "page") {
      // Eliminate page elements
      if (stickman === state) {
        smash();
      } else {
        // Gang member smash
        const elements = document.querySelectorAll("p, div, span, h1, h2, h3");
        if (elements.length > 0) {
          const target = elements[Math.floor(Math.random() * elements.length)];
          target.style.opacity = "0";
          setTimeout(() => target.remove(), 500);
          spawnParticles("💥", 5);
        }
      }
    } else {
      // Eliminate another stickman
      const targetStickman = gangMembers[task.target];
      if (targetStickman && targetStickman !== stickman) {
        removeGangMember(task.target);
        if (stickman === state) {
          showBubble(`eliminated ${task.target}!`, 2000);
        } else {
          gangBubble(stickman, `eliminated ${task.target}!`, 2000);
        }
        spawnParticles("💀", 3);
      }
    }
    
    setTimeout(() => completeTask(stickman), 2000);
  }
  
  function executeEatTask(stickman, task) {
    if (stickman === state) {
      eat();
    } else {
      // Gang member eat
      fulfillNeed("hunger", 30, stickman);
      spawnParticles("🍔", 3);
    }
    
    setTimeout(() => completeTask(stickman), 2000);
  }
  
  function executeFollowTask(stickman, task) {
    if (task.target === "page") {
      // Follow page scroll
      if (stickman === state) {
        showBubble("following page scroll...", 1500);
      }
    } else {
      // Follow another stickman
      const targetStickman = gangMembers[task.target];
      if (targetStickman) {
        if (stickman === state) {
          showBubble(`following ${task.target}!`, 1500);
        } else {
          gangBubble(stickman, `following ${task.target}!`, 1500);
        }
        // Move towards target
        const targetStage = document.getElementById(`deskbuddy-stage-${task.target}`);
        const myStage = stickman === state ? stage : document.getElementById(`deskbuddy-stage-${stickman.name}`);
        if (targetStage && myStage) {
          const targetRect = targetStage.getBoundingClientRect();
          myStage.style.left = targetRect.left + "px";
          myStage.style.top = targetRect.top + 50 + "px";
        }
      }
    }
    
    setTimeout(() => completeTask(stickman), 3000);
  }
  
  function executeAttackTask(stickman, task) {
    if (task.target === "page") {
      // Attack page elements
      if (stickman === state) {
        rampage();
      } else {
        spawnParticles("⚔️", 5);
      }
    } else {
      // Attack another stickman
      const targetStickman = gangMembers[task.target];
      if (targetStickman && targetStickman !== stickman) {
        targetStickman.needs.happiness = Math.max(0, targetStickman.needs.happiness - 20);
        targetStickman.needs.energy = Math.max(0, targetStickman.needs.energy - 15);
        if (stickman === state) {
          showBubble(`attacked ${task.target}! ⚔️`, 1500);
        } else {
          gangBubble(stickman, `attacked ${task.target}! ⚔️`, 1500);
        }
        gangBubble(targetStickman, "ouch! 😢", 1500);
        spawnParticles("💥", 4);
      }
    }
    
    setTimeout(() => completeTask(stickman), 2000);
  }
  
  function executeProtectTask(stickman, task) {
    if (task.target !== "page") {
      const targetStickman = gangMembers[task.target];
      if (targetStickman && targetStickman !== stickman) {
        targetStickman.needs.happiness = Math.min(100, targetStickman.needs.happiness + 15);
        targetStickman.needs.comfort = Math.min(100, targetStickman.needs.comfort + 15);
        if (stickman === state) {
          showBubble(`protecting ${task.target}! 🛡️`, 1500);
        } else {
          gangBubble(stickman, `protecting ${task.target}! 🛡️`, 1500);
        }
        gangBubble(targetStickman, "thanks! ❤️", 1500);
        spawnParticles("🛡️", 3);
      }
    }
    
    setTimeout(() => completeTask(stickman), 2000);
  }
  
  function executeCollectTask(stickman, task) {
    // Collect items from page (text, links, etc.)
    const items = document.querySelectorAll("a, button, input");
    if (items.length > 0) {
      const collected = Math.min(5, items.length);
      if (stickman === state) {
        showBubble(`collected ${collected} items! 📦`, 1500);
      } else {
        gangBubble(stickman, `collected ${collected} items! 📦`, 1500);
      }
      spawnParticles("📦", collected);
      fulfillNeed("fun", 10, stickman);
    }
    
    setTimeout(() => completeTask(stickman), 2000);
  }
  
  function executeBuildTask(stickman, task) {
    // Build something (create a decorative element)
    const build = document.createElement("div");
    build.className = "deskbuddy-build";
    build.innerHTML = "🏗️";
    build.style.position = "fixed";
    build.style.left = Math.random() * (window.innerWidth - 100) + "px";
    build.style.top = Math.random() * (window.innerHeight - 100) + "px";
    build.style.fontSize = "30px";
    build.style.zIndex = "2147482996";
    document.documentElement.appendChild(build);
    
    if (stickman === state) {
      showBubble("built something! 🏗️", 1500);
    } else {
      gangBubble(stickman, "built something! 🏗️", 1500);
    }
    
    spawnParticles("🔨", 3);
    fulfillNeed("fun", 15, stickman);
    
    setTimeout(() => {
      build.remove();
      completeTask(stickman);
    }, 5000);
  }
  
  function executeExploreTask(stickman, task) {
    // Explore the page (move around randomly)
    if (stickman === state) {
      const newX = Math.max(40, Math.random() * (window.innerWidth - 120));
      stage.style.left = newX + "px";
      showBubble("exploring... 🔍", 1500);
    } else {
      const myStage = document.getElementById(`deskbuddy-stage-${stickman.name}`);
      if (myStage) {
        const newX = Math.max(40, Math.random() * (window.innerWidth - 120));
        myStage.style.left = newX + "px";
        gangBubble(stickman, "exploring... 🔍", 1500);
      }
    }
    
    fulfillNeed("fun", 10, stickman);
    
    setTimeout(() => completeTask(stickman), 3000);
  }
  
  function completeTask(stickman) {
    stickman.currentTask.status = "completed";
    stickman.currentTask = null;
    
    const stickmanName = stickman === state ? "yellow" : stickman.name;
    if (stickman === state) {
      showBubble("task completed! ✓", 1500);
    } else {
      gangBubble(stickman, "task completed! ✓", 1500);
    }
    
    // Execute next task if any
    setTimeout(() => executeNextTask(stickman), 1000);
  }
  
  function viewTasks(stickmanName) {
    const stickman = getStickmanByName(stickmanName) || state;
    const name = stickman === state ? "yellow" : stickman.name;
    
    logLine(`Tasks for ${name.toUpperCase()}:`);
    if (stickman.taskQueue.length === 0 && !stickman.currentTask) {
      logLine("  No tasks assigned.");
    } else {
      if (stickman.currentTask) {
        const task = stickman.currentTask;
        const action = TASK_ACTIONS[task.action];
        logLine(`  → Executing: ${action.name} ${action.emoji} (${task.target})`);
      }
      stickman.taskQueue.forEach((task, i) => {
        const action = TASK_ACTIONS[task.action];
        logLine(`  ${i + 1}. ${action.name} ${action.emoji} → ${task.target} (${task.status})`);
      });
    }
  }
  
  function clearTasks(stickmanName) {
    const stickman = getStickmanByName(stickmanName) || state;
    const name = stickman === state ? "yellow" : stickman.name;
    
    stickman.taskQueue = [];
    stickman.currentTask = null;
    
    showBubble(`${name}'s tasks cleared!`, 1500);
    logLine(`Cleared all tasks for ${name.toUpperCase()}`);
  }

  const SPEED_MULT = { slow: 1.8, normal: 1, fast: 0.5 };

  // Personality traits for each stickman color
  const PERSONALITIES = {
    yellow: {
      name: "balanced",
      traits: { energyDecay: 1.0, socialDecay: 1.0, happinessDecay: 1.0 },
      description: "Well-rounded and adaptable"
    },
    red: {
      name: "energetic",
      traits: { energyDecay: 1.5, socialDecay: 0.8, happinessDecay: 1.2 },
      description: "High energy, burns through needs faster"
    },
    blue: {
      name: "calm",
      traits: { energyDecay: 0.7, socialDecay: 1.2, happinessDecay: 0.9 },
      description: "Relaxed, needs decay slower"
    },
    green: {
      name: "social",
      traits: { energyDecay: 1.0, socialDecay: 1.5, happinessDecay: 1.3 },
      description: "Very social, needs more interaction"
    }
  };

  function getPersonalityForColor(color) {
    return PERSONALITIES[color]?.name || "balanced";
  }

  function getPersonalityTraits(stickman) {
    const personalityName = stickman.personality || "balanced";
    for (const [color, data] of Object.entries(PERSONALITIES)) {
      if (data.name === personalityName) {
        return data.traits;
      }
    }
    return { energyDecay: 1.0, socialDecay: 1.0, happinessDecay: 1.0 };
  }

  const MOODS = {
    neutral:   { face: faceDots(false) + `<line x1="27" y1="20" x2="37" y2="20" stroke="#222" stroke-width="1.6"/>`, stroke: "#222" },
    happy:     { face: faceDots(false) + `<path d="M26 19 Q32 25 38 19" stroke="#222" stroke-width="1.6" fill="none"/>`, stroke: "#222" },
    angry:     { face: faceDots(false) +
      `<line x1="25" y1="10" x2="30" y2="12" stroke="#222" stroke-width="1.6"/>` +
      `<line x1="39" y1="10" x2="34" y2="12" stroke="#222" stroke-width="1.6"/>` +
      `<path d="M26 21 Q32 16 38 21" stroke="#c0392b" stroke-width="1.6" fill="none"/>`, stroke: "#c0392b" },
    sad:       { face: faceDots(false) +
      `<line x1="25" y1="11" x2="30" y2="13" stroke="#222" stroke-width="1.4"/>` +
      `<line x1="39" y1="11" x2="34" y2="13" stroke="#222" stroke-width="1.4"/>` +
      `<path d="M26 22 Q32 17 38 22" stroke="#222" stroke-width="1.6" fill="none"/>`, stroke: "#2e5f8a" },
    emotional: { face: faceDots(false) +
      `<path d="M26 22 Q32 17 38 22" stroke="#222" stroke-width="1.6" fill="none"/>` +
      `<ellipse cx="37" cy="18" rx="1.6" ry="2.6" fill="#4aa3ff"/>`, stroke: "#4aa3ff" },
    surprised: { face: `<circle cx="28" cy="14" r="2" fill="#222"/><circle cx="36" cy="14" r="2" fill="#222"/>` +
      `<ellipse cx="32" cy="21" rx="2.6" ry="3.2" fill="#222"/>`, stroke: "#222" },
  };

  function faceDots(big) {
    const r = big ? 2 : 1.4;
    return `<circle cx="28" cy="14" r="${r}" fill="#222"/><circle cx="36" cy="14" r="${r}" fill="#222"/>`;
  }

  const WRITE_SNIPPETS = [
    `<div class="idea">\n  <!-- what if this was bigger? -->\n  <button class="cta">Click me</button>\n</div>`,
    `<section class="notes">\n  <p>rough thought:</p>\n  <ul>\n    <li>simplify this</li>\n    <li>add spacing</li>\n  </ul>\n</section>`,
    `.card {\n  border-radius: 12px;\n  box-shadow: 0 2px 8px rgba(0,0,0,.1);\n  padding: 16px;\n}`,
    `<!-- doodling -->\n<span class="badge">new</span>\n<p>just leaving this here</p>`,
    `function tidy(el) {\n  el.style.margin = "0 auto";\n  return el;\n}`,
    `<figure>\n  <figcaption>a small caption\n  nobody asked for</figcaption>\n</figure>`,
  ];

  // ---------------------------------------------------------------------
  // DOM refs
  // ---------------------------------------------------------------------
  let root, stage, wrap, bubble, codepanel, cmdbtn, consoleEl, consoleLog, consoleInput, toast;

  // ---------------------------------------------------------------------
  // Build UI
  // ---------------------------------------------------------------------
  function buildUI() {
    root = document.createElement("div");
    root.id = "deskbuddy-root";

    stage = document.createElement("div");
    stage.id = "deskbuddy-stage";
    stage.style.left = Math.max(40, Math.random() * (window.innerWidth - 120)) + "px";

    wrap = document.createElement("div");
    wrap.id = "deskbuddy-svg-wrap";
    wrap.innerHTML = `
      <svg viewBox="0 0 64 96" xmlns="http://www.w3.org/2000/svg">
        <g id="deskbuddy-body-group">
          <circle id="deskbuddy-head" cx="32" cy="16" r="10" fill="#fff" stroke="#222" stroke-width="2.5"/>
          <g id="deskbuddy-face"></g>
          <line x1="32" y1="26" x2="32" y2="60" stroke="#222" stroke-width="2.5"/>
          <g id="deskbuddy-arms">
            <line x1="32" y1="36" x2="14" y2="48" stroke="#222" stroke-width="2.5"/>
            <line x1="32" y1="36" x2="50" y2="48" stroke="#222" stroke-width="2.5"/>
          </g>
          <g id="deskbuddy-legs">
            <line x1="32" y1="60" x2="18" y2="90" stroke="#222" stroke-width="2.5"/>
            <line x1="32" y1="60" x2="46" y2="90" stroke="#222" stroke-width="2.5"/>
          </g>
        </g>
      </svg>`;
    wrap.title = "Right-click for tasks, left-click for sticky note";
    wrap.addEventListener("click", onStickmanClick);
    wrap.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (state.dragging) return;
      openContextMenu(state);
    });
    initBuddyDrag();
    initBuddyInteraction();

    bubble = document.createElement("div");
    bubble.id = "deskbuddy-bubble";

    codepanel = document.createElement("div");
    codepanel.id = "deskbuddy-codepanel";

    cmdbtn = document.createElement("div");
    cmdbtn.id = "deskbuddy-cmdbtn";
    cmdbtn.textContent = "⌘";
    cmdbtn.title = "Commands";
    cmdbtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleConsole();
    });

    stage.appendChild(codepanel);
    stage.appendChild(bubble);
    stage.appendChild(wrap);
    stage.appendChild(cmdbtn);
    
    // Add accessory element
    const accessoryEl = document.createElement("div");
    accessoryEl.id = "deskbuddy-accessory";
    accessoryEl.style.position = "absolute";
    accessoryEl.style.top = "-5px";
    accessoryEl.style.left = "20px";
    accessoryEl.style.fontSize = "20px";
    accessoryEl.style.display = "none";
    accessoryEl.style.pointerEvents = "none";
    stage.appendChild(accessoryEl);
    
    root.appendChild(stage);

    toast = document.createElement("div");
    toast.id = "deskbuddy-toast";
    root.appendChild(toast);

    consoleEl = document.createElement("div");
    consoleEl.id = "deskbuddy-console";
    consoleEl.innerHTML = `
      <div id="deskbuddy-console-log"></div>
      <div id="deskbuddy-console-input-row">
        <span>&gt;</span>
        <input id="deskbuddy-console-input" type="text" placeholder="try: help" />
      </div>`;
    root.appendChild(consoleEl);

    const needsEl = document.createElement("div");
    needsEl.id = "deskbuddy-needs";
    root.appendChild(needsEl);

    document.documentElement.appendChild(root);

    consoleLog = consoleEl.querySelector("#deskbuddy-console-log");
    consoleInput = consoleEl.querySelector("#deskbuddy-console-input");
    consoleInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && consoleInput.value.trim()) {
        runCommand(consoleInput.value.trim());
        consoleInput.value = "";
      }
    });

    applyMood(state.mood);
    logLine('Deskbuddy is here. Type "help" for commands.');
  }

  function destroyUI() {
    clearTimeout(state.actionTimer);
    clearTimeout(rampageTimer);
    clearTimeout(smashInterval);
    clearInterval(writeSomething._iv);
    clearInterval(state.needsTimer);
    despawnPet();
    cleanDoodles();
    state.setupElements.forEach((el) => el.remove());
    state.setupElements = [];
    if (root) root.remove();
    root = null;
  }

  // ---------------------------------------------------------------------
  // Buddy drag
  // ---------------------------------------------------------------------
  function initBuddyDrag() {
    wrap.addEventListener("mousedown", onDragStart);
    document.addEventListener("mousemove", onDragMove);
    document.addEventListener("mouseup", onDragEnd);
  }

  function onDragStart(e) {
    if (e.target !== wrap && !wrap.contains(e.target)) return;
    if (state.setupType === "basketball") return;
    // Only start drag on left-click (button 0), not right-click (button 2)
    if (e.button !== 0) return;
    state.dragging = true;
    const rect = stage.getBoundingClientRect();
    state.dragOffX = e.clientX - rect.left;
    state.dragOffY = e.clientY - rect.top;
    stage.style.transition = "none";
    stage.style.cursor = "grabbing";
  }

  function onDragMove(e) {
    if (!state.dragging) return;
    stage.style.left = (e.clientX - state.dragOffX) + "px";
    stage.style.top = (e.clientY - state.dragOffY) + "px";
    updateSetupPositions();
  }

  function onDragEnd() {
    if (!state.dragging) return;
    state.dragging = false;
    stage.style.transition = "";
    stage.style.cursor = "";
  }

  // ---------------------------------------------------------------------
  // Push / Pat interaction
  // ---------------------------------------------------------------------
  function initBuddyInteraction() {
    let enterTime = 0, enterX = 0, enterY = 0;

    wrap.addEventListener("mouseenter", (e) => {
      if (state.dragging) return;
      enterTime = Date.now();
      enterX = e.clientX;
      enterY = e.clientY;
    });

    wrap.addEventListener("mouseleave", (e) => {
      if (state.dragging) return;
      const elapsed = Date.now() - enterTime;
      if (elapsed < 300) {
        pushBuddy(e.clientX - enterX, e.clientY - enterY);
      } else if (elapsed > 500) {
        patBuddy();
      }
    });
  }

  function pushBuddy(dx, dy) {
    if (state.sleeping) {
      wake();
      showBubble("ah! woke me up!", 1500);
      return;
    }
    const dist = Math.min(40, Math.sqrt(dx * dx + dy * dy) * 0.4);
    if (dist < 5) return;
    const angle = Math.atan2(dy, dx);
    const pushX = Math.cos(angle) * dist;
    const pushY = Math.sin(angle) * dist;
    stage.animate([
      { transform: "translate(0, 0)" },
      { transform: `translate(${pushX}px, ${pushY}px)` },
      { transform: "translate(0, 0)" },
    ], { duration: 350, easing: "ease-out" });
    applyMood("surprised");
    showBubble("hey!", 1000);
    setTimeout(() => { if (state.mood === "surprised" && state.pose === "idle") applyMood("neutral"); }, 1500);
  }

  function patBuddy() {
    if (state.sleeping) {
      wake();
      showBubble("zz.. oh? was i dreaming?", 1800);
      applyMood("happy");
      return;
    }
    applyMood("happy");
    showBubble("pat pat ☺", 1600);
    spawnParticles("♥", 6);
  }

  function spawnParticles(char, count) {
    const rect = stage.getBoundingClientRect();
    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      p.className = "deskbuddy-particle";
      p.textContent = char;
      p.style.left = (rect.left + rect.width / 2 + (Math.random() - 0.5) * 60) + "px";
      p.style.top = (rect.top + (Math.random() - 0.5) * 30) + "px";
      p.style.animationDelay = (Math.random() * 0.3) + "s";
      document.documentElement.appendChild(p);
      setTimeout(() => p.remove(), 1000);
    }
  }

  // ---------------------------------------------------------------------
  // Angry rampage — grabs an element, throws it into another, smashes both
  // ---------------------------------------------------------------------
  let rampageTimer = null;
  let lastSmash = 0, lastEat = 0, lastClick = 0, lastType = 0, lastToggle = 0, lastInspect = 0, lastTomato = 0;
  let lastAnswer = 0, lastAnswerTime = 0, lastAnswerKey = "";

  function pickPageElement(exclude = []) {
    const all = document.querySelectorAll(
      'p, div, section, article, h1, h2, h3, h4, h5, h6, span, a, button, img, figure, footer' +
      'blockquote, li, td, th, label, strong, em, code, pre, canvas, audio, video'
    );
    const visible = [...all].filter((el) => {
      if (exclude.includes(el)) return false;
      if (el.closest("#deskbuddy-root")) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width < 30 || rect.height < 20) return false;
      if (rect.top < -50 || rect.left < -50) return false;
      if (rect.top > window.innerHeight + 50) return false;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      return true;
    });
    if (visible.length === 0) return null;
    return visible[Math.floor(Math.random() * visible.length)];
  }

  function createCrackSvg(x, y) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.style.position = "fixed";
    svg.style.left = (x - 50) + "px";
    svg.style.top = (y - 50) + "px";
    svg.style.width = "100px";
    svg.style.height = "100px";
    svg.style.zIndex = "2147483007";
    svg.style.pointerEvents = "none";
    svg.style.opacity = "0.85";
    svg.innerHTML =
      '<path d="M50,50 L30,10 M50,50 L70,8 M50,50 L90,35 M50,50 L92,65 M50,50 L75,90 ' +
      'M50,50 L45,95 M50,50 L15,80 M50,50 L8,50 M50,50 L10,25" ' +
      'stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.9"/>' +
      '<path d="M50,50 L58,28 L65,15 M50,50 L35,30 M50,50 L68,45 M50,50 L55,75 ' +
      'M50,50 L28,70 M50,50 L20,55" ' +
      'stroke="#fff" stroke-width="0.8" fill="none" stroke-linecap="round" opacity="0.6"/>' +
      '<circle cx="50" cy="50" r="3" fill="#fff" opacity="0.9"/>' +
      '<path d="M50,42 L52,35 M50,58 L48,65 M42,50 L35,48 M58,50 L65,52" ' +
      'stroke="#fff" stroke-width="0.5" fill="none" opacity="0.4"/>';
    document.documentElement.appendChild(svg);
  }

  function doSmash() {
    const now = Date.now();
    if (now - lastSmash < 3000 || !state.active || state.setupType || state.sleeping) return;
    lastSmash = now;

    const el1 = pickPageElement();
    if (!el1) { showBubble("grrr! nothing to throw!", 1200); return; }

    const el2 = pickPageElement([el1]);
    if (!el2) { showBubble("grrr!", 1000); return; }

    showBubble("take this! >:(", 1500);
    const rect1 = el1.getBoundingClientRect();
    const ghost = el1.cloneNode(true);
    ghost.style.cssText =
      "position:fixed;pointer-events:none;z-index:2147483006;" +
      "transition:all 0.45s ease;";
    ghost.style.left = rect1.left + "px";
    ghost.style.top = rect1.top + "px";
    if (ghost.style.width) ghost.style.width = rect1.width + "px";
    if (ghost.style.height) ghost.style.height = rect1.height + "px";
    document.documentElement.appendChild(ghost);
    el1.style.opacity = "0.3";

    const sRect = stage.getBoundingClientRect();
    requestAnimationFrame(() => {
      ghost.style.left = (sRect.left + 30) + "px";
      ghost.style.top = (sRect.top - 30) + "px";
      ghost.style.transform = "scale(0.5)";
      ghost.style.opacity = "0.8";
    });

    setTimeout(() => {
      if (!el2.isConnected) { ghost.remove(); el1.style.opacity = ""; return; }
      const rect2 = el2.getBoundingClientRect();
      const cx = rect2.left + rect2.width / 2;
      const cy = rect2.top + rect2.height / 2;
      ghost.style.transition = "all 0.55s cubic-bezier(0.22,0.68,0,1)";
      ghost.style.left = (cx - 20) + "px";
      ghost.style.top = (cy - 20) + "px";
      ghost.style.transform = "scale(0.3) rotate(720deg)";
      ghost.style.opacity = "1";

      setTimeout(() => {
        ghost.remove();
        if (el1.isConnected) el1.remove();
        if (el2.isConnected) el2.remove();
        createCrackSvg(cx, cy);
        setPose("idle");
        if (state.mood !== "angry") applyMood("happy");
        showBubble("hah! smashed! 💥", 1500);
      }, 550);
    }, 600);
  }

  // ---------------------------------------------------------------------
  // Eat — buddy eats a random page element
  // ---------------------------------------------------------------------

  function eatElement() {
    const now = Date.now();
    if (now - lastEat < 3000 || !state.active || state.setupType || state.sleeping) return;
    lastEat = now;
    const el = pickPageElement();
    if (!el) { showBubble("nothing tasty...", 1000); return; }
    setPose("writing");
    const rect = el.getBoundingClientRect();
    const ghost = el.cloneNode(true);
    ghost.style.cssText =
      "position:fixed;pointer-events:none;z-index:2147483006;" +
      "transition:all 0.5s cubic-bezier(0.25,0.46,0.45,0.94);";
    ghost.style.left = rect.left + "px";
    ghost.style.top = rect.top + "px";
    document.documentElement.appendChild(ghost);
    el.style.opacity = "0.2";
    const sRect = stage.getBoundingClientRect();
    showBubble("om nom nom 🤤", 1800);
    requestAnimationFrame(() => {
      ghost.style.left = (sRect.left + 20) + "px";
      ghost.style.top = (sRect.top - 10) + "px";
      ghost.style.transform = "scale(0.6) rotate(180deg)";
      ghost.style.opacity = "0.9";
    });
    setTimeout(() => {
      ghost.style.transition = "all 0.4s ease-in";
      ghost.style.transform = "scale(0.05) rotate(720deg)";
      ghost.style.opacity = "0";
      setTimeout(() => {
        ghost.remove();
        if (el.isConnected) el.remove();
        setPose("idle");
        showBubble("burp! 😋", 1400);
      }, 400);
    }, 600);
  }

  // ---------------------------------------------------------------------
  // Click — buddy clicks a random button on the page
  // ---------------------------------------------------------------------

  function clickButton() {
    const now = Date.now();
    if (now - lastClick < 3000 || !state.active || state.setupType || state.sleeping) return;
    lastClick = now;
    const btns = document.querySelectorAll(
      'button, a, input[type="submit"], input[type="button"], [role="button"], ' +
      '[onclick], .btn, .button'
    );
    const visible = [...btns].filter((el) => {
      if (el.closest("#deskbuddy-root")) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return false;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      return true;
    });
    if (visible.length === 0) return;
    const target = visible[Math.floor(Math.random() * visible.length)];
    const rect = target.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    walkTo(cx - 50);
    setTimeout(() => {
      if (!target.isConnected) return;
      setPose("writing");
      target.style.transition = "transform 0.15s ease";
      target.style.transform = "scale(0.92)";
      setTimeout(() => {
        target.style.transform = "";
        target.click();
        setPose("idle");
        const reacts = ["*click*", "what's this?", "oops", "hehe", "🙃", "*pokes*"];
        showBubble(reacts[Math.floor(Math.random() * reacts.length)], 1400);
      }, 150);
    }, 1200 + Math.random() * 600);
  }

  // ---------------------------------------------------------------------
  // Type — buddy types into a text box on the page
  // ---------------------------------------------------------------------

  function typeInBox() {
    const now = Date.now();
    if (now - lastType < 3000 || !state.active || state.setupType || state.sleeping) return;
    lastType = now;
    const inputs = document.querySelectorAll(
      'input[type="text"], input[type="search"], input[type="url"], input[type="email"], ' +
      'textarea, [contenteditable="true"]'
    );
    const visible = [...inputs].filter((el) => {
      if (el.closest("#deskbuddy-root")) return false;
      if (el.disabled || el.readOnly) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 10) return false;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      return true;
    });
    if (visible.length === 0) return;
    const target = visible[Math.floor(Math.random() * visible.length)];
    const rect = target.getBoundingClientRect();
    walkTo(rect.left - 40);
    setTimeout(() => {
      if (!target.isConnected) return;
      setPose("writing");
      target.focus();
      const lines = [
        "hello from deskbuddy 👋",
        "testing 1 2 3",
        "beep boop 🤖",
        "i live here now",
        "sup?",
        "nom nom 🍪",
        "// TODO: fix later",
        "hmm... interesting",
        "nice page btw ^_^",
        "secret message here",
        "> hello world",
      ];
      const msg = lines[Math.floor(Math.random() * lines.length)];
      if (target.tagName === "INPUT") {
        target.value = msg;
      } else {
        target.value = (target.value ? target.value + "\n" : "") + msg;
      }
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
      setPose("idle");
      showBubble("*types* 📝", 1200);
    }, 1400 + Math.random() * 500);
  }

  // ---------------------------------------------------------------------
  // Answer — buddy finds a question + answer box on the page and fills it
  // ---------------------------------------------------------------------

  const ANSWER_INPUT_SELECTOR =
    'input[type="text"], input[type="search"], input[type="url"], input[type="email"], ' +
    'input[type="tel"], input[type="number"], textarea, [contenteditable="true"]';

  function findQuestionInput() {
    const inputs = document.querySelectorAll(ANSWER_INPUT_SELECTOR);
    for (const input of inputs) {
      if (input.closest("#deskbuddy-root")) continue;
      if (input.disabled || input.readOnly) continue;
      if (input.isContentEditable && input.getAttribute("contenteditable") === "false") continue;
      const alreadyFilled = input.tagName === "INPUT" || input.tagName === "TEXTAREA"
        ? (input.value || "").trim()
        : (input.textContent || "").trim();
      if (alreadyFilled) continue;
      const rect = input.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 10) continue;
      if (rect.top < -50 || rect.top > window.innerHeight + 50) continue;
      const style = getComputedStyle(input);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const question = questionFor(input);
      if (question) return { input, question };
    }
    return null;
  }

  function questionFor(input) {
    const parts = [];
    const safe = (s) => { try { return CSS.escape(s); } catch (e) { return String(s).replace(/["\\]/g, ""); } };
    const lb = input.getAttribute("aria-labelledby");
    if (lb) lb.split(/\s+/).forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.textContent) parts.push(el.textContent);
    });
    if (input.getAttribute("aria-label")) parts.push(input.getAttribute("aria-label"));
    if (input.id) {
      const lbl = document.querySelector('label[for="' + safe(input.id) + '"]');
      if (lbl && lbl.textContent) parts.push(lbl.textContent);
    }
    if (input.placeholder) parts.push(input.placeholder);
    const wrap = input.closest("label");
    if (wrap && wrap.textContent) parts.push(wrap.textContent);
    let prev = input.previousElementSibling;
    for (let i = 0; i < 2 && prev; i++) {
      if (prev.textContent) parts.push(prev.textContent);
      prev = prev.previousElementSibling;
    }
    let anc = input.parentElement;
    for (let i = 0; i < 3 && anc; i++) {
      if (anc.textContent) parts.push(anc.textContent);
      anc = anc.parentElement;
    }
    for (const raw of parts) {
      const clean = String(raw).replace(/\s+/g, " ").trim();
      if (!clean || clean.length > 280) continue;
      if (
        clean.endsWith("?") ||
        /\b(what|which|who|whose|where|when|why|how|is|are|was|were|do|does|did|will|would|can|could|should)\b/i.test(clean)
      ) {
        return clean;
      }
    }
    return null;
  }

  function setInputValue(input, text) {
    if (input.isContentEditable) {
      input.textContent = text;
      try {
        input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      } catch (e) {
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } else {
      input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  const ANSWER_AI_SYSTEM = "You are a helpful assistant answering a single question found on a web page. Reply with exactly the answer text.";
  const ANSWER_AI_PROMPT =
    'On the current page there is this question with an empty answer box:\n"{q}"\n\n' +
    "Reply with ONLY the direct answer to type into the box. No explanations, no quotes, no extra text.";

  async function answerQuestion() {
    const now = Date.now();
    if (!state.active || state.setupType || state.sleeping) return false;
    if (now - lastAnswer < 6000) return false;
    const pair = findQuestionInput();
    if (!pair) return false;
    const key = pair.question.slice(0, 80);
    if (key === lastAnswerKey && now - lastAnswerTime < 60000) return false;
    lastAnswer = now;
    lastAnswerTime = now;
    lastAnswerKey = key;
    const { input, question } = pair;
    const rect = input.getBoundingClientRect();
    walkTo(rect.left - 40);
    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 500));
    if (!state.active || !input.isConnected) return false;
    setPose("writing");
    showBubble("🧠 thinking...", 1400);
    let answer = "";
    try {
      const text = await aiAskBrain(ANSWER_AI_PROMPT.replace("{q}", question), ANSWER_AI_SYSTEM);
      answer = String(text || "").replace(/^["'`\s]+|["'`\s]+$/g, "");
    } catch (e) { answer = ""; }
    if (!state.active) return false;
    if (!input.isConnected) { setPose("idle"); return false; }
    if (!answer) {
      setPose("idle");
      showBubble("couldn't figure that one out 🤔", 1600);
      return false;
    }
    input.focus();
    setInputValue(input, answer);
    setPose("idle");
    showBubble("answered it! ✅", 1400);
    return true;
  }

  // ---------------------------------------------------------------------
  // Toggle — buddy flips checkboxes / radio buttons
  // ---------------------------------------------------------------------

  function toggleCheckbox() {
    const now = Date.now();
    if (now - lastToggle < 3000 || !state.active || state.setupType || state.sleeping) return;
    lastToggle = now;
    const checks = document.querySelectorAll(
      'input[type="checkbox"], input[type="radio"]'
    );
    const visible = [...checks].filter((el) => {
      if (el.closest("#deskbuddy-root")) return false;
      if (el.disabled) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width < 5 || rect.height < 5) return false;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      return true;
    });
    if (visible.length === 0) return;
    const target = visible[Math.floor(Math.random() * visible.length)];
    const rect = target.getBoundingClientRect();
    walkTo(rect.left - 40);
    setTimeout(() => {
      if (!target.isConnected) return;
      setPose("writing");
      target.checked = !target.checked;
      target.dispatchEvent(new Event("change", { bubbles: true }));
      setPose("idle");
      const reacts = ["*flip*", "toggled!", "🙃", "hehe", "oops"];
      showBubble(reacts[Math.floor(Math.random() * reacts.length)], 1200);
    }, 1200 + Math.random() * 500);
  }

  // ---------------------------------------------------------------------
  // Scroll — buddy scrolls the page around
  // ---------------------------------------------------------------------
  function scrollPage() {
    if (!state.active || state.setupType || state.sleeping) return;
    const maxScroll = Math.max(100, document.body.scrollHeight - window.innerHeight);
    if (maxScroll < 50) return;
    const dir = Math.random() < 0.7 ? 1 : -1;
    const amount = (80 + Math.random() * 200) * dir;
    const target = Math.max(0, Math.min(maxScroll, window.scrollY + amount));
    setPose("walking");
    window.scrollBy({ top: amount, behavior: "smooth" });
    const reacts = ["*scrolls*", "what's down here?", "📜", "exploring...", "peekaboo"];
    showBubble(reacts[Math.floor(Math.random() * reacts.length)], 1200);
    setTimeout(() => setPose("idle"), 600);
  }

  // ---------------------------------------------------------------------
  // Inspect — buddy hovers near an element and reads its label
  // ---------------------------------------------------------------------

  function inspectElement() {
    const now = Date.now();
    if (now - lastInspect < 3000 || !state.active || state.setupType || state.sleeping) return;
    lastInspect = now;
    const candidates = document.querySelectorAll(
      'a, button, img, h1, h2, h3, p, label, [title], [aria-label], ' +
      'input, textarea, select, details, summary'
    );
    const visible = [...candidates].filter((el) => {
      if (el.closest("#deskbuddy-root")) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 10) return false;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      return true;
    });
    if (visible.length === 0) return;
    const target = visible[Math.floor(Math.random() * visible.length)];
    const rect = target.getBoundingClientRect();
    walkTo(rect.left - 50);
    setTimeout(() => {
      if (!target.isConnected) return;
      const text = target.title || target.ariaLabel || target.textContent || target.alt || "";
      const label = text.trim().slice(0, 50).replace(/\s+/g, " ");
      if (label) {
        showBubble(`"${label}" 👀`, 2000);
      } else {
        showBubble("*peers closely* 🤔", 1600);
      }
      target.style.transition = "outline 0.3s ease";
      target.style.outline = "2px solid #4aa3ff";
      setTimeout(() => { target.style.outline = ""; setPose("idle"); }, 1200);
    }, 1200 + Math.random() * 500);
  }

  // ---------------------------------------------------------------------
  // Rotten Tomato — throws a tomato at a page element
  // ---------------------------------------------------------------------

  function createSquishedTomatoSvg(x, y) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 80 80");
    svg.style.position = "fixed";
    svg.style.left = (x - 40) + "px";
    svg.style.top = (y - 40) + "px";
    svg.style.width = "80px";
    svg.style.height = "80px";
    svg.style.zIndex = "2147483007";
    svg.style.pointerEvents = "none";
    svg.style.overflow = "visible";
    svg.innerHTML =
      `<path d="M15,50 Q10,40 18,30 Q25,22 35,25 Q42,20 50,24 Q58,20 62,28 Q70,32 65,42 Q72,50 62,58 Q55,65 45,62 Q38,68 30,62 Q20,65 15,55Z" fill="#e74c3c" stroke="#c0392b" stroke-width="1.5"/>` +
      `<path d="M58,30 Q64,28 62,22 Q58,18 52,22" fill="none" stroke="#27ae60" stroke-width="2.5" stroke-linecap="round"/>` +
      `<ellipse cx="30" cy="40" rx="3" ry="2" fill="#c0392b" opacity="0.6"/>` +
      `<ellipse cx="50" cy="45" rx="2.5" ry="1.5" fill="#c0392b" opacity="0.5"/>` +
      `<ellipse cx="40" cy="55" rx="3.5" ry="2" fill="#c0392b" opacity="0.5"/>` +
      `<ellipse cx="22" cy="50" rx="2" ry="1.5" fill="#c0392b" opacity="0.4"/>` +
      `<ellipse cx="55" cy="38" rx="2" ry="1.2" fill="#c0392b" opacity="0.5"/>` +
      `<circle cx="52" cy="52" r="1.5" fill="#c0392b" opacity="0.4"/>`;
    document.documentElement.appendChild(svg);
    setTimeout(() => { svg.style.transition = "opacity 2s ease"; svg.style.opacity = "0"; }, 4000);
    setTimeout(() => svg.remove(), 6000);
  }

  function throwTomato() {
    const now = Date.now();
    if (now - lastTomato < 3000 || !state.active || state.setupType || state.sleeping) return;
    lastTomato = now;
    const el = pickPageElement();
    if (!el) { showBubble("no target... 🍅", 1000); return; }
    applyMood("angry");
    setPose("writing");
    say("tomato");
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const sRect = stage.getBoundingClientRect();
    const tomato = document.createElement("div");
    tomato.className = "deskbuddy-tomato";
    tomato.style.left = (sRect.left + 22) + "px";
    tomato.style.top = (sRect.top - 10) + "px";
    tomato.innerHTML = `<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="8" fill="#e74c3c" stroke="#c0392b" stroke-width="1.5"/><path d="M12,4 Q14,1 11,0 Q9,1 10,4" fill="#27ae60"/></svg>`;
    document.documentElement.appendChild(tomato);
    const startX = sRect.left + 22;
    const startY = sRect.top - 10;
    const dx = cx - startX;
    const dy = cy - startY;
    cancelRampage();
    tomato.animate([
      { transform: "translate(0, 0) rotate(0deg)" },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 120}px) rotate(360deg)` },
      { transform: `translate(${dx}px, ${dy}px) rotate(720deg)` },
    ], { duration: 600, easing: "ease-in-out" });
    const tomatoTimers = [];
    const splat = () => {
      tomatoTimers.forEach(clearTimeout);
      tomatoTimers.length = 0;
      if (tomato.isConnected) tomato.remove();
      if (el.isConnected) el.remove();
      createSquishedTomatoSvg(cx, cy);
      setPose("idle");
      applyMood("happy");
      showBubble("splat! 🍅", 1500);
    };
    tomatoTimers.push(setTimeout(splat, 650));
  }

  // ---------------------------------------------------------------------
  // Glass crack — shattered glass overlay on elements
  // ---------------------------------------------------------------------

  function createGlassCrackSvg(x, y) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 120 120");
    svg.style.position = "fixed";
    svg.style.left = (x - 60) + "px";
    svg.style.top = (y - 60) + "px";
    svg.style.width = "120px";
    svg.style.height = "120px";
    svg.style.zIndex = "2147483007";
    svg.style.pointerEvents = "none";
    svg.style.overflow = "visible";
    svg.style.filter = "drop-shadow(0 0 4px rgba(100,180,255,0.5))";
    const shards = 8 + Math.floor(Math.random() * 6);
    let paths = "";
    for (let i = 0; i < shards; i++) {
      const angle = (i / shards) * 360 + Math.random() * 30 - 15;
      const a = (angle * Math.PI) / 180;
      const len = 30 + Math.random() * 50;
      const w = 1.5 + Math.random() * 2;
      const x2 = 60 + Math.cos(a) * len;
      const y2 = 60 + Math.sin(a) * len;
      const midX = 60 + Math.cos(a) * len * (0.3 + Math.random() * 0.3);
      const midY = 60 + Math.sin(a) * len * (0.3 + Math.random() * 0.3);
      const opacity = 0.7 + Math.random() * 0.3;
      paths += `<path d="M60,60 L${midX},${midY} L${x2},${y2}" fill="none" stroke="rgba(255,255,255,${opacity})" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
      paths += `<path d="M60,60 L${midX},${midY} L${x2},${y2}" fill="none" stroke="rgba(100,180,255,${opacity * 0.6})" stroke-width="${w * 0.5}" stroke-linecap="round" stroke-linejoin="round"/>`;
      if (Math.random() > 0.5) {
        const branchAngle = a + (Math.random() - 0.5) * 1.2;
        const bLen = len * (0.2 + Math.random() * 0.3);
        const bx = midX + Math.cos(branchAngle) * bLen;
        const by = midY + Math.sin(branchAngle) * bLen;
        paths += `<path d="M${midX},${midY} L${bx},${by}" fill="none" stroke="rgba(255,255,255,${opacity * 0.7})" stroke-width="${w * 0.6}" stroke-linecap="round"/>`;
      }
    }
    svg.innerHTML = paths;
    document.documentElement.appendChild(svg);
  }

  function scrambleText(text) {
    return text.split('').sort(() => Math.random() - 0.5).join('');
  }

  function shatterElement() {
    const now = Date.now();
    if (now - lastSmash < 2500 || !state.active || state.setupType || state.sleeping) return;
    lastSmash = now;
    const el = pickPageElement();
    if (!el) { showBubble("nothing to shatter...", 1000); return; }
    setPose("writing");
    showBubble("shatter! 💎", 1200);
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    el.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    el.style.transform = "scale(1.05)";
    setTimeout(() => {
      el.style.transform = "scale(0.8) rotate(5deg)";
      el.style.opacity = "0.4";
    }, 150);
    createGlassCrackSvg(cx, cy);
    if (Math.random() > 0.5) {
      setTimeout(() => createGlassCrackSvg(cx + (Math.random() - 0.5) * 60, cy + (Math.random() - 0.5) * 60), 200);
    }
    setTimeout(() => {
      if (el.isConnected) {
        el.style.transform = "";
        // Disable all tags in the shattered element
        const allTags = el.querySelectorAll('*');
        allTags.forEach(tag => {
          if (tag.disabled !== undefined) tag.disabled = true;
          tag.style.pointerEvents = 'none';
          tag.style.opacity = '0.5';
        });
        // Scramble all text content
        const originalText = el.textContent;
        if (originalText && originalText.trim().length > 0) {
          el.setAttribute('data-shattered-text', originalText);
          el.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) {
              node.textContent = scrambleText(node.textContent);
            }
          });
        }
      }
      setPose("idle");
    }, 600);
  }

  // ---------------------------------------------------------------------
  // Spray tag — graffiti spray on the page
  // ---------------------------------------------------------------------

  function sprayTag() {
    if (!state.active || state.setupType || state.sleeping) return;
    const el = pickPageElement();
    if (!el) { showBubble("no wall to spray...", 1000); return; }
    setPose("writing");
    say("dancing");
    const rect = el.getBoundingClientRect();
    const colors = ["#ff6b6b", "#4ecdc4", "#ffe66d", "#a29bfe", "#fd79a8", "#6c5ce7", "#fdcb6e", "#ff9ff3"];
    const tags = ["DESK", "BUDDY", "WUZ HERE", ":) ", "hey! ", "✌ ", "★", "!!!", "BEEP", "BOOP", "NICE", "LOL"];
    const text = tags[Math.floor(Math.random() * tags.length)];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const tagEl = document.createElement("div");
    tagEl.className = "deskbuddy-graffiti";
    const tagX = rect.left + Math.random() * Math.max(20, rect.width - 40);
    const tagY = rect.top + Math.random() * Math.max(10, rect.height - 20);
    tagEl.style.cssText = `position:fixed;left:${tagX}px;top:${tagY}px;color:${color};font-size:${18 + Math.random() * 16}px;font-family:'Impact','Arial Black',sans-serif;font-weight:900;letter-spacing:2px;pointer-events:none;z-index:2147483008;opacity:0;transform:rotate(${-15 + Math.random() * 30}deg) scale(1.5);text-shadow:0 0 8px ${color},0 0 16px ${color}40,2px 2px 0 rgba(0,0,0,0.2);white-space:nowrap;transition:opacity 0.2s ease,transform 0.2s ease;`;
    tagEl.textContent = text;
    document.documentElement.appendChild(tagEl);
    requestAnimationFrame(() => {
      tagEl.style.opacity = "0.88";
      tagEl.style.transform = `rotate(${-15 + Math.random() * 30}deg) scale(1)`;
    });
    showBubble("*sprays* 🎨", 1200);
    setTimeout(() => setPose("idle"), 600);
  }

  // ---------------------------------------------------------------------
  // Sparkle aura — sparkles float around the stickman
  // ---------------------------------------------------------------------

  function sparkle() {
    if (!state.active || state.setupType || state.sleeping) return;
    setPose("idle");
    applyMood("happy");
    showBubble("✨ sparkle sparkle ✨", 1500);
    const chars = ["✦", "✧", "⋆", "✶", "✷", "·", "⋅"];
    const rect = stage.getBoundingClientRect();
    for (let i = 0; i < 14; i++) {
      const s = document.createElement("div");
      s.className = "deskbuddy-sparkle";
      s.textContent = chars[i % chars.length];
      s.style.cssText = `position:fixed;left:${rect.left + Math.random() * 64}px;top:${rect.top + Math.random() * 96}px;font-size:${8 + Math.random() * 12}px;color:#ffe66d;pointer-events:none;z-index:2147483005;opacity:0;text-shadow:0 0 6px #ffe66d;transition:none;`;
      document.documentElement.appendChild(s);
      const anim = s.animate([
        { transform: "translate(0, 0) scale(0)", opacity: 0 },
        { transform: `translate(${(Math.random() - 0.5) * 80}px, ${-(20 + Math.random() * 60)}px) scale(1.2)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${(Math.random() - 0.5) * 120}px, ${-(50 + Math.random() * 100)}px) scale(0)`, opacity: 0 },
      ], { duration: 1200 + Math.random() * 800, easing: "ease-out" });
      setTimeout(() => s.remove(), 2200);
    }
    setTimeout(() => {
      if (state.mood === "happy" && state.pose === "idle") applyMood("neutral");
    }, 2000);
  }

  // ---------------------------------------------------------------------
  // Climb — climbs up a tall page element
  // ---------------------------------------------------------------------

  function climbElement() {
    if (!state.active || state.setupType || state.sleeping) return;
    const candidates = document.querySelectorAll(
      'div, section, article, aside, nav, main, header, footer, figure, blockquote'
    );
    const visible = [...candidates].filter((el) => {
      if (el.closest("#deskbuddy-root")) return false;
      const rect = el.getBoundingClientRect();
      if (rect.height < 200 || rect.width < 30) return false;
      if (rect.bottom < 100) return false;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      return true;
    });
    if (visible.length === 0) { showBubble("nothing to climb...", 1000); return; }
    const target = visible[Math.floor(Math.random() * visible.length)];
    const rect = target.getBoundingClientRect();
    const climbX = Math.max(40, Math.min(window.innerWidth - 100, rect.left - 40));
    walkTo(climbX);
    setTimeout(() => {
      if (!target.isConnected) return;
      const r = target.getBoundingClientRect();
      if (r.height < 30) return;
      setPose("climbing");
      say("climbing");
      const origTrans = stage.style.transition;
      stage.style.bottom = "";
      stage.style.top = (window.innerHeight - r.bottom + 10) + "px";
      stage.style.transition = "top 2.5s ease-in-out";
      requestAnimationFrame(() => {
        const climbTo = Math.max(10, window.innerHeight - r.bottom - r.height + 30);
        stage.style.top = climbTo + "px";
      });
      setTimeout(() => {
        stage.style.top = (window.innerHeight - r.bottom + 10) + "px";
        setTimeout(() => {
          stage.style.transition = origTrans;
          stage.style.bottom = "0";
          stage.style.top = "";
          setPose("idle");
          showBubble("whew! 🧗‍♂️", 1500);
        }, 2500);
      }, 3000);
    }, 1200 + Math.random() * 500);
  }

  // ---------------------------------------------------------------------
  // Cook — cooks a meal, eats it, then burps, says yum, or spits it out
  // ---------------------------------------------------------------------

  function cook() {
    if (!state.active || state.setupType || state.sleeping) return;
    teardownSetup();
    state.setupType = "cooking";
    const pan = document.createElement("div");
    pan.className = "deskbuddy-pan";
    document.documentElement.appendChild(pan);
    state.setupElements.push(pan);
    const sRect = stage.getBoundingClientRect();
    pan.style.left = (sRect.left + 50) + "px";
    pan.style.top = (sRect.top + 35) + "px";
    setPose("writing");
    showBubble("cooking... 🍳", 2500);
    spawnParticles("💨", 4);
    clearTimeout(state.setupTimeout);
    state.setupTimeout = setTimeout(() => {
      if (!state.active) return;
      pan.remove();
      state.setupElements = state.setupElements.filter((el) => el !== pan);
      state.setupType = null;
      const roll = Math.random();
      if (roll < 0.35) {
        applyMood("happy");
        showBubble("burp! 😋", 1500);
        setPose("idle");
        setTimeout(() => { if (state.mood === "happy") applyMood("neutral"); }, 2000);
      } else if (roll < 0.65) {
        applyMood("happy");
        showBubble("yum! 😋", 1500);
        setPose("idle");
        setTimeout(() => { if (state.mood === "happy") applyMood("neutral"); }, 2000);
      } else {
        spitCooking();
      }
    }, 3500 + Math.random() * 2000);
  }

  function spitCooking() {
    const el = pickPageElement();
    if (!el) {
      showBubble("bleh! 🤢", 1200);
      setPose("idle");
      return;
    }
    applyMood("angry");
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const sRect = stage.getBoundingClientRect();
    const foodChars = ["🍝", "🍲", "🥘", "🍳", "🌮", "🥪", "🍕", "🧇"];
    const food = document.createElement("div");
    food.textContent = foodChars[Math.floor(Math.random() * foodChars.length)];
    food.style.cssText = `position:fixed;font-size:28px;left:${sRect.left + 22}px;top:${sRect.top - 10}px;z-index:2147483006;pointer-events:none;`;
    document.documentElement.appendChild(food);
    const startX = sRect.left + 22;
    const startY = sRect.top - 10;
    const dx = cx - startX;
    const dy = cy - startY;
    food.animate([
      { transform: "translate(0,0) rotate(0deg)", offset: 0 },
      { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 100}px) rotate(360deg)`, offset: 0.5 },
      { transform: `translate(${dx}px,${dy}px) rotate(720deg)`, offset: 1 },
    ], { duration: 500, easing: "ease-in-out", fill: "forwards" });
    const timers = [];
    const splat = () => {
      timers.forEach(clearTimeout);
      if (el.isConnected) el.remove();
      food.animate([
        { transform: `translate(${dx}px,${dy}px) rotate(720deg)`, opacity: 1 },
        { transform: `translate(${dx}px,${window.innerHeight + 60}px) rotate(900deg)`, opacity: 0 },
      ], { duration: 800, easing: "ease-in" });
      timers.push(setTimeout(() => {
        if (food.isConnected) food.remove();
        setPose("idle");
        applyMood("happy");
        showBubble("bleh! 🤢", 1500);
        setTimeout(() => { if (state.mood === "happy") applyMood("neutral"); }, 2000);
      }, 900));
    };
    timers.push(setTimeout(splat, 550));
  }

  function scheduleRampage() {
    clearTimeout(rampageTimer);
    if (!state.active || state.setupType || state.sleeping) return;
    rampageTimer = setTimeout(() => {
      doSmash();
      if (state.mood === "angry") scheduleRampage();
    }, 700 + Math.random() * 500);
  }

  function cancelRampage() {
    clearTimeout(rampageTimer);
  }

  // ---------------------------------------------------------------------
  // Mood / pose
  // ---------------------------------------------------------------------
  function applyMood(mood) {
    if (!MOODS[mood]) mood = "neutral";
    const prev = state.mood;
    state.mood = mood;
    const faceGroup = wrap.querySelector("#deskbuddy-face");
    const head = wrap.querySelector("#deskbuddy-head");
    faceGroup.innerHTML = MOODS[mood].face;
    head.setAttribute("stroke", MOODS[mood].stroke);
    if (mood === "angry" && prev !== "angry") scheduleRampage();
    else if (mood !== "angry") cancelRampage();
  }

  function setPose(pose) {
    state.pose = pose;
    stage.classList.remove(
      "walking", "sitting", "writing", "sleeping", "pushups", "shooting",
      "stretching", "looking", "dancing", "waving", "meditating", "celebrating",
      "climbing"
    );
    if (pose !== "idle") stage.classList.add(pose);
  }

  function showEnterToast() {
    if (!toast) return;
    toast.textContent = "🚶 Deskbuddy wandered into this tab";
    toast.classList.add("show");
    clearTimeout(showEnterToast._t);
    showEnterToast._t = setTimeout(() => toast.classList.remove("show"), 3000);
  }

  function showBubble(text, ms = 1600) {
    bubble.textContent = text;
    bubble.classList.add("show");
    clearTimeout(showBubble._t);
    showBubble._t = setTimeout(() => bubble.classList.remove("show"), ms);
  }

  // ---------------------------------------------------------------------
  // Setup system
  // ---------------------------------------------------------------------
  function teardownSetup() {
    clearInterval(setupCode._iv);
    clearTimeout(state.setupTimeout);
    clearTimeout(smashInterval);
    state.setupElements.forEach((el) => el.remove());
    state.setupElements = [];
    state.setupType = null;
    setPose("idle");
    stage.style.top = "";
    codepanel.classList.remove("show", "large");
    codepanel.style.width = "";
  }

  function updateSetupPositions() {
    const stageRect = stage.getBoundingClientRect();
    for (const el of state.setupElements) {
      if (el.classList.contains("deskbuddy-ball")) {
        if (el.dataset.flying === "true") continue;
        el.style.left = (stageRect.left + 30) + "px";
        el.style.top = (stageRect.top - 20) + "px";
      }
      if (el.classList.contains("deskbuddy-mat")) {
        el.style.left = (stageRect.left - 20) + "px";
        el.style.top = (stageRect.top + 60) + "px";
      }
      if (el.classList.contains("deskbuddy-chair")) {
        el.style.left = (stageRect.left - 10) + "px";
        el.style.top = (stageRect.top + 50) + "px";
      }
    }
  }

  function setupWorkout() {
    teardownSetup();
    state.setupType = "workout";
    const mat = document.createElement("div");
    mat.className = "deskbuddy-mat";
    document.documentElement.appendChild(mat);
    state.setupElements.push(mat);
    updateSetupPositions();
    showBubble("time to get fit! 💪", 1500);
    scheduleWorkout();
    state.setupTimeout = setTimeout(teardownSetup, 18000 + Math.random() * 12000);
  }

  function scheduleWorkout() {
    if (state.setupType !== "workout") return;
    setPose("pushups");
    let reps = 0;
    const maxReps = 6 + Math.floor(Math.random() * 4);
    const iv = setInterval(() => {
      reps++;
      stage.classList.toggle("pushups-down");
      if (reps >= maxReps * 2) {
        clearInterval(iv);
        stage.classList.remove("pushups-down");
        setPose("idle");
        showBubble("phew! 💪", 1500);
        setTimeout(() => scheduleWorkout(), 3000);
      }
    }, 350);
  }

  function setupChair() {
    teardownSetup();
    state.setupType = "chair";
    const chair = document.createElement("div");
    chair.className = "deskbuddy-chair";
    document.documentElement.appendChild(chair);
    state.setupElements.push(chair);
    updateSetupPositions();
    setPose("sitting");
    showBubble("this chair is nice", 1500);
    state.setupTimeout = setTimeout(teardownSetup, 12000 + Math.random() * 10000);
  }

  function setupCode() {
    teardownSetup();
    state.setupType = "code";
    codepanel.classList.add("show", "large");
    codepanel.style.width = "400px";
    setPose("writing");
    showBubble("coding something...", 1200);
    const snippets = [
      `function greet(name) {\n  return \`Hello, \${name}!\`;\n}\n\nconst msg = greet("buddy");\nconsole.log(msg);`,
      `.container {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  min-height: 100vh;\n}`,
      `const fetchData = async (url) => {\n  try {\n    const res = await fetch(url);\n    return res.json();\n  } catch (err) {\n    console.error(err);\n  }\n};`,
      `// TODO: refactor this\nclass Widget {\n  constructor(name) {\n    this.name = name;\n  }\n  render() {\n    return \`<div>\${this.name}</div>\`;\n  }\n}`,
    ];
    const snippet = snippets[Math.floor(Math.random() * snippets.length)];
    codepanel.textContent = "";
    let i = 0;
    clearInterval(setupCode._iv);
    setupCode._iv = setInterval(() => {
      codepanel.textContent = snippet.slice(0, i);
      i++;
      if (i > snippet.length) {
        clearInterval(setupCode._iv);
        showBubble("clean code! ✨", 1500);
        setPose("idle");
      }
    }, 25);
    state.setupTimeout = setTimeout(teardownSetup, 12000 + Math.random() * 10000);
  }

  function setupBasketball() {
    teardownSetup();
    state.setupType = "basketball";
    state.basketballShots = 0;
    state.basketballMade = 0;

    const stageRect = stage.getBoundingClientRect();
    const hoopX = Math.min(window.innerWidth - 140, Math.max(300, stageRect.left + 250));

    const hoop = document.createElement("div");
    hoop.className = "deskbuddy-hoop";
    hoop.style.left = hoopX + "px";
    hoop.style.top = Math.max(60, window.innerHeight * 0.35) + "px";
    hoop.innerHTML = `<svg viewBox="0 0 80 130" xmlns="http://www.w3.org/2000/svg">
  <rect x="37" y="24" width="6" height="106" fill="#7f8c8d" rx="2"/>
  <rect x="21" y="0" width="38" height="26" fill="rgba(255,255,255,0.12)" stroke="#ecf0f1" stroke-width="2" rx="2"/>
  <rect x="27" y="5" width="26" height="16" fill="none" stroke="#ecf0f1" stroke-width="1" rx="1"/>
  <rect x="25" y="22" width="30" height="3" fill="#e74c3c" rx="1"/>
  <polygon points="27,25 31,44 49,44 53,25" fill="none" stroke="#95a5a6" stroke-width="1"/>
  <line x1="31" y1="25" x2="34" y2="44" stroke="#95a5a6" stroke-width="0.8"/>
  <line x1="35" y1="25" x2="37" y2="44" stroke="#95a5a6" stroke-width="0.8"/>
  <line x1="39" y1="25" x2="40" y2="44" stroke="#95a5a6" stroke-width="0.8"/>
  <line x1="43" y1="25" x2="43" y2="44" stroke="#95a5a6" stroke-width="0.8"/>
  <line x1="47" y1="25" x2="46" y2="44" stroke="#95a5a6" stroke-width="0.8"/>
  <line x1="29" y1="31" x2="51" y2="31" stroke="#95a5a6" stroke-width="0.5"/>
  <line x1="30" y1="38" x2="49" y2="38" stroke="#95a5a6" stroke-width="0.5"/>
</svg>`;
    document.documentElement.appendChild(hoop);
    state.setupElements.push(hoop);

    const ball = document.createElement("div");
    ball.className = "deskbuddy-ball";
    ball.style.left = (stageRect.left + 30) + "px";
    ball.style.top = (stageRect.top - 20) + "px";
    document.documentElement.appendChild(ball);
    state.setupElements.push(ball);

    showBubble("let's ball! 🏀", 1500);
    setTimeout(() => shootBall(), 1200);
    state.setupTimeout = setTimeout(teardownSetup, 25000 + Math.random() * 15000);
  }

  function setupSmash() {
    teardownSetup();
    state.setupType = "smash";
    showBubble("time to break things! 💥", 1200);
    applyMood("angry");
    doSmash();
    state.setupTimeout = setTimeout(teardownSetup, 20000 + Math.random() * 15000);
    scheduleSmash();
  }

  let smashInterval = null;

  function scheduleSmash() {
    clearTimeout(smashInterval);
    if (state.setupType !== "smash") return;
    doSmash();
    smashInterval = setTimeout(scheduleSmash, 2500 + Math.random() * 2500);
  }

  function shootBall() {
    if (state.setupType !== "basketball") return;
    const ball = state.setupElements.find((el) => el.classList.contains("deskbuddy-ball"));
    const hoop = state.setupElements.find((el) => el.classList.contains("deskbuddy-hoop"));
    if (!ball || !hoop) return;

    setPose("shooting");
    showBubble("shooting...", 700);
    ball.dataset.flying = "true";
    ball.style.transition = "none";

    const ballRect = ball.getBoundingClientRect();
    const hoopRect = hoop.getBoundingClientRect();
    const hoopCenterX = hoopRect.left + hoopRect.width / 2;
    const hoopTop = hoopRect.top + 22;

    const startX = ballRect.left;
    const startY = ballRect.top;
    const midX = (startX + hoopCenterX) / 2;
    const midY = Math.min(startY, hoopTop) - 130;
    const endX = hoopCenterX;
    const endY = hoopTop;

    ball.animate([
      { transform: "translate(0, 0) rotate(0deg)", offset: 0 },
      { transform: `translate(${midX - startX}px, ${midY - startY}px) rotate(180deg)`, offset: 0.45 },
      { transform: `translate(${endX - startX}px, ${endY - startY}px) rotate(360deg)`, offset: 1 },
    ], {
      duration: 800,
      easing: "ease-in-out",
    }).onfinish = () => {
      const made = Math.random() > 0.45;
      state.basketballShots++;

      if (made) {
        state.basketballMade++;
        applyMood("happy");
        showBubble(`swish! 🏀 (${state.basketballMade}/${state.basketballShots})`, 2000);
        ball.style.transition = "left 0.5s ease, top 0.5s ease";
        ball.dataset.flying = "false";
        resetBallPos(ball);
      } else {
        applyMood("sad");
        showBubble(`clang! (${state.basketballMade}/${state.basketballShots})`, 2000);
        ball.style.transition = "left 0.4s ease, top 0.6s ease";
        ball.style.left = (hoopCenterX - 60 + Math.random() * 120) + "px";
        ball.style.top = (hoopTop + 100) + "px";
        setTimeout(() => {
          ball.style.transition = "left 0.5s ease, top 0.5s ease";
          ball.dataset.flying = "false";
          resetBallPos(ball);
        }, 700);
      }
      setPose("idle");
      setTimeout(() => shootBall(), 2500);
    };
  }

  function resetBallPos(ball) {
    const stageRect = stage.getBoundingClientRect();
    ball.style.left = (stageRect.left + 30) + "px";
    ball.style.top = (stageRect.top - 20) + "px";
  }

  // ---------------------------------------------------------------------
  // Sleep
  // ---------------------------------------------------------------------
  function sleep() {
    if (state.sleeping) return;
    state.sleeping = true;
    teardownSetup();
    setPose("sleeping");
    showBubble("zzz... 😴", 2000);

    const stageRect = stage.getBoundingClientRect();
    const zzz = document.createElement("div");
    zzz.className = "deskbuddy-zzz";
    zzz.style.left = (stageRect.left + 20) + "px";
    zzz.style.top = (stageRect.top - 10) + "px";
    document.documentElement.appendChild(zzz);
    state.setupElements.push(zzz);

    clearTimeout(state.actionTimer);
    clearTimeout(state.sleepTimeout);
    clearInterval(writeSomething._iv);
    state.sleepTimeout = setTimeout(autoWake, 12000 + Math.random() * 10000);
  }

  function autoWake() {
    if (!state.sleeping) return;
    wake();
    showBubble("zz.. oh? morning already?", 1800);
  }

  function wake() {
    if (!state.sleeping) return;
    state.sleeping = false;
    clearTimeout(state.sleepTimeout);
    state.setupElements.forEach((el) => el.remove());
    state.setupElements = [];
    state.setupType = null;
    setPose("idle");
    applyMood("neutral");
    showBubble("good morning! ☀", 1500);
    if (state.active) tick();
  }

  // ---------------------------------------------------------------------
  // New Activities
  // ---------------------------------------------------------------------
  
  function swim() {
    if (state.setupType) teardownSetup();
    state.setupType = "swim";
    setPose("idle");
    showBubble("splash! 🏊", 1500);
    spawnParticles("💧", 8);
    
    // Create water effect
    const water = document.createElement("div");
    water.className = "deskbuddy-water";
    water.style.left = stage.style.left;
    water.style.bottom = "0";
    document.documentElement.appendChild(water);
    state.setupElements.push(water);
    
    fulfillNeed("fun", 20);
    state.needs.energy = Math.max(0, state.needs.energy - 10);
    
    setTimeout(() => {
      if (state.setupType === "swim") {
        teardownSetup();
      }
    }, 8000);
  }
  
  function fish() {
    if (state.setupType) teardownSetup();
    state.setupType = "fish";
    setPose("idle");
    showBubble("fishing time! 🎣", 1500);
    
    // Create fishing rod
    const rod = document.createElement("div");
    rod.className = "deskbuddy-fishing-rod";
    rod.style.left = stage.style.left;
    rod.style.bottom = "40px";
    document.documentElement.appendChild(rod);
    state.setupElements.push(rod);
    
    fulfillNeed("fun", 15);
    
    setTimeout(() => {
      if (state.setupType === "fish") {
        const caught = Math.random() > 0.5;
        if (caught) {
          showBubble("caught a fish! 🐟", 2000);
          fulfillNeed("hunger", 25);
          spawnParticles("🐟", 3);
        } else {
          showBubble("got away... 😢", 1500);
        }
        teardownSetup();
      }
    }, 10000);
  }
  
  function garden() {
    if (state.setupType) teardownSetup();
    state.setupType = "garden";
    setPose("idle");
    showBubble("gardening! 🌱", 1500);
    
    // Create garden plot
    const plot = document.createElement("div");
    plot.className = "deskbuddy-garden";
    plot.style.left = stage.style.left;
    plot.style.bottom = "0";
    document.documentElement.appendChild(plot);
    state.setupElements.push(plot);
    
    fulfillNeed("fun", 18);
    state.needs.energy = Math.max(0, state.needs.energy - 15);
    
    setTimeout(() => {
      if (state.setupType === "garden") {
        showBubble("plants growing! 🌻", 2000);
        spawnParticles("🌻", 4);
        teardownSetup();
      }
    }, 12000);
  }
  
  function read() {
    if (state.setupType) teardownSetup();
    state.setupType = "read";
    setPose("sitting");
    showBubble("reading a book 📚", 1500);
    
    // Create book
    const book = document.createElement("div");
    book.className = "deskbuddy-book";
    book.style.left = stage.style.left;
    book.style.bottom = "30px";
    document.documentElement.appendChild(book);
    state.setupElements.push(book);
    
    fulfillNeed("fun", 25);
    fulfillNeed("happiness", 15);
    
    setTimeout(() => {
      if (state.setupType === "read") {
        showBubble("finished reading! 📖", 1500);
        teardownSetup();
      }
    }, 15000);
  }
  
  function game() {
    if (state.setupType) teardownSetup();
    state.setupType = "game";
    setPose("idle");
    showBubble("gaming time! 🎮", 1500);
    
    // Create game controller
    const controller = document.createElement("div");
    controller.className = "deskbuddy-controller";
    controller.style.left = stage.style.left;
    controller.style.bottom = "20px";
    document.documentElement.appendChild(controller);
    state.setupElements.push(controller);
    
    fulfillNeed("fun", 30);
    state.needs.energy = Math.max(0, state.needs.energy - 20);
    fulfillNeed("happiness", 20);
    
    setTimeout(() => {
      if (state.setupType === "game") {
        const won = Math.random() > 0.4;
        if (won) {
          showBubble("I won! 🏆", 2000);
          spawnParticles("🏆", 3);
        } else {
          showBubble("almost had it... 😤", 1500);
        }
        teardownSetup();
      }
    }, 20000);
  }

  // ---------------------------------------------------------------------
  // Stickman Interactions
  // ---------------------------------------------------------------------
  
  function highFive(targetName) {
    const target = getStickmanByName(targetName);
    if (!target) {
      showBubble("who should I high-five? 👋", 1500);
      return;
    }
    
    if (target === state) {
      showBubble("can't high-five myself! 😅", 1500);
      return;
    }
    
    showBubble(`high-five ${target.name}! 👋`, 1500);
    spawnParticles("✋", 4);
    
    if (target === state) {
      showBubble("high-five! ✋", 1500);
    } else {
      gangBubble(target, "high-five! ✋", 1500);
    }
    
    fulfillNeed("social", 25);
    fulfillNeed("happiness", 15);
    
    highFiveCount++;
    checkAchievements();
    
    if (target !== state) {
      target.needs.social = Math.min(100, target.needs.social + 25);
      target.needs.happiness = Math.min(100, target.needs.happiness + 15);
      updateNeedsUI();
    }
  }
  
  function compete(targetName) {
    const target = getStickmanByName(targetName);
    if (!target) {
      showBubble("who should I compete with? 🏆", 1500);
      return;
    }
    
    if (target === state) {
      showBubble("can't compete with myself! 😅", 1500);
      return;
    }
    
    showBubble(`competing with ${target.name}! 🏆`, 1500);
    
    setTimeout(() => {
      const winner = Math.random() > 0.5 ? state : target;
      if (winner === state) {
        showBubble("I won! 🏆", 2000);
        spawnParticles("🏆", 3);
        fulfillNeed("happiness", 20);
        fulfillNeed("fun", 15);
        gangBubble(target, "good game! 🤝", 1500);
        target.needs.happiness = Math.max(0, target.needs.happiness - 5);
      } else {
        showBubble("good game! 🤝", 1500);
        gangBubble(target, "I won! 🏆", 2000);
        state.needs.happiness = Math.max(0, state.needs.happiness - 5);
        target.needs.happiness = Math.min(100, target.needs.happiness + 20);
        target.needs.fun = Math.min(100, target.needs.fun + 15);
      }
      updateNeedsUI();
    }, 3000);
  }
  
  function chat(targetName) {
    const target = getStickmanByName(targetName);
    if (!target) {
      showBubble("who should I chat with? 💬", 1500);
      return;
    }
    
    if (target === state) {
      showBubble("can't chat with myself! 😅", 1500);
      return;
    }
    
    const topics = ["code", "games", "food", "music", "movies", "life"];
    const topic = topics[Math.floor(Math.random() * topics.length)];
    
    showBubble(`chatting with ${target.name} about ${topic}! 💬`, 2000);
    
    if (target !== state) {
      gangBubble(target, `talking about ${topic}! 💬`, 2000);
    }
    
    fulfillNeed("social", 30);
    fulfillNeed("happiness", 20);
    
    if (target !== state) {
      target.needs.social = Math.min(100, target.needs.social + 30);
      target.needs.happiness = Math.min(100, target.needs.happiness + 20);
      updateNeedsUI();
    }
  }

  // ---------------------------------------------------------------------
  // Needs system
  // ---------------------------------------------------------------------
  
  function startNeedsDecay() {
    // Start needs decay for yellow stickman
    if (state.needsTimer) clearInterval(state.needsTimer);
    state.needsTimer = setInterval(() => {
      if (!state.active || state.sleeping) return;
      decayNeeds(state);
    }, 3000);
    
    // Start needs decay for all gang members
    for (const color of Object.keys(gangMembers)) {
      const m = gangMembers[color];
      if (m && m.alive) {
        if (m.needsTimer) clearInterval(m.needsTimer);
        m.needsTimer = setInterval(() => {
          if (!m.alive) return;
          decayNeeds(m);
        }, 3000);
      }
    }
  }
  
  function decayNeeds(stickman) {
    const traits = getPersonalityTraits(stickman);
    
    // Decay needs over time with personality modifiers
    stickman.needs.hunger = Math.max(0, stickman.needs.hunger - 0.3);
    stickman.needs.thirst = Math.max(0, stickman.needs.thirst - 0.35);
    stickman.needs.energy = Math.max(0, stickman.needs.energy - (0.2 * traits.energyDecay));
    stickman.needs.happiness = Math.max(0, stickman.needs.happiness - (0.15 * traits.happinessDecay));
    stickman.needs.social = Math.max(0, stickman.needs.social - (0.25 * traits.socialDecay));
    stickman.needs.hygiene = Math.max(0, stickman.needs.hygiene - 0.1);
    stickman.needs.fun = Math.max(0, stickman.needs.fun - 0.2);
    stickman.needs.comfort = Math.max(0, stickman.needs.comfort - 0.15);
    
    updateNeedsUI();
    checkNeedsStatus(stickman);
  }
  
  function updateNeedsUI() {
    const needsEl = document.getElementById("deskbuddy-needs");
    if (!needsEl) return;
    
    // Initialize drag functionality if not already done
    if (!needsEl.dataset.dragInitialized) {
      initNeedsDrag();
      needsEl.dataset.dragInitialized = "true";
    }
    
    // Check if header exists, if not create it
    let header = needsEl.querySelector("#deskbuddy-needs-header");
    if (!header) {
      header = document.createElement("div");
      header.id = "deskbuddy-needs-header";
      header.textContent = "📊 Needs Status";
      needsEl.innerHTML = "";
      needsEl.appendChild(header);
    }
    
    // Clear existing need rows (keep header)
    needsEl.innerHTML = "";
    needsEl.appendChild(header);
    
    // Add needs for yellow stickman
    if (state.active) {
      needsEl.appendChild(createNeedsRow("Yellow", state.needs, "#ffe66d"));
    }
    
    // Add needs for each gang member
    for (const color of Object.keys(gangMembers)) {
      const m = gangMembers[color];
      if (m && m.alive) {
        needsEl.appendChild(createNeedsRow(m.name, m.needs, m.fill));
      }
    }
  }
  
  function initNeedsDrag() {
    const needsEl = document.getElementById("deskbuddy-needs");
    if (!needsEl) return;
    
    let dragging = false, offX = 0, offY = 0;
    
    needsEl.addEventListener("mousedown", (e) => {
      dragging = true;
      needsEl.classList.add("dragging");
      offX = e.clientX - needsEl.offsetLeft;
      offY = e.clientY - needsEl.offsetTop;
    });
    
    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      needsEl.style.left = (e.clientX - offX) + "px";
      needsEl.style.top = (e.clientY - offY) + "px";
      needsEl.style.right = "auto";
    });
    
    document.addEventListener("mouseup", () => {
      dragging = false;
      needsEl.classList.remove("dragging");
    });
  }
  
  function createNeedsRow(name, needs, color) {
    const row = document.createElement("div");
    row.className = "deskbuddy-need-row";
    row.innerHTML = `
      <span class="deskbuddy-need-label" style="color: ${color}">${name}</span>
      <div class="deskbuddy-need-bars">
        <div class="deskbuddy-need-bar-bg" title="Hunger"><div class="deskbuddy-need-bar" style="width: ${needs.hunger}%; background: ${getNeedsColor(needs.hunger)}"></div></div>
        <div class="deskbuddy-need-bar-bg" title="Thirst"><div class="deskbuddy-need-bar" style="width: ${needs.thirst}%; background: ${getNeedsColor(needs.thirst)}"></div></div>
        <div class="deskbuddy-need-bar-bg" title="Energy"><div class="deskbuddy-need-bar" style="width: ${needs.energy}%; background: ${getNeedsColor(needs.energy)}"></div></div>
        <div class="deskbuddy-need-bar-bg" title="Happiness"><div class="deskbuddy-need-bar" style="width: ${needs.happiness}%; background: ${getNeedsColor(needs.happiness)}"></div></div>
        <div class="deskbuddy-need-bar-bg" title="Social"><div class="deskbuddy-need-bar" style="width: ${needs.social}%; background: ${getNeedsColor(needs.social)}"></div></div>
        <div class="deskbuddy-need-bar-bg" title="Hygiene"><div class="deskbuddy-need-bar" style="width: ${needs.hygiene}%; background: ${getNeedsColor(needs.hygiene)}"></div></div>
        <div class="deskbuddy-need-bar-bg" title="Fun"><div class="deskbuddy-need-bar" style="width: ${needs.fun}%; background: ${getNeedsColor(needs.fun)}"></div></div>
        <div class="deskbuddy-need-bar-bg" title="Comfort"><div class="deskbuddy-need-bar" style="width: ${needs.comfort}%; background: ${getNeedsColor(needs.comfort)}"></div></div>
      </div>
    `;
    return row;
  }
  
  function getNeedsColor(value) {
    if (value > 60) return "#4ecdc4";
    if (value > 30) return "#ffe66d";
    return "#ff6b6b";
  }
  
  function checkNeedsStatus(stickman) {
    const isYellow = stickman === state;
    const isSleeping = isYellow ? state.sleeping : false;
    const setupType = isYellow ? state.setupType : null;
    
    // Auto-sleep when energy is very low (only for yellow)
    if (isYellow && stickman.needs.energy < 15 && !isSleeping && !setupType) {
      showBubble("so tired... 😴", 1500);
      setTimeout(() => sleep(), 2000);
    }
    
    // Auto-eat when hunger is very low
    if (stickman.needs.hunger < 20 && !isSleeping && !setupType) {
      if (isYellow) {
        showBubble("so hungry... 🍽️", 1500);
        setTimeout(() => eatElement(), 2000);
      }
    }
    
    // Become sad when happiness is low
    if (stickman.needs.happiness < 25 && stickman.mood !== "sad" && !isSleeping) {
      if (isYellow) {
        applyMood("sad");
      } else {
        gangMood(stickman, "sad");
      }
    }
    
    // Become angry when multiple needs are critical
    const criticalCount = [stickman.needs.hunger, stickman.needs.energy, stickman.needs.happiness, stickman.needs.social]
      .filter(n => n < 20).length;
    if (criticalCount >= 2 && stickman.mood !== "angry" && !isSleeping) {
      if (isYellow) {
        applyMood("angry");
        showBubble("i need attention! >:(", 1800);
      } else {
        gangMood(stickman, "angry");
        gangBubble(stickman, "i need attention! >:(", 1800);
      }
    }
  }
  
  function fulfillNeed(need, amount, stickman = state) {
    stickman.needs[need] = Math.min(100, stickman.needs[need] + amount);
    updateNeedsUI();
    
    const messages = {
      hunger: ["yum! 😋", "delicious!", "thanks! 🍽️"],
      energy: ["refreshed! ⚡", "energized!", "feeling better! 💪"],
      happiness: ["yay! 🎉", "so happy!", "thanks! ☺"],
      social: ["thanks for hanging out! 👋", "fun! 🎊", "good times! 😊"]
    };
    
    if (stickman === state) {
      showBubble(messages[need][Math.floor(Math.random() * messages[need].length)], 1500);
      
      // Mood improvement based on needs
      if (state.needs.happiness > 60 && state.needs.hunger > 50 && state.needs.energy > 50) {
        applyMood("happy");
      }
    } else {
      gangBubble(stickman, messages[need][Math.floor(Math.random() * messages[need].length)], 1500);
      
      // Mood improvement based on needs
      if (stickman.needs.happiness > 60 && stickman.needs.hunger > 50 && stickman.needs.energy > 50) {
        gangMood(stickman, "happy");
      }
    }
  }
  
  function showNeedsStatus() {
    // Show needs for yellow stickman
    if (state.active) {
      const status = [
        `Yellow: Hunger ${Math.round(state.needs.hunger)}% | Energy ${Math.round(state.needs.energy)}% | Happiness ${Math.round(state.needs.happiness)}% | Social ${Math.round(state.needs.social)}%`
      ];
      logLine(status[0]);
    }
    
    // Show needs for gang members
    for (const color of Object.keys(gangMembers)) {
      const m = gangMembers[color];
      if (m && m.alive) {
        const status = [
          `${m.name}: Hunger ${Math.round(m.needs.hunger)}% | Energy ${Math.round(m.needs.energy)}% | Happiness ${Math.round(m.needs.happiness)}% | Social ${Math.round(m.needs.social)}%`
        ];
        logLine(status[0]);
      }
    }
  }
  
  function getStickmanByName(name) {
    const lowerName = name.toLowerCase();
    if (lowerName === "yellow" || lowerName === "buddy") return state;
    
    for (const color of Object.keys(gangMembers)) {
      const m = gangMembers[color];
      if (m && m.alive && m.name.toLowerCase() === lowerName) {
        return m;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // Actions / behavior loop
  // ---------------------------------------------------------------------
  const MSGS = {
    idle: ["...", "hmm", "☀", "🎵", "*humming*", "*thinking*"],
    happy: ["hehe", "nice!", "👍", "☺", "good vibes", ":D"],
    angry: ["grr...", ">:/", "*annoyed*", "tch", "stupid bug"],
    sad: ["*sigh*", "😔", "meh", "..."],
    walking: ["*whistles*", "🚶", "off we go", "exploring..."],
    sitting: ["*relaxes*", "ahh...", "comfy", "*daydreams*"],
    writing: ["*taps chin*", "hmm...", "🤔", "what if..."],
    stretch: ["*stretch*", "ahhh~", "*cracks neck*"],
    look: ["*looks around*", "👀", "what's that?"],
    yawning: ["*yawn*", "..tired", "😴"],
    workout: ["one more!", "💪", "pump it!", "*panting*"],
    eating: ["om nom nom", "yummy", "🤤", "delicious", "*munch*"],
    clicking: ["*click*", "what's this?", "oops", "hehe", "🙃", "*pokes*"],
    dancing: ["💃", "let's go!", "grooving!", "🎵", "boogie time!", "🕺"],
    waving: ["👋", "hi there!", "heya!", "howdy!", "yo!"],
    meditating: ["🧘", "om...", "peace...", "breathe...", "🕉"],
    celebrating: ["🎉", "party!", "woohoo!", "let's gooo!", "🥳"],
    selfie: ["📸", "say cheese!", "look at us!", "selfie time!", "😁"],
    tomato: ["🍅", "take that!", "rotten!", "splat!", "booo!", "🥫"],
    shatter: ["💎", "shatter!", "glass!", "crack!", "💥"],
    spray: ["🎨", "*sprays*", "tag!", "color!", "🎭"],
    sparkle: ["✨", "sparkle sparkle", "🌟", "twinkle", "·*･"],
    climbing: ["🧗", "climbing!", "up we go!", "wheee!", "almost there!"],
    cooking: ["🍳", "cooking...", "sizzle", "yummy", "😋"],
  };

  function say(category) {
    const pool = MSGS[category] || MSGS.idle;
    showBubble(pool[Math.floor(Math.random() * pool.length)]);
  }

  function walkTo(xPercentTarget) {
    if (state.sleeping || state.setupType) return;
    setPose("walking");
    const maxX = Math.max(40, window.innerWidth - 100);
    const target = xPercentTarget != null ? xPercentTarget : Math.random() * maxX;
    stage.style.left = target + "px";
    const dur = 1400 * SPEED_MULT[state.speed];
    stage.style.transitionDuration = dur + "ms";
    clearTimeout(walkTo._t);
    walkTo._t = setTimeout(() => setPose("idle"), dur);
    if (Math.random() < 0.4) say("walking");
  }

  function sitDown() {
    if (state.sleeping || state.setupType) return;
    setPose("sitting");
    setTimeout(() => {
      if (state.pose === "sitting" && Math.random() < 0.4) say("sitting");
    }, 800);
  }

  function stretch() {
    if (state.sleeping || state.setupType) return;
    setPose("stretching");
    say("stretch");
    stage.classList.add("stretching");
    setTimeout(() => {
      stage.classList.remove("stretching");
      setPose("idle");
    }, 1200);
  }

  function lookAround() {
    if (state.sleeping || state.setupType) return;
    setPose("looking");
    say("look");
    stage.classList.add("looking");
    setTimeout(() => {
      stage.classList.remove("looking");
      setPose("idle");
    }, 1400);
  }

  // ---------------------------------------------------------------------
  // New actions: dance, wave, meditate, celebrate, selfie
  // ---------------------------------------------------------------------

  function dance() {
    if (state.sleeping || state.setupType) return;
    setPose("dancing");
    say("dancing");
    spawnParticles("♪", 3);
    spawnParticles("♫", 3);
    setTimeout(() => {
      setPose("idle");
      showBubble("woohoo! 💃", 1200);
    }, 2200 + Math.random() * 800);
  }

  function wave() {
    if (state.sleeping || state.setupType) return;
    setPose("waving");
    say("waving");
    setTimeout(() => setPose("idle"), 1600);
  }

  function meditate() {
    if (state.sleeping || state.setupType) return;
    setPose("meditating");
    applyMood("neutral");
    showBubble("🧘 om...", 2000);
    let omCount = 0;
    const omIv = setInterval(() => {
      if (state.pose !== "meditating") { clearInterval(omIv); return; }
      spawnParticles("🕉", 1);
      omCount++;
      if (omCount >= 4) clearInterval(omIv);
    }, 2000);
    setTimeout(() => {
      setPose("idle");
      applyMood("happy");
      showBubble("peaceful ✨", 1500);
    }, 8000 + Math.random() * 4000);
  }

  function celebrate() {
    if (state.sleeping || state.setupType) return;
    setPose("celebrating");
    applyMood("happy");
    showBubble("🎉 party!", 1500);
    spawnConfetti();
    setTimeout(() => setPose("idle"), 1800);
  }

  function takeSelfie() {
    if (state.sleeping || state.setupType) return;
    setPose("writing");
    applyMood("happy");
    showBubble("say cheese! 📸", 1500);
    const flash = document.createElement("div");
    flash.className = "deskbuddy-flash";
    document.documentElement.appendChild(flash);
    setTimeout(() => flash.remove(), 400);
    setTimeout(() => setPose("idle"), 1200);
  }

  function spawnConfetti() {
    const rect = stage.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const colors = ["#ff6b6b", "#4ecdc4", "#ffe66d", "#a29bfe", "#fd79a8", "#6c5ce7", "#fdcb6e", "#ff9ff3"];
    for (let i = 0; i < 30; i++) {
      const c = document.createElement("div");
      c.className = "deskbuddy-confetti";
      c.style.cssText = `position:fixed;width:${6 + Math.random() * 6}px;height:${6 + Math.random() * 6}px;background:${colors[Math.floor(Math.random() * colors.length)]};left:${cx + (Math.random() - 0.5) * 80}px;top:${cy + (Math.random() - 0.5) * 40}px;border-radius:${Math.random() > 0.5 ? "50%" : "2px"};pointer-events:none;z-index:2147483005;--dx:${(Math.random() - 0.5) * 200}px;--dy:${-50 - Math.random() * 150}px;--r:${Math.random() * 720}deg;animation:db-confetti-fly ${0.6 + Math.random() * 0.6}s ease-out forwards;animation-delay:${Math.random() * 0.3}s;`;
      document.documentElement.appendChild(c);
      setTimeout(() => c.remove(), 1500);
    }
  }

  // ---------------------------------------------------------------------
  // Pet companion
  // ---------------------------------------------------------------------

  function spawnPet() {
    if (state.petActive || state.sleeping || state.setupType) return;
    state.petActive = true;
    const pet = document.createElement("div");
    pet.className = "deskbuddy-pet";
    pet.innerHTML = `<svg viewBox="0 0 30 24" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="15" cy="18" rx="8" ry="5" fill="#d4a574" stroke="#8B6914" stroke-width="1"/>
  <circle cx="22" cy="12" r="6" fill="#d4a574" stroke="#8B6914" stroke-width="1"/>
  <circle cx="24" cy="10" r="1.5" fill="#222"/>
  <ellipse cx="26" cy="12" rx="1.2" ry="0.8" fill="#222"/>
  <path d="M20 18 Q15 22 10 18" fill="none" stroke="#8B6914" stroke-width="0.8"/>
  <ellipse cx="7" cy="19" rx="2" ry="1.2" fill="#d4a574" stroke="#8B6914" stroke-width="0.8"/>
  <ellipse cx="23" cy="21" rx="2" ry="1.2" fill="#d4a574" stroke="#8B6914" stroke-width="0.8"/>
</svg>`;
    document.documentElement.appendChild(pet);
    state.petElements = [pet];
    updatePetPosition();
    showBubble("a friend! 🐕", 1500);
    state.petTimer = setTimeout(() => {
      despawnPet();
      showBubble("bye friend! 🐕", 1500);
    }, 25000 + Math.random() * 25000);
  }

  function despawnPet() {
    clearTimeout(state.petTimer);
    if (state.petRaf) cancelAnimationFrame(state.petRaf);
    state.petRaf = null;
    state.petElements.forEach((el) => el.remove());
    state.petElements = [];
    state.petActive = false;
  }

  function updatePetPosition() {
    if (!state.petActive || state.petElements.length === 0) {
      state.petRaf = null;
      return;
    }
    const pet = state.petElements[0];
    const stageRect = stage.getBoundingClientRect();
    pet.style.left = (stageRect.left - 18) + "px";
    pet.style.top = (stageRect.top + 55) + "px";
    state.petRaf = requestAnimationFrame(updatePetPosition);
  }

  // ---------------------------------------------------------------------
  // Write something
  // ---------------------------------------------------------------------

  function writeSomething() {
    if (state.sleeping || state.setupType) return;
    setPose("writing");
    say("writing");
    const snippet = WRITE_SNIPPETS[Math.floor(Math.random() * WRITE_SNIPPETS.length)];
    codepanel.textContent = "";
    codepanel.classList.add("show");
    let i = 0;
    clearInterval(writeSomething._iv);
    writeSomething._iv = setInterval(() => {
      codepanel.textContent = snippet.slice(0, i);
      i++;
      if (i > snippet.length) {
        clearInterval(writeSomething._iv);
        setTimeout(() => {
          codepanel.classList.remove("show");
          setPose("idle");
        }, 2200);
      }
    }, 20 * SPEED_MULT[state.speed]);
  }

  // ---------------------------------------------------------------------
  // Doodle — buddy scribbles annotations next to page elements
  // ---------------------------------------------------------------------
  let doodleTags = [];

  function cleanDoodles() {
    doodleTags.forEach((t) => { if (t.isConnected) t.remove(); });
    doodleTags = [];
  }

  function doodleElements() {
    if (!state.active || state.setupType || state.sleeping) return;
    const candidates = document.querySelectorAll(
      'p, h1, h2, h3, h4, h5, h6, a, button, img, label, li, td, th, ' +
      'blockquote, figure, figcaption, span, strong, em, code'
    );
    const visible = [...candidates].filter((el) => {
      if (el.closest("#deskbuddy-root")) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width < 30 || rect.height < 20) return false;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      return true;
    });
    if (visible.length === 0) return;
    setPose("writing");
    const count = 1 + Math.floor(Math.random() * 3);
    const COLORS = ["#ff6b6b", "#4ecdc4", "#ffe66d", "#a29bfe", "#fd79a8", "#6c5ce7", "#fdcb6e"];
    const doodles = [
      "nice", "👍", "hmm", "✨", "cool", "wow", "lol", "👀", "fix this",
      "why?", "??", "!", "*", "→ like this", "maybe", "no", "yes",
      "todo", "boring", "fun", "♡", "here", "???", "lgtm", "...", "1ide"
    ];
    for (let i = 0; i < count && i < visible.length; i++) {
      const el = visible[Math.floor(Math.random() * visible.length)];
      const rect = el.getBoundingClientRect();
      const tag = document.createElement("div");
      tag.className = "deskbuddy-doodle";
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const text = doodles[Math.floor(Math.random() * doodles.length)];
      tag.textContent = text;
      tag.style.cssText =
        `position:fixed;left:${rect.left + rect.width + 4}px;` +
        `top:${rect.top + Math.random() * rect.height * 0.6}px;` +
        `background:${color};color:#222;font-size:${11 + Math.random() * 4}px;` +
        `font-family:'Comic Sans MS','Marker Felt',cursive;` +
        `padding:1px 5px;border-radius:4px;pointer-events:none;` +
        `z-index:2147483008;white-space:nowrap;` +
        `box-shadow:1px 1px 3px rgba(0,0,0,0.15);` +
        `transform:rotate(${-8 + Math.random() * 16}deg);` +
        `opacity:0;transition:opacity 0.3s ease;`;
      document.documentElement.appendChild(tag);
      doodleTags.push(tag);
      requestAnimationFrame(() => { tag.style.opacity = "0.92"; });
    }
    showBubble("*doodles* ✍", 1200);
    setPose("idle");
  }

  function pickRandomSetup() {
    if (state.sleeping || state.setupType) return;
    const roll = Math.random();
    if (roll < 0.30) { setupSmash(); }
    else if (roll < 0.48) { setupWorkout(); }
    else if (roll < 0.64) { setupChair(); }
    else if (roll < 0.80) { setupCode(); }
    else { setupBasketball(); }
  }

  function maybeShiftMood() {
    if (Math.random() > 0.35) return;
    const moods = Object.keys(MOODS);
    const next = moods[Math.floor(Math.random() * moods.length)];
    applyMood(next);
  }

  function tick() {
    if (!state.active) return;
    if (state.sleeping || state.setupType) {
      state.actionTimer = setTimeout(tick, 2000);
      return;
    }
    if (state.mood === "angry" && Math.random() < 0.7) {
      doSmash();
      const base = 1500 + Math.random() * 2000;
      state.actionTimer = setTimeout(tick, base * SPEED_MULT[state.speed]);
      return;
    }
    // AI brain decides what to do when connected
    if (aiConfig.enabled && !aiBusy && Math.random() < 0.6) {
      aiBusy = true;
      (findQuestionInput() ? answerQuestion() : aiDecideAndDo())
        .catch(() => {})
        .finally(() => {
          aiBusy = false;
          const base = 2000 + Math.random() * 5000;
          state.actionTimer = setTimeout(tick, base * SPEED_MULT[state.speed]);
        });
      return;
    }
    const roll = Math.random();
    if (Math.random() < 0.15) maybeShiftMood();
    if (roll < 0.14) {
      walkTo();
    } else if (roll < 0.22) {
      sitDown();
    } else if (roll < 0.26) {
      stretch();
    } else if (roll < 0.30) {
      lookAround();
    } else if (roll < 0.33) {
      writeSomething();
    } else if (roll < 0.35) {
      dance();
    } else if (roll < 0.38) {
      wave();
    } else if (roll < 0.40) {
      meditate();
    } else if (roll < 0.42) {
      celebrate();
    } else if (roll < 0.44) {
      takeSelfie();
    } else if (roll < 0.47) {
      doodleElements();
    } else if (roll < 0.50) {
      sprayTag();
    } else if (roll < 0.53) {
      shatterElement();
    } else if (roll < 0.56) {
      sparkle();
    } else if (roll < 0.59) {
      climbElement();
    } else if (roll < 0.63) {
      inspectElement();
    } else if (roll < 0.65) {
      scrollPage();
    } else if (roll < 0.69) {
      eatElement();
    } else if (roll < 0.74) {
      clickButton();
    } else if (roll < 0.79) {
      typeInBox();
    } else if (roll < 0.83) {
      toggleCheckbox();
    } else if (roll < 0.87) {
      doSmash();
    } else if (roll < 0.89) {
      spawnPet();
    } else if (roll < 0.92) {
      cook();
    } else if (roll < 0.95) {
      throwTomato();
    } else if (roll < 0.97) {
      pickRandomSetup();
    } else if (roll < 0.99) {
      if (Math.random() < 0.3) {
        sleep();
      } else {
        say("idle");
      }
    } else {
      setTimeout(() => say("idle"), 600);
      showBubble("wonder what's on other tabs...", 1200);
      chrome.runtime.sendMessage({ type: "REQUEST_JUMP" }).catch(() => {});
      state.actionTimer = setTimeout(tick, 6000);
      return;
    }
    const base = 2000 + Math.random() * 5000;
    state.actionTimer = setTimeout(tick, base * SPEED_MULT[state.speed]);
  }

  // =====================================================================
  // Gang — multi-stickman Alan Becker system (Red, Orange, Blue, Green)
  // =====================================================================

  const GANG_COLORS = {
    red:    { fill: "#FF6B6B", stroke: "#CC0000", name: "Red" },
    orange: { fill: "#FFA94D", stroke: "#CC7000", name: "Orange" },
    blue:   { fill: "#74B9FF", stroke: "#2D6BB4", name: "Blue" },
    green:  { fill: "#81EC81", stroke: "#2E8B2E", name: "Green" },
  };

  const GANG_MSGS = {
    idle: ["...", "hmm", "☀", "🎵"],
    happy: ["nice!", ":)", "good"],
    angry: ["grr!", ">:(", "hey!"],
    walking: ["🚶", "goin...", "exploring"],
    fight: ["take this!", "👊", "hyaa!", "fight me!"],
  };

  const gangMembers = {};
  let panelEl = null;
  let panelToggle = null;
  let enemies = [];
  let enemyAttackTimers = {};
  let enemyHealthEls = {};

  function createGangSVG(fill, stroke) {
    return `<svg viewBox="0 0 64 96" xmlns="http://www.w3.org/2000/svg">
      <g class="dgb-body-group">
        <circle class="dgb-head" cx="32" cy="16" r="10" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>
        <g class="dgb-face"></g>
        <line x1="32" y1="26" x2="32" y2="60" stroke="${stroke}" stroke-width="2.5"/>
        <g class="dgb-arms">
          <line x1="32" y1="36" x2="14" y2="48" stroke="${stroke}" stroke-width="2.5"/>
          <line x1="32" y1="36" x2="50" y2="48" stroke="${stroke}" stroke-width="2.5"/>
        </g>
        <g class="dgb-legs">
          <line x1="32" y1="60" x2="18" y2="90" stroke="${stroke}" stroke-width="2.5"/>
          <line x1="32" y1="60" x2="46" y2="90" stroke="${stroke}" stroke-width="2.5"/>
        </g>
      </g>
    </svg>`;
  }

  function createGangMember(color) {
    if (gangMembers[color]) return gangMembers[color];
    const c = GANG_COLORS[color];
    if (!c) return null;
    const wrap = document.createElement("div");
    wrap.className = "deskbuddy-gang-wrap";
    wrap.style.left = (40 + Math.random() * (window.innerWidth - 160)) + "px";
    wrap.innerHTML = createGangSVG(c.fill, c.stroke);
    const bubble = document.createElement("div");
    bubble.className = "deskbuddy-gang-bubble";
    wrap.appendChild(bubble);
    const hp = document.createElement("div");
    hp.className = "deskbuddy-hp";
    hp.innerHTML = '<div class="deskbuddy-hp-fill"></div>';
    wrap.appendChild(hp);
    const hpFill = hp.querySelector(".deskbuddy-hp-fill");
    hpFill.style.background = c.fill;
    hpFill.style.width = "100%";
    
    // Add context menu for gang members
    wrap.title = "Right-click for tasks, left-click to interact";
    wrap.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openContextMenu(member);
    });
    
    // Add drag functionality for gang members
    let gangDragging = false;
    let gangDragOffX = 0;
    let gangDragOffY = 0;
    
    wrap.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return; // Only left-click for drag
      gangDragging = true;
      const rect = wrap.getBoundingClientRect();
      gangDragOffX = e.clientX - rect.left;
      gangDragOffY = e.clientY - rect.top;
      wrap.style.transition = "none";
      wrap.style.cursor = "grabbing";
    });
    
    document.addEventListener("mousemove", (e) => {
      if (!gangDragging) return;
      wrap.style.left = (e.clientX - gangDragOffX) + "px";
      wrap.style.top = (e.clientY - gangDragOffY) + "px";
      member.x = parseFloat(wrap.style.left);
    });
    
    document.addEventListener("mouseup", () => {
      if (gangDragging) {
        gangDragging = false;
        wrap.style.transition = "";
        wrap.style.cursor = "";
      }
    });
    
    document.documentElement.appendChild(wrap);
    const member = {
      color, fill: c.fill, stroke: c.stroke, name: c.name,
      wrap, bubble, hp, hpFill,
      alive: true, health: 100,
      x: parseFloat(wrap.style.left),
      pose: "idle",
      actionTimer: null, animTimer: null,
      needs: {
        hunger: 100,
        energy: 100,
        happiness: 100,
        social: 100,
        thirst: 100,
        hygiene: 100,
        fun: 100,
        comfort: 100,
      },
      needsTimer: null,
      personality: getPersonalityForColor(color),
      accessory: null,
      achievements: [],
      taskQueue: [],
      currentTask: null,
    };
    gangMembers[color] = member;
    return member;
  }

  function removeGangMember(color) {
    const m = gangMembers[color];
    if (!m) return;
    clearTimeout(m.actionTimer);
    clearTimeout(m.animTimer);
    clearInterval(m.needsTimer);
    if (m.wrap && m.wrap.isConnected) m.wrap.remove();
    delete gangMembers[color];
  }

  function removeAllGangMembers() {
    for (const color of Object.keys(gangMembers)) removeGangMember(color);
  }

  function gangPose(m, pose) {
    if (!m || !m.alive) return;
    m.pose = pose;
    m.wrap.classList.remove("walking", "dead", "dying", "attacking", "hit");
    if (pose !== "idle") m.wrap.classList.add(pose);
  }

  function gangBubble(m, text, ms) {
    if (!m || !m.alive) return;
    m.bubble.textContent = text;
    m.bubble.classList.add("show");
    clearTimeout(m.animTimer);
    m.animTimer = setTimeout(() => { if (m.bubble) m.bubble.classList.remove("show"); }, ms || 1600);
  }

  function gangMood(m, mood) {
    if (!m || !m.alive) return;
    const faceGroup = m.wrap.querySelector(".dgb-face");
    const head = m.wrap.querySelector(".dgb-head");
    if (!faceGroup || !head) return;
    const moods = {
      neutral:  { face: '<line x1="27" y1="20" x2="37" y2="20" stroke="#222" stroke-width="1.6"/>', stroke: "#222" },
      happy:    { face: '<path d="M26 19 Q32 25 38 19" stroke="#222" stroke-width="1.6" fill="none"/>', stroke: "#222" },
      angry:    { face: '<line x1="25" y1="10" x2="30" y2="12" stroke="#222" stroke-width="1.6"/><line x1="39" y1="10" x2="34" y2="12" stroke="#222" stroke-width="1.6"/><path d="M26 21 Q32 16 38 21" stroke="#c0392b" stroke-width="1.6" fill="none"/>', stroke: "#c0392b" },
      sad:      { face: '<line x1="25" y1="11" x2="30" y2="13" stroke="#222" stroke-width="1.4"/><line x1="39" y1="11" x2="34" y2="13" stroke="#222" stroke-width="1.4"/><path d="M26 22 Q32 17 38 22" stroke="#222" stroke-width="1.6" fill="none"/>', stroke: "#2e5f8a" },
    };
    const m2 = moods[mood] || moods.neutral;
    faceGroup.innerHTML = m2.face;
    head.setAttribute("stroke", m2.stroke);
  }

  function gangWalkTo(m, xTarget) {
    if (!m || !m.alive) return;
    const maxX = window.innerWidth - 100;
    const target = xTarget != null ? Math.max(40, Math.min(maxX, xTarget)) : 40 + Math.random() * (maxX - 40);
    m.x = target;
    m.wrap.style.left = target + "px";
    gangPose(m, "walking");
    clearTimeout(m.animTimer);
    m.animTimer = setTimeout(() => { if (m && m.alive) gangPose(m, "idle"); }, 1200);
  }

  function gangSay(m, category) {
    const pool = GANG_MSGS[category] || GANG_MSGS.idle;
    gangBubble(m, pool[Math.floor(Math.random() * pool.length)]);
  }

  function gangToolbox(m, color) {
    if (!m.alive) return;
    const tools = ["🔧", "🔨", "🪛", "⚙️", "🛠️"];
    const tool = tools[Math.floor(Math.random() * tools.length)];
    gangBubble(m, tool + " fixing... " + tool, 1800);
    gangPose(m, "writing");
    clearTimeout(m.animTimer);
    m.animTimer = setTimeout(() => { if (m.alive) gangPose(m, "idle"); }, 1500);
    scheduleGangTick(color, 2500);
  }

  function gangWater(m, color) {
    if (!m.alive) return;
    gangBubble(m, "🌱 💧 water time!", 1800);
    gangPose(m, "writing");
    gangParticles(m, "💧", 5);
    clearTimeout(m.animTimer);
    m.animTimer = setTimeout(() => { if (m.alive) gangPose(m, "idle"); }, 1200);
    scheduleGangTick(color, 2500);
  }

  function gangAttack(m, color) {
    if (!m.alive) return;
    const colors = Object.keys(gangMembers).filter(c => c !== color && gangMembers[c].alive);
    if (state.active) colors.push("yellow");
    if (colors.length === 0) {
      scheduleGangTick(color, 1000);
      return;
    }
    const targetColor = colors[Math.floor(Math.random() * colors.length)];
    const target = targetColor === "yellow" ? state : gangMembers[targetColor];
    if (!target) {
      scheduleGangTick(color, 1000);
      return;
    }
    const myStage = color === "yellow" ? stage : m.wrap;
    const targetStage = targetColor === "yellow" ? stage : target.wrap;
    if (!myStage || !targetStage) {
      scheduleGangTick(color, 1000);
      return;
    }
    const myRect = myStage.getBoundingClientRect();
    const targetRect = targetStage.getBoundingClientRect();
    gangWalkTo(m, targetRect.left - 20);
    gangPose(m, "attacking");
    gangBubble(m, "hyah! ⚔️", 1200);
    gangParticles(m, "⚔️", 3);
    clearTimeout(m.animTimer);
    m.animTimer = setTimeout(() => {
      if (!m.alive) return;
      gangParticles(m, "💥", 4);
      if (targetColor === "yellow") {
        applyMood("angry");
        showBubble(`attacked by ${color}! 😠`, 1500);
        state.needs.happiness = Math.max(0, state.needs.happiness - 15);
      } else {
        gangMood(target, "angry");
        gangBubble(target, "ouch! 😢", 1500);
        target.health = Math.max(0, target.health - 10);
        updateGangHP(target);
        if (target.health <= 0) gangDie(target);
      }
      gangPose(m, "idle");
    }, 800);
    scheduleGangTick(color, 3000);
  }

  function updateGangHP(m) {
    if (!m || !m.hpFill) return;
    m.hpFill.style.width = Math.max(0, m.health) + "%";
    if (m.health < 30) m.hpFill.style.background = "#ff4444";
    else if (m.health < 60) m.hpFill.style.background = "#ffaa00";
    else m.hpFill.style.background = m.fill;
  }

  function gangDie(m) {
    if (!m || !m.alive) return;
    m.alive = false;
    m.wrap.classList.add("dying");
    gangBubble(m, "nooo... 💀", 1500);
    clearTimeout(m.actionTimer);
    
    // Notify background script that stickman died
    chrome.runtime.sendMessage({ type: "STICKMAN_DIED", color: m.color }).catch(() => {});
    
    setTimeout(() => {
      if (m.wrap && m.wrap.isConnected) {
        m.wrap.classList.remove("dying");
        m.wrap.classList.add("dead");
      }
      updatePanel();
    }, 600);
  }

  // -------------------------------------------------------------------
  // Gang full action repertoire
  // -------------------------------------------------------------------

  function gangParticles(m, char, count) {
    const rect = m.wrap.getBoundingClientRect();
    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      p.className = "deskbuddy-particle";
      p.textContent = char;
      p.style.left = (rect.left + rect.width / 2 + (Math.random() - 0.5) * 60) + "px";
      p.style.top = (rect.top + (Math.random() - 0.5) * 30) + "px";
      p.style.animationDelay = (Math.random() * 0.3) + "s";
      document.documentElement.appendChild(p);
      setTimeout(() => p.remove(), 1000);
    }
  }

  function gangSit(m, color) {
    if (!m.alive) return;
    gangPose(m, "sitting");
    gangSay(m, "sitting");
    clearTimeout(m.animTimer);
    m.animTimer = setTimeout(() => { if (m.alive) gangPose(m, "idle"); }, 3000);
    scheduleGangTick(color, 3500);
  }

  function gangStretch(m, color) {
    if (!m.alive) return;
    gangPose(m, "stretching");
    clearTimeout(m.animTimer);
    m.animTimer = setTimeout(() => { if (m.alive) gangPose(m, "idle"); }, 1400);
    scheduleGangTick(color, 2000);
  }

  function gangLook(m, color) {
    if (!m.alive) return;
    gangPose(m, "looking");
    gangBubble(m, "👀", 1200);
    clearTimeout(m.animTimer);
    m.animTimer = setTimeout(() => { if (m.alive) gangPose(m, "idle"); }, 1600);
    scheduleGangTick(color, 2200);
  }

  function gangDance(m, color) {
    if (!m.alive) return;
    gangPose(m, "dancing");
    gangParticles(m, "♪", 3);
    gangParticles(m, "♫", 3);
    gangBubble(m, "woohoo! 💃", 1200);
    clearTimeout(m.animTimer);
    m.animTimer = setTimeout(() => { if (m.alive) gangPose(m, "idle"); }, 2200 + Math.random() * 800);
    scheduleGangTick(color, 3500);
  }

  function gangWave(m, color) {
    if (!m.alive) return;
    gangPose(m, "waving");
    gangBubble(m, "👋", 1200);
    clearTimeout(m.animTimer);
    m.animTimer = setTimeout(() => { if (m.alive) gangPose(m, "idle"); }, 1800);
    scheduleGangTick(color, 2400);
  }

  function gangCelebrate(m, color) {
    if (!m.alive) return;
    gangPose(m, "celebrating");
    gangBubble(m, "🎉 woop!", 1200);
    gangParticles(m, "🎉", 4);
    gangParticles(m, "✨", 3);
    clearTimeout(m.animTimer);
    m.animTimer = setTimeout(() => { if (m.alive) gangPose(m, "idle"); }, 2000);
    scheduleGangTick(color, 2600);
  }

  function gangSelfie(m, color) {
    if (!m.alive) return;
    gangPose(m, "writing");
    gangBubble(m, "say cheese! 📸", 1200);
    const flash = document.createElement("div");
    flash.className = "deskbuddy-flash";
    document.documentElement.appendChild(flash);
    setTimeout(() => flash.remove(), 400);
    clearTimeout(m.animTimer);
    m.animTimer = setTimeout(() => { if (m.alive) gangPose(m, "idle"); }, 1400);
    scheduleGangTick(color, 2000);
  }

  function gangMeditate(m, color) {
    if (!m.alive) return;
    gangPose(m, "meditating");
    gangBubble(m, "🧘 om...", 2000);
    let omCount = 0;
    const omIv = setInterval(() => {
      if (!m.alive || m.pose !== "meditating") { clearInterval(omIv); return; }
      gangParticles(m, "🕉", 1);
      omCount++;
      if (omCount >= 4) clearInterval(omIv);
    }, 2000);
    clearTimeout(m.animTimer);
    m.animTimer = setTimeout(() => {
      clearInterval(omIv);
      if (m.alive) { gangPose(m, "idle"); gangBubble(m, "peace ✨", 1200); }
    }, 8000 + Math.random() * 4000);
    scheduleGangTick(color, 13000);
  }

  function gangDoodle(m, color) {
    if (!m.alive) return;
    const candidates = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, a, button, img, label, li, td, th, blockquote, figure, span');
    const visible = [...candidates].filter((el) => {
      if (el.closest("#deskbuddy-root")) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width < 30 || rect.height < 20) return false;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      return true;
    });
    if (visible.length === 0) { scheduleGangTick(color, 2000); return; }
    gangPose(m, "writing");
    const el = visible[Math.floor(Math.random() * visible.length)];
    const rect = el.getBoundingClientRect();
    const doodle = document.createElement("div");
    doodle.className = "deskbuddy-doodle";
    const colors = ["#ff6b6b", "#4ecdc4", "#ffe66d", "#a29bfe", "#fd79a8", "#6c5ce7", "#fdcb6e"];
    const texts = ["nice", "👍", "hmm", "✨", "cool", "wow", "lol", "👀", "why?", "!!", "→", "here", "??", "todo"];
    doodle.textContent = texts[Math.floor(Math.random() * texts.length)];
    doodle.style.cssText = `position:fixed;left:${rect.left + rect.width + 4}px;top:${rect.top + Math.random() * rect.height * 0.6}px;background:${colors[Math.floor(Math.random() * colors.length)]};color:#222;font-size:${11 + Math.random() * 4}px;font-family:'Comic Sans MS','Marker Felt',cursive;padding:1px 5px;border-radius:4px;pointer-events:none;z-index:2147483008;white-space:nowrap;box-shadow:1px 1px 3px rgba(0,0,0,0.15);transform:rotate(${-8 + Math.random() * 16}deg);opacity:0;transition:opacity 0.3s ease;`;
    document.documentElement.appendChild(doodle);
    requestAnimationFrame(() => { doodle.style.opacity = "0.92"; });
    gangBubble(m, "*doodles* ✍", 1000);
    clearTimeout(m.animTimer);
    m.animTimer = setTimeout(() => { if (m.alive) gangPose(m, "idle"); }, 800);
    scheduleGangTick(color, 2000);
  }

  function gangSparkle(m, color) {
    if (!m.alive) return;
    gangBubble(m, "✨ sparkle ✨", 1200);
    const chars = ["✦", "✧", "⋆", "✶", "✷", "·", "⋅"];
    const rect = m.wrap.getBoundingClientRect();
    for (let i = 0; i < 10; i++) {
      const s = document.createElement("div");
      s.textContent = chars[i % chars.length];
      s.style.cssText = `position:fixed;left:${rect.left + Math.random() * 64}px;top:${rect.top + Math.random() * 96}px;font-size:${8 + Math.random() * 12}px;color:#ffe66d;pointer-events:none;z-index:2147483005;opacity:0;text-shadow:0 0 6px #ffe66d;`;
      document.documentElement.appendChild(s);
      s.animate([
        { transform: "translate(0,0) scale(0)", opacity: 0 },
        { transform: `translate(${(Math.random() - 0.5) * 80}px,${-(20 + Math.random() * 60)}px) scale(1.2)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${(Math.random() - 0.5) * 120}px,${-(50 + Math.random() * 100)}px) scale(0)`, opacity: 0 },
      ], { duration: 1200 + Math.random() * 800, easing: "ease-out" });
      setTimeout(() => s.remove(), 2200);
    }
    scheduleGangTick(color, 2000);
  }

  function gangClimb(m, color) {
    if (!m.alive) return;
    const candidates = document.querySelectorAll('div, section, article, aside, nav, main, header, footer');
    const visible = [...candidates].filter((el) => {
      if (el.closest("#deskbuddy-root")) return false;
      const rect = el.getBoundingClientRect();
      if (rect.height < 200 || rect.width < 30) return false;
      if (rect.bottom < 100) return false;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      return true;
    });
    if (visible.length === 0) { scheduleGangTick(color, 2000); return; }
    const target = visible[Math.floor(Math.random() * visible.length)];
    const rect = target.getBoundingClientRect();
    const climbX = Math.max(40, Math.min(window.innerWidth - 100, rect.left - 40));
    gangWalkTo(m, climbX);
    clearTimeout(m.animTimer);
    m.animTimer = setTimeout(() => {
      if (!m.alive || !target.isConnected) { scheduleGangTick(color, 1000); return; }
      const r = target.getBoundingClientRect();
      if (r.height < 30) { scheduleGangTick(color, 1000); return; }
      gangPose(m, "climbing");
      gangBubble(m, "climbing! 🧗", 1500);
      const origTrans = m.wrap.style.transition;
      m.wrap.style.bottom = "";
      m.wrap.style.top = (window.innerHeight - r.bottom + 10) + "px";
      m.wrap.style.transition = "top 2.5s ease-in-out";
      requestAnimationFrame(() => {
        const climbTo = Math.max(10, window.innerHeight - r.bottom - r.height + 30);
        m.wrap.style.top = climbTo + "px";
      });
      setTimeout(() => {
        m.wrap.style.top = (window.innerHeight - r.bottom + 10) + "px";
        setTimeout(() => {
          m.wrap.style.transition = origTrans;
          m.wrap.style.bottom = "0";
          m.wrap.style.top = "";
          if (m.alive) gangPose(m, "idle");
          scheduleGangTick(color, 1000);
        }, 2500);
      }, 3000);
    }, 1200 + Math.random() * 500);
  }

  function gangCook(m, color) {
    if (!m.alive) return;
    const mRect = m.wrap.getBoundingClientRect();
    const pan = document.createElement("div");
    pan.className = "deskbuddy-pan";
    pan.style.left = (mRect.left + 50) + "px";
    pan.style.top = (mRect.top + 35) + "px";
    document.documentElement.appendChild(pan);
    gangPose(m, "writing");
    gangBubble(m, "cooking... 🍳", 2500);
    gangParticles(m, "💨", 4);
    setTimeout(() => {
      if (pan.isConnected) pan.remove();
      if (!m.alive) { scheduleGangTick(color, 500); return; }
      const roll = Math.random();
      if (roll < 0.4) {
        gangBubble(m, "burp! 😋", 1200);
        gangPose(m, "idle");
        scheduleGangTick(color, 2000);
      } else if (roll < 0.7) {
        gangBubble(m, "yum! 😋", 1200);
        gangPose(m, "idle");
        scheduleGangTick(color, 2000);
      } else {
        const el = pickPageElement();
        if (!el) { gangBubble(m, "bleh! 🤢", 1000); gangPose(m, "idle"); scheduleGangTick(color, 2000); return; }
        const rect = el.getBoundingClientRect();
        const foodChars = ["🍝", "🍲", "🥘", "🍳", "🌮", "🥪"];
        const food = document.createElement("div");
        food.textContent = foodChars[Math.floor(Math.random() * foodChars.length)];
        food.style.cssText = `position:fixed;font-size:26px;left:${mRect.left + 22}px;top:${mRect.top - 10}px;z-index:2147483006;pointer-events:none;`;
        document.documentElement.appendChild(food);
        const dx = (rect.left + rect.width / 2) - (mRect.left + 22);
        const dy = (rect.top + rect.height / 2) - (mRect.top - 10);
        food.animate([
          { transform: "translate(0,0) rotate(0deg)", offset: 0 },
          { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 100}px) rotate(360deg)`, offset: 0.5 },
          { transform: `translate(${dx}px,${dy}px) rotate(720deg)`, offset: 1 },
        ], { duration: 500, easing: "ease-in-out", fill: "forwards" });
        setTimeout(() => {
          if (food.isConnected) food.remove();
          food.animate([
            { transform: `translate(${dx}px,${dy}px) rotate(720deg)`, opacity: 1 },
            { transform: `translate(${dx}px,${window.innerHeight + 60}px) rotate(900deg)`, opacity: 0 },
          ], { duration: 800, easing: "ease-in" });
          setTimeout(() => { if (food.isConnected) food.remove(); }, 900);
          if (m.alive) { gangPose(m, "idle"); gangBubble(m, "bleh! 🤢", 1200); }
          scheduleGangTick(color, 2000);
        }, 600);
        return;
      }
    }, 3500 + Math.random() * 2000);
  }

  function gangEat(m, color) {
    if (!m.alive) return;
    const now = Date.now();
    if (now - lastEat < 3000) { scheduleGangTick(color, 1500); return; }
    lastEat = now;
    const el = pickPageElement();
    if (!el) { scheduleGangTick(color, 2000); return; }
    gangPose(m, "writing");
    const rect = el.getBoundingClientRect();
    const ghost = el.cloneNode(true);
    ghost.style.cssText = `position:fixed;pointer-events:none;z-index:2147483006;transition:all 0.5s cubic-bezier(0.25,0.46,0.45,0.94);left:${rect.left}px;top:${rect.top}px;`;
    document.documentElement.appendChild(ghost);
    el.style.opacity = "0.2";
    const mRect = m.wrap.getBoundingClientRect();
    gangBubble(m, "om nom nom 🤤", 1800);
    requestAnimationFrame(() => {
      ghost.style.left = (mRect.left + 20) + "px";
      ghost.style.top = (mRect.top - 10) + "px";
      ghost.style.transform = "scale(0.6) rotate(180deg)";
      ghost.style.opacity = "0.9";
    });
    setTimeout(() => {
      ghost.style.transition = "all 0.4s ease-in";
      ghost.style.transform = "scale(0.05) rotate(720deg)";
      ghost.style.opacity = "0";
      setTimeout(() => {
        ghost.remove();
        if (el.isConnected) el.remove();
        if (m.alive) gangPose(m, "idle");
      }, 400);
    }, 600);
    scheduleGangTick(color, 2000);
  }

  function gangClick(m, color) {
    if (!m.alive) return;
    const now = Date.now();
    if (now - lastClick < 3000) { scheduleGangTick(color, 1500); return; }
    lastClick = now;
    const btns = document.querySelectorAll('button, a, input[type="submit"], input[type="button"], [role="button"], .btn');
    const visible = [...btns].filter((el) => {
      if (el.closest("#deskbuddy-root")) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return false;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      return true;
    });
    if (visible.length === 0) { scheduleGangTick(color, 2000); return; }
    const target = visible[Math.floor(Math.random() * visible.length)];
    const rect = target.getBoundingClientRect();
    gangWalkTo(m, rect.left - 40);
    clearTimeout(m.animTimer);
    m.animTimer = setTimeout(() => {
      if (!m.alive || !target.isConnected) return;
      gangPose(m, "writing");
      target.style.transition = "transform 0.15s ease";
      target.style.transform = "scale(0.92)";
      setTimeout(() => {
        target.style.transform = "";
        target.click();
        if (m.alive) gangPose(m, "idle");
      }, 150);
      scheduleGangTick(color, 2500);
    }, 1200 + Math.random() * 600);
  }

  function gangType(m, color) {
    if (!m.alive) return;
    const now = Date.now();
    if (now - lastType < 3000) { scheduleGangTick(color, 1500); return; }
    lastType = now;
    const inputs = document.querySelectorAll('input[type="text"], input[type="search"], textarea, [contenteditable="true"]');
    const visible = [...inputs].filter((el) => {
      if (el.closest("#deskbuddy-root")) return false;
      if (el.disabled || el.readOnly) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 10) return false;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      return true;
    });
    if (visible.length === 0) { scheduleGangTick(color, 2000); return; }
    const target = visible[Math.floor(Math.random() * visible.length)];
    const rect = target.getBoundingClientRect();
    gangWalkTo(m, rect.left - 40);
    clearTimeout(m.animTimer);
    m.animTimer = setTimeout(() => {
      if (!m.alive || !target.isConnected) return;
      gangPose(m, "writing");
      target.focus();
      const lines = ["hello from deskbuddy 👋", "beep boop 🤖", "i live here now", "sup?", "nom nom 🍪", "// TODO", "hmm...", "nice page ^_^"];
      const msg = lines[Math.floor(Math.random() * lines.length)];
      if (target.tagName === "INPUT") { target.value = msg; }
      else { target.value = (target.value ? target.value + "\n" : "") + msg; }
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
      if (m.alive) gangPose(m, "idle");
      scheduleGangTick(color, 2500);
    }, 1400 + Math.random() * 500);
  }

  async function gangAnswer(m, color) {
    if (!m.alive) return false;
    const now = Date.now();
    if (now - lastAnswer < 6000) return false;
    const pair = findQuestionInput();
    if (!pair) return false;
    const key = pair.question.slice(0, 80);
    if (key === lastAnswerKey && now - lastAnswerTime < 60000) return false;
    lastAnswer = now;
    lastAnswerTime = now;
    lastAnswerKey = key;
    const { input, question } = pair;
    const rect = input.getBoundingClientRect();
    gangWalkTo(m, rect.left - 40);
    gangPose(m, "writing");
    gangBubble(m, "🧠 thinking...", 1200);
    await new Promise((r) => setTimeout(r, 900 + Math.random() * 500));
    if (!m.alive) return false;
    let answer = "";
    if (input.isConnected) {
      try {
        const text = await aiAskBrain(ANSWER_AI_PROMPT.replace("{q}", question), ANSWER_AI_SYSTEM);
        answer = String(text || "").replace(/^["'`\s]+|["'`\s]+$/g, "");
      } catch (e) { answer = ""; }
    }
    if (!m.alive) return false;
    if (input.isConnected && answer) {
      input.focus();
      setInputValue(input, answer);
      gangBubble(m, "answered it! ✅", 1200);
    } else if (input.isConnected) {
      gangBubble(m, "hmm, no idea 🤔", 1200);
    }
    gangPose(m, "idle");
    return true;
  }

  function gangToggle(m, color) {
    if (!m.alive) return;
    const now = Date.now();
    if (now - lastToggle < 3000) { scheduleGangTick(color, 1500); return; }
    lastToggle = now;
    const checks = document.querySelectorAll('input[type="checkbox"], input[type="radio"]');
    const visible = [...checks].filter((el) => {
      if (el.closest("#deskbuddy-root")) return false;
      if (el.disabled) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width < 5 || rect.height < 5) return false;
      return true;
    });
    if (visible.length === 0) { scheduleGangTick(color, 2000); return; }
    const target = visible[Math.floor(Math.random() * visible.length)];
    const rect = target.getBoundingClientRect();
    gangWalkTo(m, rect.left - 40);
    clearTimeout(m.animTimer);
    m.animTimer = setTimeout(() => {
      if (!m.alive || !target.isConnected) return;
      gangPose(m, "writing");
      target.checked = !target.checked;
      target.dispatchEvent(new Event("change", { bubbles: true }));
      if (m.alive) gangPose(m, "idle");
      scheduleGangTick(color, 2500);
    }, 1200 + Math.random() * 500);
  }

  function gangInspect(m, color) {
    if (!m.alive) return;
    const now = Date.now();
    if (now - lastInspect < 3000) { scheduleGangTick(color, 1500); return; }
    lastInspect = now;
    const candidates = document.querySelectorAll('a, button, img, h1, h2, h3, p, label, [title], [aria-label]');
    const visible = [...candidates].filter((el) => {
      if (el.closest("#deskbuddy-root")) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width < 20 || rect.height < 10) return false;
      return true;
    });
    if (visible.length === 0) { scheduleGangTick(color, 2000); return; }
    const target = visible[Math.floor(Math.random() * visible.length)];
    const rect = target.getBoundingClientRect();
    gangWalkTo(m, rect.left - 50);
    clearTimeout(m.animTimer);
    m.animTimer = setTimeout(() => {
      if (!m.alive || !target.isConnected) return;
      const text = target.title || target.ariaLabel || target.textContent || target.alt || "";
      const label = text.trim().slice(0, 50).replace(/\s+/g, " ");
      gangBubble(m, label ? `"${label}" 👀` : "*peers closely* 🤔", 1800);
      target.style.outline = "2px solid " + m.fill;
      setTimeout(() => { if (target.isConnected) target.style.outline = ""; if (m.alive) gangPose(m, "idle"); }, 1400);
      scheduleGangTick(color, 2500);
    }, 1200 + Math.random() * 500);
  }

  function gangScroll(m, color) {
    if (!m.alive) return;
    const maxScroll = Math.max(100, document.body.scrollHeight - window.innerHeight);
    if (maxScroll < 50) { scheduleGangTick(color, 2000); return; }
    const dir = Math.random() < 0.7 ? 1 : -1;
    const amount = (80 + Math.random() * 200) * dir;
    window.scrollBy({ top: amount, behavior: "smooth" });
    gangBubble(m, "*scrolls* 📜", 1000);
    scheduleGangTick(color, 2000);
  }

  function gangTick(color) {
    const m = gangMembers[color];
    if (!m || !m.alive) return;

    // AI brain decides what to do when connected
    if (aiConfig.enabled && !aiBusy && Math.random() < 0.6) {
      aiBusy = true;
      const pair = findQuestionInput();
      (pair ? gangAnswer(gangMembers[color], color) : aiGangDecideAndDo(color))
        .catch(() => {})
        .finally(() => {
          aiBusy = false;
          scheduleGangTick(color, 2000 + Math.random() * 2500);
        });
      return;
    }

    const roll = Math.random();
    if (roll < 0.12) {
      gangWalkTo(m);
      gangSay(m, "walking");
      scheduleGangTick(color, 1500);
    } else if (roll < 0.19) { gangSit(m, color);
    } else if (roll < 0.25) { gangStretch(m, color);
    } else if (roll < 0.31) { gangLook(m, color);
    } else if (roll < 0.35) { gangDance(m, color);
    } else if (roll < 0.39) { gangWave(m, color);
    } else if (roll < 0.43) { gangCelebrate(m, color);
    } else if (roll < 0.46) { gangSelfie(m, color);
    } else if (roll < 0.49) { gangMeditate(m, color);
    } else if (roll < 0.54) { gangDoodle(m, color);
    } else if (roll < 0.58) { gangSparkle(m, color);
    } else if (roll < 0.62) { gangClimb(m, color);
    } else if (roll < 0.66) { gangCook(m, color);
    } else if (roll < 0.70) { gangEat(m, color);
    } else if (roll < 0.74) { gangClick(m, color);
    } else if (roll < 0.78) { gangType(m, color);
    } else if (roll < 0.82) { gangToggle(m, color);
    } else if (roll < 0.86) { gangInspect(m, color);
    } else if (roll < 0.90) { gangScroll(m, color);
    } else if (roll < 0.94) { gangToolbox(m, color);
    } else if (roll < 0.97) { gangWater(m, color);
    } else if (roll < 0.99) { gangAttack(m, color);
    } else if (roll < 0.995) {
      chrome.runtime.sendMessage({ type: "STICKMAN_LEAVING", color }).catch(() => {});
      gangBubble(m, "later! 👋", 1200);
      clearTimeout(m.actionTimer);
      setTimeout(() => removeGangMember(color), 1500);
      return;
    } else {
      gangMood(m, "happy");
      gangBubble(m, "nice! 👍", 1000);
      scheduleGangTick(color, 3000);
    }
  }

  function scheduleGangTick(color, ms) {
    const m = gangMembers[color];
    if (!m || !m.alive) return;
    clearTimeout(m.actionTimer);
    m.actionTimer = setTimeout(() => gangTick(color), ms != null ? ms : 2000 + Math.random() * 3000);
  }

  // =====================================================================
  // AI Brain — connect a model so stickmen actually think
  // =====================================================================

  function aiAskBrain(prompt, system) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("AI request timed out"));
      }, 20000);
      chrome.runtime.sendMessage(
        {
          type: "AI_ASK",
          provider: aiConfig.provider || "custom",
          config: aiConfig,
          system: system || "You are the AI brain of a virtual desk pet stickman. Pick the single most appropriate action for the situation. Reply with exactly one action keyword, nothing else.",
          prompt,
        },
        (res) => {
          clearTimeout(timer);
          if (settled) return;
          settled = true;
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          if (res && res.ok) return resolve(String(res.text || "").trim());
          reject(new Error(res && res.error ? res.error : "AI request failed"));
        }
      );
    });
  }

  function aiCheckBuiltin() {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "AI_BUILTIN_AVAIL" }, (res) => {
          if (chrome.runtime.lastError || !res || !res.ok) return resolve(null);
          resolve(res.result || null);
        });
      } catch (e) { resolve(null); }
    });
  }

  const AI_ACTION_MAP = {
    walk: () => walkTo(),
    sit: () => sitDown(),
    stretch: () => stretch(),
    look: () => lookAround(),
    write: () => writeSomething(),
    dance: () => dance(),
    wave: () => wave(),
    meditate: () => meditate(),
    celebrate: () => celebrate(),
    selfie: () => takeSelfie(),
    doodle: () => doodleElements(),
    spray: () => sprayTag(),
    sparkle: () => sparkle(),
    climb: () => climbElement(),
    inspect: () => inspectElement(),
    scroll: () => scrollPage(),
    eat: () => eatElement(),
    click: () => clickButton(),
    type: () => typeInBox(),
    answer: () => answerQuestion(),
    toggle: () => toggleCheckbox(),
    smash: () => doSmash(),
    pet: () => spawnPet(),
    cook: () => cook(),
    sleep: () => sleep(),
    talk: () => say("idle"),
  };
  const AI_ACTIONS_PROMPT = [
    "walk: go for a wander",
    "sit: sit down and relax",
    "stretch: stretch the arms",
    "look: look around the page",
    "write: doodle a little code snippet",
    "dance: dance for fun",
    "wave: wave hello",
    "meditate: calm meditation",
    "celebrate: celebrate happily",
    "selfie: take a selfie",
    "doodle: doodle on page elements",
    "spray: spray some graffiti",
    "sparkle: sprinkle sparkles",
    "climb: climb a page element",
    "inspect: inspect page elements",
    "scroll: scroll the page",
    "eat: munch on something",
    "click: click a button on the page",
    "type: type in an input box",
    "answer: fill in the answer to a question on the page",
    "toggle: toggle a checkbox",
    "smash: smash page elements",
    "pet: summon a pet friend",
    "cook: cook some food",
    "sleep: take a nap",
    "talk: say a little phrase",
  ].join("\n");

  const GANG_AI_ACTION_MAP = {
    walk: (c) => gangWalkTo(gangMembers[c]),
    sit: (c) => gangSit(gangMembers[c], c),
    stretch: (c) => gangStretch(gangMembers[c], c),
    look: (c) => gangLook(gangMembers[c], c),
    dance: (c) => gangDance(gangMembers[c], c),
    wave: (c) => gangWave(gangMembers[c], c),
    celebrate: (c) => gangCelebrate(gangMembers[c], c),
    selfie: (c) => gangSelfie(gangMembers[c], c),
    meditate: (c) => gangMeditate(gangMembers[c], c),
    doodle: (c) => gangDoodle(gangMembers[c], c),
    sparkle: (c) => gangSparkle(gangMembers[c], c),
    climb: (c) => gangClimb(gangMembers[c], c),
    cook: (c) => gangCook(gangMembers[c], c),
    eat: (c) => gangEat(gangMembers[c], c),
    click: (c) => gangClick(gangMembers[c], c),
    type: (c) => gangType(gangMembers[c], c),
    answer: (c) => gangAnswer(gangMembers[c], c),
    toggle: (c) => gangToggle(gangMembers[c], c),
    inspect: (c) => gangInspect(gangMembers[c], c),
    scroll: (c) => gangScroll(gangMembers[c], c),
    toolbox: (c) => gangToolbox(gangMembers[c], c),
    water: (c) => gangWater(gangMembers[c], c),
    attack: (c) => gangAttack(gangMembers[c], c),
  };
  const GANG_AI_ACTIONS_PROMPT = [
    "walk: go for a wander",
    "sit: sit down",
    "stretch: stretch",
    "look: look around",
    "dance: dance for fun",
    "wave: wave hello",
    "celebrate: celebrate",
    "selfie: take a selfie",
    "meditate: calm meditation",
    "doodle: doodle",
    "sparkle: sprinkle sparkles",
    "climb: climb around",
    "cook: cook some food",
    "eat: munch on something",
    "click: click a page element",
    "type: type in an input",
    "answer: fill in the answer to a question on the page",
    "toggle: toggle a checkbox",
    "inspect: inspect page elements",
    "scroll: scroll the page",
    "toolbox: fix things with tools",
    "water: water the plants",
    "attack: attack another stickman",
  ].join("\n");

  function aiContextFor(actor, gang) {
    const n = actor.needs || {};
    const name = gang ? actor.name : "Yellow";
    const pair = findQuestionInput();
    let pageHint = `- Current page title: "${document.title}"`;
    if (pair) {
      pageHint += `\n- There is an unanswered question with an empty answer box on this page: "${pair.question}" (prefer the action: answer)`;
    } else {
      pageHint += "\n- No question/answer box found on this page.";
    }
    return `Situation for ${name}:
- Time of day: ${getTimeOfDay()}
- Weather: ${currentWeather}
- Mood: ${gang ? (actor.pose || "idle") : state.mood}
- Needs: hunger ${Math.round(n.hunger || 50)}%, energy ${Math.round(n.energy || 50)}%, happiness ${Math.round(n.happiness || 50)}%, social ${Math.round(n.social || 50)}%
${pageHint}

Available actions:
${gang ? GANG_AI_ACTIONS_PROMPT : AI_ACTIONS_PROMPT}

Choose the single best action for ${name} right now. Reply with exactly one keyword.`;
  }

  function aiKeywordFrom(text) {
    const first = (text || "").trim().toLowerCase().split(/\s+/)[0] || "";
    return first.replace(/[^a-z]/g, "");
  }

  async function aiDecideAndDo() {
    if (!aiConfig.enabled) return;
    try {
      const text = await aiAskBrain(aiContextFor(state, false));
      if (!state.active) return;
      const kw = aiKeywordFrom(text);
      const fn = AI_ACTION_MAP[kw];
      if (fn) {
        showBubble("🧠 " + kw + "!", 1600);
        fn();
        return;
      }
      say("idle");
      showBubble("🧠 hmm, " + (text || "?"), 2000);
    } catch (err) {
      say("idle");
    }
  }

  async function aiGangDecideAndDo(color) {
    const m = gangMembers[color];
    if (!m || !m.alive) return;
    try {
      const text = await aiAskBrain(aiContextFor(m, true));
      const kw = aiKeywordFrom(text);
      const fn = GANG_AI_ACTION_MAP[kw];
      if (fn) {
        fn(color);
      } else {
        gangSay(m, "idle");
      }
    } catch (err) {
      const mm = gangMembers[color];
      if (mm && mm.alive) gangSay(mm, "idle");
    }
  }

  async function aiTestConnection() {
    const text = await aiAskBrain("Reply with exactly one word: ok");
    return text;
  }

  function aiPanelStatus(msg) {
    const st = document.getElementById("deskbuddy-ai-status");
    if (st) st.textContent = msg;
  }

  function syncAiPanelInputs() {
    const url = document.getElementById("deskbuddy-ai-url");
    const key = document.getElementById("deskbuddy-ai-key");
    const model = document.getElementById("deskbuddy-ai-model");
    const tog = document.getElementById("deskbuddy-ai-toggle");
    const sel = document.getElementById("deskbuddy-ai-provider");
    if (sel) sel.value = aiConfig.provider || "builtin";
    if (url) url.value = aiConfig.apiUrl || "";
    if (key) key.value = aiConfig.apiKey || "";
    if (model) model.value = aiConfig.model || "";
    if (tog) {
      tog.textContent = aiConfig.enabled ? "on" : "off";
      tog.classList.toggle("on", !!aiConfig.enabled);
    }
    const isCustom = (aiConfig.provider || "builtin") === "custom";
    if (url) url.style.display = isCustom ? "" : "none";
    if (key) key.style.display = isCustom ? "" : "none";
    if (model) model.style.display = isCustom ? "" : "none";
    const biEl = document.getElementById("deskbuddy-ai-builtin");
    if (biEl) biEl.style.display = (aiConfig.provider || "builtin") === "builtin" ? "" : "none";
    if (aiConfig.provider === "builtin") aiRefreshBuiltinStatus();
  }

  function aiRefreshBuiltinStatus() {
    const el = document.getElementById("deskbuddy-ai-builtin");
    if (!el) return;
    el.textContent = "checking built-in AI…";
    aiCheckBuiltin().then((r) => {
      if (!el.isConnected) return;
      if (!r) { el.textContent = "built-in AI unavailable here"; return; }
      if (!r.ok) { el.textContent = "built-in AI: " + (r.error || r.state || "unavailable"); return; }
      const s = r.state || "available";
      el.textContent = s === "available"
        ? "built-in AI: available ✔ free, no key!"
        : "built-in AI: " + s + " (model downloads on first use)";
    });
  }

  function initAiPanel() {
    const tog = document.getElementById("deskbuddy-ai-toggle");
    const save = document.getElementById("deskbuddy-ai-save");
    const test = document.getElementById("deskbuddy-ai-test");
    const sel = document.getElementById("deskbuddy-ai-provider");
    if (sel) {
      sel.addEventListener("change", () => {
        aiConfig.provider = sel.value;
        aiSaveConfig();
        syncAiPanelInputs();
        aiPanelStatus("provider set to " + sel.value);
      });
    }
    if (tog) {
      tog.addEventListener("click", () => {
        aiConfig.enabled = !aiConfig.enabled;
        aiSaveConfig();
        syncAiPanelInputs();
        aiPanelStatus(aiConfig.enabled ? "AI brain is ON. Stickmen use the model now." : "AI brain is off. Random behavior.");
      });
    }
    if (save) {
      save.addEventListener("click", () => {
        const p = (document.getElementById("deskbuddy-ai-provider").value || "builtin");
        aiConfig.provider = p;
        aiConfig.apiUrl = (document.getElementById("deskbuddy-ai-url").value || "").trim();
        aiConfig.apiKey = (document.getElementById("deskbuddy-ai-key").value || "").trim();
        aiConfig.model = (document.getElementById("deskbuddy-ai-model").value || "").trim();
        aiSaveConfig();
        aiPanelStatus("config saved ✔");
      });
    }
    if (test) {
      test.addEventListener("click", () => {
        const p = (document.getElementById("deskbuddy-ai-provider").value || "builtin");
        aiConfig.provider = p;
        aiConfig.apiUrl = (document.getElementById("deskbuddy-ai-url").value || "").trim();
        aiConfig.apiKey = (document.getElementById("deskbuddy-ai-key").value || "").trim();
        aiConfig.model = (document.getElementById("deskbuddy-ai-model").value || "").trim();
        aiSaveConfig();
        aiPanelStatus("testing " + p + "…");
        aiTestConnection()
          .then((t) => { aiPanelStatus("connected ✔ model said: " + t); })
          .catch((err) => { aiPanelStatus("failed ✖ " + String(err).slice(0, 60)); });
      });
    }
    syncAiPanelInputs();
  }

  // =====================================================================
  // Portal — white portal that sucks stickmen in when banned
  // =====================================================================

  function spawnPortal(x, y) {
    const portal = document.createElement("div");
    portal.className = "deskbuddy-portal";
    portal.style.left = x + "px";
    portal.style.top = y + "px";
    portal.innerHTML =
      '<div class="deskbuddy-portal-flare"></div><div class="deskbuddy-portal-ring"></div><div class="deskbuddy-portal-hole"></div>';
    document.documentElement.appendChild(portal);
    requestAnimationFrame(() => requestAnimationFrame(() => portal.classList.add("on")));
    return portal;
  }

  function vanishPortal(portal) {
    if (!portal || !portal.isConnected) return;
    portal.classList.remove("on");
    portal.classList.add("vanish");
    setTimeout(() => { if (portal.isConnected) portal.remove(); }, 400);
  }

  function suckIntoPortal(el, portal, done) {
    if (!el || !el.isConnected) { vanishPortal(portal); if (done) done(); return; }
    const er = el.getBoundingClientRect();
    const pr = portal.getBoundingClientRect();
    const clone = el.cloneNode(true);
    clone.style.position = "fixed";
    clone.style.left = er.left + "px";
    clone.style.top = er.top + "px";
    clone.style.margin = "0";
    clone.style.width = er.width + "px";
    clone.style.height = er.height + "px";
    clone.style.zIndex = "2147483011";
    clone.style.pointerEvents = "none";
    clone.style.transition = "left 0.8s cubic-bezier(0.5, 0, 0.8, 1), top 0.8s cubic-bezier(0.5, 0, 0.8, 1), transform 0.8s ease-in, opacity 0.8s ease-in";
    clone.classList.add("deskbuddy-sucked");
    document.documentElement.appendChild(clone);
    const dx = (pr.left - 16) - er.left;
    const dy = (pr.top - 36) - er.top;
    void clone.offsetWidth;
    clone.style.left = (er.left + dx) + "px";
    clone.style.top = (er.top + dy) + "px";
    clone.style.transform = "scale(0.05) rotate(360deg)";
    clone.style.opacity = "0";
    setTimeout(() => {
      if (clone.isConnected) clone.remove();
      vanishPortal(portal);
      if (done) done();
    }, 900);
  }

  function portalBanStickman(sm) {
    let el = null;
    if (sm.id === "yellow" && state.active && wrap) {
      el = wrap;
    } else if (gangMembers[sm.id]) {
      el = gangMembers[sm.id].wrap;
    }
    if (el && el.isConnected) {
      const rect = el.getBoundingClientRect();
      const px = Math.min(window.innerWidth - 60, Math.max(60, rect.right + 100));
      const py = Math.max(60, Math.min(window.innerHeight - 60, rect.top + 30));
      const portal = spawnPortal(px, py);
      suckIntoPortal(el, portal, () => {
        if (sm.id === "yellow") {
          if (state.active) deactivate();
        } else {
          removeGangMember(sm.id);
        }
        chrome.runtime.sendMessage({ type: "BAN_STICKMAN", color: sm.id }).catch(() => {});
        setTimeout(() => updatePanel(), 700);
      });
    } else {
      chrome.runtime.sendMessage({ type: "BAN_STICKMAN", color: sm.id }).catch(() => {});
      setTimeout(() => updatePanel(), 400);
    }
  }

  // =====================================================================
  // Control Panel
  // =====================================================================

  function setupPanel() {
    if (panelToggle) return;
    panelToggle = document.createElement("div");
    panelToggle.id = "deskbuddy-panel-toggle";
    panelToggle.textContent = "●";
    panelToggle.title = "Stickman Control";
    document.documentElement.appendChild(panelToggle);
    panelEl = document.createElement("div");
    panelEl.id = "deskbuddy-panel";
    panelEl.innerHTML = '<div class="deskbuddy-panel-title">🎨 Stickmen</div>';
    document.documentElement.appendChild(panelEl);
    
    // Add home button
    const homeBtn = document.createElement("button");
    homeBtn.className = "deskbuddy-panel-summon";
    homeBtn.textContent = "🏠 Home";
    homeBtn.addEventListener("click", () => {
      openHomePage();
    });
    panelEl.appendChild(homeBtn);
    
    // Add draw enemy button
    const drawBtn = document.createElement("button");
    drawBtn.className = "deskbuddy-panel-summon";
    drawBtn.id = "deskbuddy-draw-btn";
    drawBtn.textContent = "🎨 Draw Enemy";
    drawBtn.addEventListener("click", () => {
      drawMode = !drawMode;
      if (drawMode) {
        drawBtn.textContent = "✏️ Drawing...";
        drawBtn.style.background = "rgba(255,107,107,0.4)";
        showBubble("draw mode on! draw enemies on the page", 2000);
        initDrawMode();
      } else {
        drawBtn.textContent = "🎨 Draw Enemy";
        drawBtn.style.background = "";
        showBubble("draw mode off", 1500);
        if (drawOverlay) {
          drawOverlay.remove();
          drawOverlay = null;
        }
      }
    });
    panelEl.appendChild(drawBtn);

    // AI Brain section
    const aiBox = document.createElement("div");
    aiBox.className = "deskbuddy-panel-ai";
    aiBox.innerHTML = `
      <div class="deskbuddy-panel-ai-head">
        <span>🧠 AI Brain</span>
        <button class="deskbuddy-ai-toggle" id="deskbuddy-ai-toggle">off</button>
      </div>
      <select id="deskbuddy-ai-provider">
        <option value="builtin">Built-in AI (free)</option>
        <option value="pollinations">Pollinations (free)</option>
        <option value="custom">Custom API</option>
      </select>
      <div class="deskbuddy-ai-builtin" id="deskbuddy-ai-builtin"></div>
      <input id="deskbuddy-ai-url" type="text" placeholder="API URL (e.g. https://api.openai.com/v1)" />
      <input id="deskbuddy-ai-key" type="password" placeholder="API key" />
      <input id="deskbuddy-ai-model" type="text" placeholder="Model (e.g. gpt-4o-mini)" />
      <div class="deskbuddy-ai-actions">
        <button id="deskbuddy-ai-save">save</button>
        <button id="deskbuddy-ai-test">test</button>
      </div>
      <div class="deskbuddy-ai-status" id="deskbuddy-ai-status">AI is off. Try Built-in AI or Pollinations — both free!</div>
    `;
    panelEl.appendChild(aiBox);
    initAiPanel();

    panelToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      panelEl.classList.toggle("open");
      updatePanel();
      syncAiPanelInputs();
    });
    document.addEventListener("click", (e) => {
      if (panelEl && !panelEl.contains(e.target) && e.target !== panelToggle) {
        panelEl.classList.remove("open");
      }
    });
    requestStickmenData();
  }

  function requestStickmenData() {
    chrome.runtime.sendMessage({ type: "GET_STICKMEN" }, (res) => {
      if (res && res.stickmen) renderPanel(res.stickmen);
    });
  }

  function updatePanel() {
    if (!panelEl) return;
    chrome.runtime.sendMessage({ type: "GET_STICKMEN" }, (res) => {
      if (res && res.stickmen) renderPanel(res.stickmen);
    });
  }

  function renderPanel(stickmen) {
    if (!panelEl) return;
    
    // Only clear the stickmen rows, not the entire panel
    const existingRows = panelEl.querySelectorAll(".deskbuddy-panel-row, .deskbuddy-panel-summon");
    existingRows.forEach(row => row.remove());
    
    // Check if action buttons exist, if not create them
    let homeBtn = document.getElementById("deskbuddy-home-btn");
    
    if (!homeBtn) {
      homeBtn = document.createElement("button");
      homeBtn.className = "deskbuddy-panel-summon";
      homeBtn.textContent = "🏠 Home";
      homeBtn.id = "deskbuddy-home-btn";
      homeBtn.addEventListener("click", () => {
        openHomePage();
      });
    }
    
    // Insert button after title
    const title = panelEl.querySelector(".deskbuddy-panel-title");
    if (title && title.nextSibling !== homeBtn) {
      title.parentNode.insertBefore(homeBtn, title.nextSibling);
    }
    
    let anyBanned = false;
    for (const sm of stickmen) {
      const row = document.createElement("div");
      row.className = "deskbuddy-panel-row";
      const dot = document.createElement("div");
      dot.className = "deskbuddy-panel-dot";
      dot.style.background = sm.fill;
      const nameSpan = document.createElement("span");
      nameSpan.className = "deskbuddy-panel-name";
      nameSpan.textContent = sm.name;
      const status = document.createElement("span");
      status.className = "deskbuddy-panel-status";
      const btn = document.createElement("button");
      btn.className = "deskbuddy-panel-btn";
      if (!sm.alive) {
        status.textContent = "💀 dead";
        btn.className += " dead";
        btn.textContent = "respawn";
        btn.addEventListener("click", () => {
          chrome.runtime.sendMessage({ type: "BRING_TO_TAB", color: sm.id }).catch(() => {});
          btn.textContent = "...";
          btn.disabled = true;
        });
      } else if (sm.banned) {
        anyBanned = true;
        status.textContent = "🚫 banned";
        btn.textContent = "unban";
        btn.addEventListener("click", () => {
          chrome.runtime.sendMessage({ type: "UNBAN_ALL" }).catch(() => {});
          setTimeout(() => updatePanel(), 300);
        });
      } else {
        status.textContent = sm.onThisTab ? "✓ here" : ("tab " + (sm.currentTab || "?"));
        btn.textContent = sm.onThisTab ? "🚫" : "bring";
        if (sm.onThisTab) {
          btn.title = "Ban from this tab (portal)";
          btn.addEventListener("click", () => {
            btn.textContent = "🌀";
            btn.disabled = true;
            portalBanStickman(sm);
          });
        } else {
          btn.addEventListener("click", () => {
            chrome.runtime.sendMessage({ type: "BRING_TO_TAB", color: sm.id }).catch(() => {});
            btn.textContent = "...";
            btn.disabled = true;
            setTimeout(() => updatePanel(), 1000);
          });
        }
      }
      row.appendChild(dot);
      row.appendChild(nameSpan);
      row.appendChild(status);
      row.appendChild(btn);
      panelEl.appendChild(row);
    }
    if (anyBanned) {
      const unbanBtn = document.createElement("button");
      unbanBtn.className = "deskbuddy-panel-summon";
      unbanBtn.textContent = "unban all";
      unbanBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: "UNBAN_ALL" }).catch(() => {});
        unbanBtn.textContent = "...";
        setTimeout(() => updatePanel(), 300);
      });
      panelEl.appendChild(unbanBtn);
    }
    const summonBtn = document.createElement("button");
    summonBtn.className = "deskbuddy-panel-summon";
    summonBtn.textContent = "bring all alive here";
    summonBtn.addEventListener("click", () => {
      for (const sm of stickmen) {
        if (sm.alive && !sm.onThisTab && !sm.banned) {
          chrome.runtime.sendMessage({ type: "BRING_TO_TAB", color: sm.id }).catch(() => {});
        }
      }
      summonBtn.textContent = "...";
      setTimeout(() => updatePanel(), 1200);
    });
    panelEl.appendChild(summonBtn);
    
    // Add quick enemy creation button
    const addEnemyBtn = document.createElement("button");
    addEnemyBtn.className = "deskbuddy-panel-summon";
    addEnemyBtn.textContent = "➕ Add Ninja Enemy";
    addEnemyBtn.style.background = "rgba(255, 107, 107, 0.3)";
    addEnemyBtn.addEventListener("click", () => {
      createDefaultEnemy();
      updatePanel();
    });
    panelEl.appendChild(addEnemyBtn);
    
    if (enemies.length > 0) {
      
      for (const enemy of enemies) {
        const enemyRow = document.createElement("div");
        enemyRow.className = "deskbuddy-panel-row";
        
        const enemyDot = document.createElement("div");
        enemyDot.className = "deskbuddy-panel-dot";
        enemyDot.style.background = "#cc0000";
        
        const enemyName = document.createElement("span");
        enemyName.className = "deskbuddy-panel-name";
        enemyName.textContent = "🥷 Ninja";
        
        const enemyHealth = document.createElement("span");
        enemyHealth.className = "deskbuddy-panel-status";
        enemyHealth.textContent = `HP: ${Math.round(enemy.health)}%`;
        enemyHealth.style.color = enemy.health > 50 ? "#4ade80" : enemy.health > 25 ? "#fbbf24" : "#ef4444";
        
        const enemyStatus = document.createElement("span");
        enemyStatus.className = "deskbuddy-panel-status";
        enemyStatus.textContent = "attacking";
        enemyStatus.style.color = "#ff6b6b";
        
        const enemyBtn = document.createElement("button");
        enemyBtn.className = "deskbuddy-panel-btn";
        enemyBtn.textContent = "remove";
        enemyBtn.style.background = "rgba(239, 68, 68, 0.3)";
        enemyBtn.addEventListener("click", () => {
          destroyEnemy(enemy);
          updatePanel();
        });
        
        enemyRow.appendChild(enemyDot);
        enemyRow.appendChild(enemyName);
        enemyRow.appendChild(enemyHealth);
        enemyRow.appendChild(enemyStatus);
        enemyRow.appendChild(enemyBtn);
        panelEl.appendChild(enemyRow);
      }
      
      const removeAllEnemiesBtn = document.createElement("button");
      removeAllEnemiesBtn.className = "deskbuddy-panel-summon";
      removeAllEnemiesBtn.textContent = "remove all enemies";
      removeAllEnemiesBtn.style.background = "rgba(239, 68, 68, 0.3)";
      removeAllEnemiesBtn.addEventListener("click", () => {
        while (enemies.length > 0) {
          destroyEnemy(enemies[0]);
        }
        updatePanel();
      });
      panelEl.appendChild(removeAllEnemiesBtn);
    }
  }

  // =====================================================================
  // Cross-tab / background message handlers
  // =====================================================================

  function handleGangMessages(msg) {
    if (msg.type === "STICKMAN_ARRIVE" && msg.stickman) {
      const s = msg.stickman;
      if (s.id === "yellow") {
        activate();
      } else if (GANG_COLORS[s.id]) {
        if (!panelEl) setupPanel();
        const m = createGangMember(s.id);
        if (m) {
          m.x = s.x || (40 + Math.random() * (window.innerWidth - 160));
          m.wrap.style.left = m.x + "px";
          scheduleGangTick(s.id, 500);
          updatePanel();
        }
      }
    }
    if (msg.type === "STICKMAN_LEAVE" && msg.color) {
      if (msg.color === "yellow") {
        state.active = false;
        clearTimeout(state.actionTimer);
        clearTimeout(rampageTimer);
        clearTimeout(smashInterval);
        clearInterval(writeSomething._iv);
        despawnPet();
        if (stage) stage.style.display = "none";
        if (cmdbtn) cmdbtn.style.display = "none";
        if (consoleEl) { consoleEl.classList.remove("open"); state.consoleOpen = false; }
        updatePanel();
      } else {
        removeGangMember(msg.color);
        updatePanel();
      }
    }
    if (msg.type === "STICKMAN_HIT" && msg.color) {
      const om = gangMembers[msg.color];
      if (om) {
        om.health = Math.max(0, om.health - (msg.damage || 10));
        updateGangHP(om);
        om.wrap.classList.add("hit");
        setTimeout(() => { if (om.wrap.isConnected) om.wrap.classList.remove("hit"); }, 400);
        if (om.health <= 0) gangDie(om);
      }
    }
    if (msg.type === "STICKMAN_DIED" && msg.color) {
      const om = gangMembers[msg.color];
      if (om) gangDie(om);
      updatePanel();
    }
  }

  // Modify activate to also set up panel and existing gang members
  const _origActivate = activate;
  activate = function() {
    if (state.active) return;
    state.active = true;
    if (!root) buildUI();
    stage.style.display = "";
    cmdbtn.style.display = "flex";
    showEnterToast();
    showBubble("hey!", 1400);
    // Set up control panel
    setupPanel();
    // Start needs decay
    startNeedsDecay();
    updateNeedsUI();
    // Check for gang members already on this tab
    chrome.runtime.sendMessage({ type: "WHO_AM_I" }, (res) => {
      if (res && res.stickmen) {
        for (const color of res.stickmen) {
          if (color !== "yellow" && GANG_COLORS[color] && !gangMembers[color]) {
            const m = createGangMember(color);
            if (m) scheduleGangTick(color, 1000 + Math.random() * 1500);
          }
        }
        updatePanel();
      }
    });
    tick();
  };

  const _origDeactivate = deactivate;
  deactivate = function() {
    state.active = false;
    clearTimeout(state.actionTimer);
    clearTimeout(rampageTimer);
    clearTimeout(smashInterval);
    clearInterval(writeSomething._iv);
    despawnPet();
    if (stage) stage.style.display = "none";
    if (cmdbtn) cmdbtn.style.display = "none";
    if (consoleEl) {
      consoleEl.classList.remove("open");
      state.consoleOpen = false;
    }
  };
  // ---------------------------------------------------------------------
  // Home Page
  // ---------------------------------------------------------------------
  
  function openHomePage() {
    const homeUrl = chrome.runtime.getURL('home.html');
    chrome.tabs.create({ url: homeUrl });
  }
  
  function isReddishColor(color) {
    if (!color) return false;
    const temp = document.createElement("div");
    temp.style.color = color;
    document.body.appendChild(temp);
    const computed = getComputedStyle(temp).color;
    document.body.removeChild(temp);
    const match = computed.match(/\d+/g);
    if (!match || match.length < 3) return false;
    const r = parseInt(match[0]);
    const g = parseInt(match[1]);
    const b = parseInt(match[2]);
    return r > g && r > b && r > 100;
  }
  
  function findReddishButtons() {
    const buttons = document.querySelectorAll("button, a, input[type='button'], input[type='submit'], [role='button']");
    const reddishButtons = [];
    for (const btn of buttons) {
      const computed = getComputedStyle(btn);
      const bgColor = computed.backgroundColor;
      const textColor = computed.color;
      if (isReddishColor(bgColor) || isReddishColor(textColor)) {
        const rect = btn.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          reddishButtons.push({ el: btn, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        }
      }
    }
    return reddishButtons;
  }
  
  function startEnemyAttacks(enemy) {
    if (enemy.attackTimer) clearInterval(enemy.attackTimer);
    
    enemy.attackTimer = setInterval(() => {
      if (!enemy.el.isConnected) {
        clearInterval(enemy.attackTimer);
        return;
      }
      
      // Update enemy health bar
      if (enemyHealthEls[enemy.id]) {
        enemyHealthEls[enemy.id].style.width = (enemy.health / enemy.maxHealth * 100) + "%";
      }
      
      // Find stickmen targets
      const targets = [];
      if (state.active && stage) {
        const stageRect = stage.getBoundingClientRect();
        targets.push({ x: stageRect.left + stageRect.width / 2, y: stageRect.top + stageRect.height / 2, type: "yellow", el: stage });
      }
      
      for (const color of Object.keys(gangMembers)) {
        const m = gangMembers[color];
        if (m && m.alive) {
          const rect = m.wrap.getBoundingClientRect();
          targets.push({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, type: color, el: m.wrap });
        }
      }
      
      // Find reddish buttons
      const reddishButtons = findReddishButtons();
      
      // Prioritize stickmen if available
      if (targets.length > 0) {
        // Find nearest stickman
        let nearest = targets[0];
        let nearestDist = Math.hypot(targets[0].x - enemy.x, targets[0].y - enemy.y);
        for (let i = 1; i < targets.length; i++) {
          const dist = Math.hypot(targets[i].x - enemy.x, targets[i].y - enemy.y);
          if (dist < nearestDist) {
            nearest = targets[i];
            nearestDist = dist;
          }
        }
        
        // Attack stickman if close enough, move towards if far
        if (nearestDist < 200) {
          enemyAttack(nearest, enemy);
        } else if (nearestDist < 500) {
          const dx = nearest.x - enemy.x;
          const dy = nearest.y - enemy.y;
          const moveSpeed = 30;
          enemy.x += (dx / nearestDist) * moveSpeed;
          enemy.y += (dy / nearestDist) * moveSpeed;
          enemy.el.style.left = (enemy.x - enemy.width / 2) + "px";
          enemy.el.style.top = (enemy.y - enemy.height / 2) + "px";
        }
      } else if (reddishButtons.length > 0) {
        // If no stickmen, target reddish buttons
        let nearest = reddishButtons[0];
        let nearestDist = Math.hypot(reddishButtons[0].x - enemy.x, reddishButtons[0].y - enemy.y);
        for (let i = 1; i < reddishButtons.length; i++) {
          const dist = Math.hypot(reddishButtons[i].x - enemy.x, reddishButtons[i].y - enemy.y);
          if (dist < nearestDist) {
            nearest = reddishButtons[i];
            nearestDist = dist;
          }
        }
        
        // Click button if close enough, move towards if far
        if (nearestDist < 200) {
          enemyClickButton(nearest.el, enemy);
        } else if (nearestDist < 800) {
          const dx = nearest.x - enemy.x;
          const dy = nearest.y - enemy.y;
          const moveSpeed = 50;
          enemy.x += (dx / nearestDist) * moveSpeed;
          enemy.y += (dy / nearestDist) * moveSpeed;
          enemy.el.style.left = (enemy.x - enemy.width / 2) + "px";
          enemy.el.style.top = (enemy.y - enemy.height / 2) + "px";
        }
      }
    }, 800);
  }
  
  function enemyClickButton(button, enemy) {
    // Visual feedback
    const rect = button.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    
    // Spawn click particles
    const click = document.createElement("div");
    click.textContent = "👆";
    click.style.cssText = `position:fixed;left:${enemy.x}px;top:${enemy.y}px;font-size:24px;z-index:2147483012;pointer-events:none;transition:all 0.3s ease;`;
    document.documentElement.appendChild(click);
    
    requestAnimationFrame(() => {
      click.style.left = cx + "px";
      click.style.top = cy + "px";
      click.style.transform = "scale(1.5)";
      click.style.opacity = "0";
    });
    
    setTimeout(() => {
      if (click.isConnected) click.remove();
    }, 300);
    
    // Click the button
    button.click();
    
    // Change text to "switched" randomized
    const originalText = button.textContent || button.innerText || button.value || "";
    if (originalText && originalText !== "switched") {
      const switchedVariants = ["switched", "SWITCHED", "SwItChEd", "sWiTcHeD", "🔄 switched", "switched 🔄"];
      const randomVariant = switchedVariants[Math.floor(Math.random() * switchedVariants.length)];
      
      if (button.tagName === "INPUT") {
        button.value = randomVariant;
      } else {
        button.textContent = randomVariant;
      }
      
      // Visual flash effect
      button.style.transition = "all 0.2s ease";
      button.style.transform = "scale(1.1)";
      button.style.filter = "brightness(1.5)";
      
      setTimeout(() => {
        button.style.transform = "";
        button.style.filter = "";
      }, 200);
    }
  }
  
  function enemyAttack(target, enemy) {
    // Visual feedback
    const targetRect = target.el.getBoundingClientRect();
    const cx = targetRect.left + targetRect.width / 2;
    const cy = targetRect.top + targetRect.height / 2;
    
    // Spawn attack particles
    const attack = document.createElement("div");
    attack.textContent = "⚔️";
    attack.style.cssText = `position:fixed;left:${enemy.x}px;top:${enemy.y}px;font-size:24px;z-index:2147483012;pointer-events:none;transition:all 0.5s ease;`;
    document.documentElement.appendChild(attack);
    
    requestAnimationFrame(() => {
      attack.style.left = cx + "px";
      attack.style.top = cy + "px";
      attack.style.transform = "scale(1.5)";
      attack.style.opacity = "0";
    });
    
    setTimeout(() => {
      if (attack.isConnected) attack.remove();
    }, 500);
    
    // Damage target
    if (target.type === "yellow") {
      state.needs.happiness = Math.max(0, state.needs.happiness - 15);
      state.needs.energy = Math.max(0, state.needs.energy - 10);
      applyMood("angry");
      showBubble("under attack! 😠", 1500);
      updateNeedsUI();
      
      // Yellow stickman fights back
      if (state.active && !state.sleeping) {
        setTimeout(() => {
          if (state.active && !state.sleeping) {
            showBubble("fight back! ⚔️", 1200);
            setPose("attacking");
            setTimeout(() => { if (state.active) setPose("idle"); }, 800);
            
            // Damage enemy
            enemy.health -= 8;
            if (enemy.health <= 0) {
              destroyEnemy(enemy);
              updatePanel();
            }
          }
        }, 500);
      }
    } else {
      const m = gangMembers[target.type];
      if (m && m.alive) {
        m.health = Math.max(0, m.health - 20);
        updateGangHP(m);
        gangMood(m, "angry");
        gangBubble(m, "under attack! 😠", 1500);
        
        // Check if stickman died
        if (m.health <= 0) {
          gangDie(m);
          updatePanel();
        }
        
        // Stickman fights back
        if (m.health > 0) {
          setTimeout(() => {
            if (m.alive) {
              gangBubble(m, "fight back! ⚔️", 1200);
              gangPose(m, "attacking");
              setTimeout(() => { if (m.alive) gangPose(m, "idle"); }, 800);
              
              // Damage enemy
              enemy.health -= 8;
              if (enemy.health <= 0) {
                destroyEnemy(enemy);
                updatePanel();
              }
            }
          }, 500);
        }
      }
    }
  }
  
  function destroyEnemy(enemy) {
    if (enemy.el && enemy.el.isConnected) {
      // Death animation
      enemy.el.style.transition = "all 0.5s ease";
      enemy.el.style.transform = "scale(0) rotate(720deg)";
      enemy.el.style.opacity = "0";
      
      setTimeout(() => {
        if (enemy.el && enemy.el.isConnected) enemy.el.remove();
        spawnParticles("💥", 5);
      }, 500);
    }
    
    if (enemy.attackTimer) clearInterval(enemy.attackTimer);
    
    // Remove from arrays
    const idx = enemies.indexOf(enemy);
    if (idx > -1) enemies.splice(idx, 1);
    delete enemyHealthEls[enemy.id];
  }
  
  function createDefaultEnemy() {
    const enemyId = "enemy-" + Date.now();
    const enemyEl = document.createElement("div");
    enemyEl.id = enemyId;
    enemyEl.className = "deskbuddy-enemy";
    
    // Position enemy randomly on screen
    const x = 100 + Math.random() * (window.innerWidth - 300);
    const y = 100 + Math.random() * (window.innerHeight - 300);
    
    enemyEl.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:60px;height:90px;z-index:2147483011;pointer-events:none;`;
    
    // Create ninja stickman SVG
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 64 96");
    svg.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;";
    
    // Ninja stickman - dark body with red headband
    svg.innerHTML = `
      <g class="enemy-body-group">
        <circle cx="32" cy="16" r="10" fill="#1a1a1a" stroke="#cc0000" stroke-width="2.5"/>
        <path d="M22 12 Q32 8 42 12" stroke="#cc0000" stroke-width="2" fill="none"/>
        <line x1="32" y1="26" x2="32" y2="60" stroke="#1a1a1a" stroke-width="2.5"/>
        <g class="enemy-arms">
          <line x1="32" y1="36" x2="14" y2="48" stroke="#1a1a1a" stroke-width="2.5"/>
          <line x1="32" y1="36" x2="50" y2="48" stroke="#1a1a1a" stroke-width="2.5"/>
        </g>
        <g class="enemy-legs">
          <line x1="32" y1="60" x2="18" y2="90" stroke="#1a1a1a" stroke-width="2.5"/>
          <line x1="32" y1="60" x2="46" y2="90" stroke="#1a1a1a" stroke-width="2.5"/>
        </g>
      </g>
    `;
    
    enemyEl.appendChild(svg);
    
    // Health bar
    const healthBar = document.createElement("div");
    healthBar.className = "deskbuddy-enemy-hp";
    healthBar.style.cssText = `position:absolute;bottom:-8px;left:0;width:100%;height:6px;background:rgba(0,0,0,0.5);border-radius:3px;overflow:hidden;`;
    const healthFill = document.createElement("div");
    healthFill.className = "deskbuddy-enemy-hp-fill";
    healthFill.style.cssText = "width:100%;height:100%;background:#ff4444;transition:width 0.3s ease;";
    healthBar.appendChild(healthFill);
    enemyEl.appendChild(healthBar);
    
    document.documentElement.appendChild(enemyEl);
    
    const enemy = {
      id: enemyId,
      el: enemyEl,
      health: 100,
      maxHealth: 100,
      x: x + 30,
      y: y + 45,
      width: 60,
      height: 90,
      attackTimer: null
    };
    
    enemies.push(enemy);
    enemyHealthEls[enemyId] = healthFill;
    
    // Start attacking
    startEnemyAttacks(enemy);
    
    showBubble("ninja enemy spawned! 🥷", 1500);
    spawnParticles("🥷", 3);
  }
  
  function onStickmanClick(e) {
    e.stopPropagation();
    if (state.dragging) return;
    
    // Check if right-click (context menu)
    if (e.button === 2) {
      openContextMenu(state);
      return;
    }
    
    // Regular click creates sticky note
    createNote();
  }

  function createNote() {
    const rect = stage.getBoundingClientRect();
    const note = document.createElement("div");
    note.className = "deskbuddy-note";
    note.style.left = Math.min(window.innerWidth - 180, rect.left + 60) + "px";
    note.style.top = Math.max(10, rect.top - 40) + "px";
    note.innerHTML = `
      <span class="deskbuddy-note-close" title="Remove">✕</span>
      <textarea class="deskbuddy-note-content" placeholder="write something..."></textarea>`;
    document.documentElement.appendChild(note);
    state.notes.push(note);

    note.querySelector(".deskbuddy-note-close").addEventListener("click", () => {
      note.remove();
      state.notes = state.notes.filter((n) => n !== note);
    });

    makeDraggable(note);
    note.querySelector("textarea").focus();
    showBubble("here you go!", 1400);
  }

  function makeDraggable(note) {
    let dragging = false, offX = 0, offY = 0;
    note.addEventListener("mousedown", (e) => {
      if (e.target.tagName === "TEXTAREA" || e.target.classList.contains("deskbuddy-note-close")) return;
      dragging = true;
      note.classList.add("dragging");
      offX = e.clientX - note.offsetLeft;
      offY = e.clientY - note.offsetTop;
    });
    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      note.style.left = e.clientX - offX + "px";
      note.style.top = e.clientY - offY + "px";
    });
    document.addEventListener("mouseup", () => {
      dragging = false;
      note.classList.remove("dragging");
    });
  }

  function clearNotes() {
    state.notes.forEach((n) => n.remove());
    state.notes = [];
  }

  // ---------------------------------------------------------------------
  // Command console
  // ---------------------------------------------------------------------
  const HELP_TEXT = [
    "help                  — show this list",
    "note                  — pop out a new sticky note",
    "write                 — show a code snippet",
    "doodle                — scribble on page elements",
    "sit                   — sit down",
    "walk                  — get up and wander",
    "dance                 — bust a move 💃",
    "wave                  — wave hello 👋",
    "meditate              — find inner peace 🧘",
    "party                 — throw a celebration 🎉",
    "selfie                — take a selfie 📸",
    "pet                   — summon a pet companion 🐕",
    "tomato                — throw a rotten tomato 🍅",
    "shatter               — glass shatter an element 💎",
    "spray                 — spray-paint a graffiti tag 🎨",
    "sparkle               — make sparkles appear ✨",
    "cook                  — cook a meal 🍳",
    "climb                 — climb a tall element 🧗",
    "mood <name>           — happy | angry | sad | neutral | emotional | surprised",
    "speed <name>          — slow | normal | fast",
    "jump                  — move to a different open tab now",
    "hide                  — hide the stickman",
    "show                  — show the stickman again",
    "clear                 — remove all sticky notes",
    "setup <type>          — workout | chair | code | basketball | smash",
    "teardown              — remove current setup",
    "sleep                 — put the buddy to sleep",
    "wake                  — wake the buddy up",
    "needs                 — check current needs status",
    "feed [name]           — feed stickman (hunger +30). Optional: yellow/red/blue/green",
    "play [name]           — play with stickman (happiness +25, social +20)",
    "comfort [name]        — comfort stickman (happiness +20, social +15)",
    "rest [name]           — let stickman rest (energy +35)",
    "swim                  — go swimming (fun +20, energy -10)",
    "fish                  — go fishing (fun +15, chance for food)",
    "garden                — do some gardening (fun +18, energy -15)",
    "read                  — read a book (fun +25, happiness +15)",
    "game                  — play video games (fun +30, happiness +20, energy -20)",
    "highfive <name>       — high-five another stickman (social +25)",
    "compete <name>        — compete with another stickman (winner gets bonus)",
    "chat <name>           — chat with another stickman (social +30, happiness +20)",
    "weather <type>        — set weather: sunny | rainy | snowy | cloudy",
    "rps                   — play rock-paper-scissors",
    "guess                 — play guess the number (1-100)",
    "equip <item>          — equip accessory: hat, crown, glasses, sunglasses, bow, flower, headphones, scarf, cape",
    "remove                — remove current accessory",
    "accessories           — list available accessories",
    "achievements          — view achievements",
    "tasks [name]          — view tasks for stickman (defaults to yellow)",
    "cleartasks [name]     — clear all tasks for stickman (defaults to yellow)",
    "ai                    — show AI brain status",
    "ai on / ai off        — turn the AI brain on or off",
    "ai provider <name>    — builtin (free) | pollinations (free) | custom",
    "ai config <url> <key> <model> — connect a custom OpenAI-compatible model",
    "ai test               — test the AI connection",
  ];

  function toggleConsole() {
    state.consoleOpen = !state.consoleOpen;
    consoleEl.classList.toggle("open", state.consoleOpen);
    if (state.consoleOpen) consoleInput.focus();
  }

  function logLine(text) {
    const d = document.createElement("div");
    d.textContent = text;
    consoleLog.appendChild(d);
    consoleLog.scrollTop = consoleLog.scrollHeight;
  }

  function runCommand(raw) {
    logLine("> " + raw);
    
    // Check if user is playing a game
    if (currentGame) {
      if (currentGame === "rps") {
        handleGameChoice(raw);
        return;
      } else if (currentGame === "guess") {
        handleNumberGuess(raw);
        return;
      }
    }
    
    const [cmd, ...rest] = raw.toLowerCase().split(/\s+/);
    const arg = rest.join(" ");
    switch (cmd) {
      case "help":
        HELP_TEXT.forEach(logLine);
        break;
      case "note":
        createNote();
        logLine("new sticky note added.");
        break;
      case "write":
        writeSomething();
        logLine("writing something...");
        break;
      case "doodle":
        doodleElements();
        logLine("doodling on elements...");
        break;
      case "sit":
        sitDown();
        logLine("sat down.");
        break;
      case "dance":
        dance();
        logLine("dancing!");
        break;
      case "wave":
        wave();
        logLine("waving!");
        break;
      case "meditate":
        meditate();
        logLine("meditating... om...");
        break;
      case "party":
      case "celebrate":
        celebrate();
        logLine("party time!");
        break;
      case "selfie":
        takeSelfie();
        logLine("say cheese!");
        break;
      case "pet":
        spawnPet();
        logLine("spawning a friend!");
        break;
      case "tomato":
        throwTomato();
        logLine("throwing a tomato!");
        break;
      case "shatter":
        shatterElement();
        logLine("shattering!");
        break;
      case "spray":
        sprayTag();
        logLine("spraying graffiti!");
        break;
      case "sparkle":
        sparkle();
        logLine("sparkling!");
        break;
      case "climb":
        climbElement();
        logLine("climbing!");
        break;
      case "cook":
        cook();
        logLine("cooking!");
        break;
      case "walk":
      case "stand":
        walkTo();
        logLine("wandering off.");
        break;
      case "mood":
        if (MOODS[arg]) {
          applyMood(arg);
          logLine("mood set to " + arg + ".");
        } else {
          logLine("unknown mood. try: " + Object.keys(MOODS).join(", "));
        }
        break;
      case "speed":
        if (SPEED_MULT[arg]) {
          state.speed = arg;
          logLine("speed set to " + arg + ".");
        } else {
          logLine("unknown speed. try: slow, normal, fast");
        }
        break;
      case "jump":
        chrome.runtime.sendMessage({ type: "REQUEST_JUMP" }).catch(() => {});
        logLine("looking for a new tab...");
        break;
      case "hide":
        stage.style.display = "none";
        cmdbtn.style.display = "none";
        logLine("hiding. type \"show\" to bring me back.");
        break;
      case "show":
        stage.style.display = "";
        cmdbtn.style.display = "flex";
        logLine("back!");
        break;
      case "clear":
        clearNotes();
        logLine("sticky notes cleared.");
        break;
      case "setup":
        if (["workout", "chair", "code", "basketball", "smash"].includes(arg)) {
          if (arg === "workout") setupWorkout();
          else if (arg === "chair") setupChair();
          else if (arg === "code") setupCode();
          else if (arg === "basketball") setupBasketball();
          else if (arg === "smash") setupSmash();
          logLine("setup: " + arg);
        } else {
          logLine("unknown setup. try: workout, chair, code, basketball, smash");
        }
        break;
      case "teardown":
        teardownSetup();
        logLine("setup removed.");
        break;
      case "sleep":
        sleep();
        logLine("goodnight!");
        break;
      case "wake":
        wake();
        logLine("woke up!");
        break;
      case "needs":
        showNeedsStatus();
        break;
      case "feed":
        const feedTarget = getStickmanByName(arg) || state;
        fulfillNeed("hunger", 30, feedTarget);
        logLine(`fed ${feedTarget === state ? "yellow" : feedTarget.name}!`);
        break;
      case "play":
        const playTarget = getStickmanByName(arg) || state;
        fulfillNeed("happiness", 25, playTarget);
        fulfillNeed("social", 20, playTarget);
        logLine(`played with ${playTarget === state ? "yellow" : playTarget.name}!`);
        spawnParticles("🎵", 5);
        break;
      case "comfort":
        const comfortTarget = getStickmanByName(arg) || state;
        fulfillNeed("happiness", 20, comfortTarget);
        fulfillNeed("social", 15, comfortTarget);
        logLine(`comforted ${comfortTarget === state ? "yellow" : comfortTarget.name}!`);
        spawnParticles("♥", 4);
        break;
      case "rest":
        const restTarget = getStickmanByName(arg) || state;
        fulfillNeed("energy", 35, restTarget);
        logLine(`${restTarget === state ? "yellow" : restTarget.name} rested!`);
        break;
      case "swim":
        swim();
        logLine("going for a swim!");
        break;
      case "fish":
        fish();
        logLine("fishing time!");
        break;
      case "garden":
        garden();
        logLine("gardening!");
        break;
      case "read":
        read();
        logLine("reading a book!");
        break;
      case "game":
        game();
        logLine("gaming time!");
        break;
      case "highfive":
        highFive(arg);
        break;
      case "compete":
        compete(arg);
        break;
      case "chat":
        chat(arg);
        break;
      case "weather":
        setWeather(arg);
        break;
      case "rps":
        playRockPaperScissors();
        break;
      case "guess":
        playGuessNumber();
        break;
      case "equip":
        equipAccessory(arg);
        break;
      case "remove":
        removeAccessory();
        break;
      case "accessories":
        listAccessories();
        break;
      case "achievements":
        listAchievements();
        break;
      case "tasks":
        viewTasks(arg);
        break;
      case "cleartasks":
        clearTasks(arg);
        break;
      case "ai":
        if (rest.length === 0) {
          logLine(aiConfig.enabled ? "AI brain: ON 🧠" : "AI brain: OFF");
          logLine("provider: " + (aiConfig.provider || "builtin") + " (free options: builtin, pollinations)");
          if ((aiConfig.provider || "builtin") === "custom") {
            logLine(aiConfig.apiUrl ? "API: " + aiConfig.apiUrl + " | model: " + (aiConfig.model || "?") : "No API configured. Try: ai config <url> <key> <model>");
          } else {
            logLine("free provider — no API key needed!");
          }
        } else if (rest[0] === "on" || rest[0] === "off") {
          aiConfig.enabled = rest[0] === "on";
          aiSaveConfig();
          syncAiPanelInputs();
          logLine("AI brain turned " + (aiConfig.enabled ? "on 🧠" : "off"));
        } else if (rest[0] === "provider") {
          if (["builtin", "pollinations", "custom"].includes(rest[1])) {
            aiConfig.provider = rest[1];
            aiSaveConfig();
            syncAiPanelInputs();
            logLine("AI provider set to " + rest[1] + (rest[1] !== "custom" ? " (free)" : ""));
          } else {
            logLine("provider must be one of: builtin | pollinations | custom");
          }
        } else if (rest[0] === "config") {
          const parts = arg.split(/\s+/);
          if (parts.length >= 2) {
            aiConfig.apiUrl = parts[1] || "";
            aiConfig.apiKey = parts[2] || "";
            aiConfig.model = parts[3] || "";
            aiSaveConfig();
            syncAiPanelInputs();
            logLine("AI config saved.");
          } else {
            logLine("usage: ai config <api-url> <api-key> <model>");
          }
        } else if (rest[0] === "test") {
          aiTestConnection()
            .then((t) => logLine("AI connected ✔ said: " + t))
            .catch((err) => logLine("AI failed ✖ " + err));
        } else {
          logLine("unknown ai subcommand. try: ai on / ai off / ai provider / ai config / ai test");
        }
        break;
      default:
        logLine("unknown command. type \"help\".");
    }
  }

  // ---------------------------------------------------------------------
  // Activation lifecycle
  // ---------------------------------------------------------------------
  function activate() {
    if (state.active) return;
    state.active = true;
    if (!root) buildUI();
    stage.style.display = "";
    cmdbtn.style.display = "flex";
    showEnterToast();
    showBubble("hey!", 1400);
    tick();
  }

  function deactivate() {
    state.active = false;
    clearTimeout(state.actionTimer);
    clearTimeout(rampageTimer);
    clearTimeout(smashInterval);
    clearInterval(writeSomething._iv);
    despawnPet();
    if (consoleEl) {
      consoleEl.classList.remove("open");
      state.consoleOpen = false;
    }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "ACTIVATE") activate();
    if (msg.type === "DEACTIVATE") deactivate();
    handleGangMessages(msg);
  });

  chrome.runtime.sendMessage({ type: "WHO_AM_I" }, (res) => {
    if (chrome.runtime.lastError) return;
    if (res) {
      if (res.isActive) activate();
      if (res.stickmen && res.stickmen.length > 0) {
        for (const color of res.stickmen) {
          if (color !== "yellow" && GANG_COLORS[color] && !gangMembers[color]) {
            const m = createGangMember(color);
            if (m) scheduleGangTick(color, 1000 + Math.random() * 1500);
          }
        }
      }
    }
  });

  // Always show the control panel on every tab
  aiLoadConfig();
  setupPanel();
  updatePanel();
})();

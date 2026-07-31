const ALARM_NAME = "deskbuddy-jump";
const KEEPALIVE_ALARM = "deskbuddy-keepalive";
const STORAGE_KEY = "deskbuddy_state";
const MIN_MINUTES = 0.75;
const MAX_MINUTES = 2.5;

const DEFAULT_STICKMEN = [
  { id: "yellow",  name: "Yellow", fill: "#FFD700", stroke: "#B8860B", alive: true, health: 100, currentTab: null, x: 60 },
  { id: "red",     name: "Red",    fill: "#FF6B6B", stroke: "#CC0000", alive: true, health: 100, currentTab: null, x: 120 },
  { id: "orange",  name: "Orange", fill: "#FFA94D", stroke: "#CC7000", alive: true, health: 100, currentTab: null, x: 180 },
  { id: "blue",    name: "Blue",   fill: "#74B9FF", stroke: "#2D6BB4", alive: true, health: 100, currentTab: null, x: 240 },
  { id: "green",   name: "Green",  fill: "#81EC81", stroke: "#2E8B2E", alive: true, health: 100, currentTab: null, x: 300 },
];

let STICKMEN = DEFAULT_STICKMEN.map((s) => ({ ...s }));
let started = false;

async function saveState() {
  if (!STICKMEN) return;
  const data = STICKMEN.map((s) => ({ id: s.id, alive: s.alive, health: s.health, currentTab: s.currentTab }));
  try { await chrome.storage.session.set({ [STORAGE_KEY]: data }); } catch (e) {}
}

async function loadState() {
  try {
    const res = await chrome.storage.session.get(STORAGE_KEY);
    if (res[STORAGE_KEY] && Array.isArray(res[STORAGE_KEY])) {
      const saved = res[STORAGE_KEY];
      STICKMEN = DEFAULT_STICKMEN.map((def) => {
        const s = saved.find((x) => x.id === def.id);
        return s ? { ...def, alive: s.alive, health: s.health, currentTab: s.currentTab } : { ...def };
      });
      return true;
    }
  } catch (e) {}
  return false;
}

function randomDelayMinutes() {
  return MIN_MINUTES + Math.random() * (MAX_MINUTES - MIN_MINUTES);
}

async function sendSafe(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (e) {}
}

const bans = {};

function getBans() {
  return bans;
}

function banStickman(tabId, color) {
  if (!bans[tabId]) bans[tabId] = [];
  if (!bans[tabId].includes(color)) bans[tabId].push(color);
}

function unbanAll(tabId) {
  delete bans[tabId];
}

function getAlive() {
  return STICKMEN.filter((s) => s.alive);
}

function getAliveOnTab(tabId) {
  return getAlive().filter((s) => s.currentTab === tabId);
}

function hasTab(tabId) {
  return STICKMEN.some((s) => s.currentTab === tabId);
}

async function pickRandomTab(excludeIds) {
  const tabs = await chrome.tabs.query({});
  const eligible = tabs.filter(
    (t) => !excludeIds.includes(t.id) && t.url && /^https?:\/\//.test(t.url)
  );
  if (eligible.length === 0) return null;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

async function moveStickmanTo(stickman, targetTabId) {
  if (bans[targetTabId] && bans[targetTabId].includes(stickman.id)) return;
  const prevTab = stickman.currentTab;
  if (prevTab === targetTabId) return;
  if (prevTab != null) {
    await sendSafe(prevTab, { type: "STICKMAN_LEAVE", color: stickman.id });
  }
  stickman.currentTab = targetTabId;
  await sendSafe(targetTabId, { type: "STICKMAN_ARRIVE", stickman: { id: stickman.id, name: stickman.name, fill: stickman.fill, stroke: stickman.stroke } });
  saveState();
}

async function ensureMinimumActive() {
  const alive = getAlive();
  for (const sm of alive) {
    if (sm.currentTab != null) continue;
    const occupied = alive.map((s) => s.currentTab).filter(Boolean);
    const tab = await pickRandomTab(occupied);
    if (!tab) break;
    await moveStickmanTo(sm, tab.id);
  }
}

async function scatterToRandomTabs() {
  const alive = getAlive();
  const tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  if (tabs.length === 0) return;
  for (let i = 0; i < alive.length; i++) {
    const tab = tabs[Math.floor(Math.random() * tabs.length)];
    await moveStickmanTo(alive[i], tab.id);
  }
}

async function rotateOneStickman() {
  const alive = getAlive();
  if (alive.length === 0) return;
  const sm = alive[Math.floor(Math.random() * alive.length)];
  if (sm.currentTab == null) {
    const tab = await pickRandomTab([]);
    if (tab) await moveStickmanTo(sm, tab.id);
    return;
  }
  const othersOnTab = getAliveOnTab(sm.currentTab).filter((s) => s.id !== sm.id);
  if (othersOnTab.length >= 1) {
    const exclude = [sm.currentTab];
    const tab = await pickRandomTab(exclude);
    if (tab) await moveStickmanTo(sm, tab.id);
  } else {
    if (Math.random() < 0.4) {
      const tab = await pickRandomTab([sm.currentTab]);
      if (tab) await moveStickmanTo(sm, tab.id);
    }
  }
}

function scheduleNextJump() {
  chrome.alarms.create(ALARM_NAME, { delayInMinutes: randomDelayMinutes() });
}

function startKeepalive() {
  chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.3 });
}

async function startup() {
  if (started) return;
  started = true;
  const restored = await loadState();
  if (!restored) {
    await scatterToRandomTabs();
  } else {
    await ensureMinimumActive();
  }
  scheduleNextJump();
  startKeepalive();
}

chrome.runtime.onInstalled.addListener(startup);
chrome.runtime.onStartup.addListener(startup);

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await rotateOneStickman();
    scheduleNextJump();
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading" && hasTab(tabId)) {
    for (const sm of STICKMEN) {
      if (sm.currentTab === tabId) {
        sendSafe(tabId, { type: "STICKMAN_ARRIVE", stickman: { id: sm.id, name: sm.name, fill: sm.fill, stroke: sm.stroke } });
      }
    }
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  for (const sm of STICKMEN) {
    if (sm.currentTab === tabId) {
      sm.currentTab = null;
    }
  }
  unbanAll(tabId);
  saveState();
  await ensureMinimumActive();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab ? sender.tab.id : null;

  if (msg.type === "GET_STICKMEN") {
    const b = getBans();
    const snapshot = STICKMEN.map((s) => ({
      id: s.id, name: s.name, fill: s.fill, stroke: s.stroke,
      alive: s.alive, health: s.health, currentTab: s.currentTab,
      onThisTab: s.currentTab === tabId,
      banned: tabId && b[tabId] && b[tabId].includes(s.id),
    }));
    sendResponse({ stickmen: snapshot });
    return true;
  }

  if (msg.type === "BRING_TO_TAB") {
    const color = msg.color;
    if (tabId && bans[tabId] && bans[tabId].includes(color)) {
      sendResponse({ ok: false, reason: "banned" });
      return false;
    }
    const sm = STICKMEN.find((s) => s.id === color);
    if (!sm) { sendResponse({ ok: false }); return false; }
    if (!sm.alive) {
      sm.alive = true;
      sm.health = 100;
      saveState();
    }
    if (tabId) moveStickmanTo(sm, tabId);
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === "BAN_STICKMAN") {
    if (tabId && msg.color) {
      banStickman(tabId, msg.color);
      const sm = STICKMEN.find((s) => s.id === msg.color);
      if (sm && sm.currentTab === tabId) {
        sm.currentTab = null;
        sendSafe(tabId, { type: "STICKMAN_LEAVE", color: msg.color });
        saveState();
      }
    }
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === "UNBAN_ALL") {
    if (tabId) unbanAll(tabId);
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === "STICKMAN_DAMAGE") {
    const target = STICKMEN.find((s) => s.id === msg.targetColor);
    if (target && target.alive) {
      target.health = Math.max(0, target.health - (msg.damage || 10));
      if (target.health <= 0) {
        target.alive = false;
        target.currentTab = null;
        if (tabId) sendSafe(tabId, { type: "STICKMAN_DIED", color: target.id });
      }
      saveState();
    }
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === "STICKMAN_DIED") {
    const target = STICKMEN.find((s) => s.id === msg.color);
    if (target) {
      target.alive = false;
      target.health = 0;
      target.currentTab = null;
      saveState();
    }
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === "STICKMAN_ATTACK") {
    const attacker = STICKMEN.find((s) => s.id === msg.attackerColor);
    const target = STICKMEN.find((s) => s.id === msg.targetColor);
    if (attacker && target && target.alive && target.currentTab != null) {
      const damage = 8 + Math.floor(Math.random() * 10);
      target.health = Math.max(0, target.health - damage);
      sendSafe(target.currentTab, { type: "STICKMAN_HIT", color: target.id, damage, attackerColor: attacker.id });
      if (target.health <= 0) {
        target.alive = false;
        const prevTab = target.currentTab;
        target.currentTab = null;
        sendSafe(prevTab, { type: "STICKMAN_DIED", color: target.id });
      }
      saveState();
    }
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === "STICKMAN_LEAVING") {
    const sm = STICKMEN.find((s) => s.id === msg.color);
    if (sm && sm.currentTab === tabId) {
      sm.currentTab = null;
      saveState();
      setTimeout(async () => {
        if (!sm.alive) return;
        const tab = await pickRandomTab([tabId]);
        if (tab) moveStickmanTo(sm, tab.id);
      }, 2000);
    }
    return false;
  }

  if (msg.type === "WHO_AM_I") {
    const onThisTab = getAlive().filter((s) => s.currentTab === tabId).map((s) => s.id);
    sendResponse({ isActive: onThisTab.includes("yellow"), stickmen: onThisTab });
    return true;
  }
});

startup();

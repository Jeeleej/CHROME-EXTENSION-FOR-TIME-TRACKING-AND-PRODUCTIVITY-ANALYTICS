// Global variables
let currentTab = null;
let trackingStartTime = null;
let domainData = {};
let isWindowActive = true;

// Initialize
chrome.runtime.onStartup.addListener(init);
chrome.runtime.onInstalled.addListener(init);

async function init() {
  const data = await chrome.storage.local.get("domainData");
  domainData = data.domainData || {};
  startTracking();
}

// Start tracking when Chrome launches
function startTracking() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      updateActiveTab(tabs[0].id);
    }
  });
}

// Tab change handlers
chrome.tabs.onActivated.addListener((activeInfo) => {
  updateActiveTab(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.status === "complete") {
    updateActiveTab(tabId);
  }
});

// Window focus handlers
chrome.windows.onFocusChanged.addListener((windowId) => {
  isWindowActive = windowId !== chrome.windows.WINDOW_ID_NONE;
  if (isWindowActive) {
    chrome.tabs.query({ active: true, windowId }, (tabs) => {
      if (tabs[0]) updateActiveTab(tabs[0].id);
    });
  } else {
    recordTime();
  }
});

// Update active tab
function updateActiveTab(tabId) {
  chrome.tabs.get(tabId, (tab) => {
    if (!tab.url || !isWindowActive) return;

    try {
      const url = new URL(tab.url);
      if (url.protocol === "chrome:" || url.protocol === "edge:") return;

      const domain = getCleanDomain(url.hostname);

      // Record time for previous tab
      recordTime();

      // Start tracking new tab
      currentTab = domain;
      trackingStartTime = Date.now();
    } catch (e) {
      console.log("Invalid URL:", tab.url);
    }
  });
}

// Record time spent
function recordTime() {
  if (!currentTab || !trackingStartTime) return;

  const timeSpent = Math.floor((Date.now() - trackingStartTime) / 1000);
  if (timeSpent <= 0) return;

  const today = getTodayDateString();

  if (!domainData[today]) domainData[today] = {};
  if (!domainData[today][currentTab]) domainData[today][currentTab] = 0;

  domainData[today][currentTab] += timeSpent;

  saveData();

  // Reset tracking
  currentTab = null;
  trackingStartTime = null;
}

// Helper functions
function getCleanDomain(hostname) {
  return hostname.replace(/^www\./, "");
}

function getTodayDateString() {
  return new Date().toISOString().split("T")[0];
}

function saveData() {
  chrome.storage.local.set({ domainData });
}

// Save data periodically
chrome.alarms.create("saveData", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "saveData") {
    recordTime();
  }
});

// Record time before extension closes
chrome.runtime.onSuspend.addListener(() => {
  recordTime();
});

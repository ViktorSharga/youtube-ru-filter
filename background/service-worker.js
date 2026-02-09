/**
 * Background service worker for the YouTube Russian-Language Filter.
 *
 * Handles:
 * - Extension installation/update: initialize default storage
 * - Context menu creation: "Whitelist this channel" / "Block this channel"
 * - Context menu clicks: message content script for channel name, then update storage
 * - Cache cleanup alarm: purge expired detection cache entries every 24h
 */

// --- Installation ---

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Set defaults on fresh install
    await chrome.storage.sync.set({
      settings: { enabled: true },
      whitelist: {},
      blocklist: {},
    });
    await chrome.storage.local.set({
      stats: { totalFiltered: 0 },
      detectionCache: {},
    });
  } else if (details.reason === 'update') {
    // Clear detection cache on update so new detection logic takes effect
    await chrome.storage.local.set({ detectionCache: {} });
  }

  // Create context menus (re-created on every install/update)
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'rufilter-whitelist',
      title: 'RuFilter: Whitelist this channel',
      contexts: ['link'],
      documentUrlPatterns: ['*://*.youtube.com/*'],
    });

    chrome.contextMenus.create({
      id: 'rufilter-blocklist',
      title: 'RuFilter: Block this channel',
      contexts: ['link'],
      documentUrlPatterns: ['*://*.youtube.com/*'],
    });
  });

  // Set up cache cleanup alarm
  chrome.alarms.create('rufilter-cache-cleanup', {
    periodInMinutes: 24 * 60, // Every 24 hours
  });
});

// --- Context Menu Clicks ---

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId !== 'rufilter-whitelist' && info.menuItemId !== 'rufilter-blocklist') return;

  try {
    // Ask content script for the channel name of the right-clicked video
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'GET_CHANNEL_FROM_CONTEXT',
    });

    const channelName = response?.channelName;
    if (!channelName) {
      // Could not determine channel — show a notification or silently fail
      console.warn('[RuFilter] Could not determine channel name from context menu click');
      return;
    }

    if (info.menuItemId === 'rufilter-whitelist') {
      const { whitelist = {} } = await chrome.storage.sync.get({ whitelist: {} });
      whitelist[channelName] = true;
      // Remove from blocklist if present
      const { blocklist = {} } = await chrome.storage.sync.get({ blocklist: {} });
      delete blocklist[channelName];
      await chrome.storage.sync.set({ whitelist, blocklist });
    } else if (info.menuItemId === 'rufilter-blocklist') {
      const { blocklist = {} } = await chrome.storage.sync.get({ blocklist: {} });
      blocklist[channelName] = true;
      // Remove from whitelist if present
      const { whitelist = {} } = await chrome.storage.sync.get({ whitelist: {} });
      delete whitelist[channelName];
      await chrome.storage.sync.set({ whitelist, blocklist });
    }
  } catch (err) {
    console.error('[RuFilter] Context menu error:', err);
  }
});

// --- Cache Cleanup Alarm ---

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'rufilter-cache-cleanup') return;

  const { detectionCache = {} } = await chrome.storage.local.get({ detectionCache: {} });
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let changed = false;

  for (const key of Object.keys(detectionCache)) {
    if (detectionCache[key].timestamp < cutoff) {
      delete detectionCache[key];
      changed = true;
    }
  }

  if (changed) {
    await chrome.storage.local.set({ detectionCache });
  }
});

/**
 * Background service worker for the YouTube Russian-Language Filter.
 *
 * Handles:
 * - Extension installation: initialize default storage
 * - Context menu creation: "Whitelist this channel" / "Block this channel"
 * - Context menu clicks: message content script for channel name, then update storage
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
    });
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


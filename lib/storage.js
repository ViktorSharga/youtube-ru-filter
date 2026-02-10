/**
 * Storage wrapper for chrome.storage.sync (cross-device) and chrome.storage.local (device-only).
 *
 * sync: settings, whitelist, blocklist
 * local: stats
 */
const RuFilterStorage = (() => {
  // --- Settings (sync) ---

  async function getSettings() {
    const { settings } = await chrome.storage.sync.get({ settings: { enabled: true } });
    return settings;
  }

  async function updateSettings(partial) {
    const current = await getSettings();
    const updated = { ...current, ...partial };
    await chrome.storage.sync.set({ settings: updated });
    return updated;
  }

  // --- Whitelist (sync) ---

  async function getWhitelist() {
    const { whitelist } = await chrome.storage.sync.get({ whitelist: {} });
    return whitelist;
  }

  async function addToWhitelist(channelName) {
    if (!channelName) return;
    const whitelist = await getWhitelist();
    whitelist[channelName] = true;
    await chrome.storage.sync.set({ whitelist });
    // Remove from blocklist if present
    const blocklist = await getBlocklist();
    if (blocklist[channelName]) {
      delete blocklist[channelName];
      await chrome.storage.sync.set({ blocklist });
    }
  }

  async function removeFromWhitelist(channelName) {
    const whitelist = await getWhitelist();
    delete whitelist[channelName];
    await chrome.storage.sync.set({ whitelist });
  }

  // --- Blocklist (sync) ---

  async function getBlocklist() {
    const { blocklist } = await chrome.storage.sync.get({ blocklist: {} });
    return blocklist;
  }

  async function addToBlocklist(channelName) {
    if (!channelName) return;
    const blocklist = await getBlocklist();
    blocklist[channelName] = true;
    await chrome.storage.sync.set({ blocklist });
    // Remove from whitelist if present
    const whitelist = await getWhitelist();
    if (whitelist[channelName]) {
      delete whitelist[channelName];
      await chrome.storage.sync.set({ whitelist });
    }
  }

  async function removeFromBlocklist(channelName) {
    const blocklist = await getBlocklist();
    delete blocklist[channelName];
    await chrome.storage.sync.set({ blocklist });
  }

  // --- Stats (local) ---

  async function getStats() {
    const { stats } = await chrome.storage.local.get({ stats: { totalFiltered: 0 } });
    return stats;
  }

  async function incrementFiltered(count = 1) {
    const stats = await getStats();
    stats.totalFiltered += count;
    await chrome.storage.local.set({ stats });
    return stats;
  }

  async function resetStats() {
    await chrome.storage.local.set({ stats: { totalFiltered: 0 } });
  }

  return {
    getSettings,
    updateSettings,
    getWhitelist,
    addToWhitelist,
    removeFromWhitelist,
    getBlocklist,
    addToBlocklist,
    removeFromBlocklist,
    getStats,
    incrementFiltered,
    resetStats,
  };
})();

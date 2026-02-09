/**
 * Storage wrapper for chrome.storage.sync (cross-device) and chrome.storage.local (device-only).
 *
 * sync: settings, whitelist, blocklist
 * local: stats, detectionCache
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

  // --- Detection Cache (local) ---

  function hashText(text) {
    // Simple FNV-1a 32-bit hash for fast cache keying
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
  }

  async function getCachedDetection(text) {
    const key = hashText(text);
    const { detectionCache } = await chrome.storage.local.get({ detectionCache: {} });
    const entry = detectionCache[key];
    if (!entry) return null;
    // Expire after 30 days
    if (Date.now() - entry.timestamp > 30 * 24 * 60 * 60 * 1000) {
      delete detectionCache[key];
      await chrome.storage.local.set({ detectionCache });
      return null;
    }
    return entry.result;
  }

  async function cacheDetection(text, result) {
    const key = hashText(text);
    const { detectionCache } = await chrome.storage.local.get({ detectionCache: {} });
    detectionCache[key] = { result, timestamp: Date.now() };
    await chrome.storage.local.set({ detectionCache });
  }

  async function cleanExpiredCache() {
    const { detectionCache } = await chrome.storage.local.get({ detectionCache: {} });
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
    getCachedDetection,
    cacheDetection,
    cleanExpiredCache,
  };
})();

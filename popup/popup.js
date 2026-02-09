/**
 * Popup UI logic for YouTube RU Filter.
 *
 * Reads settings/whitelist/blocklist from chrome.storage on open,
 * writes changes immediately, and the content script picks them up
 * via chrome.storage.onChanged.
 */
document.addEventListener('DOMContentLoaded', async () => {
  // --- DOM refs ---
  const enabledToggle = document.getElementById('enabled-toggle');
  const statsCount = document.getElementById('stats-count');
  const resetStatsBtn = document.getElementById('reset-stats');
  const whitelistInput = document.getElementById('whitelist-input');
  const whitelistAddBtn = document.getElementById('whitelist-add');
  const whitelistList = document.getElementById('whitelist-list');
  const blocklistInput = document.getElementById('blocklist-input');
  const blocklistAddBtn = document.getElementById('blocklist-add');
  const blocklistList = document.getElementById('blocklist-list');

  // --- Load initial data ---
  const { settings = { enabled: true } } = await chrome.storage.sync.get({ settings: { enabled: true } });
  const { whitelist = {} } = await chrome.storage.sync.get({ whitelist: {} });
  const { blocklist = {} } = await chrome.storage.sync.get({ blocklist: {} });
  const { stats = { totalFiltered: 0 } } = await chrome.storage.local.get({ stats: { totalFiltered: 0 } });

  enabledToggle.checked = settings.enabled;
  updateStats(stats.totalFiltered);
  renderList(whitelistList, whitelist, 'whitelist');
  renderList(blocklistList, blocklist, 'blocklist');

  // --- Event handlers ---

  enabledToggle.addEventListener('change', async () => {
    const enabled = enabledToggle.checked;
    await chrome.storage.sync.set({ settings: { ...settings, enabled } });
  });

  resetStatsBtn.addEventListener('click', async () => {
    await chrome.storage.local.set({ stats: { totalFiltered: 0 } });
    updateStats(0);
  });

  whitelistAddBtn.addEventListener('click', () => addChannel('whitelist'));
  whitelistInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addChannel('whitelist');
  });

  blocklistAddBtn.addEventListener('click', () => addChannel('blocklist'));
  blocklistInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addChannel('blocklist');
  });

  // Listen for external storage changes (e.g., from context menu actions)
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'sync') {
      if (changes.whitelist) {
        renderList(whitelistList, changes.whitelist.newValue || {}, 'whitelist');
      }
      if (changes.blocklist) {
        renderList(blocklistList, changes.blocklist.newValue || {}, 'blocklist');
      }
      if (changes.settings) {
        enabledToggle.checked = (changes.settings.newValue || { enabled: true }).enabled;
      }
    }
    if (area === 'local' && changes.stats) {
      updateStats((changes.stats.newValue || { totalFiltered: 0 }).totalFiltered);
    }
  });

  // --- Functions ---

  function updateStats(count) {
    statsCount.textContent = `${count} video${count === 1 ? '' : 's'} filtered`;
  }

  function renderList(listEl, items, listType) {
    listEl.innerHTML = '';
    const names = Object.keys(items).sort((a, b) => a.localeCompare(b));

    if (names.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty-state';
      li.textContent = listType === 'whitelist' ? 'No whitelisted channels' : 'No blocked channels';
      listEl.appendChild(li);
      return;
    }

    for (const name of names) {
      const li = document.createElement('li');

      const span = document.createElement('span');
      span.className = 'channel-name';
      span.textContent = name;

      const btn = document.createElement('button');
      btn.className = 'btn-remove';
      btn.textContent = '\u00d7'; // ×
      btn.title = 'Remove';
      btn.addEventListener('click', () => removeChannel(listType, name));

      li.appendChild(span);
      li.appendChild(btn);
      listEl.appendChild(li);
    }
  }

  async function addChannel(listType) {
    const input = listType === 'whitelist' ? whitelistInput : blocklistInput;
    const name = input.value.trim();
    if (!name) return;
    input.value = '';

    const key = listType;
    const oppositeKey = listType === 'whitelist' ? 'blocklist' : 'whitelist';

    // Get current data
    const { [key]: list = {} } = await chrome.storage.sync.get({ [key]: {} });
    const { [oppositeKey]: oppositeList = {} } = await chrome.storage.sync.get({ [oppositeKey]: {} });

    // Add to target list, remove from opposite
    list[name] = true;
    delete oppositeList[name];

    await chrome.storage.sync.set({ [key]: list, [oppositeKey]: oppositeList });

    // Re-render both lists
    const wl = listType === 'whitelist' ? list : oppositeList;
    const bl = listType === 'blocklist' ? list : oppositeList;
    renderList(whitelistList, wl, 'whitelist');
    renderList(blocklistList, bl, 'blocklist');
  }

  async function removeChannel(listType, name) {
    const { [listType]: list = {} } = await chrome.storage.sync.get({ [listType]: {} });
    delete list[name];
    await chrome.storage.sync.set({ [listType]: list });

    const listEl = listType === 'whitelist' ? whitelistList : blocklistList;
    renderList(listEl, list, listType);
  }
});

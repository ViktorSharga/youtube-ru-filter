/**
 * Main orchestrator for the YouTube Russian-language filter.
 *
 * Initialization sequence:
 * 1. Load settings, whitelist, blocklist
 * 2. Always register storage/message listeners (so re-enabling works without reload)
 * 3. Start DOM observer if enabled
 * 4. Run initial page scan if enabled
 *
 * Filtering pipeline (per video):
 * 1. Extract metadata
 * 2. Check whitelist/blocklist
 * 3. Run language detection
 * 4. Apply combined decision
 * 5. Hide if blocked
 */
(() => {
  let settings = { enabled: true };
  let whitelist = {};
  let blocklist = {};
  let isProcessing = false;
  let processedElements = new WeakSet();

  // Track the last video element the user hovered over, for context menu detection.
  // Using :hover is unreliable because browsers clear hover state when the context menu opens.
  let lastHoveredVideo = null;

  function setupHoverTracking() {
    document.addEventListener('pointerover', (e) => {
      const video = e.target.closest(RuFilterExtractor.VIDEO_SELECTORS);
      if (video) lastHoveredVideo = video;
    });
  }

  /**
   * Process all unprocessed video elements on the page.
   */
  async function processVideos() {
    if (!settings.enabled || isProcessing) return;
    isProcessing = true;

    try {
      const unprocessed = RuFilterExtractor.findUnprocessedVideos();
      if (unprocessed.length === 0) return;

      let filteredCount = 0;

      for (const container of unprocessed) {
        if (processedElements.has(container)) continue;

        const metadata = RuFilterExtractor.extractMetadata(container);
        if (!metadata) continue;

        processedElements.add(container);

        const decision = await RuFilterDetector.shouldFilter(
          metadata.title,
          metadata.channelName,
          whitelist,
          blocklist
        );

        if (decision === 'BLOCK') {
          RuFilterActions.hideVideo(metadata.element);
          filteredCount++;
        }
      }

      if (filteredCount > 0) {
        await RuFilterStorage.incrementFiltered(filteredCount);
      }
    } catch (err) {
      console.error('[RuFilter] Error processing videos:', err);
    } finally {
      isProcessing = false;
    }
  }

  /**
   * Re-evaluate all videos (e.g., after whitelist/blocklist change).
   */
  async function reprocessAll() {
    RuFilterActions.showAllHidden();
    RuFilterActions.resetAllMarkers();
    processedElements = new WeakSet();
    await processVideos();
  }

  /**
   * Handle storage changes from popup or context menu.
   */
  function onStorageChanged(changes, area) {
    let needsReprocess = false;

    if (area === 'sync') {
      if (changes.settings) {
        const wasEnabled = settings.enabled;
        settings = changes.settings.newValue || { enabled: true };

        if (!settings.enabled) {
          RuFilterActions.showAllHidden();
          RuFilterObserver.stop();
          return;
        }
        // Went from disabled → enabled: start observer
        if (!wasEnabled && settings.enabled) {
          RuFilterObserver.start(processVideos);
        }
        needsReprocess = true;
      }
      if (changes.whitelist) {
        whitelist = changes.whitelist.newValue || {};
        needsReprocess = true;
      }
      if (changes.blocklist) {
        blocklist = changes.blocklist.newValue || {};
        needsReprocess = true;
      }
    }

    if (needsReprocess && settings.enabled) {
      reprocessAll();
    }
  }

  /**
   * Handle messages from the background service worker (e.g., context menu actions).
   */
  function onMessage(message, sender, sendResponse) {
    if (message.type === 'GET_CHANNEL_FROM_CONTEXT') {
      if (lastHoveredVideo) {
        // Extract channel name without marking as processed (read-only extraction)
        const selectors = [
          'ytd-channel-name #text',
          'ytd-channel-name yt-formatted-string',
          '#channel-name #text',
          '#channel-name yt-formatted-string',
          '#byline a',
          '#byline',
        ];
        let channelName = '';
        for (const sel of selectors) {
          const el = lastHoveredVideo.querySelector(sel);
          if (el) {
            const text = el.textContent.trim();
            if (text) { channelName = text; break; }
          }
        }
        sendResponse({ channelName });
      } else {
        sendResponse({ channelName: '' });
      }
      return true;
    }
  }

  /**
   * Initialize the extension.
   */
  async function init() {
    try {
      // Load initial data
      [settings, whitelist, blocklist] = await Promise.all([
        RuFilterStorage.getSettings(),
        RuFilterStorage.getWhitelist(),
        RuFilterStorage.getBlocklist(),
      ]);

      // Always register listeners so toggling enable/disable works without reload
      chrome.storage.onChanged.addListener(onStorageChanged);
      chrome.runtime.onMessage.addListener(onMessage);
      setupHoverTracking();

      if (!settings.enabled) return;

      // Start DOM observer
      RuFilterObserver.start(processVideos);

      // Initial scan
      await processVideos();
    } catch (err) {
      console.error('[RuFilter] Initialization error:', err);
    }
  }

  init();
})();

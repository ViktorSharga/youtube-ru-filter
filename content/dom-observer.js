/**
 * MutationObserver and SPA navigation listener for YouTube.
 *
 * - Observes DOM mutations (debounced at 300ms) for new video elements
 * - Listens for yt-navigate-finish for SPA page transitions
 * - Uses requestIdleCallback when available for non-urgent processing
 */
const RuFilterObserver = (() => {
  let observer = null;
  let debounceTimer = null;
  let onNewVideosCallback = null;
  let navHandler = null;

  const DEBOUNCE_MS = 300;
  const NAV_SETTLE_MS = 500;

  /**
   * Schedule processing via requestIdleCallback or setTimeout fallback.
   */
  function scheduleProcessing(callback) {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(callback, { timeout: 1000 });
    } else {
      setTimeout(callback, 0);
    }
  }

  /**
   * Debounced handler for DOM mutations.
   */
  function handleMutations() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      scheduleProcessing(() => {
        if (onNewVideosCallback) onNewVideosCallback();
      });
    }, DEBOUNCE_MS);
  }

  /**
   * Start observing the DOM for new video elements.
   * @param {Function} callback - Called when new unprocessed videos may be present
   */
  function start(callback) {
    onNewVideosCallback = callback;

    // MutationObserver on document.body
    if (!observer && document.body) {
      observer = new MutationObserver(handleMutations);
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    // YouTube SPA navigation event — store reference for cleanup
    if (!navHandler) {
      navHandler = () => {
        setTimeout(() => {
          scheduleProcessing(() => {
            if (onNewVideosCallback) onNewVideosCallback();
          });
        }, NAV_SETTLE_MS);
      };
      document.addEventListener('yt-navigate-finish', navHandler);
    }
  }

  /**
   * Stop observing.
   */
  function stop() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (navHandler) {
      document.removeEventListener('yt-navigate-finish', navHandler);
      navHandler = null;
    }
    clearTimeout(debounceTimer);
  }

  return {
    start,
    stop,
  };
})();

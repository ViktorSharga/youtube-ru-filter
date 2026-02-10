/**
 * Extracts video metadata (title, channel name) from YouTube DOM elements.
 *
 * Handles different page types:
 * - Home feed:  ytd-rich-item-renderer
 * - Search:     ytd-video-renderer
 * - Shorts:     ytd-reel-item-renderer
 * - Sidebar:    ytd-compact-video-renderer
 */
const RuFilterExtractor = (() => {
  const VIDEO_SELECTORS = [
    'ytd-rich-item-renderer',
    'ytd-video-renderer',
    'ytd-reel-item-renderer',
    'ytd-compact-video-renderer',
  ].join(',');

  const PROCESSED_ATTR = 'data-ru-filter-checked';

  /**
   * Find all unprocessed video container elements on the page.
   * @returns {Element[]}
   */
  function findUnprocessedVideos() {
    const all = document.querySelectorAll(VIDEO_SELECTORS);
    const unprocessed = [];
    for (const el of all) {
      if (!el.hasAttribute(PROCESSED_ATTR)) {
        unprocessed.push(el);
      }
    }
    return unprocessed;
  }

  /**
   * Extract title text from a video container.
   */
  function extractTitle(container) {
    // Primary: #video-title (works for most video types)
    const titleEl =
      container.querySelector('#video-title') ||
      container.querySelector('h3 a#video-title-link') ||
      container.querySelector('.title');
    if (titleEl) {
      const text = titleEl.textContent.trim();
      if (text) return text;
      // aria-label / title attribute fallbacks (works even when text is in shadow DOM)
      const ariaLabel = titleEl.getAttribute('aria-label');
      if (ariaLabel) return ariaLabel.trim();
      const titleAttr = titleEl.getAttribute('title');
      if (titleAttr) return titleAttr.trim();
    }
    // Shorts fallback: look for the overlay title
    const shortsTitle = container.querySelector('.shortsLockupViewModelHostOutsideMetadataTitle span');
    if (shortsTitle) return shortsTitle.textContent.trim();

    // Another Shorts fallback
    const reelTitle = container.querySelector('h3');
    if (reelTitle) return reelTitle.textContent.trim();

    return '';
  }

  /**
   * Extract channel name from a video container.
   */
  function extractChannelName(container) {
    // Try multiple selectors as YouTube's DOM varies by page type
    const selectors = [
      'ytd-channel-name #text',
      'ytd-channel-name yt-formatted-string',
      '#channel-name #text',
      '#channel-name yt-formatted-string',
      '.ytd-channel-name',
      '#text.ytd-channel-name',
    ];
    for (const sel of selectors) {
      const el = container.querySelector(sel);
      if (el) {
        const text = el.textContent.trim();
        if (text) return text;
      }
    }
    // Fallback: look for the byline
    const byline = container.querySelector('#byline a, #byline');
    if (byline) {
      const text = byline.textContent.trim();
      if (text) return text;
    }
    return '';
  }

  /**
   * Extract metadata from a video container element.
   * @returns {{ element: Element, title: string, channelName: string } | null}
   */
  function extractMetadata(container) {
    const title = extractTitle(container);
    const channelName = extractChannelName(container);

    // Need at least a title to make a detection decision.
    // Do NOT mark as processed if title is missing — YouTube may still be
    // lazy-loading the metadata, so we should re-check on the next cycle.
    if (!title) return null;

    container.setAttribute(PROCESSED_ATTR, 'true');
    return { element: container, title, channelName };
  }

  return {
    VIDEO_SELECTORS,
    PROCESSED_ATTR,
    findUnprocessedVideos,
    extractMetadata,
  };
})();

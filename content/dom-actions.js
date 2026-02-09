/**
 * DOM manipulation for hiding/showing video elements.
 */
const RuFilterActions = (() => {
  const HIDDEN_ATTR = 'data-ru-filter-hidden';

  /**
   * Hide a video container element from the DOM.
   */
  function hideVideo(element) {
    element.style.display = 'none';
    element.setAttribute(HIDDEN_ATTR, 'true');
  }

  /**
   * Restore a previously hidden video element.
   */
  function showVideo(element) {
    element.style.display = '';
    element.removeAttribute(HIDDEN_ATTR);
  }

  /**
   * Restore all hidden videos (e.g., when extension is disabled or channel whitelisted).
   */
  function showAllHidden() {
    const hidden = document.querySelectorAll(`[${HIDDEN_ATTR}="true"]`);
    for (const el of hidden) {
      showVideo(el);
    }
    return hidden.length;
  }

  /**
   * Reset all processing markers so videos get re-evaluated.
   */
  function resetAllMarkers() {
    const processed = document.querySelectorAll(`[${RuFilterExtractor.PROCESSED_ATTR}]`);
    for (const el of processed) {
      el.removeAttribute(RuFilterExtractor.PROCESSED_ATTR);
    }
  }

  return {
    HIDDEN_ATTR,
    hideVideo,
    showVideo,
    showAllHidden,
    resetAllMarkers,
  };
})();

/**
 * DOM manipulation for hiding/showing video elements.
 *
 * Uses both an injected CSS rule (!important) and inline styles to hide videos.
 * The CSS rule ensures hiding persists even if YouTube's framework overwrites
 * inline styles during re-renders.
 */
const RuFilterActions = (() => {
  const HIDDEN_ATTR = 'data-ru-filter-hidden';
  let styleInjected = false;

  /**
   * Inject a <style> tag that hides elements via our data attribute.
   * This is more resilient than inline styles alone because YouTube's
   * Polymer/Lit framework can overwrite inline styles during re-renders.
   */
  function ensureStyleInjected() {
    if (styleInjected) return;
    const style = document.createElement('style');
    style.textContent = `[${HIDDEN_ATTR}="true"] { display: none !important; }`;
    (document.head || document.documentElement).appendChild(style);
    styleInjected = true;
  }

  /**
   * Hide a video container element from the DOM.
   */
  function hideVideo(element) {
    ensureStyleInjected();
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

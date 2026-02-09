/**
 * 3-tier language detection with false-negative bias.
 *
 * Tier 1: Character heuristic (instant)
 *   a) Ukrainian-only chars (іїєґ) → UKRAINIAN
 *   b) Russian-only chars (ёыэъ) → RUSSIAN
 *   c) >50% Cyrillic with zero Ukrainian chars → RUSSIAN
 *
 * Tier 2: chrome.i18n.detectLanguage (async, CLD-based)
 *
 * Tier 3: Fallback → ALLOW (false-negative bias)
 *
 * Results: "RUSSIAN", "UKRAINIAN", "ALLOW" (non-Cyrillic or unknown)
 */
const RuFilterDetector = (() => {
  const RUSSIAN_ONLY = /[ёЁыЫэЭъЪ]/;
  const UKRAINIAN_ONLY = /[іІїЇєЄґҐ]/;
  const CYRILLIC = /[\u0400-\u04FF]/;
  const CYRILLIC_GLOBAL = /[\u0400-\u04FF]/g;
  const LETTER = /[\p{L}]/gu;

  /**
   * Tier 1: Character-based heuristic.
   *
   * Check order matters for the false-negative bias:
   * Ukrainian chars always take precedence over Russian chars.
   *
   * Additionally, if >50% of letters in the text are Cyrillic AND no
   * Ukrainian-unique chars exist, we classify as RUSSIAN. This catches
   * the majority of Russian titles that don't happen to contain ёыэъ
   * (e.g. "Приготовил Самую Острую Шаурму").
   *
   * @returns {"RUSSIAN"|"UKRAINIAN"|null} null means inconclusive
   */
  function charHeuristic(text) {
    const hasUkrainian = UKRAINIAN_ONLY.test(text);
    if (hasUkrainian) return 'UKRAINIAN';

    const hasRussian = RUSSIAN_ONLY.test(text);
    if (hasRussian) return 'RUSSIAN';

    // Predominantly-Cyrillic heuristic: if most letters are Cyrillic
    // and none are Ukrainian-unique, this is very likely Russian.
    const cyrillicMatches = text.match(CYRILLIC_GLOBAL);
    if (cyrillicMatches) {
      const letterMatches = text.match(LETTER);
      if (letterMatches && cyrillicMatches.length / letterMatches.length > 0.5) {
        return 'RUSSIAN';
      }
    }

    return null;
  }

  /**
   * Tier 2: chrome.i18n.detectLanguage (CLD).
   * Only invoked on text that contains Cyrillic characters.
   * @returns {Promise<"RUSSIAN"|"UKRAINIAN"|"ALLOW">}
   */
  function chromeDetect(text) {
    if (!CYRILLIC.test(text)) return Promise.resolve('ALLOW');

    return new Promise((resolve) => {
      try {
        chrome.i18n.detectLanguage(text, (result) => {
          if (chrome.runtime.lastError) {
            resolve('ALLOW');
            return;
          }
          if (!result || !result.languages || result.languages.length === 0) {
            resolve('ALLOW');
            return;
          }
          const top = result.languages[0];
          if (top.language === 'uk') {
            resolve('UKRAINIAN');
            return;
          }
          if (result.isReliable && top.language === 'ru' && top.percentage >= 70) {
            resolve('RUSSIAN');
            return;
          }
          resolve('ALLOW');
        });
      } catch {
        resolve('ALLOW');
      }
    });
  }

  /**
   * Detect language of a single text string using the 3-tier cascade.
   * @returns {Promise<"RUSSIAN"|"UKRAINIAN"|"ALLOW">}
   */
  async function detectText(text) {
    if (!text || !text.trim()) return 'ALLOW';
    text = text.trim();

    // Check cache first
    const cached = await RuFilterStorage.getCachedDetection(text);
    if (cached) return cached;

    // Tier 1: char heuristic (includes predominantly-Cyrillic check)
    const tier1 = charHeuristic(text);
    if (tier1) {
      await RuFilterStorage.cacheDetection(text, tier1);
      return tier1;
    }

    // No Cyrillic at all → ALLOW (English, etc.)
    if (!CYRILLIC.test(text)) {
      await RuFilterStorage.cacheDetection(text, 'ALLOW');
      return 'ALLOW';
    }

    // Tier 2: chrome.i18n
    const tier2 = await chromeDetect(text);
    await RuFilterStorage.cacheDetection(text, tier2);
    return tier2;
  }

  /**
   * Combined decision for a video, given its metadata and user lists.
   *
   * Decision rules (in order):
   * 1. Channel whitelisted → ALLOW
   * 2. Channel blocklisted → BLOCK
   * 3. Either title or channel detected as Ukrainian → ALLOW
   * 4. Title detected as Russian → BLOCK (title is the primary signal)
   * 5. Channel detected as Russian but title is not → ALLOW
   *    (could be a non-Russian video from a Russian channel)
   * 6. Everything else → ALLOW
   *
   * False-negative bias: Ukrainian always takes precedence (rule 3),
   * and we only block based on the title, never on channel name alone.
   *
   * @returns {Promise<"ALLOW"|"BLOCK">}
   */
  async function shouldFilter(title, channelName, whitelist, blocklist) {
    // List checks (O(1) lookup)
    if (channelName && whitelist[channelName]) return 'ALLOW';
    if (channelName && blocklist[channelName]) return 'BLOCK';

    // Run detection on both in parallel
    const [titleResult, channelResult] = await Promise.all([
      detectText(title),
      detectText(channelName),
    ]);

    // Ukrainian found anywhere → ALLOW (Ukrainian takes absolute precedence)
    if (titleResult === 'UKRAINIAN' || channelResult === 'UKRAINIAN') return 'ALLOW';

    // Title is Russian → BLOCK
    if (titleResult === 'RUSSIAN') return 'BLOCK';

    // Channel is Russian but title is not — allow the video
    // (non-Russian content from a Russian channel should not be hidden)
    return 'ALLOW';
  }

  return {
    detectText,
    shouldFilter,
    charHeuristic,
  };
})();

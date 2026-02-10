# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# YouTube Russian-Language Filter — Chrome Extension

## Project Overview

Chrome extension (Manifest V3) that silently removes Russian-language videos from YouTube's Home feed, Shorts, and search results while preserving Ukrainian-language content. Channel pages are exempt — navigating to a channel directly means the user wants to see its content.

## Development

No build step, no bundler, no package manager. Edit files directly and reload the extension.

1. `chrome://extensions` → Enable Developer Mode → "Load unpacked" → select this folder
2. After code changes: click the refresh icon on the extension card, then reload the YouTube tab
3. Debug with DevTools console — all logs are prefixed with `[RuFilter]`

## Architecture

```
manifest.json              # MV3 config, permissions: storage, contextMenus, alarms
background/service-worker.js  # Lifecycle, context menus, cache cleanup alarm
content/                   # Content scripts (injected into youtube.com)
  main.js                  # Orchestrator: init, SPA nav, filtering pipeline
  dom-observer.js          # MutationObserver (300ms debounce) + yt-navigate-finish
  video-extractor.js       # Extract title/channel from ytd-* elements
  dom-actions.js           # Hide/show video elements (display:none)
lib/
  language-detector.js     # 3-tier detection: chars → chrome.i18n → fallback
  storage.js               # chrome.storage.sync/local wrapper
popup/                     # Extension popup UI (HTML/CSS/JS)
```

## Key Design Decisions

- **DOM-only detection** — no YouTube Data API, no API keys. Uses visible title + channel name.
- **False-negative bias** — every uncertain case defaults to ALLOW. Ukrainian chars always take absolute precedence over Russian detection.
- **Two detection biases**: video titles use aggressive "predominantly Cyrillic" heuristic (>50% Cyrillic → RUSSIAN). Search queries use conservative detection (only skip filtering when confidently Russian).
- **Search query language detection** — English/Ukrainian search queries trigger filtering of Russian results. Russian search queries disable language filtering (user explicitly wants Russian content). Blocklisted channels are always hidden regardless.
- **Channel pages exempt** — no filtering on `/@`, `/channel/`, `/c/`, `/user/` pages. If the user navigated to a channel, they want to see its content. Filtering only applies on feed, Shorts, and search results.
- **Content scripts share globals** — `RuFilterStorage`, `RuFilterDetector`, `RuFilterExtractor`, `RuFilterActions`, `RuFilterObserver` are IIFEs on `window`. Load order in manifest matters.
- **Content script load order** (defined in manifest.json, order is critical): `lib/storage.js` → `lib/language-detector.js` → `content/video-extractor.js` → `content/dom-actions.js` → `content/dom-observer.js` → `content/main.js`. Each later module depends on globals from earlier ones.

## Common Issues & Fixes

- **Race condition in processVideos**: async language detection (await per element) blocks the isProcessing flag. MutationObserver callbacks during processing get rejected. Fixed with follow-up scan in `finally` block.
- **Lazy-loaded metadata**: don't mark elements as `data-ru-filter-checked` if title extraction fails — YouTube may still be populating the DOM. Element will be re-checked on next cycle.
- **Context menu hover detection**: `:hover` CSS pseudo-selector doesn't work when context menu is open. Use `pointerover` event tracking with `lastHoveredVideo` variable instead.
- **Re-enabling after disable**: always register `chrome.storage.onChanged` and `chrome.runtime.onMessage` listeners regardless of `settings.enabled`. Otherwise toggling on from popup requires page reload.

## Storage Layout

**chrome.storage.sync** (cross-device, 100KB):
- `settings: { enabled: boolean }`
- `whitelist: { [channelName]: true }`
- `blocklist: { [channelName]: true }`

**chrome.storage.local** (device-only, 10MB):
- `stats: { totalFiltered: number }`

## Language Detection Rules

**Tier 1 — Character heuristic (instant):**
- Ukrainian-only chars: `іІїЇєЄґҐ` → UKRAINIAN (always wins)
- Russian-only chars: `ёЁыЫэЭъЪ` → RUSSIAN
- >50% Cyrillic letters with no Ukrainian chars → RUSSIAN

**Tier 2 — chrome.i18n.detectLanguage:**
- Only for Cyrillic text not resolved by Tier 1
- Requires `isReliable && language === "ru" && percentage >= 70`

**Combined video decision:**
1. Channel whitelisted → ALLOW
2. Channel blocklisted → BLOCK
3. Ukrainian detected anywhere → ALLOW
4. Title detected as Russian → BLOCK
5. Everything else → ALLOW

## Testing

Load unpacked at `chrome://extensions` → Developer Mode. Refresh extension + reload YouTube tab after changes. Check DevTools console for `[RuFilter]` errors.

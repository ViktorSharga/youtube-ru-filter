# YouTube Russian-Language Filter

A Chrome extension that silently removes Russian-language videos from YouTube's feed, Shorts, and search results while carefully preserving Ukrainian-language content.

## Features

- Filters Russian-language videos from Home feed, Search, Shorts, and Sidebar
- Preserves Ukrainian content (Ukrainian characters always take precedence)
- Whitelist/blocklist channels via right-click context menu or popup
- Settings sync across Chrome devices
- No API keys or external services required — all detection runs locally

## Installation

1. **Download** — clone or download this repository:
   ```
   git clone https://github.com/ViktorSharga/youtube-ru-filter.git
   ```
2. **Open Chrome** and navigate to `chrome://extensions`
3. **Enable Developer Mode** (toggle in the top-right corner)
4. Click **"Load unpacked"** and select the `youtube-ru-filter` folder
5. Open YouTube — Russian-language videos will be filtered automatically

## Usage

- **Popup** — click the extension icon to toggle on/off, view stats, and manage channel lists
- **Right-click** any video link on YouTube → "RuFilter: Whitelist this channel" or "RuFilter: Block this channel"
- Whitelisted channels are never filtered; blocked channels are always hidden

## How detection works

The extension uses a 3-tier language detection cascade:

1. **Character heuristic** — Ukrainian-only letters (іїєґ) → allow; Russian-only letters (ёыэъ) or predominantly Cyrillic text with no Ukrainian chars → filter
2. **chrome.i18n.detectLanguage** — Chrome's built-in language detection (CLD) for ambiguous text
3. **Fallback** — when uncertain, the video is shown (false-negative bias to protect Ukrainian content)

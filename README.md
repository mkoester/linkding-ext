# linkding-ext

Browser extension for [Linkding](https://github.com/sissbruecker/linkding) — displays your bookmarks as a customizable folder-based launcher on the New Tab page and popup.

## Features

- New Tab page with configurable bookmark folders
- Popup for quick access
- Folder rules: match bookmarks by tag, URL, or title (AND/OR combinations)
- Incremental sync via Linkding's `modified_since` API
- Background sync on timer + on New Tab open
- Static demo data mode (no Linkding instance needed)
- Firefox + Chrome from one codebase

## Development

```bash
npm install

# Chrome (watch mode)
npm run dev:chrome

# Firefox (watch mode)
npm run dev:firefox
```

Output lands in `dist/chrome/` or `dist/firefox/`.

### Load in browser

**Chrome**: `chrome://extensions` → Enable developer mode → Load unpacked → select `dist/chrome/`

**Firefox**: `about:debugging` → This Firefox → Load Temporary Add-on → select `dist/firefox/manifest.json`

## Build

```bash
npm run build        # both browsers
npm run build:chrome
npm run build:firefox
```

## Project structure

```
shared/          # All shared logic (types, storage, bookmarks, API, validation)
  data/          # Static mock bookmark data
src/
  background/    # Service worker — sync logic, alarms, message handling
  newtab/        # New Tab override page
  popup/         # Toolbar popup
  options/       # Settings + folder rule editor
manifests/       # Per-browser manifests (chrome/firefox)
public/icons/    # Extension icons (add icon48.png + icon128.png)
```

## Configuration

Open the extension options to:
- Set your Linkding URL and API token
- Configure the sync interval
- Toggle static demo data mode
- Define bookmark folders with match rules

## Icons

Add `icon48.png` and `icon128.png` to `public/icons/` before building.

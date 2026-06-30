# Project notes for Claude

## What this is

**Bookmarks+** — a browser extension that replaces the New Tab page with a folder-based bookmark launcher, with a toolbar popup for quick access. Supports multiple bookmark sources (providers). TypeScript, targets Firefox and Chrome from one codebase. Built iteratively with Claude starting 2026-06-22.

## Build & tooling

- **Package manager: pnpm** (not npm — `package-lock.json` is gitignored)
- `pnpm type-check` — `tsc --noEmit`, should be clean
- `pnpm build` — produces `dist/chrome/` and `dist/firefox/` via webpack
- Load in Firefox: `about:debugging` → Load Temporary Add-on → `dist/firefox/manifest.json`
- Load in Chrome: `chrome://extensions` → Enable developer mode → Load unpacked → `dist/chrome/`
- **Version bumping:** increment the patch version in `package.json` by 1 whenever building something the user should test in the browser (early development convention). `package.json` is the single source of truth — webpack injects it into both browser manifests at build time, so don't edit version in the manifests.

## Architecture decisions (already made, don't revisit)

**Bookmark IDs**
- All `Bookmark.id` values are namespaced strings: `"${providerConfigId}:${rawId}"`
- `BookmarkMap = Record<string, Bookmark>`
- `Folder.bookmark_ids: string[]`
- This prevents ID collisions across providers

**Provider system**
- Each bookmark source is a `BookmarkProvider` (interface in `shared/types.ts`): `sync(): Promise<Bookmark[]>`
- Provider configs (stored in `Settings.providers`) are a discriminated union on `type`: `"static" | "json" | "browser" | "linkding"`
- Factory: `createProvider(config)` in `shared/providers/index.ts`
- Every sync is a full sync (no incremental) — TODO: add per-provider incremental support

**Four providers**
1. **Static** (`shared/providers/static.ts`) — returns `STATIC_BOOKMARKS` from `shared/data/static.ts`; for development
2. **JSON** (`shared/providers/json.ts`) — user pastes a JSON array; format: `{ id?, url, title, tag_names?, favicon_url? }[]`; validated by `shared/validation.ts`
3. **Browser** (`shared/providers/browser.ts`) — uses `ext.bookmarks.getTree()`; ancestor folder names become `tag_names`; requests `bookmarks` optional permission at first sync
4. **Linkding** (`shared/providers/linkding.ts`) — full paginated sync against the Linkding REST API

**Storage layout** (`chrome.storage.local` / `browser.storage.local`)
- Bookmarks stored as `BookmarkMap` — flat `Record<string, Bookmark>` keyed by namespaced ID
- Folders stored as `Folder[]` — each has user-defined rules and a precomputed `bookmark_ids: string[]`
- `bookmark_ids` recomputed in background worker after every sync, not at render time
- `lastSync` stored as ISO string (currently informational only — all providers do full sync)

**Favicon strategy** (`shared/favicon.ts` — `renderFavicon(bookmark, size)`)
- `favicon_url` is optional on `Bookmark` — only stored when a provider returns one; always preferred when present (Linkding supplies it server-resolved)
- **Chrome**: uses the browser's cached favicons via the `_favicon` endpoint (`ext.runtime.getURL("/_favicon/?pageUrl=…&size=…")`), gated on the `"favicon"` permission (Chrome manifest only). Handles `<link rel="icon">` declarations; no network request.
- **Firefox**: no favicon API exists, so it falls back to guessing `${origin}/favicon.ico`.
- **Last resort (both)**: an inline-SVG letter tile (site initial on a hue derived from the URL) when the icon fails to load. No more empty gaps.

**Sync flow**
- Background service worker owns all sync logic
- Two triggers: `chrome.alarms` (configurable interval, default 15 min) and `sync_requested` message from any UI page
- Debounced: won't sync more than once per minute
- Full sync always: iterates all configured providers, merges results into a single `BookmarkMap`

**Folder rules**
```typescript
interface FolderRules {
  match: "all" | "any";   // AND / OR
  conditions: RuleCondition[];
}
type ConditionType = "tag" | "url_contains" | "title_contains";
```
A bookmark can appear in multiple folders. No "uncategorized" folder.

**Browser API abstraction**
- `shared/browser.ts` exports a single `ext` object — `browser` in Firefox, `chrome` in Chrome
- All code imports from there; no direct `browser.*` or `chrome.*` calls

**`unlimitedStorage` permission (Chrome only)**
- Chrome manifest: `optional_permissions: ["unlimitedStorage", "bookmarks"]`
- Firefox manifest: `optional_permissions: ["bookmarks"]` (no unlimitedStorage — not valid in Firefox)
- Storage warning threshold: 9 MB (in `shared/storage.ts`)

**Default / static dev data**
- `STATIC_BOOKMARKS` + `STATIC_FOLDERS` live in `shared/data/static.ts`
- `getFolders()` falls back to `STATIC_FOLDERS` when storage is empty
- Default settings use a single static provider so the extension works out of the box

## File map

```
shared/
  types.ts            — all TypeScript interfaces and the ProviderConfig union
  browser.ts          — Firefox/Chrome API shim
  storage.ts          — storage read/write helpers, storage warning logic
  bookmarks.ts        — getFaviconUrl, bookmarksToMap, mergeIntoMap,
                        computeFolderMembership (no trimBookmark — providers handle trimming)
  validation.ts       — validateBookmarks() + entryToBookmark() for the JSON provider
  providers/
    index.ts          — createProvider(config) factory
    static.ts         — StaticProvider
    json.ts           — JsonProvider
    browser.ts        — BrowserProvider (chrome.bookmarks, requests permission lazily)
    linkding.ts       — LinkdingProvider (paginated Linkding REST API)
  data/
    static.ts         — STATIC_BOOKMARKS (17 items) + STATIC_FOLDERS (Crowdsourcing, Fediverse)

src/
  background/background.ts   — service worker: provider loop, alarms, message handler
  newtab/newtab.ts           — renders folders + bookmark list; storage change listener;
                               storage warning banner
  newtab/newtab.html/css
  popup/popup.ts             — same rendering, popup dimensions; <details>/<summary>;
                               middle-click folder name → open all in new tabs
  popup/popup.html/css
  options/options.ts         — provider management UI + folder/rule editor
  options/options.html/css

manifests/
  manifest.shared.json       — everything common to both browsers (no version field; injected from package.json at build)
  manifest.chrome.json       — Chrome-exclusive only: background.service_worker + unlimitedStorage
  manifest.firefox.json      — Firefox-exclusive only: background.scripts + browser_specific_settings
  (build deep-merges shared + browser file; arrays are unioned — see webpack.config.ts)

public/icons/
  icon48.png / icon128.png   — placeholder blue-circle icons

webpack.config.ts            — parameterised by --env browser=chrome|firefox
                               @shared/* alias resolves to shared/
```

## Linkding API notes

Base URL: user-configured per provider. Auth: `Authorization: Token <token>` header.

Pagination: follows `next` links until exhausted (100 results per page).

## What's missing / next steps

**Functional gaps**
- [ ] Deletion handling — full sync replaces the whole map, so deletions from Linkding/browser are caught. But if a provider is removed, its bookmarks linger in storage until the next sync. TODO: filter map by active provider IDs after sync.
- [ ] Manual JSON import UI — `validateBookmarks()` exists in `validation.ts` and the options page has a JSON textarea, but there's no live validation feedback shown to the user
- [ ] Per-provider incremental sync — Linkding supports `modified_since`; could speed up large collections
- [ ] Options page does not yet request host permission for Linkding URLs (optional_host_permissions)
- [ ] CSS is minimal placeholder — all three pages need proper styling
- [ ] Real icons — replace `public/icons/icon{48,128}.png` with actual artwork

**Nice to have**
- [ ] Folder ordering (drag to reorder)
- [ ] Bookmark ordering within folders
- [ ] Search/filter within the new tab page
- [ ] "Open in Linkding" context on individual bookmarks
- [ ] Error state UI when sync fails
- [ ] Show last sync timestamp in the new tab header

## Code style notes

- All variable names, comments, and output strings in English
- Prefer explicit types over inference where it aids readability
- No default exports except `shared/browser.ts`
- CSS variables not yet introduced — when doing a styling pass, consider a `:root` token set shared across all three pages

# Project notes for Claude

## What this is

`linkding-ext` — a browser extension for [Linkding](https://github.com/sissbruecker/linkding) (self-hosted bookmark manager). Replaces the New Tab page with a folder-based bookmark launcher; also adds a toolbar popup for quick access. TypeScript, targets Firefox and Chrome from one codebase. Built iteratively with Claude starting 2026-06-22.

## Build & tooling

- **Package manager: pnpm** (not npm — `package-lock.json` is gitignored)
- `pnpm type-check` — `tsc --noEmit`, should be clean
- `pnpm build` — produces `dist/chrome/` and `dist/firefox/` via webpack
- Load in Firefox: `about:debugging` → Load Temporary Add-on → `dist/firefox/manifest.json`
- Load in Chrome: `chrome://extensions` → Enable developer mode → Load unpacked → `dist/chrome/`
- **Version bumping:** increment the patch version in `manifests/manifest.shared.json` by 1 whenever building something the user should test in the browser (early development convention)

## Architecture decisions (already made, don't revisit)

**Storage layout** (`chrome.storage.local` / `browser.storage.local`)
- Bookmarks stored as `BookmarkMap` — flat `Record<number, Bookmark>` keyed by Linkding bookmark ID
- Folders stored as `Folder[]` — each has user-defined rules and a precomputed `bookmark_ids: number[]`
- `bookmark_ids` recomputed in background worker after every sync, not at render time
- `lastSync` stored as ISO string, used as cursor for `modified_since` incremental API queries
- `date_modified` intentionally NOT stored per-bookmark — it only lives on the API response

**Favicon strategy**
- `favicon_url` is optional on `Bookmark` — only stored when Linkding returns a non-standard URL
- Fallback at render time: `${new URL(bookmark.url).origin}/favicon.ico`
- No third-party favicon services

**Sync flow**
- Background service worker owns all sync logic
- Two triggers: `chrome.alarms` (configurable interval, default 15 min) and `sync_requested` message from any UI page
- Debounced: won't sync more than once per minute regardless of trigger source
- Incremental by default (`modified_since`), full sync only on first install or empty cache
- Deletions from Linkding are not handled yet (see "What's missing")
- `useStaticData: true` in default settings — uses `shared/data/static.ts` instead of real API; no Linkding connection needed for development
- `getFolders()` falls back to `STATIC_FOLDERS` when storage is empty (so there's always something to render during development)

**Folder rules**
```typescript
interface FolderRules {
  match: "all" | "any";   // AND / OR
  conditions: RuleCondition[];
}
type ConditionType = "tag" | "url_contains" | "title_contains";
```
A bookmark can appear in multiple folders. No "uncategorized" folder — the extension is a curated launcher, not a full bookmark browser.

**Browser API abstraction**
- `shared/browser.ts` exports a single `ext` object — `browser` in Firefox, `chrome` cast to the same type in Chrome
- All code imports from there; no direct `browser.*` or `chrome.*` calls anywhere else

**`unlimitedStorage` permission**
- Chrome manifest only — declared as `optional_permissions`, never requested at install time
- Requested at runtime only when `storage.local` usage exceeds 9 MB (`STORAGE_WARNING_BYTES` in `storage.ts`)
- Firefox has no storage quota, so `unlimitedStorage` is omitted from the Firefox manifest entirely (it's not a valid Firefox optional permission)
- Background worker sets `needsUnlimitedStorage: true` in storage; UI reacts via `storage.onChanged` and shows a banner with a button that triggers `permissions.request()` (must be a user gesture)

## File map

```
shared/
  types.ts          — all TypeScript interfaces (Bookmark, Folder, FolderRules,
                      RuleCondition, Settings, StorageSchema, LinkdingBookmark, etc.)
  browser.ts        — Firefox/Chrome API shim
  storage.ts        — storage read/write helpers, storage warning logic
  bookmarks.ts      — trimBookmark, getFaviconUrl, bookmarksToMap,
                      mergeIntoMap, computeFolderMembership
  api.ts            — Linkding REST client (fetchAllBookmarks, fetchModifiedSince)
  validation.ts     — validateBookmarks() for manually provided JSON
  data/static.ts    — STATIC_BOOKMARKS (17 hardcoded bookmarks) + STATIC_FOLDERS
                      (2 default folders: Crowdsourcing, Fediverse) for development

src/
  background/background.ts   — service worker: sync orchestration, alarms, message handler
  newtab/newtab.ts           — renders BookmarkMap + Folder[] into folder sections;
                               listens for storage changes, shows storage warning banner
  newtab/newtab.html/css
  popup/popup.ts             — same rendering logic, trimmed for popup dimensions,
                               uses <details>/<summary> for collapsible folders;
                               opens bookmarks via ext.tabs.create (required in MV3 popups)
  popup/popup.html/css
  options/options.ts         — settings form + folder/rule editor (add/remove folders,
                               add/remove conditions per folder); saves then triggers sync
  options/options.html/css

manifests/
  manifest.chrome.json       — background.service_worker, optional_permissions: [unlimitedStorage]
  manifest.firefox.json      — background.scripts + browser_specific_settings.gecko;
                               NO unlimitedStorage (not a valid Firefox optional permission)
  manifest.shared.json       — reference only, not used by build

public/icons/
  icon48.png / icon128.png   — placeholder blue-circle icons

webpack.config.ts            — single config, parameterised by --env browser=chrome|firefox
                               outputs to dist/chrome/ or dist/firefox/
                               @shared/* path alias resolves to shared/
```

## Linkding API notes

Base URL: user-configured. Auth: `Authorization: Token <token>` header.

Relevant endpoints:
```
GET /api/bookmarks/?limit=1000
GET /api/bookmarks/?modified_since=<ISO8601>&limit=1000
```

Response shape: `{ count, next, results: LinkdingBookmark[] }`

Fields kept after trimming: `id`, `url`, `title`, `tag_names`, `favicon_url` (optional).

## What's missing / next steps

**Functional gaps**
- [ ] Pagination — `api.ts` uses `limit=1000` as a shortcut; large collections need to follow `next` links
- [ ] Deletion handling — incremental sync via `modified_since` does not detect deleted bookmarks; need either a periodic full sync (e.g. daily) or ID diffing
- [ ] Manual JSON import UI — `validateBookmarks()` exists in `validation.ts` but is not yet wired into the options page
- [ ] Options page does not yet request host permission for the Linkding URL — when the user saves a URL, `optional_host_permissions` should be requested for that origin via `browser.permissions.request({ origins: [\`${origin}/*\`] })`
- [ ] CSS is minimal placeholder only — all three pages need proper styling
- [ ] Real icons — replace `public/icons/icon{48,128}.png` with actual artwork

**Nice to have**
- [ ] Folder ordering (drag to reorder)
- [ ] Bookmark ordering within folders
- [ ] Search/filter within the new tab page
- [ ] "Open in Linkding" context on individual bookmarks
- [ ] Error state UI when sync fails (currently only `console.error`)
- [ ] Show last sync timestamp in the new tab header

## Code style notes

- All variable names, comments, and output strings in English
- Prefer explicit types over inference where it aids readability
- No default exports except `shared/browser.ts`
- CSS variables not yet introduced — when doing a styling pass, consider a `:root` token set shared across all three pages

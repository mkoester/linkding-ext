import ext from "@shared/browser";
import { getBookmarks, getFolders, getSyncStatus } from "@shared/storage";
import { renderFavicon } from "@shared/favicon";
import { applyStoredTheme } from "@shared/theme";
import { renderSyncErrorBanner } from "@shared/syncBanner";
import { isAllowedBookmarkUrl } from "@shared/url";
import type { Bookmark, BookmarkMap, Folder, Message, SyncStatus } from "@shared/types";

// The sidebar mirrors the popup's folder rendering, but it stays open, so it
// re-renders on storage changes and opens bookmarks in the current tab instead
// of closing itself.

// Skip re-rendering (and aborting in-flight favicon loads) when a sync writes
// back data that's identical to what's already on screen.
let lastRenderKey = "";

async function init(): Promise<void> {
  await applyStoredTheme();
  registerForToggle();

  await render();
  requestSync();
  listenForChanges();

  document.getElementById("open-options")?.addEventListener("click", () => {
    ext.runtime.openOptionsPage();
  });
}

// Chromium only: register this panel (keyed by window) with the background so the keyboard
// shortcut can toggle it shut — Chrome can't reliably close a global side panel from the API, but
// the panel can close itself with window.close(). Firefox's sidebar toggles natively, so skip it.
async function registerForToggle(): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.sidePanel) return;
  try {
    const win = await ext.windows.getCurrent();
    const port = ext.runtime.connect({ name: `sidepanel:${win.id ?? -1}` });
    port.onMessage.addListener((msg: { type?: string }) => {
      if (msg?.type === "close") window.close();
    });
  } catch {
    // best-effort; if this fails, the shortcut just always opens (never toggles closed)
  }
}

// ---- Render -----------------------------------------------------------------

async function render(): Promise<void> {
  const [bookmarkMap, folders, syncStatus] = await Promise.all([
    getBookmarks(),
    getFolders(),
    getSyncStatus(),
  ]);

  const key = JSON.stringify({ bookmarkMap, folders, syncStatus });
  if (key === lastRenderKey) return;
  lastRenderKey = key;

  renderBanner(syncStatus);
  renderFolders(bookmarkMap, folders);
}

function renderBanner(syncStatus: SyncStatus | null): void {
  const slot = document.getElementById("sync-error")!;
  slot.innerHTML = "";
  const banner = renderSyncErrorBanner(syncStatus);
  if (banner) slot.appendChild(banner);
}

function renderFolders(bookmarkMap: BookmarkMap, folders: Folder[]): void {
  const container = document.getElementById("folders")!;
  container.innerHTML = "";

  if (folders.length === 0) {
    container.innerHTML = '<p class="empty">No folders configured.</p>';
    return;
  }

  for (const folder of folders) {
    container.appendChild(renderFolder(folder, bookmarkMap));
  }
}

function renderFolder(folder: Folder, bookmarkMap: BookmarkMap): HTMLElement {
  const details = document.createElement("details");
  details.open = true;

  const summary = document.createElement("summary");
  summary.textContent = folder.name;
  // Middle-click the folder name: open all its bookmarks in background tabs.
  summary.addEventListener("mousedown", (e) => {
    if (e.button !== 1) return;
    e.preventDefault();
    const bookmarks = folder.bookmark_ids
      .map((id) => bookmarkMap[id])
      .filter((b): b is Bookmark => b != null && isAllowedBookmarkUrl(b.url));
    for (const bookmark of bookmarks) {
      ext.tabs.create({ url: bookmark.url, active: false });
    }
  });
  details.appendChild(summary);

  const ul = document.createElement("ul");
  for (const id of folder.bookmark_ids) {
    const bookmark = bookmarkMap[id];
    if (bookmark) ul.appendChild(renderBookmark(bookmark));
  }
  details.appendChild(ul);

  return details;
}

function renderBookmark(bookmark: Bookmark): HTMLElement {
  const li = document.createElement("li");
  const a = document.createElement("a");
  const safe = isAllowedBookmarkUrl(bookmark.url);
  a.href = safe ? bookmark.url : "#";
  if (!safe) a.title = "Blocked: unsupported link type";

  // Left-click: navigate the current tab (the sidebar stays open). Middle-click
  // is left to the native anchor behaviour, which opens a background tab.
  a.addEventListener("click", (e) => {
    e.preventDefault();
    if (!safe) return;
    ext.tabs.update({ url: bookmark.url });
  });

  const span = document.createElement("span");
  span.textContent = bookmark.title;

  a.appendChild(renderFavicon(bookmark, 14));
  a.appendChild(span);
  li.appendChild(a);
  return li;
}

// ---- Sync & live updates ----------------------------------------------------

function requestSync(): void {
  const message: Message = { type: "sync_requested" };
  ext.runtime.sendMessage(message).catch(() => {
    // background worker may not be ready yet on first load
  });
}

function listenForChanges(): void {
  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.bookmarks || changes.folders || changes.syncStatus) {
      render();
    }
    if (changes.settings) {
      applyStoredTheme();
    }
  });
}

document.addEventListener("DOMContentLoaded", init);

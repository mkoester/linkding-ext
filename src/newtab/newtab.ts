import ext from "@shared/browser";
import { getBookmarks, getFolders, getSyncStatus } from "@shared/storage";
import { renderFavicon } from "@shared/favicon";
import { applyStoredTheme } from "@shared/theme";
import { renderSyncErrorBanner } from "@shared/syncBanner";
import { isAllowedBookmarkUrl } from "@shared/url";
import type { Bookmark, BookmarkMap, Folder, Message, SyncStatus } from "@shared/types";

// Skip re-rendering (and aborting in-flight favicon loads) when a sync writes
// back data that's identical to what's already on screen.
let lastRenderKey = "";

// ---- Init -------------------------------------------------------------------

// The new-tab override is always declared, but whether this page is shown at all is the browser's
// call: Firefox/Chromium ask the user to keep or revert the extension's new-tab control (browsers
// block any script-side redirect back to the native page — about:home/about:blank are denied). So
// if we're running here, the user opted in — just render the launcher.
async function init(): Promise<void> {
  await applyStoredTheme();

  document.getElementById("open-settings")?.addEventListener("click", () => {
    ext.runtime.openOptionsPage();
  });

  await render();
  requestSync();
  listenForChanges();
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
    container.innerHTML =
      '<p class="empty">No folders configured yet. Open <a href="#" id="open-options">settings</a> to get started.</p>';
    document.getElementById("open-options")?.addEventListener("click", (e) => {
      e.preventDefault();
      ext.runtime.openOptionsPage();
    });
    return;
  }

  for (const folder of folders) {
    container.appendChild(renderFolder(folder, bookmarkMap));
  }
}

function renderFolder(folder: Folder, bookmarkMap: BookmarkMap): HTMLElement {
  const section = document.createElement("section");
  section.className = "folder";

  const heading = document.createElement("h2");
  heading.textContent = folder.name;
  section.appendChild(heading);

  const list = document.createElement("ul");

  for (const id of folder.bookmark_ids) {
    const bookmark = bookmarkMap[id];
    if (bookmark) {
      list.appendChild(renderBookmark(bookmark));
    }
  }

  section.appendChild(list);
  return section;
}

function renderBookmark(bookmark: Bookmark): HTMLElement {
  const li = document.createElement("li");
  const a = document.createElement("a");

  // Defensive: only link out to safe schemes. A `javascript:` URL clicked here
  // would run in this privileged extension page, so a bad bookmark is neutered.
  if (isAllowedBookmarkUrl(bookmark.url)) {
    a.href = bookmark.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  } else {
    a.href = "#";
    a.title = "Blocked: unsupported link type";
    a.addEventListener("click", (e) => e.preventDefault());
  }

  const span = document.createElement("span");
  span.textContent = bookmark.title;

  a.appendChild(renderFavicon(bookmark, 16));
  a.appendChild(span);
  li.appendChild(a);
  return li;
}

// ---- Sync -------------------------------------------------------------------

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

// ---- Boot -------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", init);

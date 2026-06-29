import ext from "@shared/browser";
import { getBookmarks, getFolders } from "@shared/storage";
import { renderFavicon } from "@shared/favicon";
import type { Bookmark, BookmarkMap, Folder, Message } from "@shared/types";

// The sidebar mirrors the popup's folder rendering, but it stays open, so it
// re-renders on storage changes and opens bookmarks in the current tab instead
// of closing itself.

// Skip re-rendering (and aborting in-flight favicon loads) when a sync writes
// back data that's identical to what's already on screen.
let lastRenderKey = "";

async function init(): Promise<void> {
  await render();
  requestSync();
  listenForChanges();

  document.getElementById("open-options")?.addEventListener("click", () => {
    ext.runtime.openOptionsPage();
  });
}

// ---- Render -----------------------------------------------------------------

async function render(): Promise<void> {
  const [bookmarkMap, folders] = await Promise.all([
    getBookmarks(),
    getFolders(),
  ]);

  const key = JSON.stringify({ bookmarkMap, folders });
  if (key === lastRenderKey) return;
  lastRenderKey = key;

  renderFolders(bookmarkMap, folders);
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
      .filter((b): b is Bookmark => b != null);
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
  a.href = bookmark.url;

  // Left-click: navigate the current tab (the sidebar stays open). Middle-click
  // is left to the native anchor behaviour, which opens a background tab.
  a.addEventListener("click", (e) => {
    e.preventDefault();
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
    if (changes.bookmarks || changes.folders) {
      render();
    }
  });
}

document.addEventListener("DOMContentLoaded", init);

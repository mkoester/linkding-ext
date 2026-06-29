import ext from "@shared/browser";
import { getBookmarks, getFolders } from "@shared/storage";
import { renderFavicon } from "@shared/favicon";
import type { Bookmark, BookmarkMap, Folder, Message } from "@shared/types";

// Skip re-rendering (and aborting in-flight favicon loads) when a sync writes
// back data that's identical to what's already on screen.
let lastRenderKey = "";

// ---- Init -------------------------------------------------------------------

async function init(): Promise<void> {
  await render();
  requestSync();
  listenForChanges();
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
  a.href = bookmark.url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";

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
    if (changes.bookmarks || changes.folders) {
      render();
    }
  });
}

// ---- Boot -------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", init);

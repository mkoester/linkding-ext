import ext from "@shared/browser";
import { getBookmarks, getFolders } from "@shared/storage";
import { renderFavicon } from "@shared/favicon";
import type { Bookmark, BookmarkMap, Folder, Message } from "@shared/types";

async function init(): Promise<void> {
  const [bookmarkMap, folders] = await Promise.all([
    getBookmarks(),
    getFolders(),
  ]);

  renderFolders(bookmarkMap, folders);

  document.getElementById("open-options")?.addEventListener("click", () => {
    ext.runtime.openOptionsPage();
    window.close();
  });

  const message: Message = { type: "sync_requested" };
  ext.runtime.sendMessage(message).catch(() => {});
}

function renderFolders(bookmarkMap: BookmarkMap, folders: Folder[]): void {
  const container = document.getElementById("folders")!;

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
  summary.addEventListener("mousedown", (e) => {
    if (e.button !== 1) return;
    e.preventDefault();
    const bookmarks = folder.bookmark_ids
      .map((id) => bookmarkMap[id])
      .filter((b): b is Bookmark => b != null);
    for (const bookmark of bookmarks) {
      ext.tabs.create({ url: bookmark.url });
    }
    window.close();
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

  a.addEventListener("click", (e) => {
    e.preventDefault();
    ext.tabs.create({ url: bookmark.url });
    window.close();
  });

  const span = document.createElement("span");
  span.textContent = bookmark.title;

  a.appendChild(renderFavicon(bookmark, 14));
  a.appendChild(span);
  li.appendChild(a);
  return li;
}

document.addEventListener("DOMContentLoaded", init);

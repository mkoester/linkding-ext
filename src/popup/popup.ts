import ext from "@shared/browser";
import { getBookmarks, getFolders, getSettings } from "@shared/storage";
import { getFaviconUrl } from "@shared/bookmarks";
import type { Bookmark, BookmarkMap, Folder, Message } from "@shared/types";

async function init(): Promise<void> {
  const [bookmarkMap, folders, settings] = await Promise.all([
    getBookmarks(),
    getFolders(),
    getSettings(),
  ]);

  renderFolders(bookmarkMap, folders);

  document.getElementById("open-options")?.addEventListener("click", () => {
    ext.runtime.openOptionsPage();
    window.close();
  });

  const linkdingBtn = document.getElementById("open-linkding")!;
  if (settings.linkdingUrl) {
    linkdingBtn.addEventListener("click", () => {
      ext.tabs.create({ url: settings.linkdingUrl! });
      window.close();
    });
  } else {
    linkdingBtn.setAttribute("disabled", "true");
  }

  // trigger a background sync but don't wait for it
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

  const img = document.createElement("img");
  img.src = getFaviconUrl(bookmark);
  img.alt = "";
  img.width = 14;
  img.height = 14;
  img.onerror = () => { img.style.display = "none"; };

  const span = document.createElement("span");
  span.textContent = bookmark.title;

  a.appendChild(img);
  a.appendChild(span);
  li.appendChild(a);
  return li;
}

document.addEventListener("DOMContentLoaded", init);

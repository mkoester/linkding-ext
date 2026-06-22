import ext from "@shared/browser";
import { getBookmarks, getFolders, requestUnlimitedStorage } from "@shared/storage";
import { getFaviconUrl } from "@shared/bookmarks";
import type { Bookmark, BookmarkMap, Folder } from "@shared/types";
import type { Message } from "@shared/types";

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

  const img = document.createElement("img");
  img.src = getFaviconUrl(bookmark);
  img.alt = "";
  img.width = 16;
  img.height = 16;
  img.onerror = () => { img.style.display = "none"; };

  const span = document.createElement("span");
  span.textContent = bookmark.title;

  a.appendChild(img);
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

    if (changes.needsUnlimitedStorage?.newValue === true) {
      document.getElementById("storage-warning")?.classList.remove("hidden");
    }
  });

  document
    .getElementById("request-storage")
    ?.addEventListener("click", async () => {
      const granted = await requestUnlimitedStorage();
      if (granted) {
        await ext.storage.local.remove("needsUnlimitedStorage");
        document.getElementById("storage-warning")?.classList.add("hidden");
      }
    });
}

// ---- Boot -------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", init);

import ext from "./browser";
import type { BookmarkMap, Folder, Settings, StorageSchema } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { STATIC_FOLDERS } from "./data/static";

const STORAGE_WARNING_BYTES = 9 * 1024 * 1024; // 9 MB

export async function getSettings(): Promise<Settings> {
  const result = await ext.storage.local.get("settings");
  return (result.settings as Settings) ?? DEFAULT_SETTINGS;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await ext.storage.local.set({ settings });
}

export async function getBookmarks(): Promise<BookmarkMap> {
  const result = await ext.storage.local.get("bookmarks");
  return (result.bookmarks as BookmarkMap) ?? {};
}

export async function getFolders(): Promise<Folder[]> {
  const result = await ext.storage.local.get("folders");
  return (result.folders as Folder[]) ?? STATIC_FOLDERS;
}

export async function saveFolders(folders: Folder[]): Promise<void> {
  await ext.storage.local.set({ folders });
}

export async function getLastSync(): Promise<string | null> {
  const result = await ext.storage.local.get("lastSync");
  return (result.lastSync as string) ?? null;
}

export async function saveBookmarksAndSync(
  bookmarks: BookmarkMap,
  folders: Folder[],
  lastSync: string
): Promise<void> {
  const update: Partial<StorageSchema> = { bookmarks, folders, lastSync };

  // Check storage usage before writing (getBytesInUse is not available in all browsers)
  if (typeof ext.storage.local.getBytesInUse === "function") {
    const bytes = await ext.storage.local.getBytesInUse(null);
    if (bytes > STORAGE_WARNING_BYTES) {
      await ext.storage.local.set({ needsUnlimitedStorage: true });
    }
  }

  await ext.storage.local.set(update);
}

export async function requestUnlimitedStorage(): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ext.permissions.request({ permissions: ["unlimitedStorage" as any] });
}

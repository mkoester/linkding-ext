import ext from "./browser";
import type { BookmarkMap, Folder, Settings, StorageSchema, SyncStatus } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { STATIC_FOLDERS } from "./data/static";

export async function getSettings(): Promise<Settings> {
  const result = await ext.storage.local.get("settings");
  const stored = result.settings as Partial<Settings> | undefined;
  if (!stored) return DEFAULT_SETTINGS;
  // Backfill fields added after this install first saved its settings.
  return { ...DEFAULT_SETTINGS, ...stored };
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
  await ext.storage.local.set(update);
}

export async function getSyncStatus(): Promise<SyncStatus | null> {
  const result = await ext.storage.local.get("syncStatus");
  return (result.syncStatus as SyncStatus) ?? null;
}

export async function saveSyncStatus(status: SyncStatus): Promise<void> {
  await ext.storage.local.set({ syncStatus: status });
}

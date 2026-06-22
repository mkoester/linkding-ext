import ext from "@shared/browser";
import { fetchAllBookmarks, fetchModifiedSince } from "@shared/api";
import {
  getBookmarks,
  getFolders,
  getLastSync,
  getSettings,
  saveBookmarksAndSync,
} from "@shared/storage";
import {
  bookmarksToMap,
  computeFolderMembership,
  mergeIntoMap,
} from "@shared/bookmarks";
import { STATIC_BOOKMARKS } from "@shared/data/static";
import type { Message } from "@shared/types";

const SYNC_ALARM = "linkding-sync";
const MIN_SYNC_INTERVAL_MS = 60_000; // 1 minute debounce

let syncing = false;
let lastSyncAttempt = 0;

// ---- Setup ------------------------------------------------------------------

ext.runtime.onInstalled.addListener(async () => {
  console.log("Extension installed, running initial sync");
  await setupAlarm();
  await sync();
});

ext.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM) {
    sync();
  }
});

// ---- Message handling -------------------------------------------------------

ext.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    if (message.type === "sync_requested") {
      sync();
      sendResponse({ accepted: true });
    }
    return false;
  }
);

// ---- Alarm ------------------------------------------------------------------

async function setupAlarm(): Promise<void> {
  const settings = await getSettings();
  await ext.alarms.clearAll();
  ext.alarms.create(SYNC_ALARM, {
    periodInMinutes: settings.syncIntervalMinutes,
  });
}

// ---- Sync -------------------------------------------------------------------

async function sync(): Promise<void> {
  if (syncing) {
    console.log("Sync already in progress, skipping");
    return;
  }

  const now = Date.now();
  if (now - lastSyncAttempt < MIN_SYNC_INTERVAL_MS) {
    console.log("Sync debounced, too soon since last attempt");
    return;
  }

  syncing = true;
  lastSyncAttempt = now;

  try {
    const settings = await getSettings();

    if (settings.useStaticData) {
      await syncStatic();
    } else {
      await syncLinkding();
    }
  } catch (error) {
    console.error("Sync failed:", error);
  } finally {
    syncing = false;
  }
}

async function syncStatic(): Promise<void> {
  console.log("Using static bookmark data");
  const bookmarkMap = bookmarksToMap(STATIC_BOOKMARKS);
  const folders = await getFolders();
  const recomputed = computeFolderMembership(bookmarkMap, folders);
  await saveBookmarksAndSync(bookmarkMap, recomputed, new Date().toISOString());
}

async function syncLinkding(): Promise<void> {
  const lastSync = await getLastSync();
  const existing = await getBookmarks();

  let updatedMap;

  if (!lastSync || Object.keys(existing).length === 0) {
    console.log("Full sync from Linkding");
    const response = await fetchAllBookmarks();
    updatedMap = bookmarksToMap(
      response.results.map((b) => ({
        id: b.id,
        url: b.url,
        title: b.title || b.url,
        tag_names: b.tag_names,
        ...(b.favicon_url ? { favicon_url: b.favicon_url } : {}),
      }))
    );
  } else {
    console.log(`Incremental sync since ${lastSync}`);
    const response = await fetchModifiedSince(lastSync);
    if (response.results.length === 0) {
      console.log("No changes since last sync");
      return;
    }
    updatedMap = mergeIntoMap(existing, response.results);
  }

  const folders = await getFolders();
  const recomputed = computeFolderMembership(updatedMap, folders);
  await saveBookmarksAndSync(updatedMap, recomputed, new Date().toISOString());
  console.log(`Sync complete: ${Object.keys(updatedMap).length} bookmarks`);
}

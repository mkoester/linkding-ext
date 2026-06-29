import ext from "@shared/browser";
import { getBookmarks, getFolders, getSettings, saveBookmarksAndSync } from "@shared/storage";
import { bookmarksToMap, computeFolderMembership } from "@shared/bookmarks";
import { createProvider } from "@shared/providers/index";
import type { Message } from "@shared/types";

const SYNC_ALARM = "bookmarks-plus-sync";
const MIN_SYNC_INTERVAL_MS = 60_000;

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
      // Explicit user-initiated sync: bypass the time-based debounce.
      sync(true);
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

async function sync(force = false): Promise<void> {
  if (syncing) {
    console.log("Sync already in progress, skipping");
    return;
  }

  const now = Date.now();
  if (!force && now - lastSyncAttempt < MIN_SYNC_INTERVAL_MS) {
    console.log("Sync debounced, too soon since last attempt");
    return;
  }

  syncing = true;
  lastSyncAttempt = now;

  try {
    const settings = await getSettings();
    const allBookmarks = [];

    for (const config of settings.providers) {
      try {
        const provider = createProvider(config);
        const bookmarks = await provider.sync();
        allBookmarks.push(...bookmarks);
        console.log(`Provider "${config.name}": ${bookmarks.length} bookmarks`);
      } catch (err) {
        console.error(`Provider "${config.name}" sync failed:`, err);
      }
    }

    const map = bookmarksToMap(allBookmarks);
    const folders = await getFolders();
    const recomputed = computeFolderMembership(map, folders);
    await saveBookmarksAndSync(map, recomputed, new Date().toISOString());
    console.log(`Sync complete: ${allBookmarks.length} bookmarks total`);
  } catch (error) {
    console.error("Sync failed:", error);
  } finally {
    syncing = false;
  }
}

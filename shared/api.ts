import type { LinkdingResponse } from "./types";
import { getSettings } from "./storage";

async function apiFetch(path: string): Promise<LinkdingResponse> {
  const settings = await getSettings();

  if (!settings.linkdingUrl || !settings.linkdingToken) {
    throw new Error("Linkding URL and token are not configured");
  }

  const url = new URL(path, settings.linkdingUrl).toString();

  const response = await fetch(url, {
    headers: {
      Authorization: `Token ${settings.linkdingToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Linkding API error: HTTP ${response.status}`);
  }

  return response.json() as Promise<LinkdingResponse>;
}

export async function fetchAllBookmarks(): Promise<LinkdingResponse> {
  return apiFetch("/api/bookmarks/?limit=1000");
}

export async function fetchModifiedSince(since: string): Promise<LinkdingResponse> {
  return apiFetch(`/api/bookmarks/?modified_since=${encodeURIComponent(since)}&limit=1000`);
}

import type { Bookmark, BookmarkProvider, JsonProviderConfig } from "../types";
import { validateBookmarks, entryToBookmark } from "../validation";

export class JsonProvider implements BookmarkProvider {
  constructor(private config: JsonProviderConfig) {}

  async sync(): Promise<Bookmark[]> {
    if (!this.config.data.trim()) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(this.config.data);
    } catch {
      console.error(`Provider "${this.config.name}": invalid JSON`);
      return [];
    }

    const result = validateBookmarks(parsed);
    if (!result.valid) {
      console.error(`Provider "${this.config.name}": validation errors:`, result.errors);
      return [];
    }

    return (parsed as Record<string, unknown>[]).map((entry, i) =>
      entryToBookmark(entry, i, this.config.id)
    );
  }
}

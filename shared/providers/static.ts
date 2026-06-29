import type { Bookmark, BookmarkProvider, StaticProviderConfig } from "../types";
import { STATIC_BOOKMARKS } from "../data/static";

export class StaticProvider implements BookmarkProvider {
  constructor(private config: StaticProviderConfig) {}

  async sync(): Promise<Bookmark[]> {
    return STATIC_BOOKMARKS.map((b) => ({
      ...b,
      id: `${this.config.id}:${b.id}`,
    }));
  }
}

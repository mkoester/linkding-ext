import ext from "../browser";
import type { Bookmark, BookmarkProvider, BrowserProviderConfig } from "../types";

export class BrowserProvider implements BookmarkProvider {
  constructor(private config: BrowserProviderConfig) {}

  async sync(): Promise<Bookmark[]> {
    console.log(`[BrowserProvider "${this.config.name}"] sync started`);

    const granted = await ext.permissions.contains({ permissions: ["bookmarks"] });
    console.log(`[BrowserProvider "${this.config.name}"] bookmarks permission granted: ${granted}`);
    if (!granted) {
      console.warn(`[BrowserProvider "${this.config.name}"] permission not granted — request it from the options page`);
      return [];
    }

    const tree = await ext.bookmarks.getTree();
    console.log(`[BrowserProvider "${this.config.name}"] raw tree:`, tree);

    const bookmarks: Bookmark[] = [];
    this.walk(tree, [], bookmarks);

    console.log(`[BrowserProvider "${this.config.name}"] imported ${bookmarks.length} bookmarks`);
    if (bookmarks.length > 0) {
      console.log(`[BrowserProvider "${this.config.name}"] sample (first 3):`, bookmarks.slice(0, 3));
    }

    return bookmarks;
  }

  private walk(
    nodes: chrome.bookmarks.BookmarkTreeNode[],
    folderPath: string[],
    out: Bookmark[]
  ): void {
    for (const node of nodes) {
      if (node.url) {
        const bookmark: Bookmark = {
          id: `${this.config.id}:${node.id}`,
          url: node.url,
          title: node.title || node.url,
          tag_names: [...folderPath],
        };
        console.log(`[BrowserProvider "${this.config.name}"] bookmark: "${bookmark.title}" tags=[${bookmark.tag_names.join(", ")}]`);
        out.push(bookmark);
      } else if (node.children) {
        const newPath = node.title ? [...folderPath, node.title] : folderPath;
        if (node.title) {
          console.log(`[BrowserProvider "${this.config.name}"] entering folder: ${newPath.join(" / ")}`);
        }
        this.walk(node.children, newPath, out);
      }
    }
  }
}

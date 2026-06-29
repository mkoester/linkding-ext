import { getFaviconUrl } from "./bookmarks";
import type { Bookmark } from "./types";

// Builds a favicon <img> for a bookmark. If the site's favicon can't be loaded
// (404, or a non-image response blocked by Firefox's OpaqueResponseBlocking),
// it swaps in a generated letter tile instead of leaving an empty gap.
export function renderFavicon(bookmark: Bookmark, size: number): HTMLImageElement {
  const img = document.createElement("img");
  img.width = size;
  img.height = size;
  img.alt = "";
  img.src = getFaviconUrl(bookmark);
  img.addEventListener(
    "error",
    () => { img.src = letterTile(bookmark); },
    { once: true }
  );
  return img;
}

// A deterministic colored square with the site's initial, as an inline SVG data
// URL (crisp at any size, no network request).
function letterTile(bookmark: Bookmark): string {
  let initial = "?";
  try {
    initial = new URL(bookmark.url).hostname.replace(/^www\./, "")[0] ?? "?";
  } catch {
    initial = bookmark.title[0] ?? "?";
  }
  const letter = escapeXml(initial.toUpperCase());
  const hue = hashHue(bookmark.url);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">` +
    `<rect width="16" height="16" rx="3" fill="hsl(${hue} 45% 45%)"/>` +
    `<text x="8" y="8" dy=".35em" text-anchor="middle" ` +
    `font-family="system-ui, sans-serif" font-size="10" fill="#fff">${letter}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === "'" ? "&apos;" : "&quot;"
  );
}

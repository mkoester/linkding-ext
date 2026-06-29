import ext from "./browser";
import type { Bookmark } from "./types";

// Chrome exposes the browser's cached favicons — which include icons declared in
// the page via <link rel="icon"> — through the `_favicon` endpoint (gated on the
// "favicon" manifest permission), with no network request. Firefox has no such
// API, so there we fall back to guessing the site's /favicon.ico.
const isChrome = typeof browser === "undefined";

// Builds a favicon <img> for a bookmark. If the icon can't be loaded (404, or a
// non-image response blocked by Firefox's OpaqueResponseBlocking), it swaps in a
// generated letter tile instead of leaving an empty gap.
export function renderFavicon(bookmark: Bookmark, size: number): HTMLImageElement {
  const img = document.createElement("img");
  img.width = size;
  img.height = size;
  img.alt = "";
  img.src = faviconSrc(bookmark, size);
  img.addEventListener(
    "error",
    () => { img.src = letterTile(bookmark); },
    { once: true }
  );
  return img;
}

function faviconSrc(bookmark: Bookmark, size: number): string {
  // A favicon explicitly provided by a source (e.g. Linkding) always wins.
  if (bookmark.favicon_url) return bookmark.favicon_url;

  if (isChrome) {
    // Request at 2x for crispness on HiDPI; the <img> is still sized to `size`.
    const px = Math.max(size * 2, 32);
    // Look the favicon up by the site origin rather than the full path: favicons
    // are per-site, and the homepage is the most commonly-visited (so most likely
    // to be in the browser's favicon cache) entry for a given bookmark.
    let pageUrl = bookmark.url;
    try {
      pageUrl = new URL(bookmark.url).origin;
    } catch {
      // Keep the raw URL as a best effort if it doesn't parse.
    }
    return ext.runtime.getURL(
      `/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=${px}`
    );
  }

  try {
    return `${new URL(bookmark.url).origin}/favicon.ico`;
  } catch {
    return letterTile(bookmark);
  }
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

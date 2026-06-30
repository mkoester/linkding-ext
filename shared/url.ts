// Schemes a bookmark is allowed to link to. Anything else (notably `javascript:`
// and `data:`) is rejected: an extension page lives on a privileged
// chrome-extension:// / moz-extension:// origin, so a `javascript:` href clicked
// there would run script in that privileged context. Enforced both at validation
// time (JSON provider) and defensively at render time (all providers).
const ALLOWED_BOOKMARK_SCHEMES = new Set(["http:", "https:", "mailto:", "ftp:"]);

export function isAllowedBookmarkUrl(url: string): boolean {
  try {
    return ALLOWED_BOOKMARK_SCHEMES.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

// A favicon ends up as an <img src>. `javascript:`/`mailto:` make no sense there;
// allow only the web schemes plus inline data: images (used by some sources and by
// our own letter-tile fallback).
const ALLOWED_FAVICON_SCHEMES = new Set(["http:", "https:", "data:"]);

export function isAllowedFaviconUrl(url: string): boolean {
  try {
    return ALLOWED_FAVICON_SCHEMES.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

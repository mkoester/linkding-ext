import type { Bookmark } from "./types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateBookmarkEntry(b: unknown, index: number): string[] {
  const errors: string[] = [];
  const prefix = `bookmarks[${index}]`;

  if (typeof b !== "object" || b === null) {
    return [`${prefix}: must be an object`];
  }

  const bookmark = b as Record<string, unknown>;

  if (typeof bookmark.url !== "string" || !bookmark.url.trim()) {
    errors.push(`${prefix}: url must be a non-empty string`);
  } else {
    try {
      new URL(bookmark.url);
    } catch {
      errors.push(`${prefix}: url is not a valid URL`);
    }
  }

  if (typeof bookmark.title !== "string" || !bookmark.title.trim()) {
    errors.push(`${prefix}: title must be a non-empty string`);
  }

  if ("tag_names" in bookmark) {
    if (!Array.isArray(bookmark.tag_names)) {
      errors.push(`${prefix}: tag_names must be an array`);
    } else if (!bookmark.tag_names.every((t) => typeof t === "string" && t.trim())) {
      errors.push(`${prefix}: tag_names must contain only non-empty strings`);
    }
  }

  if ("favicon_url" in bookmark) {
    if (typeof bookmark.favicon_url !== "string" || !bookmark.favicon_url.trim()) {
      errors.push(`${prefix}: favicon_url must be a non-empty string when present`);
    } else {
      try {
        new URL(bookmark.favicon_url as string);
      } catch {
        errors.push(`${prefix}: favicon_url is not a valid URL`);
      }
    }
  }

  return errors;
}

export function validateBookmarks(data: unknown): ValidationResult {
  if (!Array.isArray(data)) {
    return { valid: false, errors: ["root must be an array"] };
  }

  if (data.length === 0) {
    return { valid: false, errors: ["array must not be empty"] };
  }

  const errors = data.flatMap((b, i) => validateBookmarkEntry(b, i));
  return { valid: errors.length === 0, errors };
}

// Converts a validated raw entry to a Bookmark, namespaced under providerId.
// Falls back to array index if id is absent.
export function entryToBookmark(
  entry: Record<string, unknown>,
  index: number,
  providerId: string
): Bookmark {
  const rawId =
    entry.id !== undefined && entry.id !== null
      ? String(entry.id)
      : String(index);

  return {
    id: `${providerId}:${rawId}`,
    url: entry.url as string,
    title: entry.title as string,
    tag_names: Array.isArray(entry.tag_names)
      ? (entry.tag_names as string[])
      : [],
    ...(typeof entry.favicon_url === "string" ? { favicon_url: entry.favicon_url } : {}),
  };
}

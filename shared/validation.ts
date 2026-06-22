import type { Bookmark } from "./types";

function validateBookmark(b: unknown, index: number): string[] {
  const errors: string[] = [];
  const prefix = `bookmarks[${index}]`;

  if (typeof b !== "object" || b === null) {
    return [`${prefix}: must be an object`];
  }

  const bookmark = b as Record<string, unknown>;

  if (
    typeof bookmark.id !== "number" ||
    !Number.isInteger(bookmark.id) ||
    bookmark.id < 1
  ) {
    errors.push(`${prefix}: id must be a positive integer`);
  }

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

  if (!Array.isArray(bookmark.tag_names)) {
    errors.push(`${prefix}: tag_names must be an array`);
  } else if (
    !bookmark.tag_names.every((t) => typeof t === "string" && t.trim())
  ) {
    errors.push(`${prefix}: tag_names must contain only non-empty strings`);
  }

  if ("favicon_url" in bookmark) {
    if (
      typeof bookmark.favicon_url !== "string" ||
      !bookmark.favicon_url.trim()
    ) {
      errors.push(
        `${prefix}: favicon_url must be a non-empty string when present`
      );
    } else {
      try {
        new URL(bookmark.favicon_url);
      } catch {
        errors.push(`${prefix}: favicon_url is not a valid URL`);
      }
    }
  }

  return errors;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateBookmarks(data: unknown): ValidationResult {
  if (!Array.isArray(data)) {
    return { valid: false, errors: ["root must be an array"] };
  }

  if (data.length === 0) {
    return { valid: false, errors: ["array must not be empty"] };
  }

  const errors = data.flatMap((b, i) => validateBookmark(b, i));

  const ids = data
    .filter((b) => typeof (b as Record<string, unknown>).id === "number")
    .map((b) => (b as Record<string, unknown>).id as number);

  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicates.length > 0) {
    errors.push(`duplicate ids found: ${[...new Set(duplicates)].join(", ")}`);
  }

  return { valid: errors.length === 0, errors };
}

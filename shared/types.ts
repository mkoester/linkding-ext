// ---- Bookmark ---------------------------------------------------------------

export interface Bookmark {
  id: number;
  url: string;
  title: string;
  tag_names: string[];
  favicon_url?: string;
}

export type BookmarkMap = Record<number, Bookmark>;

// ---- Folder rules -----------------------------------------------------------

export type ConditionType = "tag" | "url_contains" | "title_contains";

export interface RuleCondition {
  type: ConditionType;
  value: string;
}

export interface FolderRules {
  match: "all" | "any";
  conditions: RuleCondition[];
}

export interface Folder {
  id: string;
  name: string;
  rules: FolderRules;
  bookmark_ids: number[]; // precomputed at sync time
}

// ---- Storage schema ---------------------------------------------------------

export interface StorageSchema {
  bookmarks: BookmarkMap;
  folders: Folder[];
  lastSync: string | null;
  settings: Settings;
  needsUnlimitedStorage?: boolean;
}

// ---- Settings ---------------------------------------------------------------

export interface Settings {
  linkdingUrl: string | null;
  linkdingToken: string | null;
  syncIntervalMinutes: number;
  useStaticData: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  linkdingUrl: null,
  linkdingToken: null,
  syncIntervalMinutes: 15,
  useStaticData: true,
};

// ---- Messages ---------------------------------------------------------------

export type MessageType = "sync_requested";

export interface Message {
  type: MessageType;
}

// ---- Linkding API response --------------------------------------------------

export interface LinkdingBookmark {
  id: number;
  url: string;
  title: string;
  description: string;
  notes: string;
  web_archive_snapshot_url: string;
  favicon_url: string;
  preview_image_url: string;
  is_archived: boolean;
  unread: boolean;
  shared: boolean;
  tag_names: string[];
  date_added: string;
  date_modified: string;
}

export interface LinkdingResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: LinkdingBookmark[];
}

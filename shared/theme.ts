import { getSettings } from "./storage";
import type { Theme } from "./types";

// Theme is driven by a `data-theme` attribute on <html>; tokens.css maps it (plus
// the OS `prefers-color-scheme` when the attribute is absent) to the colour tokens.
//   - "system" → no attribute, follow the OS
//   - "light" / "dark" → pin it explicitly
export function setTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", theme);
  }
}

// Apply the stored theme as early as possible in each page's init to minimise any
// flash of the default theme before settings load.
export async function applyStoredTheme(): Promise<void> {
  const settings = await getSettings();
  setTheme(settings.theme);
}

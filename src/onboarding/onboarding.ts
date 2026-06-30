import ext from "@shared/browser";

// The onboarding page is one shared file copied into every build. Tailor the New Tab section to
// the build the user actually installed, detected from the manifest at runtime:
//   - Firefox            → has the override; Firefox offers a built-in revert.
//   - Chromium (new tab) → has the override; Chromium may have changed "On startup".
//   - Chromium (plain)   → no override; point at the "new tab edition" build.
// `typeof browser` is unreliable — Chromium also exposes a `browser` alias. Extension page URLs
// are the dependable signal: moz-extension:// on Firefox vs chrome-extension:// on Chromium.
const isFirefox = location.protocol === "moz-extension:";

// A plain <a href="chrome://…"> is blocked from navigating; open it via the tabs API instead.
function wireChromeLink(id: string, url: string): void {
  document.getElementById(id)?.addEventListener("click", (e) => {
    e.preventDefault();
    ext.tabs.create({ url });
  });
}

function tailorSidebarItem(): void {
  const item = document.getElementById("sidebar-item");
  if (!item) return;

  if (isFirefox) {
    // Ctrl+Alt+S is the suggested_key for _execute_sidebar_action in manifest.firefox.json.
    item.innerHTML =
      "<strong>Sidebar</strong> — open it from Firefox's sidebar, or press <strong>Ctrl+Alt+S</strong> " +
      "(rebindable in about:addons → ⚙ → Manage Extension Shortcuts).";
    return;
  }

  const shortcutsUrl = "chrome://extensions/shortcuts";
  item.innerHTML =
    "<strong>Side panel</strong> — press <strong>Ctrl+Shift+S</strong> to open it (rebindable at " +
    `<a id="shortcuts-link" href="${shortcutsUrl}">${shortcutsUrl}</a>). Some Chromium builds also ` +
    "show a side-panel button in the toolbar, but others (e.g. ungoogled-chromium) hide it — the " +
    "shortcut always works.";
  wireChromeLink("shortcuts-link", shortcutsUrl);
}

function tailorNewTabSection(): void {
  const heading = document.getElementById("newtab-heading");
  const body = document.getElementById("newtab-body");
  if (!heading || !body) return;

  const manifest = ext.runtime.getManifest() as { chrome_url_overrides?: { newtab?: string } };
  const hasNewTab = Boolean(manifest.chrome_url_overrides?.newtab);

  if (hasNewTab && isFirefox) {
    heading.textContent = "New tab";
    body.innerHTML =
      "<p>New tabs now show your Bookmarks+ launcher.</p>" +
      "<p>To switch back to Firefox's default, open <strong>Settings → Home → New Windows and " +
      "Tabs → New tabs</strong> and pick Firefox Home — or use the notification Firefox showed " +
      "when the extension took over. You can flip it back any time.</p>";
    return;
  }

  if (hasNewTab && !isFirefox) {
    const startupUrl = "chrome://settings/?search=start";
    heading.textContent = "New tab";
    body.innerHTML =
      "<p>New tabs now show your Bookmarks+ launcher.</p>" +
      "<p class=\"warn\">Chromium may have changed your <strong>On startup</strong> setting when it " +
      "took over the new tab. If your browser no longer restores your previous session, open " +
      `<a id="startup-link" href="${startupUrl}"><strong>Settings → On startup</strong></a> ` +
      "and reselect <strong>“Continue where you left off.”</strong> " +
      "New tabs will still show the launcher — the two settings are independent.</p>" +
      "<p class=\"muted\">Didn't actually want the new-tab takeover? Install the standard " +
      "<strong>“Bookmarks+”</strong> build instead — it leaves your native new tab alone.</p>";

    wireChromeLink("startup-link", startupUrl);
    return;
  }

  // Plain Chromium build: no override.
  heading.textContent = "New tab (not in this build)";
  body.innerHTML =
    "<p>This build leaves your browser's native new tab untouched.</p>" +
    "<p class=\"muted\">Want new tabs to show your Bookmarks+ launcher instead? Install the " +
    "<strong>“Bookmarks+ (new tab edition)”</strong> build.</p>";
}

document.addEventListener("DOMContentLoaded", () => {
  tailorSidebarItem();
  tailorNewTabSection();
});

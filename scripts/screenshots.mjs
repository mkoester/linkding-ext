// Generates repeatable store screenshots from the built extension UI.
//
// How it works: the real page bundles in dist/chrome are copied into a throwaway
// work dir; scripts/screenshot-harness.js is injected before each page's own
// <script> so the pages render with mocked extension data (no real browser
// profile, no extension id, fully offline/deterministic). Headless system
// Chromium captures each page; ImageMagick frames the small ones onto a branded
// 1280x800 canvas (the Chrome Web Store's required size; AMO accepts it too).
//
// Requires on PATH: chromium, ImageMagick (magick). No npm install needed.
// Run: pnpm screenshots   (output → web-store/screenshots/)
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dist = path.join(root, "dist", "chrome");
const work = path.join(root, "web-store", ".shot-work");
const outDir = path.join(root, "web-store", "screenshots");

// 2x everything for crisp downscaling; final store images are 1280x800.
const SCALE = 2;
const OUT_W = 1280;
const OUT_H = 800;
const VIOLET_TOP = "#6d6bf0";
const VIOLET_BOTTOM = "#4a48cf";

// Each shot: which page, theme, capture viewport, and whether to frame + caption.
// Full-page shots (newtab) are used raw; small surfaces are framed.
const SHOTS = [
  { name: "1-newtab-dark", page: "newtab", theme: "dark", w: OUT_W, h: OUT_H, frame: false },
  { name: "2-newtab-light", page: "newtab", theme: "light", w: OUT_W, h: OUT_H, frame: false },
  { name: "3-popup", page: "popup", theme: "dark", w: 400, h: 600, frame: true, caption: "Quick access from the toolbar" },
  { name: "4-sidebar", page: "sidebar", theme: "light", w: 360, h: 760, frame: true, caption: "Keep it open in the sidebar / side panel" },
  { name: "5-options", page: "options", theme: "dark", w: 820, h: 900, frame: true, caption: "Folders that fill themselves" },
];

// Resolve a system sans-serif (bold) via fontconfig so captions match the UI's
// system-ui look instead of ImageMagick's serif default. Falls back to undefined
// (IM default) if fontconfig isn't available.
function captionFont() {
  try {
    return execFileSync("fc-match", ["-f", "%{file}", "sans-serif:bold"], { encoding: "utf-8" }).trim() || undefined;
  } catch {
    return undefined;
  }
}
const FONT = captionFont();

function ensureBuilt() {
  if (!existsSync(path.join(dist, "manifest.json"))) {
    console.log("dist/chrome missing — building…");
    execFileSync("pnpm", ["run", "build:chrome"], { cwd: root, stdio: "inherit" });
  }
}

// Copy the build and inject the harness before each page's own bundle script.
function prepareWork() {
  rmSync(work, { recursive: true, force: true });
  cpSync(dist, work, { recursive: true });
  writeFileSync(path.join(work, "shot-harness.js"), readFileSync(path.join(root, "scripts/screenshot-harness.js")));

  for (const page of new Set(SHOTS.map((s) => s.page))) {
    const htmlPath = path.join(work, page, `${page}.html`);
    let html = readFileSync(htmlPath, "utf-8");
    // Inject the harness immediately before the page's own script so chrome.* is
    // stubbed before the bundle runs.
    html = html.replace(
      /<script src="\.\.\/([^"]+\.js)"><\/script>/,
      '<script src="../shot-harness.js"></script>\n  <script src="../$1"></script>'
    );
    writeFileSync(path.join(work, page, "_shot.html"), html);
  }
}

function capture(shot, rawPng) {
  const url = `file://${path.join(work, shot.page, "_shot.html")}?theme=${shot.theme}`;
  execFileSync(
    "chromium",
    [
      "--headless=new",
      "--no-sandbox",
      "--hide-scrollbars",
      "--disable-gpu",
      "--default-background-color=00000000",
      `--force-device-scale-factor=${SCALE}`,
      "--virtual-time-budget=5000",
      "--run-all-compositor-stages-before-draw",
      `--window-size=${shot.w},${shot.h}`,
      `--screenshot=${rawPng}`,
      url,
    ],
    { stdio: "ignore" }
  );
  if (!existsSync(rawPng)) throw new Error(`capture failed for ${shot.name}`);
}

// Full-bleed shot → just normalise to the store size.
function finalizeRaw(rawPng, outPng) {
  execFileSync("magick", [rawPng, "-resize", `${OUT_W}x${OUT_H}!`, outPng]);
}

// Small shot → drop onto a branded gradient with a soft shadow + caption.
function finalizeFramed(rawPng, outPng, caption) {
  const W = OUT_W * SCALE;
  const H = OUT_H * SCALE;
  execFileSync("magick", [
    "-size", `${W}x${H}`,
    `gradient:${VIOLET_TOP}-${VIOLET_BOTTOM}`,
    // the captured surface: scale to fit, rounded look via a thin border + shadow
    "(", rawPng, "-resize", `x${Math.round(H * 0.72)}`,
        "(", "+clone", "-background", "black", "-shadow", "55x40+0+25", ")",
        "+swap", "-background", "none", "-layers", "merge", "+repage", ")",
    "-gravity", "center", "-geometry", "+0+90", "-composite",
    // caption near the top
    ...(FONT ? ["-font", FONT] : []),
    "-gravity", "north", "-fill", "white", "-pointsize", `${28 * SCALE}`,
    "-annotate", "+0+70", caption,
    "-resize", `${OUT_W}x${OUT_H}!`,
    outPng,
  ]);
}

function main() {
  ensureBuilt();
  prepareWork();
  mkdirSync(outDir, { recursive: true });
  const rawDir = path.join(work, "raw");
  mkdirSync(rawDir, { recursive: true });

  for (const shot of SHOTS) {
    const raw = path.join(rawDir, `${shot.name}.png`);
    const out = path.join(outDir, `${shot.name}.png`);
    capture(shot, raw);
    if (shot.frame) finalizeFramed(raw, out, shot.caption);
    else finalizeRaw(raw, out);
    console.log(`✓ ${path.relative(root, out)}`);
  }

  rmSync(work, { recursive: true, force: true });
  console.log(`\n${SHOTS.length} screenshots in ${path.relative(root, outDir)}/ (1280×800)`);
}

main();

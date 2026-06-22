// Unified browser API — works in both Firefox (browser.*) and Chrome (chrome.*)
const ext: typeof browser =
  typeof browser !== "undefined" ? browser : (chrome as unknown as typeof browser);

export default ext;

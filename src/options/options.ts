import ext from "@shared/browser";
import {
  getFolders,
  getSettings,
  saveFolders,
  saveSettings,
} from "@shared/storage";
import type { Folder, FolderRules, RuleCondition, Settings } from "@shared/types";

let folders: Folder[] = [];

async function init(): Promise<void> {
  const [settings, savedFolders] = await Promise.all([
    getSettings(),
    getFolders(),
  ]);

  folders = savedFolders;

  (document.getElementById("linkding-url") as HTMLInputElement).value =
    settings.linkdingUrl ?? "";
  (document.getElementById("linkding-token") as HTMLInputElement).value =
    settings.linkdingToken ?? "";
  (document.getElementById("sync-interval") as HTMLInputElement).value =
    String(settings.syncIntervalMinutes);
  (document.getElementById("use-static-data") as HTMLInputElement).checked =
    settings.useStaticData;

  renderFolderList();

  document.getElementById("save")?.addEventListener("click", save);
  document.getElementById("add-folder")?.addEventListener("click", addFolder);
}

// ---- Save -------------------------------------------------------------------

async function save(): Promise<void> {
  const settings: Settings = {
    linkdingUrl:
      (document.getElementById("linkding-url") as HTMLInputElement).value.trim() || null,
    linkdingToken:
      (document.getElementById("linkding-token") as HTMLInputElement).value.trim() || null,
    syncIntervalMinutes: parseInt(
      (document.getElementById("sync-interval") as HTMLInputElement).value,
      10
    ),
    useStaticData: (document.getElementById("use-static-data") as HTMLInputElement).checked,
  };

  await saveSettings(settings);
  await saveFolders(folders);

  // Trigger a re-sync with the new settings
  await ext.runtime.sendMessage({ type: "sync_requested" });

  const status = document.getElementById("status")!;
  status.textContent = "Saved.";
  setTimeout(() => { status.textContent = ""; }, 2000);
}

// ---- Folder list rendering --------------------------------------------------

function renderFolderList(): void {
  const container = document.getElementById("folder-list")!;
  container.innerHTML = "";
  folders.forEach((folder, index) => {
    container.appendChild(renderFolderEditor(folder, index));
  });
}

function renderFolderEditor(folder: Folder, index: number): HTMLElement {
  const div = document.createElement("div");
  div.className = "folder-editor";

  const header = document.createElement("div");
  header.className = "folder-header";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.value = folder.name;
  nameInput.placeholder = "Folder name";
  nameInput.addEventListener("input", () => {
    folders[index].name = nameInput.value;
  });

  const matchSelect = document.createElement("select");
  ["all", "any"].forEach((val) => {
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = val === "all" ? "Match ALL" : "Match ANY";
    if (folder.rules.match === val) opt.selected = true;
    matchSelect.appendChild(opt);
  });
  matchSelect.addEventListener("change", () => {
    folders[index].rules.match = matchSelect.value as "all" | "any";
  });

  const removeBtn = document.createElement("button");
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", () => {
    folders.splice(index, 1);
    renderFolderList();
  });

  header.appendChild(nameInput);
  header.appendChild(matchSelect);
  header.appendChild(removeBtn);
  div.appendChild(header);

  const conditionsDiv = document.createElement("div");
  conditionsDiv.className = "conditions";

  folder.rules.conditions.forEach((condition, ci) => {
    conditionsDiv.appendChild(renderConditionEditor(condition, index, ci));
  });

  const addCondBtn = document.createElement("button");
  addCondBtn.textContent = "+ Add condition";
  addCondBtn.addEventListener("click", () => {
    folders[index].rules.conditions.push({ type: "tag", value: "" });
    renderFolderList();
  });

  div.appendChild(conditionsDiv);
  div.appendChild(addCondBtn);
  return div;
}

function renderConditionEditor(
  condition: RuleCondition,
  folderIndex: number,
  conditionIndex: number
): HTMLElement {
  const div = document.createElement("div");
  div.className = "condition";

  const typeSelect = document.createElement("select");
  const conditionTypes: Array<{ value: RuleCondition["type"]; label: string }> = [
    { value: "tag", label: "Tag" },
    { value: "url_contains", label: "URL contains" },
    { value: "title_contains", label: "Title contains" },
  ];
  conditionTypes.forEach(({ value, label }) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    if (condition.type === value) opt.selected = true;
    typeSelect.appendChild(opt);
  });
  typeSelect.addEventListener("change", () => {
    folders[folderIndex].rules.conditions[conditionIndex].type =
      typeSelect.value as RuleCondition["type"];
  });

  const valueInput = document.createElement("input");
  valueInput.type = "text";
  valueInput.value = condition.value;
  valueInput.placeholder = "Value";
  valueInput.addEventListener("input", () => {
    folders[folderIndex].rules.conditions[conditionIndex].value = valueInput.value;
  });

  const removeBtn = document.createElement("button");
  removeBtn.textContent = "×";
  removeBtn.addEventListener("click", () => {
    folders[folderIndex].rules.conditions.splice(conditionIndex, 1);
    renderFolderList();
  });

  div.appendChild(typeSelect);
  div.appendChild(valueInput);
  div.appendChild(removeBtn);
  return div;
}

// ---- Add folder -------------------------------------------------------------

function addFolder(): void {
  const newFolder: Folder = {
    id: crypto.randomUUID(),
    name: "",
    rules: { match: "any", conditions: [] } as FolderRules,
    bookmark_ids: [],
  };
  folders.push(newFolder);
  renderFolderList();
}

// ---- Boot -------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", init);

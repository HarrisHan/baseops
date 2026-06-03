"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => BaseOpsPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// src/operations.ts
var DEFAULT_SELECTION_PROPERTY = "baseops_selected";
var DEFAULT_PREVIEW_LIMIT = 50;
function isSelectedValue(value) {
  if (value === true || value === 1) {
    return true;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "yes" || normalized === "1";
  }
  return false;
}
function normalizePropertyName(propertyName) {
  return propertyName.trim();
}
function operationNeedsValue(operation) {
  return operation !== "clear";
}
function parseInputValue(rawValue, operation, propertyName) {
  if (!operationNeedsValue(operation)) {
    return void 0;
  }
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    throw new Error("Enter a value before previewing this operation.");
  }
  if (operation === "add" || operation === "remove") {
    return splitListInput(trimmed, propertyName);
  }
  return normalizeToken(trimmed, propertyName);
}
function planOperation(files, propertyNameInput, operation, rawValue) {
  const propertyName = normalizePropertyName(propertyNameInput);
  if (propertyName.length === 0) {
    throw new Error("Enter a property name before previewing.");
  }
  const parsedValue = parseInputValue(rawValue, operation, propertyName);
  const changedFiles = [];
  const skippedFiles = [];
  for (const file of files) {
    const nextValue = nextPropertyValue(file.value, file.propertyExists, operation, parsedValue);
    if (valuesEqual(file.value, nextValue)) {
      skippedFiles.push({
        path: file.path,
        value: file.value,
        reason: "No change"
      });
      continue;
    }
    changedFiles.push({
      path: file.path,
      propertyExists: file.propertyExists,
      oldValue: file.value,
      newValue: nextValue,
      oldDisplay: formatValue(file.value),
      newDisplay: formatValue(nextValue)
    });
  }
  return {
    operation,
    propertyName,
    totalFiles: files.length,
    changedFiles,
    skippedFiles
  };
}
function nextPropertyValue(currentValue, propertyExists, operation, parsedValue) {
  if (operation === "clear") {
    return void 0;
  }
  if (operation === "replace") {
    return parsedValue;
  }
  const requested = Array.isArray(parsedValue) ? parsedValue : [parsedValue];
  const currentItems = propertyExists ? toList(currentValue) : [];
  if (operation === "add") {
    const next = [...currentItems];
    for (const item of requested) {
      if (!next.some((existing) => valuesEqual(existing, item))) {
        next.push(item);
      }
    }
    return next;
  }
  if (operation === "remove") {
    return currentItems.filter((item) => !requested.some((removeItem) => valuesEqual(item, removeItem)));
  }
  return currentValue;
}
function formatValue(value) {
  if (typeof value === "undefined") {
    return "(missing)";
  }
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => formatValue(item)).join(", ")}]`;
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
function splitListInput(value, propertyName) {
  const values = value.split(",").map((part) => normalizeToken(part, propertyName)).filter((part) => part.length > 0);
  if (values.length === 0) {
    throw new Error("Enter at least one value before previewing this operation.");
  }
  return values;
}
function normalizeToken(value, propertyName) {
  const trimmed = value.trim();
  if (isTagProperty(propertyName)) {
    return trimmed.replace(/^#+/, "");
  }
  return trimmed;
}
function isTagProperty(propertyName) {
  const normalized = propertyName.trim().toLowerCase();
  return normalized === "tag" || normalized === "tags";
}
function toList(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "undefined") {
    return [];
  }
  return [value];
}
function valuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

// main.ts
var DEFAULT_PRESETS = [
  {
    id: "mark-done",
    name: "Mark as done",
    propertyName: "status",
    operation: "replace",
    rawValue: "done"
  },
  {
    id: "needs-review",
    name: "Add needs-review tag",
    propertyName: "tags",
    operation: "add",
    rawValue: "needs-review"
  },
  {
    id: "clear-owner",
    name: "Clear owner",
    propertyName: "owner",
    operation: "clear",
    rawValue: ""
  }
];
function getDefaultSettings() {
  return {
    selectionProperty: DEFAULT_SELECTION_PROPERTY,
    previewLimit: DEFAULT_PREVIEW_LIMIT,
    presets: DEFAULT_PRESETS.map((preset) => ({ ...preset }))
  };
}
var BaseOpsPlugin = class extends import_obsidian.Plugin {
  settings = getDefaultSettings();
  undoSnapshot = null;
  async onload() {
    await this.loadSettings();
    this.addCommand({
      id: "open-bulk-editor",
      name: "Open bulk editor",
      callback: () => {
        new BulkEditorModal(this.app, this).open();
      }
    });
    this.addCommand({
      id: "toggle-active-note-selection",
      name: "Toggle active note selection",
      callback: () => this.toggleActiveNoteSelection()
    });
    this.addCommand({
      id: "clear-selected-notes",
      name: "Clear selected notes",
      callback: () => this.clearSelectedNotes()
    });
    this.addCommand({
      id: "select-active-folder-notes",
      name: "Select active folder notes",
      callback: () => this.selectActiveFolderNotes()
    });
    this.addCommand({
      id: "create-starter-kit",
      name: "Create starter kit",
      callback: () => this.createStarterKit()
    });
    this.addCommand({
      id: "undo-last-operation",
      name: "Undo last operation",
      callback: () => this.undoLastOperation()
    });
    this.addSettingTab(new BaseOpsSettingTab(this.app, this));
  }
  async loadSettings() {
    const loaded = await this.loadData();
    this.settings = {
      ...getDefaultSettings(),
      ...loaded,
      presets: normalizePresets(loaded?.presets)
    };
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  async addPreset(preset) {
    this.settings.presets = [...this.settings.presets, preset];
    await this.saveSettings();
  }
  async removePreset(id) {
    this.settings.presets = this.settings.presets.filter((preset) => preset.id !== id);
    await this.saveSettings();
  }
  getSelectedMarkdownFiles() {
    const propertyName = this.settings.selectionProperty.trim() || DEFAULT_SELECTION_PROPERTY;
    return this.app.vault.getMarkdownFiles().filter((file) => isSelectedValue(this.app.metadataCache.getFileCache(file)?.frontmatter?.[propertyName]));
  }
  getFilePropertyStates(files, propertyName) {
    return files.map((file) => {
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
      return {
        path: file.path,
        propertyExists: Object.prototype.hasOwnProperty.call(frontmatter, propertyName),
        value: frontmatter[propertyName]
      };
    });
  }
  findFile(path) {
    const abstractFile = this.app.vault.getAbstractFileByPath(path);
    return abstractFile instanceof import_obsidian.TFile ? abstractFile : null;
  }
  async applyPlan(plan) {
    if (plan.changedFiles.length === 0) {
      new import_obsidian.Notice("BaseOps: Preview contains no changes to apply.");
      return 0;
    }
    const undoEntries = [];
    for (const change of plan.changedFiles) {
      const file = this.findFile(change.path);
      if (!file) {
        continue;
      }
      undoEntries.push({
        file,
        propertyName: plan.propertyName,
        propertyExists: change.propertyExists,
        oldValue: change.oldValue
      });
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        if (typeof change.newValue === "undefined") {
          delete frontmatter[plan.propertyName];
        } else {
          frontmatter[plan.propertyName] = change.newValue;
        }
      });
    }
    this.undoSnapshot = undoEntries;
    new import_obsidian.Notice(`BaseOps: Applied changes to ${undoEntries.length} file${undoEntries.length === 1 ? "" : "s"}.`);
    return undoEntries.length;
  }
  async undoLastOperation() {
    if (!this.undoSnapshot || this.undoSnapshot.length === 0) {
      new import_obsidian.Notice("BaseOps: No operation to undo in this session.");
      return;
    }
    const snapshot = this.undoSnapshot;
    for (const entry of snapshot) {
      await this.app.fileManager.processFrontMatter(entry.file, (frontmatter) => {
        if (entry.propertyExists) {
          frontmatter[entry.propertyName] = entry.oldValue;
        } else {
          delete frontmatter[entry.propertyName];
        }
      });
    }
    this.undoSnapshot = null;
    new import_obsidian.Notice(`BaseOps: Undid changes to ${snapshot.length} file${snapshot.length === 1 ? "" : "s"}.`);
  }
  async toggleActiveNoteSelection() {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new import_obsidian.Notice("BaseOps: Open a Markdown note before toggling selection.");
      return;
    }
    if (file.extension !== "md") {
      new import_obsidian.Notice("BaseOps: BaseOps selection only works on Markdown notes.");
      return;
    }
    const propertyName = this.settings.selectionProperty.trim() || DEFAULT_SELECTION_PROPERTY;
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter[propertyName] = !isSelectedValue(frontmatter[propertyName]);
    });
    new import_obsidian.Notice("BaseOps: Toggled active note selection.");
  }
  async clearSelectedNotes() {
    const propertyName = this.settings.selectionProperty.trim() || DEFAULT_SELECTION_PROPERTY;
    const files = this.getSelectedMarkdownFiles();
    for (const file of files) {
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        delete frontmatter[propertyName];
      });
    }
    new import_obsidian.Notice(`BaseOps: Cleared selection from ${files.length} file${files.length === 1 ? "" : "s"}.`);
  }
  async selectActiveFolderNotes() {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new import_obsidian.Notice("BaseOps: Open a Markdown note before selecting a folder.");
      return;
    }
    const folderPath = activeFile.parent?.path ?? "";
    const propertyName = this.settings.selectionProperty.trim() || DEFAULT_SELECTION_PROPERTY;
    const folderFiles = this.app.vault.getMarkdownFiles().filter((file) => (file.parent?.path ?? "") === folderPath);
    for (const file of folderFiles) {
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        frontmatter[propertyName] = true;
      });
    }
    const label = folderPath.length > 0 ? folderPath : "vault root";
    new import_obsidian.Notice(`BaseOps: Selected ${folderFiles.length} note${folderFiles.length === 1 ? "" : "s"} in ${label}.`);
  }
  async createStarterKit() {
    const folder = "BaseOps Starter Kit";
    await this.createFolderIfMissing(folder);
    const files = [
      {
        path: `${folder}/Start Here.md`,
        content: starterGuideMarkdown(this.settings.selectionProperty)
      },
      {
        path: `${folder}/Project - Launch checklist.md`,
        content: starterItemMarkdown(this.settings.selectionProperty, "Launch checklist", "in-progress", ["baseops-demo", "project"], true)
      },
      {
        path: `${folder}/Reading - Plugin documentation.md`,
        content: starterItemMarkdown(this.settings.selectionProperty, "Plugin documentation", "inbox", ["baseops-demo", "reading"], true)
      },
      {
        path: `${folder}/Idea - Bases workflow.md`,
        content: starterItemMarkdown(this.settings.selectionProperty, "Bases workflow", "idea", ["baseops-demo", "idea"], false)
      }
    ];
    let created = 0;
    for (const file of files) {
      if (this.app.vault.getAbstractFileByPath(file.path)) {
        continue;
      }
      await this.app.vault.create(file.path, file.content);
      created += 1;
    }
    new import_obsidian.Notice(`BaseOps: Starter kit ready. Created ${created} file${created === 1 ? "" : "s"}.`);
  }
  async createFolderIfMissing(path) {
    if (!this.app.vault.getAbstractFileByPath(path)) {
      await this.app.vault.createFolder(path);
    }
  }
};
var BulkEditorModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  selectedFiles = [];
  propertyName = "";
  operation = "replace";
  rawValue = "";
  lastPreview = null;
  applyButton = null;
  previewContainer = null;
  valueContainer = null;
  propertyInput = null;
  operationDropdown = null;
  valueInput = null;
  onOpen() {
    this.selectedFiles = this.plugin.getSelectedMarkdownFiles();
    this.propertyName = "";
    this.rawValue = "";
    this.lastPreview = null;
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("baseops-modal");
    contentEl.createEl("h2", { text: "BaseOps Bulk Editor" });
    contentEl.createEl("p", {
      cls: "baseops-muted",
      text: `${this.selectedFiles.length} selected note${this.selectedFiles.length === 1 ? "" : "s"}`
    });
    if (this.selectedFiles.length === 0) {
      contentEl.createEl("p", {
        text: `No selected notes. Add a checkbox property named ${this.plugin.settings.selectionProperty} in a Base view, or run "BaseOps: Toggle active note selection" on notes you want to edit.`
      });
      return;
    }
    new import_obsidian.Setting(contentEl).setName("Workflow preset").setDesc("Load a common operation, then adjust it before previewing.").addDropdown((dropdown) => {
      dropdown.addOption("", "Choose a preset");
      for (const preset of this.plugin.settings.presets) {
        dropdown.addOption(preset.id, preset.name);
      }
      dropdown.onChange((id) => {
        const preset = this.plugin.settings.presets.find((candidate) => candidate.id === id);
        if (preset) {
          this.applyPreset(preset);
        }
        dropdown.setValue("");
      });
    });
    new import_obsidian.Setting(contentEl).setName("Property").setDesc("The frontmatter property to change.").addText((text) => {
      this.propertyInput = text;
      text.setPlaceholder("status, tags, owner").setValue(this.propertyName).onChange((value) => {
        this.propertyName = value;
        this.invalidatePreview();
      });
    });
    new import_obsidian.Setting(contentEl).setName("Operation").addDropdown((dropdown) => {
      this.operationDropdown = dropdown;
      dropdown.addOption("replace", "Replace").addOption("add", "Add").addOption("remove", "Remove").addOption("clear", "Clear").setValue(this.operation).onChange((value) => {
        this.operation = value;
        this.invalidatePreview();
        this.renderValueSetting();
      });
    });
    this.valueContainer = contentEl.createDiv();
    this.renderValueSetting();
    new import_obsidian.Setting(contentEl).addButton((button) => {
      button.setButtonText("Preview").setCta().onClick(() => this.preview());
    }).addButton((button) => {
      button.setButtonText("Save Preset").onClick(() => this.saveCurrentAsPreset());
    }).addButton((button) => {
      this.applyButton = button.buttonEl;
      button.setButtonText("Apply").setDisabled(true).onClick(async () => {
        if (!this.lastPreview) {
          return;
        }
        await this.plugin.applyPlan(this.lastPreview);
        this.close();
      });
    });
    this.previewContainer = contentEl.createDiv({ cls: "baseops-preview" });
  }
  renderValueSetting() {
    if (!this.valueContainer) {
      return;
    }
    this.valueContainer.empty();
    const valueSetting = new import_obsidian.Setting(this.valueContainer);
    if (!operationNeedsValue(this.operation)) {
      this.valueInput = null;
      valueSetting.setName("Value").setDesc("Clear removes the property from selected notes.");
      return;
    }
    valueSetting.setName("Value").setDesc("Use commas for add/remove list values. Tags may include #.").addText((text) => {
      this.valueInput = text;
      text.setPlaceholder(this.operation === "replace" ? "done" : "alpha, beta").setValue(this.rawValue).onChange((value) => {
        this.rawValue = value;
        this.invalidatePreview();
      });
    });
  }
  applyPreset(preset) {
    this.propertyName = preset.propertyName;
    this.operation = preset.operation;
    this.rawValue = preset.rawValue;
    this.propertyInput?.setValue(this.propertyName);
    this.operationDropdown?.setValue(this.operation);
    this.renderValueSetting();
    this.valueInput?.setValue(this.rawValue);
    this.invalidatePreview();
  }
  saveCurrentAsPreset() {
    const propertyName = this.propertyName.trim();
    if (propertyName.length === 0) {
      new import_obsidian.Notice("BaseOps: Enter a property before saving a preset.");
      return;
    }
    if (operationNeedsValue(this.operation) && this.rawValue.trim().length === 0) {
      new import_obsidian.Notice("BaseOps: Enter a value before saving this preset.");
      return;
    }
    new PresetNameModal(this.app, async (name) => {
      await this.plugin.addPreset({
        id: createPresetId(name),
        name,
        propertyName,
        operation: this.operation,
        rawValue: this.rawValue
      });
      new import_obsidian.Notice(`BaseOps: Saved preset "${name}".`);
      this.onOpen();
    }).open();
  }
  preview() {
    if (!this.previewContainer) {
      return;
    }
    try {
      const states = this.plugin.getFilePropertyStates(this.selectedFiles, this.propertyName.trim());
      this.lastPreview = planOperation(states, this.propertyName, this.operation, this.rawValue);
      this.renderPreview(this.lastPreview);
      if (this.applyButton) {
        this.applyButton.disabled = this.lastPreview.changedFiles.length === 0;
      }
    } catch (error) {
      this.lastPreview = null;
      this.applyButton?.setAttribute("disabled", "true");
      this.previewContainer.empty();
      this.previewContainer.createEl("p", {
        cls: "baseops-error",
        text: error instanceof Error ? error.message : "Preview failed."
      });
    }
  }
  invalidatePreview() {
    this.lastPreview = null;
    this.applyButton?.setAttribute("disabled", "true");
  }
  renderPreview(plan) {
    if (!this.previewContainer) {
      return;
    }
    this.previewContainer.empty();
    this.previewContainer.createEl("h3", { text: "Preview" });
    this.previewContainer.createEl("p", {
      text: `${plan.totalFiles} selected, ${plan.changedFiles.length} will change, ${plan.skippedFiles.length} skipped.`
    });
    const limit = Math.max(1, this.plugin.settings.previewLimit);
    const visibleChanges = plan.changedFiles.slice(0, limit);
    if (visibleChanges.length > 0) {
      const list = this.previewContainer.createEl("ul", { cls: "baseops-preview-list" });
      for (const change of visibleChanges) {
        list.createEl("li", {
          text: `${change.path}: ${change.oldDisplay} -> ${change.newDisplay}`
        });
      }
    }
    if (plan.changedFiles.length > visibleChanges.length) {
      this.previewContainer.createEl("p", {
        cls: "baseops-muted",
        text: `${plan.changedFiles.length - visibleChanges.length} more changed file(s) hidden by the preview limit.`
      });
    }
    const visibleSkipped = plan.skippedFiles.slice(0, limit);
    if (visibleSkipped.length > 0) {
      this.previewContainer.createEl("h4", { text: "Skipped" });
      const skippedList = this.previewContainer.createEl("ul", { cls: "baseops-preview-list" });
      for (const skipped of visibleSkipped) {
        skippedList.createEl("li", {
          text: `${skipped.path}: ${skipped.reason} (${formatValue(skipped.value)})`
        });
      }
    }
  }
};
var PresetNameModal = class extends import_obsidian.Modal {
  constructor(app, onSubmit) {
    super(app);
    this.onSubmit = onSubmit;
  }
  name = "";
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Save Preset" });
    new import_obsidian.Setting(contentEl).setName("Preset name").addText((text) => {
      text.setPlaceholder("Review queue").onChange((value) => {
        this.name = value.trim();
      });
    });
    new import_obsidian.Setting(contentEl).addButton((button) => {
      button.setButtonText("Save").setCta().onClick(async () => {
        if (this.name.length === 0) {
          new import_obsidian.Notice("BaseOps: Enter a preset name.");
          return;
        }
        await this.onSubmit(this.name);
        this.close();
      });
    });
  }
};
var BaseOpsSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "BaseOps Settings" });
    new import_obsidian.Setting(containerEl).setName("Selection property").setDesc("Boolean property used to select notes from Bases or commands.").addText((text) => {
      text.setPlaceholder(DEFAULT_SELECTION_PROPERTY).setValue(this.plugin.settings.selectionProperty).onChange(async (value) => {
        this.plugin.settings.selectionProperty = value.trim() || DEFAULT_SELECTION_PROPERTY;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Preview row limit").setDesc("Maximum changed and skipped rows shown in the modal.").addText((text) => {
      text.setPlaceholder(String(DEFAULT_PREVIEW_LIMIT)).setValue(String(this.plugin.settings.previewLimit)).onChange(async (value) => {
        const parsed = Number.parseInt(value, 10);
        this.plugin.settings.previewLimit = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PREVIEW_LIMIT;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Restore defaults").setDesc("Reset BaseOps settings to their default values.").addButton((button) => {
      button.setButtonText("Restore Defaults").onClick(async () => {
        this.plugin.settings = getDefaultSettings();
        await this.plugin.saveSettings();
        this.display();
        new import_obsidian.Notice("BaseOps: Settings restored.");
      });
    });
    containerEl.createEl("h3", { text: "Workflow Presets" });
    for (const preset of this.plugin.settings.presets) {
      new import_obsidian.Setting(containerEl).setName(preset.name).setDesc(`${preset.operation} ${preset.propertyName}${preset.rawValue ? ` = ${preset.rawValue}` : ""}`).addButton((button) => {
        button.setButtonText("Remove").onClick(async () => {
          await this.plugin.removePreset(preset.id);
          this.display();
          new import_obsidian.Notice(`BaseOps: Removed preset "${preset.name}".`);
        });
      });
    }
    new import_obsidian.Setting(containerEl).setName("Restore default presets").setDesc("Add the built-in BaseOps presets back to your workflow list.").addButton((button) => {
      button.setButtonText("Restore Presets").onClick(async () => {
        const existing = new Set(this.plugin.settings.presets.map((preset) => preset.id));
        const restored = DEFAULT_PRESETS.filter((preset) => !existing.has(preset.id)).map((preset) => ({ ...preset }));
        this.plugin.settings.presets = [...this.plugin.settings.presets, ...restored];
        await this.plugin.saveSettings();
        this.display();
        new import_obsidian.Notice(`BaseOps: Restored ${restored.length} default preset${restored.length === 1 ? "" : "s"}.`);
      });
    });
  }
};
function normalizePresets(value) {
  if (!Array.isArray(value)) {
    return DEFAULT_PRESETS.map((preset) => ({ ...preset }));
  }
  const presets = value.map((preset) => normalizePreset(preset)).filter((preset) => preset !== null);
  return presets.length > 0 ? presets : DEFAULT_PRESETS.map((preset) => ({ ...preset }));
}
function normalizePreset(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value;
  if (typeof candidate.id !== "string" || typeof candidate.name !== "string" || typeof candidate.propertyName !== "string" || typeof candidate.rawValue !== "string" || !["replace", "add", "remove", "clear"].includes(candidate.operation)) {
    return null;
  }
  return {
    id: candidate.id,
    name: candidate.name,
    propertyName: candidate.propertyName,
    operation: candidate.operation,
    rawValue: candidate.rawValue
  };
}
function createPresetId(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return `${Date.now()}-${slug || "preset"}`;
}
function starterGuideMarkdown(selectionProperty) {
  return `---
${selectionProperty}: false
status: guide
tags:
  - baseops-demo
---

# BaseOps Starter Kit

This folder gives you a tiny workflow you can edit safely.

1. Open a Base view or the file explorer.
2. Select demo notes by setting \`${selectionProperty}\` to \`true\`.
3. Run **BaseOps: Open bulk editor**.
4. Load a workflow preset, preview the changes, then apply.
5. Run **BaseOps: Undo last operation** if you want to roll it back.
`;
}
function starterItemMarkdown(selectionProperty, title, status, tags, selected) {
  return `---
${selectionProperty}: ${selected ? "true" : "false"}
status: ${status}
tags:
${tags.map((tag) => `  - ${tag}`).join("\n")}
owner: You
---

# ${title}

Use this demo note to try BaseOps previews, presets, and undo.
`;
}

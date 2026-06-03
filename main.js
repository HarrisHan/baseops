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
var DEFAULT_SETTINGS = {
  selectionProperty: DEFAULT_SELECTION_PROPERTY,
  previewLimit: DEFAULT_PREVIEW_LIMIT
};
var BaseOpsPlugin = class extends import_obsidian.Plugin {
  settings = DEFAULT_SETTINGS;
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
      id: "undo-last-operation",
      name: "Undo last operation",
      callback: () => this.undoLastOperation()
    });
    this.addSettingTab(new BaseOpsSettingTab(this.app, this));
  }
  async loadSettings() {
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...await this.loadData()
    };
  }
  async saveSettings() {
    await this.saveData(this.settings);
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
    new import_obsidian.Setting(contentEl).setName("Property").setDesc("The frontmatter property to change.").addText((text) => {
      text.setPlaceholder("status, tags, owner").setValue(this.propertyName).onChange((value) => {
        this.propertyName = value;
        this.invalidatePreview();
      });
    });
    new import_obsidian.Setting(contentEl).setName("Operation").addDropdown((dropdown) => {
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
      valueSetting.setName("Value").setDesc("Clear removes the property from selected notes.");
      return;
    }
    valueSetting.setName("Value").setDesc("Use commas for add/remove list values. Tags may include #.").addText((text) => {
      text.setPlaceholder(this.operation === "replace" ? "done" : "alpha, beta").setValue(this.rawValue).onChange((value) => {
        this.rawValue = value;
        this.invalidatePreview();
      });
    });
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
        this.plugin.settings = { ...DEFAULT_SETTINGS };
        await this.plugin.saveSettings();
        this.display();
        new import_obsidian.Notice("BaseOps: Settings restored.");
      });
    });
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibWFpbi50cyIsICJzcmMvb3BlcmF0aW9ucy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHtcbiAgQXBwLFxuICBNb2RhbCxcbiAgTm90aWNlLFxuICBQbHVnaW4sXG4gIFBsdWdpblNldHRpbmdUYWIsXG4gIFNldHRpbmcsXG4gIFRGaWxlXG59IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHtcbiAgQnVsa09wZXJhdGlvbixcbiAgREVGQVVMVF9QUkVWSUVXX0xJTUlULFxuICBERUZBVUxUX1NFTEVDVElPTl9QUk9QRVJUWSxcbiAgRmlsZVByb3BlcnR5U3RhdGUsXG4gIE9wZXJhdGlvblBsYW4sXG4gIGZvcm1hdFZhbHVlLFxuICBpc1NlbGVjdGVkVmFsdWUsXG4gIG9wZXJhdGlvbk5lZWRzVmFsdWUsXG4gIHBsYW5PcGVyYXRpb25cbn0gZnJvbSBcIi4vc3JjL29wZXJhdGlvbnNcIjtcblxuaW50ZXJmYWNlIEJhc2VPcHNTZXR0aW5ncyB7XG4gIHNlbGVjdGlvblByb3BlcnR5OiBzdHJpbmc7XG4gIHByZXZpZXdMaW1pdDogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgVW5kb0VudHJ5IHtcbiAgZmlsZTogVEZpbGU7XG4gIHByb3BlcnR5TmFtZTogc3RyaW5nO1xuICBwcm9wZXJ0eUV4aXN0czogYm9vbGVhbjtcbiAgb2xkVmFsdWU6IHVua25vd247XG59XG5cbmNvbnN0IERFRkFVTFRfU0VUVElOR1M6IEJhc2VPcHNTZXR0aW5ncyA9IHtcbiAgc2VsZWN0aW9uUHJvcGVydHk6IERFRkFVTFRfU0VMRUNUSU9OX1BST1BFUlRZLFxuICBwcmV2aWV3TGltaXQ6IERFRkFVTFRfUFJFVklFV19MSU1JVFxufTtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQmFzZU9wc1BsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG4gIHNldHRpbmdzOiBCYXNlT3BzU2V0dGluZ3MgPSBERUZBVUxUX1NFVFRJTkdTO1xuICBwcml2YXRlIHVuZG9TbmFwc2hvdDogVW5kb0VudHJ5W10gfCBudWxsID0gbnVsbDtcblxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcblxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJvcGVuLWJ1bGstZWRpdG9yXCIsXG4gICAgICBuYW1lOiBcIk9wZW4gYnVsayBlZGl0b3JcIixcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB7XG4gICAgICAgIG5ldyBCdWxrRWRpdG9yTW9kYWwodGhpcy5hcHAsIHRoaXMpLm9wZW4oKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJ0b2dnbGUtYWN0aXZlLW5vdGUtc2VsZWN0aW9uXCIsXG4gICAgICBuYW1lOiBcIlRvZ2dsZSBhY3RpdmUgbm90ZSBzZWxlY3Rpb25cIixcbiAgICAgIGNhbGxiYWNrOiAoKSA9PiB0aGlzLnRvZ2dsZUFjdGl2ZU5vdGVTZWxlY3Rpb24oKVxuICAgIH0pO1xuXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcImNsZWFyLXNlbGVjdGVkLW5vdGVzXCIsXG4gICAgICBuYW1lOiBcIkNsZWFyIHNlbGVjdGVkIG5vdGVzXCIsXG4gICAgICBjYWxsYmFjazogKCkgPT4gdGhpcy5jbGVhclNlbGVjdGVkTm90ZXMoKVxuICAgIH0pO1xuXG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcInVuZG8tbGFzdC1vcGVyYXRpb25cIixcbiAgICAgIG5hbWU6IFwiVW5kbyBsYXN0IG9wZXJhdGlvblwiLFxuICAgICAgY2FsbGJhY2s6ICgpID0+IHRoaXMudW5kb0xhc3RPcGVyYXRpb24oKVxuICAgIH0pO1xuXG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBCYXNlT3BzU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcykpO1xuICB9XG5cbiAgYXN5bmMgbG9hZFNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuc2V0dGluZ3MgPSB7XG4gICAgICAuLi5ERUZBVUxUX1NFVFRJTkdTLFxuICAgICAgLi4uKGF3YWl0IHRoaXMubG9hZERhdGEoKSlcbiAgICB9O1xuICB9XG5cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG4gIH1cblxuICBnZXRTZWxlY3RlZE1hcmtkb3duRmlsZXMoKTogVEZpbGVbXSB7XG4gICAgY29uc3QgcHJvcGVydHlOYW1lID0gdGhpcy5zZXR0aW5ncy5zZWxlY3Rpb25Qcm9wZXJ0eS50cmltKCkgfHwgREVGQVVMVF9TRUxFQ1RJT05fUFJPUEVSVFk7XG4gICAgcmV0dXJuIHRoaXMuYXBwLnZhdWx0XG4gICAgICAuZ2V0TWFya2Rvd25GaWxlcygpXG4gICAgICAuZmlsdGVyKChmaWxlKSA9PiBpc1NlbGVjdGVkVmFsdWUodGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk/LmZyb250bWF0dGVyPy5bcHJvcGVydHlOYW1lXSkpO1xuICB9XG5cbiAgZ2V0RmlsZVByb3BlcnR5U3RhdGVzKGZpbGVzOiBURmlsZVtdLCBwcm9wZXJ0eU5hbWU6IHN0cmluZyk6IEZpbGVQcm9wZXJ0eVN0YXRlW10ge1xuICAgIHJldHVybiBmaWxlcy5tYXAoKGZpbGUpID0+IHtcbiAgICAgIGNvbnN0IGZyb250bWF0dGVyID0gdGhpcy5hcHAubWV0YWRhdGFDYWNoZS5nZXRGaWxlQ2FjaGUoZmlsZSk/LmZyb250bWF0dGVyID8/IHt9O1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcGF0aDogZmlsZS5wYXRoLFxuICAgICAgICBwcm9wZXJ0eUV4aXN0czogT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGZyb250bWF0dGVyLCBwcm9wZXJ0eU5hbWUpLFxuICAgICAgICB2YWx1ZTogZnJvbnRtYXR0ZXJbcHJvcGVydHlOYW1lXVxuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGZpbmRGaWxlKHBhdGg6IHN0cmluZyk6IFRGaWxlIHwgbnVsbCB7XG4gICAgY29uc3QgYWJzdHJhY3RGaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHBhdGgpO1xuICAgIHJldHVybiBhYnN0cmFjdEZpbGUgaW5zdGFuY2VvZiBURmlsZSA/IGFic3RyYWN0RmlsZSA6IG51bGw7XG4gIH1cblxuICBhc3luYyBhcHBseVBsYW4ocGxhbjogT3BlcmF0aW9uUGxhbik6IFByb21pc2U8bnVtYmVyPiB7XG4gICAgaWYgKHBsYW4uY2hhbmdlZEZpbGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgbmV3IE5vdGljZShcIkJhc2VPcHM6IFByZXZpZXcgY29udGFpbnMgbm8gY2hhbmdlcyB0byBhcHBseS5cIik7XG4gICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICBjb25zdCB1bmRvRW50cmllczogVW5kb0VudHJ5W10gPSBbXTtcblxuICAgIGZvciAoY29uc3QgY2hhbmdlIG9mIHBsYW4uY2hhbmdlZEZpbGVzKSB7XG4gICAgICBjb25zdCBmaWxlID0gdGhpcy5maW5kRmlsZShjaGFuZ2UucGF0aCk7XG4gICAgICBpZiAoIWZpbGUpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIHVuZG9FbnRyaWVzLnB1c2goe1xuICAgICAgICBmaWxlLFxuICAgICAgICBwcm9wZXJ0eU5hbWU6IHBsYW4ucHJvcGVydHlOYW1lLFxuICAgICAgICBwcm9wZXJ0eUV4aXN0czogY2hhbmdlLnByb3BlcnR5RXhpc3RzLFxuICAgICAgICBvbGRWYWx1ZTogY2hhbmdlLm9sZFZhbHVlXG4gICAgICB9KTtcblxuICAgICAgYXdhaXQgdGhpcy5hcHAuZmlsZU1hbmFnZXIucHJvY2Vzc0Zyb250TWF0dGVyKGZpbGUsIChmcm9udG1hdHRlcikgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIGNoYW5nZS5uZXdWYWx1ZSA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAgIGRlbGV0ZSBmcm9udG1hdHRlcltwbGFuLnByb3BlcnR5TmFtZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZnJvbnRtYXR0ZXJbcGxhbi5wcm9wZXJ0eU5hbWVdID0gY2hhbmdlLm5ld1ZhbHVlO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB0aGlzLnVuZG9TbmFwc2hvdCA9IHVuZG9FbnRyaWVzO1xuICAgIG5ldyBOb3RpY2UoYEJhc2VPcHM6IEFwcGxpZWQgY2hhbmdlcyB0byAke3VuZG9FbnRyaWVzLmxlbmd0aH0gZmlsZSR7dW5kb0VudHJpZXMubGVuZ3RoID09PSAxID8gXCJcIiA6IFwic1wifS5gKTtcbiAgICByZXR1cm4gdW5kb0VudHJpZXMubGVuZ3RoO1xuICB9XG5cbiAgYXN5bmMgdW5kb0xhc3RPcGVyYXRpb24oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKCF0aGlzLnVuZG9TbmFwc2hvdCB8fCB0aGlzLnVuZG9TbmFwc2hvdC5sZW5ndGggPT09IDApIHtcbiAgICAgIG5ldyBOb3RpY2UoXCJCYXNlT3BzOiBObyBvcGVyYXRpb24gdG8gdW5kbyBpbiB0aGlzIHNlc3Npb24uXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHNuYXBzaG90ID0gdGhpcy51bmRvU25hcHNob3Q7XG4gICAgZm9yIChjb25zdCBlbnRyeSBvZiBzbmFwc2hvdCkge1xuICAgICAgYXdhaXQgdGhpcy5hcHAuZmlsZU1hbmFnZXIucHJvY2Vzc0Zyb250TWF0dGVyKGVudHJ5LmZpbGUsIChmcm9udG1hdHRlcikgPT4ge1xuICAgICAgICBpZiAoZW50cnkucHJvcGVydHlFeGlzdHMpIHtcbiAgICAgICAgICBmcm9udG1hdHRlcltlbnRyeS5wcm9wZXJ0eU5hbWVdID0gZW50cnkub2xkVmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGVsZXRlIGZyb250bWF0dGVyW2VudHJ5LnByb3BlcnR5TmFtZV07XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHRoaXMudW5kb1NuYXBzaG90ID0gbnVsbDtcbiAgICBuZXcgTm90aWNlKGBCYXNlT3BzOiBVbmRpZCBjaGFuZ2VzIHRvICR7c25hcHNob3QubGVuZ3RofSBmaWxlJHtzbmFwc2hvdC5sZW5ndGggPT09IDEgPyBcIlwiIDogXCJzXCJ9LmApO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyB0b2dnbGVBY3RpdmVOb3RlU2VsZWN0aW9uKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuICAgIGlmICghZmlsZSkge1xuICAgICAgbmV3IE5vdGljZShcIkJhc2VPcHM6IE9wZW4gYSBNYXJrZG93biBub3RlIGJlZm9yZSB0b2dnbGluZyBzZWxlY3Rpb24uXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChmaWxlLmV4dGVuc2lvbiAhPT0gXCJtZFwiKSB7XG4gICAgICBuZXcgTm90aWNlKFwiQmFzZU9wczogQmFzZU9wcyBzZWxlY3Rpb24gb25seSB3b3JrcyBvbiBNYXJrZG93biBub3Rlcy5cIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgcHJvcGVydHlOYW1lID0gdGhpcy5zZXR0aW5ncy5zZWxlY3Rpb25Qcm9wZXJ0eS50cmltKCkgfHwgREVGQVVMVF9TRUxFQ1RJT05fUFJPUEVSVFk7XG4gICAgYXdhaXQgdGhpcy5hcHAuZmlsZU1hbmFnZXIucHJvY2Vzc0Zyb250TWF0dGVyKGZpbGUsIChmcm9udG1hdHRlcikgPT4ge1xuICAgICAgZnJvbnRtYXR0ZXJbcHJvcGVydHlOYW1lXSA9ICFpc1NlbGVjdGVkVmFsdWUoZnJvbnRtYXR0ZXJbcHJvcGVydHlOYW1lXSk7XG4gICAgfSk7XG5cbiAgICBuZXcgTm90aWNlKFwiQmFzZU9wczogVG9nZ2xlZCBhY3RpdmUgbm90ZSBzZWxlY3Rpb24uXCIpO1xuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBjbGVhclNlbGVjdGVkTm90ZXMoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgcHJvcGVydHlOYW1lID0gdGhpcy5zZXR0aW5ncy5zZWxlY3Rpb25Qcm9wZXJ0eS50cmltKCkgfHwgREVGQVVMVF9TRUxFQ1RJT05fUFJPUEVSVFk7XG4gICAgY29uc3QgZmlsZXMgPSB0aGlzLmdldFNlbGVjdGVkTWFya2Rvd25GaWxlcygpO1xuXG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICBhd2FpdCB0aGlzLmFwcC5maWxlTWFuYWdlci5wcm9jZXNzRnJvbnRNYXR0ZXIoZmlsZSwgKGZyb250bWF0dGVyKSA9PiB7XG4gICAgICAgIGRlbGV0ZSBmcm9udG1hdHRlcltwcm9wZXJ0eU5hbWVdO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgbmV3IE5vdGljZShgQmFzZU9wczogQ2xlYXJlZCBzZWxlY3Rpb24gZnJvbSAke2ZpbGVzLmxlbmd0aH0gZmlsZSR7ZmlsZXMubGVuZ3RoID09PSAxID8gXCJcIiA6IFwic1wifS5gKTtcbiAgfVxufVxuXG5jbGFzcyBCdWxrRWRpdG9yTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIHByaXZhdGUgc2VsZWN0ZWRGaWxlczogVEZpbGVbXSA9IFtdO1xuICBwcml2YXRlIHByb3BlcnR5TmFtZSA9IFwiXCI7XG4gIHByaXZhdGUgb3BlcmF0aW9uOiBCdWxrT3BlcmF0aW9uID0gXCJyZXBsYWNlXCI7XG4gIHByaXZhdGUgcmF3VmFsdWUgPSBcIlwiO1xuICBwcml2YXRlIGxhc3RQcmV2aWV3OiBPcGVyYXRpb25QbGFuIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgYXBwbHlCdXR0b246IEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgcHJldmlld0NvbnRhaW5lcjogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSB2YWx1ZUNvbnRhaW5lcjogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcblxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcHJpdmF0ZSBwbHVnaW46IEJhc2VPcHNQbHVnaW4pIHtcbiAgICBzdXBlcihhcHApO1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIHRoaXMuc2VsZWN0ZWRGaWxlcyA9IHRoaXMucGx1Z2luLmdldFNlbGVjdGVkTWFya2Rvd25GaWxlcygpO1xuICAgIHRoaXMucHJvcGVydHlOYW1lID0gXCJcIjtcbiAgICB0aGlzLnJhd1ZhbHVlID0gXCJcIjtcbiAgICB0aGlzLmxhc3RQcmV2aWV3ID0gbnVsbDtcblxuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5hZGRDbGFzcyhcImJhc2VvcHMtbW9kYWxcIik7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKFwiaDJcIiwgeyB0ZXh0OiBcIkJhc2VPcHMgQnVsayBFZGl0b3JcIiB9KTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoXCJwXCIsIHtcbiAgICAgIGNsczogXCJiYXNlb3BzLW11dGVkXCIsXG4gICAgICB0ZXh0OiBgJHt0aGlzLnNlbGVjdGVkRmlsZXMubGVuZ3RofSBzZWxlY3RlZCBub3RlJHt0aGlzLnNlbGVjdGVkRmlsZXMubGVuZ3RoID09PSAxID8gXCJcIiA6IFwic1wifWBcbiAgICB9KTtcblxuICAgIGlmICh0aGlzLnNlbGVjdGVkRmlsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb250ZW50RWwuY3JlYXRlRWwoXCJwXCIsIHtcbiAgICAgICAgdGV4dDogYE5vIHNlbGVjdGVkIG5vdGVzLiBBZGQgYSBjaGVja2JveCBwcm9wZXJ0eSBuYW1lZCAke3RoaXMucGx1Z2luLnNldHRpbmdzLnNlbGVjdGlvblByb3BlcnR5fSBpbiBhIEJhc2Ugdmlldywgb3IgcnVuIFwiQmFzZU9wczogVG9nZ2xlIGFjdGl2ZSBub3RlIHNlbGVjdGlvblwiIG9uIG5vdGVzIHlvdSB3YW50IHRvIGVkaXQuYFxuICAgICAgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoXCJQcm9wZXJ0eVwiKVxuICAgICAgLnNldERlc2MoXCJUaGUgZnJvbnRtYXR0ZXIgcHJvcGVydHkgdG8gY2hhbmdlLlwiKVxuICAgICAgLmFkZFRleHQoKHRleHQpID0+IHtcbiAgICAgICAgdGV4dC5zZXRQbGFjZWhvbGRlcihcInN0YXR1cywgdGFncywgb3duZXJcIilcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wcm9wZXJ0eU5hbWUpXG4gICAgICAgICAgLm9uQ2hhbmdlKCh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wcm9wZXJ0eU5hbWUgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMuaW52YWxpZGF0ZVByZXZpZXcoKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGVudEVsKVxuICAgICAgLnNldE5hbWUoXCJPcGVyYXRpb25cIilcbiAgICAgIC5hZGREcm9wZG93bigoZHJvcGRvd24pID0+IHtcbiAgICAgICAgZHJvcGRvd25cbiAgICAgICAgICAuYWRkT3B0aW9uKFwicmVwbGFjZVwiLCBcIlJlcGxhY2VcIilcbiAgICAgICAgICAuYWRkT3B0aW9uKFwiYWRkXCIsIFwiQWRkXCIpXG4gICAgICAgICAgLmFkZE9wdGlvbihcInJlbW92ZVwiLCBcIlJlbW92ZVwiKVxuICAgICAgICAgIC5hZGRPcHRpb24oXCJjbGVhclwiLCBcIkNsZWFyXCIpXG4gICAgICAgICAgLnNldFZhbHVlKHRoaXMub3BlcmF0aW9uKVxuICAgICAgICAgIC5vbkNoYW5nZSgodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMub3BlcmF0aW9uID0gdmFsdWUgYXMgQnVsa09wZXJhdGlvbjtcbiAgICAgICAgICAgIHRoaXMuaW52YWxpZGF0ZVByZXZpZXcoKTtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyVmFsdWVTZXR0aW5nKCk7XG4gICAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgIHRoaXMudmFsdWVDb250YWluZXIgPSBjb250ZW50RWwuY3JlYXRlRGl2KCk7XG4gICAgdGhpcy5yZW5kZXJWYWx1ZVNldHRpbmcoKTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRlbnRFbClcbiAgICAgIC5hZGRCdXR0b24oKGJ1dHRvbikgPT4ge1xuICAgICAgICBidXR0b25cbiAgICAgICAgICAuc2V0QnV0dG9uVGV4dChcIlByZXZpZXdcIilcbiAgICAgICAgICAuc2V0Q3RhKClcbiAgICAgICAgICAub25DbGljaygoKSA9PiB0aGlzLnByZXZpZXcoKSk7XG4gICAgICB9KVxuICAgICAgLmFkZEJ1dHRvbigoYnV0dG9uKSA9PiB7XG4gICAgICAgIHRoaXMuYXBwbHlCdXR0b24gPSBidXR0b24uYnV0dG9uRWw7XG4gICAgICAgIGJ1dHRvblxuICAgICAgICAgIC5zZXRCdXR0b25UZXh0KFwiQXBwbHlcIilcbiAgICAgICAgICAuc2V0RGlzYWJsZWQodHJ1ZSlcbiAgICAgICAgICAub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoIXRoaXMubGFzdFByZXZpZXcpIHtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uYXBwbHlQbGFuKHRoaXMubGFzdFByZXZpZXcpO1xuICAgICAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICB0aGlzLnByZXZpZXdDb250YWluZXIgPSBjb250ZW50RWwuY3JlYXRlRGl2KHsgY2xzOiBcImJhc2VvcHMtcHJldmlld1wiIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJWYWx1ZVNldHRpbmcoKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLnZhbHVlQ29udGFpbmVyKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy52YWx1ZUNvbnRhaW5lci5lbXB0eSgpO1xuICAgIGNvbnN0IHZhbHVlU2V0dGluZyA9IG5ldyBTZXR0aW5nKHRoaXMudmFsdWVDb250YWluZXIpO1xuICAgIGlmICghb3BlcmF0aW9uTmVlZHNWYWx1ZSh0aGlzLm9wZXJhdGlvbikpIHtcbiAgICAgIHZhbHVlU2V0dGluZy5zZXROYW1lKFwiVmFsdWVcIikuc2V0RGVzYyhcIkNsZWFyIHJlbW92ZXMgdGhlIHByb3BlcnR5IGZyb20gc2VsZWN0ZWQgbm90ZXMuXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhbHVlU2V0dGluZ1xuICAgICAgLnNldE5hbWUoXCJWYWx1ZVwiKVxuICAgICAgLnNldERlc2MoXCJVc2UgY29tbWFzIGZvciBhZGQvcmVtb3ZlIGxpc3QgdmFsdWVzLiBUYWdzIG1heSBpbmNsdWRlICMuXCIpXG4gICAgICAuYWRkVGV4dCgodGV4dCkgPT4ge1xuICAgICAgICB0ZXh0XG4gICAgICAgICAgLnNldFBsYWNlaG9sZGVyKHRoaXMub3BlcmF0aW9uID09PSBcInJlcGxhY2VcIiA/IFwiZG9uZVwiIDogXCJhbHBoYSwgYmV0YVwiKVxuICAgICAgICAgIC5zZXRWYWx1ZSh0aGlzLnJhd1ZhbHVlKVxuICAgICAgICAgIC5vbkNoYW5nZSgodmFsdWUpID0+IHtcbiAgICAgICAgICAgIHRoaXMucmF3VmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMuaW52YWxpZGF0ZVByZXZpZXcoKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBwcmV2aWV3KCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5wcmV2aWV3Q29udGFpbmVyKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHN0YXRlcyA9IHRoaXMucGx1Z2luLmdldEZpbGVQcm9wZXJ0eVN0YXRlcyh0aGlzLnNlbGVjdGVkRmlsZXMsIHRoaXMucHJvcGVydHlOYW1lLnRyaW0oKSk7XG4gICAgICB0aGlzLmxhc3RQcmV2aWV3ID0gcGxhbk9wZXJhdGlvbihzdGF0ZXMsIHRoaXMucHJvcGVydHlOYW1lLCB0aGlzLm9wZXJhdGlvbiwgdGhpcy5yYXdWYWx1ZSk7XG4gICAgICB0aGlzLnJlbmRlclByZXZpZXcodGhpcy5sYXN0UHJldmlldyk7XG4gICAgICBpZiAodGhpcy5hcHBseUJ1dHRvbikge1xuICAgICAgICB0aGlzLmFwcGx5QnV0dG9uLmRpc2FibGVkID0gdGhpcy5sYXN0UHJldmlldy5jaGFuZ2VkRmlsZXMubGVuZ3RoID09PSAwO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aGlzLmxhc3RQcmV2aWV3ID0gbnVsbDtcbiAgICAgIHRoaXMuYXBwbHlCdXR0b24/LnNldEF0dHJpYnV0ZShcImRpc2FibGVkXCIsIFwidHJ1ZVwiKTtcbiAgICAgIHRoaXMucHJldmlld0NvbnRhaW5lci5lbXB0eSgpO1xuICAgICAgdGhpcy5wcmV2aWV3Q29udGFpbmVyLmNyZWF0ZUVsKFwicFwiLCB7XG4gICAgICAgIGNsczogXCJiYXNlb3BzLWVycm9yXCIsXG4gICAgICAgIHRleHQ6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogXCJQcmV2aWV3IGZhaWxlZC5cIlxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBpbnZhbGlkYXRlUHJldmlldygpOiB2b2lkIHtcbiAgICB0aGlzLmxhc3RQcmV2aWV3ID0gbnVsbDtcbiAgICB0aGlzLmFwcGx5QnV0dG9uPy5zZXRBdHRyaWJ1dGUoXCJkaXNhYmxlZFwiLCBcInRydWVcIik7XG4gIH1cblxuICBwcml2YXRlIHJlbmRlclByZXZpZXcocGxhbjogT3BlcmF0aW9uUGxhbik6IHZvaWQge1xuICAgIGlmICghdGhpcy5wcmV2aWV3Q29udGFpbmVyKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5wcmV2aWV3Q29udGFpbmVyLmVtcHR5KCk7XG4gICAgdGhpcy5wcmV2aWV3Q29udGFpbmVyLmNyZWF0ZUVsKFwiaDNcIiwgeyB0ZXh0OiBcIlByZXZpZXdcIiB9KTtcbiAgICB0aGlzLnByZXZpZXdDb250YWluZXIuY3JlYXRlRWwoXCJwXCIsIHtcbiAgICAgIHRleHQ6IGAke3BsYW4udG90YWxGaWxlc30gc2VsZWN0ZWQsICR7cGxhbi5jaGFuZ2VkRmlsZXMubGVuZ3RofSB3aWxsIGNoYW5nZSwgJHtwbGFuLnNraXBwZWRGaWxlcy5sZW5ndGh9IHNraXBwZWQuYFxuICAgIH0pO1xuXG4gICAgY29uc3QgbGltaXQgPSBNYXRoLm1heCgxLCB0aGlzLnBsdWdpbi5zZXR0aW5ncy5wcmV2aWV3TGltaXQpO1xuICAgIGNvbnN0IHZpc2libGVDaGFuZ2VzID0gcGxhbi5jaGFuZ2VkRmlsZXMuc2xpY2UoMCwgbGltaXQpO1xuXG4gICAgaWYgKHZpc2libGVDaGFuZ2VzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IGxpc3QgPSB0aGlzLnByZXZpZXdDb250YWluZXIuY3JlYXRlRWwoXCJ1bFwiLCB7IGNsczogXCJiYXNlb3BzLXByZXZpZXctbGlzdFwiIH0pO1xuICAgICAgZm9yIChjb25zdCBjaGFuZ2Ugb2YgdmlzaWJsZUNoYW5nZXMpIHtcbiAgICAgICAgbGlzdC5jcmVhdGVFbChcImxpXCIsIHtcbiAgICAgICAgICB0ZXh0OiBgJHtjaGFuZ2UucGF0aH06ICR7Y2hhbmdlLm9sZERpc3BsYXl9IC0+ICR7Y2hhbmdlLm5ld0Rpc3BsYXl9YFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocGxhbi5jaGFuZ2VkRmlsZXMubGVuZ3RoID4gdmlzaWJsZUNoYW5nZXMubGVuZ3RoKSB7XG4gICAgICB0aGlzLnByZXZpZXdDb250YWluZXIuY3JlYXRlRWwoXCJwXCIsIHtcbiAgICAgICAgY2xzOiBcImJhc2VvcHMtbXV0ZWRcIixcbiAgICAgICAgdGV4dDogYCR7cGxhbi5jaGFuZ2VkRmlsZXMubGVuZ3RoIC0gdmlzaWJsZUNoYW5nZXMubGVuZ3RofSBtb3JlIGNoYW5nZWQgZmlsZShzKSBoaWRkZW4gYnkgdGhlIHByZXZpZXcgbGltaXQuYFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgdmlzaWJsZVNraXBwZWQgPSBwbGFuLnNraXBwZWRGaWxlcy5zbGljZSgwLCBsaW1pdCk7XG4gICAgaWYgKHZpc2libGVTa2lwcGVkLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMucHJldmlld0NvbnRhaW5lci5jcmVhdGVFbChcImg0XCIsIHsgdGV4dDogXCJTa2lwcGVkXCIgfSk7XG4gICAgICBjb25zdCBza2lwcGVkTGlzdCA9IHRoaXMucHJldmlld0NvbnRhaW5lci5jcmVhdGVFbChcInVsXCIsIHsgY2xzOiBcImJhc2VvcHMtcHJldmlldy1saXN0XCIgfSk7XG4gICAgICBmb3IgKGNvbnN0IHNraXBwZWQgb2YgdmlzaWJsZVNraXBwZWQpIHtcbiAgICAgICAgc2tpcHBlZExpc3QuY3JlYXRlRWwoXCJsaVwiLCB7XG4gICAgICAgICAgdGV4dDogYCR7c2tpcHBlZC5wYXRofTogJHtza2lwcGVkLnJlYXNvbn0gKCR7Zm9ybWF0VmFsdWUoc2tpcHBlZC52YWx1ZSl9KWBcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmNsYXNzIEJhc2VPcHNTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwcml2YXRlIHBsdWdpbjogQmFzZU9wc1BsdWdpbikge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDJcIiwgeyB0ZXh0OiBcIkJhc2VPcHMgU2V0dGluZ3NcIiB9KTtcblxuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJTZWxlY3Rpb24gcHJvcGVydHlcIilcbiAgICAgIC5zZXREZXNjKFwiQm9vbGVhbiBwcm9wZXJ0eSB1c2VkIHRvIHNlbGVjdCBub3RlcyBmcm9tIEJhc2VzIG9yIGNvbW1hbmRzLlwiKVxuICAgICAgLmFkZFRleHQoKHRleHQpID0+IHtcbiAgICAgICAgdGV4dFxuICAgICAgICAgIC5zZXRQbGFjZWhvbGRlcihERUZBVUxUX1NFTEVDVElPTl9QUk9QRVJUWSlcbiAgICAgICAgICAuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3Muc2VsZWN0aW9uUHJvcGVydHkpXG4gICAgICAgICAgLm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3Muc2VsZWN0aW9uUHJvcGVydHkgPSB2YWx1ZS50cmltKCkgfHwgREVGQVVMVF9TRUxFQ1RJT05fUFJPUEVSVFk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pO1xuXG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIlByZXZpZXcgcm93IGxpbWl0XCIpXG4gICAgICAuc2V0RGVzYyhcIk1heGltdW0gY2hhbmdlZCBhbmQgc2tpcHBlZCByb3dzIHNob3duIGluIHRoZSBtb2RhbC5cIilcbiAgICAgIC5hZGRUZXh0KCh0ZXh0KSA9PiB7XG4gICAgICAgIHRleHRcbiAgICAgICAgICAuc2V0UGxhY2Vob2xkZXIoU3RyaW5nKERFRkFVTFRfUFJFVklFV19MSU1JVCkpXG4gICAgICAgICAgLnNldFZhbHVlKFN0cmluZyh0aGlzLnBsdWdpbi5zZXR0aW5ncy5wcmV2aWV3TGltaXQpKVxuICAgICAgICAgIC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IE51bWJlci5wYXJzZUludCh2YWx1ZSwgMTApO1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MucHJldmlld0xpbWl0ID0gTnVtYmVyLmlzRmluaXRlKHBhcnNlZCkgJiYgcGFyc2VkID4gMCA/IHBhcnNlZCA6IERFRkFVTFRfUFJFVklFV19MSU1JVDtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiUmVzdG9yZSBkZWZhdWx0c1wiKVxuICAgICAgLnNldERlc2MoXCJSZXNldCBCYXNlT3BzIHNldHRpbmdzIHRvIHRoZWlyIGRlZmF1bHQgdmFsdWVzLlwiKVxuICAgICAgLmFkZEJ1dHRvbigoYnV0dG9uKSA9PiB7XG4gICAgICAgIGJ1dHRvblxuICAgICAgICAgIC5zZXRCdXR0b25UZXh0KFwiUmVzdG9yZSBEZWZhdWx0c1wiKVxuICAgICAgICAgIC5vbkNsaWNrKGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzID0geyAuLi5ERUZBVUxUX1NFVFRJTkdTIH07XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICAgIHRoaXMuZGlzcGxheSgpO1xuICAgICAgICAgICAgbmV3IE5vdGljZShcIkJhc2VPcHM6IFNldHRpbmdzIHJlc3RvcmVkLlwiKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pO1xuICB9XG59XG4iLCAiZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VMRUNUSU9OX1BST1BFUlRZID0gXCJiYXNlb3BzX3NlbGVjdGVkXCI7XG5leHBvcnQgY29uc3QgREVGQVVMVF9QUkVWSUVXX0xJTUlUID0gNTA7XG5cbmV4cG9ydCB0eXBlIEJ1bGtPcGVyYXRpb24gPSBcInJlcGxhY2VcIiB8IFwiYWRkXCIgfCBcInJlbW92ZVwiIHwgXCJjbGVhclwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIEZpbGVQcm9wZXJ0eVN0YXRlIHtcbiAgcGF0aDogc3RyaW5nO1xuICBwcm9wZXJ0eUV4aXN0czogYm9vbGVhbjtcbiAgdmFsdWU6IHVua25vd247XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGxhbm5lZENoYW5nZSB7XG4gIHBhdGg6IHN0cmluZztcbiAgcHJvcGVydHlFeGlzdHM6IGJvb2xlYW47XG4gIG9sZFZhbHVlOiB1bmtub3duO1xuICBuZXdWYWx1ZTogdW5rbm93bjtcbiAgb2xkRGlzcGxheTogc3RyaW5nO1xuICBuZXdEaXNwbGF5OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2tpcHBlZENoYW5nZSB7XG4gIHBhdGg6IHN0cmluZztcbiAgdmFsdWU6IHVua25vd247XG4gIHJlYXNvbjogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIE9wZXJhdGlvblBsYW4ge1xuICBvcGVyYXRpb246IEJ1bGtPcGVyYXRpb247XG4gIHByb3BlcnR5TmFtZTogc3RyaW5nO1xuICB0b3RhbEZpbGVzOiBudW1iZXI7XG4gIGNoYW5nZWRGaWxlczogUGxhbm5lZENoYW5nZVtdO1xuICBza2lwcGVkRmlsZXM6IFNraXBwZWRDaGFuZ2VbXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzU2VsZWN0ZWRWYWx1ZSh2YWx1ZTogdW5rbm93bik6IGJvb2xlYW4ge1xuICBpZiAodmFsdWUgPT09IHRydWUgfHwgdmFsdWUgPT09IDEpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgdmFsdWUgPT09IFwic3RyaW5nXCIpIHtcbiAgICBjb25zdCBub3JtYWxpemVkID0gdmFsdWUudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gICAgcmV0dXJuIG5vcm1hbGl6ZWQgPT09IFwidHJ1ZVwiIHx8IG5vcm1hbGl6ZWQgPT09IFwieWVzXCIgfHwgbm9ybWFsaXplZCA9PT0gXCIxXCI7XG4gIH1cblxuICByZXR1cm4gZmFsc2U7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVQcm9wZXJ0eU5hbWUocHJvcGVydHlOYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gcHJvcGVydHlOYW1lLnRyaW0oKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG9wZXJhdGlvbk5lZWRzVmFsdWUob3BlcmF0aW9uOiBCdWxrT3BlcmF0aW9uKTogYm9vbGVhbiB7XG4gIHJldHVybiBvcGVyYXRpb24gIT09IFwiY2xlYXJcIjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlSW5wdXRWYWx1ZShyYXdWYWx1ZTogc3RyaW5nLCBvcGVyYXRpb246IEJ1bGtPcGVyYXRpb24sIHByb3BlcnR5TmFtZTogc3RyaW5nKTogdW5rbm93biB7XG4gIGlmICghb3BlcmF0aW9uTmVlZHNWYWx1ZShvcGVyYXRpb24pKSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuXG4gIGNvbnN0IHRyaW1tZWQgPSByYXdWYWx1ZS50cmltKCk7XG4gIGlmICh0cmltbWVkLmxlbmd0aCA9PT0gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkVudGVyIGEgdmFsdWUgYmVmb3JlIHByZXZpZXdpbmcgdGhpcyBvcGVyYXRpb24uXCIpO1xuICB9XG5cbiAgaWYgKG9wZXJhdGlvbiA9PT0gXCJhZGRcIiB8fCBvcGVyYXRpb24gPT09IFwicmVtb3ZlXCIpIHtcbiAgICByZXR1cm4gc3BsaXRMaXN0SW5wdXQodHJpbW1lZCwgcHJvcGVydHlOYW1lKTtcbiAgfVxuXG4gIHJldHVybiBub3JtYWxpemVUb2tlbih0cmltbWVkLCBwcm9wZXJ0eU5hbWUpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGxhbk9wZXJhdGlvbihcbiAgZmlsZXM6IEZpbGVQcm9wZXJ0eVN0YXRlW10sXG4gIHByb3BlcnR5TmFtZUlucHV0OiBzdHJpbmcsXG4gIG9wZXJhdGlvbjogQnVsa09wZXJhdGlvbixcbiAgcmF3VmFsdWU6IHN0cmluZ1xuKTogT3BlcmF0aW9uUGxhbiB7XG4gIGNvbnN0IHByb3BlcnR5TmFtZSA9IG5vcm1hbGl6ZVByb3BlcnR5TmFtZShwcm9wZXJ0eU5hbWVJbnB1dCk7XG4gIGlmIChwcm9wZXJ0eU5hbWUubGVuZ3RoID09PSAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiRW50ZXIgYSBwcm9wZXJ0eSBuYW1lIGJlZm9yZSBwcmV2aWV3aW5nLlwiKTtcbiAgfVxuXG4gIGNvbnN0IHBhcnNlZFZhbHVlID0gcGFyc2VJbnB1dFZhbHVlKHJhd1ZhbHVlLCBvcGVyYXRpb24sIHByb3BlcnR5TmFtZSk7XG4gIGNvbnN0IGNoYW5nZWRGaWxlczogUGxhbm5lZENoYW5nZVtdID0gW107XG4gIGNvbnN0IHNraXBwZWRGaWxlczogU2tpcHBlZENoYW5nZVtdID0gW107XG5cbiAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgY29uc3QgbmV4dFZhbHVlID0gbmV4dFByb3BlcnR5VmFsdWUoZmlsZS52YWx1ZSwgZmlsZS5wcm9wZXJ0eUV4aXN0cywgb3BlcmF0aW9uLCBwYXJzZWRWYWx1ZSk7XG5cbiAgICBpZiAodmFsdWVzRXF1YWwoZmlsZS52YWx1ZSwgbmV4dFZhbHVlKSkge1xuICAgICAgc2tpcHBlZEZpbGVzLnB1c2goe1xuICAgICAgICBwYXRoOiBmaWxlLnBhdGgsXG4gICAgICAgIHZhbHVlOiBmaWxlLnZhbHVlLFxuICAgICAgICByZWFzb246IFwiTm8gY2hhbmdlXCJcbiAgICAgIH0pO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgY2hhbmdlZEZpbGVzLnB1c2goe1xuICAgICAgcGF0aDogZmlsZS5wYXRoLFxuICAgICAgcHJvcGVydHlFeGlzdHM6IGZpbGUucHJvcGVydHlFeGlzdHMsXG4gICAgICBvbGRWYWx1ZTogZmlsZS52YWx1ZSxcbiAgICAgIG5ld1ZhbHVlOiBuZXh0VmFsdWUsXG4gICAgICBvbGREaXNwbGF5OiBmb3JtYXRWYWx1ZShmaWxlLnZhbHVlKSxcbiAgICAgIG5ld0Rpc3BsYXk6IGZvcm1hdFZhbHVlKG5leHRWYWx1ZSlcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgb3BlcmF0aW9uLFxuICAgIHByb3BlcnR5TmFtZSxcbiAgICB0b3RhbEZpbGVzOiBmaWxlcy5sZW5ndGgsXG4gICAgY2hhbmdlZEZpbGVzLFxuICAgIHNraXBwZWRGaWxlc1xuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbmV4dFByb3BlcnR5VmFsdWUoXG4gIGN1cnJlbnRWYWx1ZTogdW5rbm93bixcbiAgcHJvcGVydHlFeGlzdHM6IGJvb2xlYW4sXG4gIG9wZXJhdGlvbjogQnVsa09wZXJhdGlvbixcbiAgcGFyc2VkVmFsdWU6IHVua25vd25cbik6IHVua25vd24ge1xuICBpZiAob3BlcmF0aW9uID09PSBcImNsZWFyXCIpIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG5cbiAgaWYgKG9wZXJhdGlvbiA9PT0gXCJyZXBsYWNlXCIpIHtcbiAgICByZXR1cm4gcGFyc2VkVmFsdWU7XG4gIH1cblxuICBjb25zdCByZXF1ZXN0ZWQgPSBBcnJheS5pc0FycmF5KHBhcnNlZFZhbHVlKSA/IHBhcnNlZFZhbHVlIDogW3BhcnNlZFZhbHVlXTtcbiAgY29uc3QgY3VycmVudEl0ZW1zID0gcHJvcGVydHlFeGlzdHMgPyB0b0xpc3QoY3VycmVudFZhbHVlKSA6IFtdO1xuXG4gIGlmIChvcGVyYXRpb24gPT09IFwiYWRkXCIpIHtcbiAgICBjb25zdCBuZXh0ID0gWy4uLmN1cnJlbnRJdGVtc107XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIHJlcXVlc3RlZCkge1xuICAgICAgaWYgKCFuZXh0LnNvbWUoKGV4aXN0aW5nKSA9PiB2YWx1ZXNFcXVhbChleGlzdGluZywgaXRlbSkpKSB7XG4gICAgICAgIG5leHQucHVzaChpdGVtKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG5leHQ7XG4gIH1cblxuICBpZiAob3BlcmF0aW9uID09PSBcInJlbW92ZVwiKSB7XG4gICAgcmV0dXJuIGN1cnJlbnRJdGVtcy5maWx0ZXIoKGl0ZW0pID0+ICFyZXF1ZXN0ZWQuc29tZSgocmVtb3ZlSXRlbSkgPT4gdmFsdWVzRXF1YWwoaXRlbSwgcmVtb3ZlSXRlbSkpKTtcbiAgfVxuXG4gIHJldHVybiBjdXJyZW50VmFsdWU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmb3JtYXRWYWx1ZSh2YWx1ZTogdW5rbm93bik6IHN0cmluZyB7XG4gIGlmICh0eXBlb2YgdmFsdWUgPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICByZXR1cm4gXCIobWlzc2luZylcIjtcbiAgfVxuXG4gIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgIHJldHVybiBcIm51bGxcIjtcbiAgfVxuXG4gIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgIHJldHVybiBgWyR7dmFsdWUubWFwKChpdGVtKSA9PiBmb3JtYXRWYWx1ZShpdGVtKSkuam9pbihcIiwgXCIpfV1gO1xuICB9XG5cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJvYmplY3RcIikge1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh2YWx1ZSk7XG4gIH1cblxuICByZXR1cm4gU3RyaW5nKHZhbHVlKTtcbn1cblxuZnVuY3Rpb24gc3BsaXRMaXN0SW5wdXQodmFsdWU6IHN0cmluZywgcHJvcGVydHlOYW1lOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIGNvbnN0IHZhbHVlcyA9IHZhbHVlXG4gICAgLnNwbGl0KFwiLFwiKVxuICAgIC5tYXAoKHBhcnQpID0+IG5vcm1hbGl6ZVRva2VuKHBhcnQsIHByb3BlcnR5TmFtZSkpXG4gICAgLmZpbHRlcigocGFydCkgPT4gcGFydC5sZW5ndGggPiAwKTtcblxuICBpZiAodmFsdWVzLmxlbmd0aCA9PT0gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkVudGVyIGF0IGxlYXN0IG9uZSB2YWx1ZSBiZWZvcmUgcHJldmlld2luZyB0aGlzIG9wZXJhdGlvbi5cIik7XG4gIH1cblxuICByZXR1cm4gdmFsdWVzO1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVUb2tlbih2YWx1ZTogc3RyaW5nLCBwcm9wZXJ0eU5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IHRyaW1tZWQgPSB2YWx1ZS50cmltKCk7XG4gIGlmIChpc1RhZ1Byb3BlcnR5KHByb3BlcnR5TmFtZSkpIHtcbiAgICByZXR1cm4gdHJpbW1lZC5yZXBsYWNlKC9eIysvLCBcIlwiKTtcbiAgfVxuICByZXR1cm4gdHJpbW1lZDtcbn1cblxuZnVuY3Rpb24gaXNUYWdQcm9wZXJ0eShwcm9wZXJ0eU5hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBjb25zdCBub3JtYWxpemVkID0gcHJvcGVydHlOYW1lLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICByZXR1cm4gbm9ybWFsaXplZCA9PT0gXCJ0YWdcIiB8fCBub3JtYWxpemVkID09PSBcInRhZ3NcIjtcbn1cblxuZnVuY3Rpb24gdG9MaXN0KHZhbHVlOiB1bmtub3duKTogdW5rbm93bltdIHtcbiAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG5cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIHJldHVybiBbdmFsdWVdO1xufVxuXG5mdW5jdGlvbiB2YWx1ZXNFcXVhbChsZWZ0OiB1bmtub3duLCByaWdodDogdW5rbm93bik6IGJvb2xlYW4ge1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkobGVmdCkgPT09IEpTT04uc3RyaW5naWZ5KHJpZ2h0KTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLHNCQVFPOzs7QUNSQSxJQUFNLDZCQUE2QjtBQUNuQyxJQUFNLHdCQUF3QjtBQWlDOUIsU0FBUyxnQkFBZ0IsT0FBeUI7QUFDdkQsTUFBSSxVQUFVLFFBQVEsVUFBVSxHQUFHO0FBQ2pDLFdBQU87QUFBQSxFQUNUO0FBRUEsTUFBSSxPQUFPLFVBQVUsVUFBVTtBQUM3QixVQUFNLGFBQWEsTUFBTSxLQUFLLEVBQUUsWUFBWTtBQUM1QyxXQUFPLGVBQWUsVUFBVSxlQUFlLFNBQVMsZUFBZTtBQUFBLEVBQ3pFO0FBRUEsU0FBTztBQUNUO0FBRU8s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

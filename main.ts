import {
  App,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile
} from "obsidian";
import {
  BulkOperation,
  DEFAULT_PREVIEW_LIMIT,
  DEFAULT_SELECTION_PROPERTY,
  FilePropertyState,
  OperationPlan,
  formatValue,
  isSelectedValue,
  operationNeedsValue,
  planOperation
} from "./src/operations";

interface BaseOpsSettings {
  selectionProperty: string;
  previewLimit: number;
}

interface UndoEntry {
  file: TFile;
  propertyName: string;
  propertyExists: boolean;
  oldValue: unknown;
}

const DEFAULT_SETTINGS: BaseOpsSettings = {
  selectionProperty: DEFAULT_SELECTION_PROPERTY,
  previewLimit: DEFAULT_PREVIEW_LIMIT
};

export default class BaseOpsPlugin extends Plugin {
  settings: BaseOpsSettings = DEFAULT_SETTINGS;
  private undoSnapshot: UndoEntry[] | null = null;

  async onload(): Promise<void> {
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

  async loadSettings(): Promise<void> {
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(await this.loadData())
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  getSelectedMarkdownFiles(): TFile[] {
    const propertyName = this.settings.selectionProperty.trim() || DEFAULT_SELECTION_PROPERTY;
    return this.app.vault
      .getMarkdownFiles()
      .filter((file) => isSelectedValue(this.app.metadataCache.getFileCache(file)?.frontmatter?.[propertyName]));
  }

  getFilePropertyStates(files: TFile[], propertyName: string): FilePropertyState[] {
    return files.map((file) => {
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
      return {
        path: file.path,
        propertyExists: Object.prototype.hasOwnProperty.call(frontmatter, propertyName),
        value: frontmatter[propertyName]
      };
    });
  }

  findFile(path: string): TFile | null {
    const abstractFile = this.app.vault.getAbstractFileByPath(path);
    return abstractFile instanceof TFile ? abstractFile : null;
  }

  async applyPlan(plan: OperationPlan): Promise<number> {
    if (plan.changedFiles.length === 0) {
      new Notice("BaseOps: Preview contains no changes to apply.");
      return 0;
    }

    const undoEntries: UndoEntry[] = [];

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
    new Notice(`BaseOps: Applied changes to ${undoEntries.length} file${undoEntries.length === 1 ? "" : "s"}.`);
    return undoEntries.length;
  }

  async undoLastOperation(): Promise<void> {
    if (!this.undoSnapshot || this.undoSnapshot.length === 0) {
      new Notice("BaseOps: No operation to undo in this session.");
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
    new Notice(`BaseOps: Undid changes to ${snapshot.length} file${snapshot.length === 1 ? "" : "s"}.`);
  }

  private async toggleActiveNoteSelection(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice("BaseOps: Open a Markdown note before toggling selection.");
      return;
    }

    if (file.extension !== "md") {
      new Notice("BaseOps: BaseOps selection only works on Markdown notes.");
      return;
    }

    const propertyName = this.settings.selectionProperty.trim() || DEFAULT_SELECTION_PROPERTY;
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter[propertyName] = !isSelectedValue(frontmatter[propertyName]);
    });

    new Notice("BaseOps: Toggled active note selection.");
  }

  private async clearSelectedNotes(): Promise<void> {
    const propertyName = this.settings.selectionProperty.trim() || DEFAULT_SELECTION_PROPERTY;
    const files = this.getSelectedMarkdownFiles();

    for (const file of files) {
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        delete frontmatter[propertyName];
      });
    }

    new Notice(`BaseOps: Cleared selection from ${files.length} file${files.length === 1 ? "" : "s"}.`);
  }
}

class BulkEditorModal extends Modal {
  private selectedFiles: TFile[] = [];
  private propertyName = "";
  private operation: BulkOperation = "replace";
  private rawValue = "";
  private lastPreview: OperationPlan | null = null;
  private applyButton: HTMLButtonElement | null = null;
  private previewContainer: HTMLElement | null = null;
  private valueContainer: HTMLElement | null = null;

  constructor(app: App, private plugin: BaseOpsPlugin) {
    super(app);
  }

  onOpen(): void {
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

    new Setting(contentEl)
      .setName("Property")
      .setDesc("The frontmatter property to change.")
      .addText((text) => {
        text.setPlaceholder("status, tags, owner")
          .setValue(this.propertyName)
          .onChange((value) => {
            this.propertyName = value;
            this.invalidatePreview();
          });
      });

    new Setting(contentEl)
      .setName("Operation")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("replace", "Replace")
          .addOption("add", "Add")
          .addOption("remove", "Remove")
          .addOption("clear", "Clear")
          .setValue(this.operation)
          .onChange((value) => {
            this.operation = value as BulkOperation;
            this.invalidatePreview();
            this.renderValueSetting();
          });
      });

    this.valueContainer = contentEl.createDiv();
    this.renderValueSetting();

    new Setting(contentEl)
      .addButton((button) => {
        button
          .setButtonText("Preview")
          .setCta()
          .onClick(() => this.preview());
      })
      .addButton((button) => {
        this.applyButton = button.buttonEl;
        button
          .setButtonText("Apply")
          .setDisabled(true)
          .onClick(async () => {
            if (!this.lastPreview) {
              return;
            }
            await this.plugin.applyPlan(this.lastPreview);
            this.close();
          });
      });

    this.previewContainer = contentEl.createDiv({ cls: "baseops-preview" });
  }

  private renderValueSetting(): void {
    if (!this.valueContainer) {
      return;
    }

    this.valueContainer.empty();
    const valueSetting = new Setting(this.valueContainer);
    if (!operationNeedsValue(this.operation)) {
      valueSetting.setName("Value").setDesc("Clear removes the property from selected notes.");
      return;
    }

    valueSetting
      .setName("Value")
      .setDesc("Use commas for add/remove list values. Tags may include #.")
      .addText((text) => {
        text
          .setPlaceholder(this.operation === "replace" ? "done" : "alpha, beta")
          .setValue(this.rawValue)
          .onChange((value) => {
            this.rawValue = value;
            this.invalidatePreview();
          });
      });
  }

  private preview(): void {
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

  private invalidatePreview(): void {
    this.lastPreview = null;
    this.applyButton?.setAttribute("disabled", "true");
  }

  private renderPreview(plan: OperationPlan): void {
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
}

class BaseOpsSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: BaseOpsPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "BaseOps Settings" });

    new Setting(containerEl)
      .setName("Selection property")
      .setDesc("Boolean property used to select notes from Bases or commands.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SELECTION_PROPERTY)
          .setValue(this.plugin.settings.selectionProperty)
          .onChange(async (value) => {
            this.plugin.settings.selectionProperty = value.trim() || DEFAULT_SELECTION_PROPERTY;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Preview row limit")
      .setDesc("Maximum changed and skipped rows shown in the modal.")
      .addText((text) => {
        text
          .setPlaceholder(String(DEFAULT_PREVIEW_LIMIT))
          .setValue(String(this.plugin.settings.previewLimit))
          .onChange(async (value) => {
            const parsed = Number.parseInt(value, 10);
            this.plugin.settings.previewLimit = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PREVIEW_LIMIT;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Restore defaults")
      .setDesc("Reset BaseOps settings to their default values.")
      .addButton((button) => {
        button
          .setButtonText("Restore Defaults")
          .onClick(async () => {
            this.plugin.settings = { ...DEFAULT_SETTINGS };
            await this.plugin.saveSettings();
            this.display();
            new Notice("BaseOps: Settings restored.");
          });
      });
  }
}

# BaseOps

BaseOps is an Obsidian community plugin that adds a safe action layer for notes managed through Properties and Bases. It lets you select notes, preview property changes, apply batch operations, and undo the most recent operation during the current session.

## Installation

### Manual install

1. Download the release assets: `main.js`, `manifest.json`, and `styles.css`.
2. Create this folder in your vault: `.obsidian/plugins/baseops/`.
3. Copy the three release assets into that folder.
4. Reload Obsidian and enable **BaseOps** in Community plugins.

After community review approval, BaseOps can also be installed from Obsidian's Community plugins browser.

## Usage

BaseOps uses a configurable checkbox-style property to choose notes. The default property is `baseops_selected`.

1. Add `baseops_selected` to notes or to a Bases table.
2. Set selected notes to `true`, `yes`, or `1`, or run **BaseOps: Toggle active note selection** from the command palette.
3. Run **BaseOps: Open bulk editor**.
4. Enter the property to change, choose `Replace`, `Add`, `Remove`, or `Clear`, then click **Preview**.
5. Review the files that will change.
6. Click **Apply** to write the previewed operation.

Additional commands:

- **BaseOps: Clear selected notes** removes the selection property from selected notes.
- **BaseOps: Select active folder notes** marks every Markdown note in the active note's folder as selected.
- **BaseOps: Create starter kit** creates a small demo folder so new users can try previews, presets, apply, and undo safely.
- **BaseOps: Undo last operation** restores the most recent BaseOps batch operation from memory.

## Workflow Presets

The bulk editor includes workflow presets for common changes, such as marking notes done, adding a review tag, or clearing an owner. You can save your current property, operation, and value as a reusable preset from the editor. Presets are local plugin settings and can be removed or restored from BaseOps settings.

## Settings

- **Selection property** controls which frontmatter property marks selected notes.
- **Preview row limit** keeps long previews compact.
- **Workflow presets** lets you remove saved presets or restore the built-in set.
- **Restore defaults** resets BaseOps settings.

## Privacy

BaseOps is local-only and network-free. It does not make network requests, send vault data to third-party services, use analytics, or track users.

## Safety

BaseOps only edits frontmatter properties through Obsidian's `app.fileManager.processFrontMatter` API. It does not delete notes, move files, read outside the vault, or execute shell commands. All bulk edits require a preview before applying. Undo is in-memory and only covers the latest operation in the current Obsidian session.

## Release Assets

GitHub releases should attach exactly these Obsidian plugin assets:

- `main.js`
- `manifest.json`
- `styles.css`

Release tags must match the version in `manifest.json`.

## Development

```bash
npm install
npm test
npm run build
```

The build uses esbuild and writes `main.js` at the plugin root.

# BaseOps PRD

## Product Summary

BaseOps is an Obsidian community plugin that adds a safe action layer for notes managed through Properties and Bases. It lets users select notes, preview property changes, apply batch operations, and undo the most recent operation without sending vault data over the network.

## Positioning

Tagline: The missing action layer for Obsidian Bases.

Primary audience:
- Obsidian users who organize notes with Properties and Bases.
- Users who maintain project lists, reading lists, CRM-like notes, content calendars, or task collections.
- Users who want Notion/Airtable-style bulk editing while keeping local Markdown files.

Differentiators:
- Local-first and network-free.
- Preview before write.
- Undo for the last batch operation.
- Works with regular notes and Base views by using a configurable selection property.
- Mobile-compatible commands and modals.

## Problem

Obsidian Bases makes it easy to view and edit note properties, but repeated property operations across many notes are still awkward. Users often need to:
- Mark a set of notes from a Base table.
- Add or remove a tag across all selected notes.
- Replace a status property across many files.
- Clear a stale property.
- Check exactly what will change before touching dozens or hundreds of Markdown files.
- Recover if they applied the wrong batch edit.

## Goals

MVP goals:
- Provide a command palette workflow for batch property operations.
- Use a configurable checkbox property to select files from any Base table.
- Show an explicit preview of every file and property value change before applying.
- Apply changes through Obsidian's frontmatter API.
- Store enough in-memory history to undo the most recent batch operation during the current session.
- Provide a minimal settings tab.
- Ship with README, license, manifest, versions file, and GitHub-ready release assets.

Non-goals for MVP:
- Directly patch the internal Bases table UI.
- Implement a custom Bases view.
- Move or delete files.
- Use AI or any network service.
- Persist unlimited undo history.
- Support nested YAML objects.

## User Stories

1. As a Bases user, I can add a checkbox property column named `baseops_selected`, check rows in my Base, run BaseOps, and batch update those notes.
2. As a vault maintainer, I can add a tag to selected notes without overwriting existing tags.
3. As a project manager, I can replace `status` with `done` for selected project notes and preview every affected file before the write.
4. As a cautious user, I can cancel after preview if a file is unexpectedly included.
5. As a user who made a mistake, I can undo the last BaseOps batch operation in the same Obsidian session.
6. As a mobile user, I can run the same commands from the command palette.

## Functional Requirements

### Selection

- Default selection property: `baseops_selected`.
- The selection property name is configurable in settings.
- A file is selected when the configured property is true, the string `true`, the string `yes`, the string `1`, or the number `1`.
- Command: `BaseOps: Toggle active note selection`.
- Command: `BaseOps: Clear selected notes`.
- The bulk editor operates on all Markdown notes with the selected property enabled.
- If no notes are selected, the bulk editor should explain how to select notes.

### Bulk Editor

Command: `BaseOps: Open bulk editor`.

The modal must include:
- Selected note count.
- Property name input.
- Operation selector.
- Value input when the operation needs a value.
- Preview action.
- Apply action disabled until a valid preview exists.

Supported operations:
- Replace property value.
- Add value to list-like property.
- Remove value from list-like property.
- Clear property.

Value parsing:
- Text values are plain strings.
- Comma-separated values become an array for add/remove operations.
- Tags may be written with or without `#`; stored values should not include `#`.
- Empty value is invalid for replace/add/remove and valid for clear.

Preview:
- Shows total files selected.
- Shows total files that will change.
- Shows skipped files when the operation would not alter the value.
- Shows per-file old value and new value in a readable format.
- Limits long preview displays to keep the modal usable.

Apply:
- Uses `app.fileManager.processFrontMatter`.
- Applies only files included in the last preview.
- Captures previous values and whether the property existed.
- Shows a notice with the number of changed files.

### Undo

Command: `BaseOps: Undo last operation`.

- Restores the previous value for every changed file from the last operation.
- If the property did not exist before the operation, removes it.
- Undo history is in-memory and session-scoped.
- After a successful undo, the undo snapshot is cleared.

### Settings

The settings tab must include:
- Selection property setting.
- Preview row limit setting.
- Restore defaults button.

### Safety and Privacy

- Plugin must not make network requests.
- Plugin must not read outside the Obsidian vault.
- Plugin must not delete notes.
- Plugin must not move files.
- Plugin must not execute shell commands.
- README must state the plugin is local-only and network-free.

## UX Requirements

- Keep UI compact and clear.
- Use Obsidian-native settings, buttons, dropdowns, text inputs, and notices.
- Destructive or broad operations require preview first.
- Button labels must be action-oriented: Preview, Apply, Clear Selection, Undo.
- Error messages should tell users how to recover.

## Technical Requirements

- TypeScript Obsidian plugin.
- Build output: `main.js`, `manifest.json`, `styles.css`.
- Manifest ID: `baseops`.
- Display name: `BaseOps`.
- Minimum app version: `1.8.7`.
- Desktop-only: false.
- No runtime dependencies beyond the Obsidian API.
- Unit tests for operation planning logic.
- Build with esbuild.
- Include MIT license.

## Acceptance Criteria

- `npm install` succeeds.
- `npm run build` produces `main.js`.
- `npm test` passes.
- `manifest.json` contains required Obsidian fields and version `0.1.0`.
- `versions.json` maps `0.1.0` to the minimum app version.
- README includes install, usage, release, privacy, and safety notes.
- Manual review confirms no network APIs, file deletion, shell execution, or external tracking.
- Manual review confirms release assets exist: `main.js`, `manifest.json`, `styles.css`.

## Launch Plan

1. Create the open-source GitHub repository.
2. Push source code with README, LICENSE, and release-ready assets.
3. Create a GitHub release tagged exactly `0.1.0`.
4. Attach `main.js`, `manifest.json`, and `styles.css` to the release.
5. Submit the repository through Obsidian Community developer dashboard.
6. When approved, update README with community plugin installation instructions.

## Future Roadmap

V0.2:
- Saved operation presets.
- Schema presets for common Bases workflows.
- Better enum suggestions from existing property values.

V0.3:
- Optional custom Bases view with built-in multi-select toolbar.
- CSV export/import for selected notes.

V1.0:
- Persistent operation history.
- Schema validation reports.
- Form-based note creation for specific Base workflows.

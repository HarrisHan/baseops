# BaseOps Release Checklist

## Local Acceptance

- [ ] `npm install` succeeds.
- [ ] `npm test` passes.
- [ ] `npm run build` succeeds.
- [ ] `main.js` exists in the repository root.
- [ ] `manifest.json` exists in the repository root.
- [ ] `styles.css` exists in the repository root.
- [ ] `manifest.json` version is `0.1.0`.
- [ ] `versions.json` maps `0.1.0` to `1.8.7`.
- [ ] README explains usage, privacy, manual install, and release assets.
- [ ] Manual review finds no network calls.
- [ ] Manual review finds no file deletion or file moving.
- [ ] Manual review finds no shell execution.

## GitHub Release

- [ ] Create a public GitHub repository named `baseops`.
- [ ] Push all source files.
- [ ] Create a release tag exactly named `0.1.0`.
- [ ] Attach these assets to the release:
  - [ ] `manifest.json`
  - [ ] `main.js`
  - [ ] `styles.css`
- [ ] Confirm the tag matches `manifest.json` version exactly.

## Obsidian Community Submission

- [ ] Sign in to Obsidian Community developer dashboard.
- [ ] Connect GitHub account.
- [ ] Submit the `baseops` repository.
- [ ] Confirm automated review passes.
- [ ] Confirm plugin metadata:
  - [ ] Name: `BaseOps`
  - [ ] Description: `Preview, apply, and undo batch property operations for notes managed with Obsidian Bases.`
  - [ ] Free / no required payment.
  - [ ] No network access.
  - [ ] Mobile compatible.
- [ ] After approval, update README with community install instructions.

## Launch Copy

Short description:

> Preview, apply, and undo batch property operations for notes managed with Obsidian Bases.

Longer announcement:

> BaseOps is a local-first action layer for Obsidian Bases. Mark notes with a checkbox property, preview a batch property change, apply it safely, and undo the last operation in the same session. It never sends vault data over the network.

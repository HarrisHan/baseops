# BaseOps QA Report

Date: 2026-06-03

## Result

Pass with one environment note: the local shell does not provide `npm`, so `npm install` could not be executed here. Build and tests were verified with the bundled Codex Node runtime plus a manually installed local `esbuild` package.

## Verified Commands

```bash
/Users/harris/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node esbuild.config.mjs production
/Users/harris/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node esbuild.config.mjs test
/Users/harris/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test dist-tests/*.test.mjs
```

## Build Result

- `main.js` generated successfully.
- Release assets present:
  - `main.js`
  - `manifest.json`
  - `styles.css`

## Test Result

- 11 tests passed.
- 0 tests failed.

## Manifest Review

- `id`: `baseops`
- `name`: `BaseOps`
- `version`: `0.1.0`
- `minAppVersion`: `1.8.7`
- `author`: `Harris`
- `isDesktopOnly`: `false`

## Safety Review

Static scan found no matches for:
- Network calls such as `fetch`, `XMLHttpRequest`, `requestUrl`, `http://`, or `https://`.
- Shell execution such as `child_process`, `exec`, or `spawn`.
- File deletion or moving APIs such as `vault.delete`, `vault.trash`, `vault.rename`, `adapter.remove`, or `unlink`.

## Known Limits

- Undo is in-memory and only covers the most recent BaseOps operation during the current Obsidian session.
- The MVP uses a configurable selection property rather than directly patching the internal Bases table UI.
- Replace operations write text values. Add/remove operations treat comma-separated input as list values.

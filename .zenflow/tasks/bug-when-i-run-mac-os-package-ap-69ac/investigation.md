# Investigation: Cannot find module '../services/fileService' in packaged app

## Bug Summary

When running the packaged macOS `.app`, Electron crashes immediately with:

```
Error: Cannot find module '../services/fileService'
Require stack:
- .../app.asar/src/main/ipcHandlers.js
```

## Root Cause

The `build.files` array in `package.json` is incomplete. It only bundles:

```json
"files": [
  "src/main/**/*",
  "src/renderer/dist/**/*",
  "node_modules/**/*"
]
```

This excludes the following directories/files that are required at runtime by main-process modules:

| Missing path | Required by |
|---|---|
| `src/services/**/*` | `ipcHandlers.js` (fileService, transcriptionService, recordingService, transcriptionStoreService), `refinementHandlers.js` (templateManager, ollamaService) |
| `src/config.js` | `ipcHandlers.js`, `refinementHandlers.js` via `require('../config')` |
| `src/config/**/*` | `ipcHandlers.js` via `require('../config/default')` (line 484) |
| `src/utils/**/*` | Potentially needed by services |

When electron-builder creates the `.asar` archive, these paths are not included, so `require()` calls fail at app startup.

## Affected Components

- `package.json` → `build.files` config
- `src/main/ipcHandlers.js` — imports 4 services + config + config/default
- `src/main/refinementHandlers.js` — imports 2 services + config

## Proposed Solution

Add the missing source paths to `build.files` in `package.json`:

```json
"files": [
  "src/main/**/*",
  "src/services/**/*",
  "src/config/**/*",
  "src/utils/**/*",
  "src/config.js",
  "src/renderer/dist/**/*",
  "node_modules/**/*"
]
```

## Edge Cases / Side Effects

- `src/renderer/dist/**/*` is correct (only the built renderer bundle, not source)
- `src/config.js` (root-level) and `src/config/` (directory) are both needed — they are separate files
- No security concerns: these are all internal JS modules with no secrets
- No IPC boundary changes required
- Fix is purely additive (no deletions, no logic changes)

# Investigation: DMG Not Working on macOS

## Bug Summary

The packaged DMG is non-functional — buttons cannot be clicked and the UI is unresponsive. The app loads visually but no interactions work. Running via `npm start` in development mode may appear to work but the same core issue exists.

## Root Cause Analysis

### Primary Root Cause: Missing `App.js` and `AppState.js`

At commit `b1e89a8` ("Extract 5 controllers from monolithic index.js"), the original monolithic `src/renderer/index.js` (4209 lines, class `WhisperWrapperApp`) was refactored into modular ES module controllers. However, the refactoring was **never completed**:

1. The monolithic `index.js` was deleted and replaced with a 61-line module entry point that does `import { App } from './app/App.js'`
2. **`src/renderer/app/App.js` was never created** — the file has never existed in git history
3. **`src/renderer/app/AppState.js` was never created** — also never existed

This means the `<script type="module" src="index.js">` in `index.html` always fails with a module resolution error. Since the module fails, **none of the 7 modular controllers are ever imported or instantiated**:

| Controller | Constructor Args | Status |
|---|---|---|
| TabController | `(appState)` | Never loaded |
| StatusController | `(appState)` | Never loaded |
| SettingsController | `(appState, statusController)` | Never loaded |
| FileUploadController | `(appState, statusController, tabController)` | Never loaded |
| RecordingController | `(appState, statusController, tabController)` | Never loaded |
| TranscriptionController | `(appState, statusController, tabController)` | Never loaded |
| TemplateController | `(appState, statusController)` | Never loaded |

The only controllers that load are:
- `refinementController.js` — loaded as regular `<script>` but **never instantiated** (no `new RefinementController()` call)
- `libraryController.js` — loaded as regular `<script>` and auto-instantiates on `DOMContentLoaded`

**Result**: Tab switching, settings, file upload, recording, transcription, and template management are ALL non-functional. Only the library tab has partial functionality.

### Secondary Issue: macOS Window Close Handler

In `src/main/index.js` lines 57-62:
```js
mainWindow.on('close', (event) => {
    if (process.platform === 'darwin') {
        event.preventDefault();
        mainWindow.hide();
    }
});
```

This prevents the window from closing on macOS (standard hide-to-dock behavior), but there's no `before-quit` flag. When the user tries to quit via Cmd+Q, the `close` event fires, `event.preventDefault()` runs, and the app refuses to quit. The only way to exit is force-kill.

### Tertiary Issue: CSP and `file://` Protocol

The CSP in `index.html`:
```
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;
```

When loaded via `file://` in the packaged app, `'self'` may not correctly resolve for ES module imports within asar archives in some Electron versions. This is a secondary concern — the primary fix (creating `App.js`) must happen first.

### Tertiary Issue: `electron` Not in Dependencies

The `electron` package is not listed in `package.json` dependencies or devDependencies. It should be a devDependency for consistent builds.

## Affected Components

- `src/renderer/index.js` — module entry point references non-existent `App.js`
- `src/renderer/app/` — entire directory missing (App.js, AppState.js)
- `src/renderer/controllers/*` — 7 ES module controllers exist but are never loaded
- `src/main/index.js` — macOS close handler bug
- `src/renderer/index.html` — CSP may need `connect-src` update for packaged app

## Proposed Solution

### Step 1: Create `src/renderer/app/AppState.js`

A centralized state management class that provides:
- `subscribe(channel, callback)` — pub/sub for state changes
- `setCurrentTab(tabName)` / `getCurrentTab()`
- `getRecordingState()` / `setRecordingState(state)`
- `getFileUploadState()` / `setFileUploadState(state)`
- `getTranscriptionState()` / `setTranscriptionState(state)`
- `setUIState(state)`

Reference the old monolithic `WhisperWrapperApp` constructor (available in git at `b1e89a8~1:src/renderer/index.js`) for the state shape.

### Step 2: Create `src/renderer/app/App.js`

The main application coordinator that:
1. Creates `AppState` instance
2. Instantiates controllers in dependency order:
   - `StatusController(appState)`
   - `TabController(appState)`
   - `SettingsController(appState, statusController)`
   - `FileUploadController(appState, statusController, tabController)`
   - `RecordingController(appState, statusController, tabController)`
   - `TranscriptionController(appState, statusController, tabController)`
   - `TemplateController(appState, statusController)`
3. Integrates legacy `RefinementController` (non-module, available on `window`)
4. Exposes app instance globally for legacy compatibility (`window.app`)

### Step 3: Fix macOS Close Handler

Add `before-quit` flag to `src/main/index.js`:
```js
let isQuitting = false;
app.on('before-quit', () => { isQuitting = true; });
mainWindow.on('close', (event) => {
    if (process.platform === 'darwin' && !isQuitting) {
        event.preventDefault();
        mainWindow.hide();
    }
});
```

### Step 4: Update Build Script

Ensure `scripts/build-renderer.js` copies `src/renderer/app/` to `dist/app/`.

### Step 5: Add Regression Tests

- Unit test for `AppState` pub/sub and state management
- Unit test for `App` controller instantiation
- Test that verifies all controllers are loaded and initialized

### Step 6: Verify Build and Package

- Run `npm run build:renderer` and verify `dist/app/App.js` exists
- Run `npm run lint` and `npm run test:unit`
- Test with `npm run start:prod` to verify `file://` loading works

## Edge Cases

- The `RefinementController` is a legacy non-module class — it must be instantiated AFTER DOM is ready, as it queries DOM elements in its constructor
- The `LibraryController` auto-instantiates independently — the new `App.js` should not double-instantiate it
- The `RecordingController` depends on browser APIs (`MediaRecorder`, `AudioContext`) — initialization errors in these should not crash the entire app

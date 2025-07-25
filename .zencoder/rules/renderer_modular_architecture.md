---
description: Documents the new modular architecture for the renderer process
alwaysApply: false
---

## Renderer Process Modular Architecture

The large `src/renderer/index.js` file (4,209 lines) has been refactored into a modular architecture following MVC patterns.

### New Structure:

```
src/renderer/
├── index.js                    # Original monolithic file (to be replaced)
├── new_index.js               # New entry point
├── app/
│   ├── App.js                 # Main application coordinator
│   └── AppState.js            # Centralized state management
├── controllers/
│   ├── TabController.js       # Tab navigation management
│   ├── StatusController.js    # Status updates & progress
│   ├── refinementController.js # AI refinement (existing)
│   └── [Future controllers]   # FileUpload, Recording, Transcription, Settings, Template
├── utils/
│   ├── Constants.js           # Application constants
│   ├── EventHandler.js        # Event listener utilities
│   └── UIHelpers.js          # UI manipulation helpers
└── styles/, assets/           # Existing assets
```

### Key Components:

1. **AppState.js**: Centralized state management with event system
   - Manages all application state (tabs, recording, transcription, AI refinement, settings)
   - Provides subscription system for state changes
   - Includes undo/redo functionality for transcription

2. **App.js**: Main coordinator class
   - Initializes all controllers
   - Manages application lifecycle
   - Provides delegation methods for backward compatibility

3. **Controllers**: Single-responsibility controllers
   - TabController: Tab navigation and switching logic
   - StatusController: Status messages, progress bars, error handling
   - [Future]: FileUploadController, RecordingController, etc.

4. **Utilities**: Reusable helper functions
   - Constants: All app constants and selectors
   - EventHandler: Safe event listener management with debounce/throttle
   - UIHelpers: DOM manipulation, progress bars, notifications

### Migration Strategy:

1. ✅ Created foundational utilities and AppState
2. ✅ Extracted TabController and StatusController
3. ✅ Created main App.js coordinator
4. 🔄 **Next**: Extract remaining controllers (FileUpload, Recording, Transcription, Settings, Template)
5. 🔄 **Final**: Replace index.js with new_index.js

### Benefits:

- **Maintainability**: Each controller handles one feature area
- **Testability**: Controllers can be unit tested independently  
- **Scalability**: Easy to add new features or modify existing ones
- **Team Development**: Multiple developers can work on different controllers
- **State Management**: Centralized state with change notifications
- **Backward Compatibility**: Legacy code continues to work during migration

### Usage:

Controllers are initialized by App.js and communicate through AppState. Event handling is centralized through EventHandler utility. UI updates are managed through UIHelpers.

The architecture maintains compatibility with existing RefinementController and can be gradually migrated by extracting one controller at a time.
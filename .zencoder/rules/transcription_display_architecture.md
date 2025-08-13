---
description: Documents the transcription display methods and their differences between controllers
alwaysApply: false
---

## Transcription Display Architecture

### Controller Methods
The application has multiple transcription display methods with different capabilities:

**FileUploadController.showTranscriptionResult()** ✅ (ROBUST)
- Location: src/renderer/controllers/FileUploadController.js
- Features: Proper element visibility management, error handling, UIHelpers.show/hide usage
- Used by: File upload transcription workflow
- Works correctly with timestamped segments

**TranscriptionController.showTranscriptionResult()** ❌ (INCOMPLETE) 
- Location: src/renderer/controllers/TranscriptionController.js  
- Issues: Missing element visibility management, doesn't show editor container
- Originally used by: Recording transcription workflow
- Caused timestamp view issues in recording

### Current Solution
Both recording and file upload now use FileUploadController.showTranscriptionResult() for consistency:

```javascript
// RecordingController calls:
window.whisperApp.controllers.fileUpload.showTranscriptionResult(result.text, result.segments);

// FileUploadController calls:
await this.showTranscriptionResult(result.text, result.segments);
```

### Key Implementation Details
FileUploadController method includes:
- UIHelpers.show(editor) - Critical for making transcription visible
- UIHelpers.hide(loadingState) - Clears loading states  
- UIHelpers.setValue() instead of direct .value assignment
- Proper segment rendering with view mode checking
- Robust error handling for missing DOM elements
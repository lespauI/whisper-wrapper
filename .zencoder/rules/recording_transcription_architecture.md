---
description: Architecture understanding for implementing ongoing transcription during audio recording
alwaysApply: false
---

## Recording and Transcription Architecture

### Current Recording Structure:
- **RecordingController.js**: Main controller in src/renderer/controllers/
- **recordingService.js**: Backend service in src/services/
- **HTML Structure**: Recording tab starts at line 232 in src/renderer/index.html
- **Settings location**: Lines 236-258 contain recording settings (quality, format, auto-transcribe checkbox)

### Current Recording Process:
1. MediaRecorder starts with `.start(100)` (collects data every 100ms)
2. Audio chunks stored in `this.audioChunks = []`
3. On stop, creates blob: `new Blob(this.audioChunks, { type: mimeType })`
4. Auto-save functionality exists with chunking already implemented

### Transcription Architecture:
- **TranscriptionService.js**: Handles local Whisper transcription in src/services/
- **LocalWhisperService**: Backend transcription through whisper.cpp
- **Current flow**: File → transcribe → show result using `FileUploadController.showTranscriptionResult()`

### UI Components for Reuse:
- **Transcription editor**: `#transcription-editor` (line 382)
- **Text area**: `#transcription-text` (line 389-394)
- **Segments display**: `#transcription-segments` (line 384-386)

### Implementation Points:
1. Add checkbox in recording settings section (after line 256)
2. Add ongoing transcription text area in recording section (after line 316)
3. Modify RecordingController to support chunk-based transcription
4. Create streaming transcription logic using existing services
---
description: Final implementation details for ongoing transcription during audio recording
alwaysApply: false
---

## Ongoing Transcription - Final Implementation

### Problem Solved:
**WebM Chunk Header Issue**: Initial approach failed because WebM chunks after the first lacked proper container headers, causing FFmpeg to fail with "EBML header parsing failed" errors.

### Solution Architecture:
**Separate MediaRecorder Strategy**: Each transcription chunk uses its own MediaRecorder instance, ensuring complete, valid WebM files with proper headers.

### Implementation Details:

#### UI Components (index.html):
- **Settings Panel**: "Show ongoing transcription" checkbox + chunk duration dropdown (8-20 seconds)
- **Display Area**: Real-time transcription textarea with loading states
- **Styling**: Reuses existing transcription CSS patterns in main.css

#### Core Logic (RecordingController.js):
1. **initializeOngoingTranscription()**: Starts first chunk after 2-second delay
2. **startOngoingTranscriptionChunk()**: Creates new MediaRecorder for each chunk
3. **processTranscriptionChunk()**: Processes completed valid WebM files
4. **Chunk Lifecycle**: Each recorder runs for configured duration (default: 10s)
5. **State Management**: Tracks currentChunkRecorder for proper cleanup

#### Key Features:
- **Valid Audio Files**: Each chunk is complete WebM with headers
- **Error Recovery**: Graceful handling with retry logic
- **Resource Cleanup**: Proper MediaRecorder lifecycle management
- **Pause/Resume Support**: Stops current chunk, resumes with new chunk
- **Live Updates**: Real-time text appending with auto-scroll

#### Configuration:
- **Default Duration**: 10 seconds (configurable 8-20s)
- **Minimum Chunk Size**: 5KB validation
- **Retry Logic**: 2-second delay on errors
- **Chunk Overlap**: 500ms gap between chunks

### Usage Flow:
1. User enables "Show ongoing transcription"
2. Select chunk duration (8-20 seconds)
3. Start recording → First chunk begins after 2s
4. Every N seconds: new MediaRecorder → transcribe → append text
5. Pause/resume/stop properly manages chunk recorders

### Integration Points:
- **TranscriptionService**: Uses existing local Whisper backend
- **App State**: Integrates with recording state management  
- **UI Helpers**: Leverages existing utility functions
- **Event Handling**: Works with existing pause/resume/stop controls
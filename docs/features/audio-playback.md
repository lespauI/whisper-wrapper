# Audio Playback Synced to Transcript

An integrated audio player in the Transcription tab plays back the source audio file or recording with the transcript highlighted in sync as playback progresses. Clicking any transcript segment seeks the audio to that position.

## Why

Reviewing a transcript without the source audio forces users to switch between applications. Synced playback lets users verify accuracy, correct errors, and navigate long recordings entirely within the app — a standard capability in professional transcription tools.

## How To Use

### Playing Audio

1. Open the **Transcription** tab after transcribing a file or recording.
2. The audio player bar appears automatically when a source audio file is available.
3. Click **Play** (▶) to start playback; click again to pause.
4. Drag the **seek slider** to jump to any point in the audio.
5. Use the **speed selector** to adjust playback rate: `0.5×`, `0.75×`, `1×`, `1.25×`, `1.5×`, or `2×`.

### Synced Transcript Highlighting

- The segment currently being spoken is highlighted in the transcript as audio plays.
- The transcript automatically scrolls to keep the active segment in view.

### Click-to-Seek

- Click any transcript segment to jump the audio to that position.
- When **word-level timestamps** are enabled, individual words are also clickable for fine-grained seeking.

### Library Entries

- The audio source path is saved with each transcription in the library.
- Switching between library entries reloads the correct audio file automatically.
- If no audio source is available for an entry, the player bar is hidden.

## Player Controls Reference

| Control | Description |
|---------|-------------|
| Play / Pause | Start or stop audio playback |
| Seek slider | Scrub to any position in the audio |
| Time display | Shows `current time / total duration` |
| Speed selector | Adjusts playback rate (0.5× – 2×) |

## Implementation Details

| Component | File |
|-----------|------|
| Audio player UI (HTML) | `src/renderer/index.html` |
| Player logic & highlighting | `src/renderer/controllers/TranscriptionController.js` |
| Click-to-seek on upload results | `src/renderer/controllers/FileUploadController.js` |
| Player bar & active segment styles | `src/renderer/styles/main.css` |
| `audioFilePath` persistence | `src/services/transcriptionStoreService.js` |
| `audio:readFile` IPC handler | `src/main/ipcHandlers.js` |
| `readAudioFile` context bridge | `src/main/preload.js` |

### Active Segment CSS Class

The currently active transcript segment receives the class `.transcription-segment--active`. Override this in `main.css` to customise the highlight colour or animation.

### IPC: `audio:readFile`

The main process exposes `audio:readFile` to read a local audio file and return it as a `data:` URL. This allows the renderer to load audio without requiring a custom protocol or relaxed file access permissions.

```javascript
const dataUrl = await window.electronAPI.readAudioFile('/path/to/recording.wav');
audioElement.src = dataUrl;
```

## Troubleshooting

- **Player bar does not appear** — the transcription result has no associated audio path. Re-transcribe the file or recording; the path is stored automatically for new results.
- **Audio does not play** — confirm the source file still exists at its original path. Moving or deleting the file after transcription will break playback.
- **Highlighting is out of sync** — this can occur if the transcription backend did not return segment timestamps. Ensure the model and settings used produce timestamped output.

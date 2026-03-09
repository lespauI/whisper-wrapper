# System Audio Capture (Loopback Recording)

Capture audio playing through your computer's speakers — meetings, video calls, browser audio — alongside or instead of microphone input.

## Why

Whisper Wrapper previously only captured microphone audio. For meeting transcription use cases, remote participants speak through your speakers/headphones rather than your mic. System audio capture (loopback) enables transcription of:

- Remote participants on video calls (Zoom, Teams, Google Meet, etc.)
- Browser audio (YouTube, podcasts, webinars)
- Any audio playing through the system

## How To Use

1. Open the **Recording** tab
2. Open the **Audio Source** dropdown
3. Select a capture mode:
   - **Microphone only** (default) — unchanged existing behaviour
   - **System audio only** — captures loopback output only
   - **Both (mic + system)** — mixes microphone and system audio
4. Start recording as normal
5. The active mode is displayed in the status bar

Your chosen mode is saved in settings and restored on next launch.

## Platform Support

| Platform | System Audio | Notes |
|---|---|---|
| Windows | Native (WASAPI loopback) | Works out of the box |
| macOS 14.2+ | Native (ScreenCaptureKit) | Requires Electron 28+ |
| macOS < 14.2 | Requires virtual audio driver | Install BlackHole (see below) |
| Linux | PulseAudio/PipeWire monitor | Select the loopback monitor device |

### macOS: BlackHole Setup (pre-14.2)

On macOS versions before 14.2, system audio loopback requires a virtual audio driver. [BlackHole](https://github.com/ExistingMatt/BlackHole) is a free, open-source option.

When **System audio** or **Both** mode is selected on macOS, the app shows an informational message with a link to BlackHole's installation page.

Install steps:
1. Download and install BlackHole from [existingmatt.github.io/BlackHole](https://existingmatt.github.io/BlackHole/)
2. In **System Settings → Sound → Output**, select BlackHole (or create a Multi-Output Device combining BlackHole + your speakers)
3. Return to Whisper Wrapper and select **System audio only** or **Both**

## Audio Mixing (Both Mode)

When **Both** is selected, the app mixes the two `MediaStream` sources using the Web Audio API:

- A `MediaStreamAudioSourceNode` is created for each stream (mic and system)
- Both are routed through a `GainNode` set to 0.75 (−2.5 dB) to prevent clipping
- Both connect to a shared `MediaStreamDestinationNode` whose output stream is passed to the recorder

This keeps clipping to a minimum when both sources are active simultaneously.

## VAD Compatibility

Voice Activity Detection works correctly in all three capture modes. The VAD pipeline operates on the final mixed stream, so silence detection, gating, and offline segmentation all function as expected regardless of which audio source is active.

## Settings Reference

- Config key: `recording.captureMode`
- Allowed values: `'microphone'` (default), `'system'`, `'both'`
- Persisted via `electron-store`

## IPC Reference

### `get-audio-sources`

Returns available desktop audio sources enumerated via Electron's `desktopCapturer`.

**Response:**
```json
{
  "sources": [
    { "id": "screen:0:0", "name": "Entire Screen" },
    { "id": "window:1234:0", "name": "Google Chrome" }
  ],
  "systemAudioSupported": true,
  "platform": "darwin"
}
```

- `systemAudioSupported` — `true` on Windows, macOS, and Linux; `false` on unsupported platforms
- `platform` — `'win32'`, `'darwin'`, or `'linux'`

## Implementation Links

- Audio source dropdown and mixing: `src/renderer/controllers/RecordingController.js`
- `get-audio-sources` IPC handler: `src/main/ipcHandlers.js`
- Preload bridge: `src/main/preload.js`
- Config default: `src/config/default.js` (`recording.captureMode`)

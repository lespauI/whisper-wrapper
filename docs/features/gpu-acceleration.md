# GPU / Hardware Acceleration for Local Whisper Transcription

Hardware acceleration passes backend-specific flags to the whisper.cpp binary, enabling the GPU or Neural Engine to handle computation instead of the CPU. This delivers 3–5× speedup on capable hardware with no changes to the transcription logic.

## Why

whisper.cpp natively supports Metal, CoreML, CUDA, and Vulkan but the flags must be passed explicitly. Without them the binary defaults to CPU-only inference, leaving available hardware idle. Enabling the correct backend is especially impactful on Apple Silicon Macs and NVIDIA-equipped Windows/Linux machines.

## Supported Backends

| Backend | Platform | Hardware | whisper.cpp flag |
|---------|----------|----------|-----------------|
| **Metal** | macOS (Apple Silicon) | GPU | `--metal` |
| **CoreML** | macOS | Neural Engine / GPU | `--coreml` |
| **CUDA** | Windows / Linux | NVIDIA GPU | `--cuda` |
| **Vulkan** | Windows / Linux | AMD / Intel GPU | `--vulkan` |
| **CPU only** | All | CPU | _(no flag)_ |

## How To Use

1. Open **Settings** → **Performance** section.
2. Toggle **Hardware acceleration** on (default: on).
3. Select an **Acceleration backend** from the dropdown:
   - `Auto-detect` — the app picks the best backend for the current machine.
   - `Metal` / `CoreML` / `CUDA` / `Vulkan` / `CPU only` — manual override.
4. Optionally adjust **Thread count** (CPU threads used during inference).
5. Save settings; the next transcription will use the selected backend.

## Auto-detect Logic

On startup the app probes the system and suggests a backend:

- macOS + Apple Silicon → **Metal** (optionally CoreML if models are available)
- macOS + Intel → **CPU only** (Metal unavailable)
- Windows / Linux + NVIDIA GPU detected → **CUDA**
- Windows / Linux + other GPU → **Vulkan**
- Fallback → **CPU only**

Detection uses `process.platform` and `os.cpus()`.

## Fallback Chain

If a backend flag is rejected by the binary at runtime the app catches the error and retries with a safer option:

```
CUDA → Vulkan → CPU only
Metal / CoreML → CPU only
```

This prevents transcription failures on machines where the whisper.cpp binary was compiled without a particular backend.

## Settings Reference

Config keys (stored via `electron-store`):

| Key | Default | Description |
|-----|---------|-------------|
| `transcription.hardwareAcceleration` | `true` | Master toggle for GPU acceleration |
| `transcription.gpuBackend` | `'auto'` | Backend: `'auto'` \| `'metal'` \| `'coreml'` \| `'cuda'` \| `'vulkan'` \| `'cpu'` |
| `transcription.threads` | `4` | CPU thread count passed via `--threads` |

## CoreML Notes

CoreML requires pre-converted encoder model files (`.mlmodelc` packages) alongside the standard ggml model. If CoreML model files are absent the binary falls back to Metal automatically. To generate CoreML models, run the conversion script bundled with whisper.cpp:

```bash
bash whisper.cpp/models/generate-coreml-model.sh base
```

Replace `base` with your chosen model name (e.g. `small`, `medium`).

## Troubleshooting

- **Transcription falls back to CPU unexpectedly** — verify the whisper.cpp binary was compiled with the target backend (`cmake -DWHISPER_METAL=ON`, `-DWHISPER_CUDA=ON`, etc.).
- **CoreML is selected but Metal is used** — CoreML model files (`.mlmodelc`) are missing; run the conversion script above.
- **CUDA backend fails on Linux** — ensure CUDA toolkit and the correct NVIDIA driver are installed; try Vulkan as an alternative.
- **No speedup observed** — confirm the binary supports the flag by running `whisper --help` and checking for the `--metal` / `--cuda` / `--vulkan` entries.

## Implementation Links

- Flag building and fallback: `src/services/localWhisperService.js` (`buildGpuArgs`, `transcribeFile`)
- Backend auto-detection: `LocalWhisperService.detectSuggestedBackend()` (static method)
- IPC handler: `src/main/ipcHandlers.js` (`whisper:detectGpuBackend`)
- Preload bridge: `src/main/preload.js` (`whisper.detectGpuBackend`)
- Settings UI: `src/renderer/controllers/SettingsController.js`
- Config defaults: `src/config/default.js` (`transcription.hardwareAcceleration`, `transcription.gpuBackend`)

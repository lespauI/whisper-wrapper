# Whisper Wrapper
***Disclaimer! This project is 100% AI-generated with [Zencoder.ai](https://zencoder.ai/)***

A Node.js desktop application that provides a user-friendly interface for OpenAI's Whisper speech-to-text model. This application allows you to transcribe audio and video files, as well as record audio directly for transcription.

## Features

- **File Upload**: Upload audio and video files for transcription
- **Audio Recording**: Record audio directly within the application
- **Markdown Formatting**: View and edit transcriptions with Markdown formatting
- **Export Options**: Download transcriptions in various formats
- **Local Processing**: Runs entirely on your local machine
- **Initial Prompt**: Provide custom vocabulary or context to improve transcription accuracy
- **Silence/Noise Detection (VAD)**: Real‑time gating and offline segmentation to skip silence/noise and reduce hallucinations (configurable engine and modes)
- **GPU Acceleration**: Hardware-accelerated transcription via Metal (Apple Silicon), CoreML, CUDA (NVIDIA), or Vulkan — delivering 3–5× speedup over CPU-only processing

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm (v8 or higher)
- FFmpeg (for audio/video processing)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/whisper-wrapper.git
   cd whisper-wrapper
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application:
   ```bash
   npm start
   ```

4. Configure your OpenAI API key:
   - Click the settings button (⚙️) in the application
   - Enter your OpenAI API key
   - Save the settings

## Usage

### Transcribing Files

1. Click the "Upload" button or drag and drop a file into the designated area
2. Select an audio or video file from your computer
3. Wait for the transcription to complete
4. View and edit the transcription in the editor
5. Download the transcription using the "Download" button

### Recording Audio

1. Click the "Record" button to start recording
2. Speak clearly into your microphone
3. Click "Stop" when finished
4. Wait for the transcription to complete
5. View and edit the transcription in the editor
6. Download the transcription using the "Download" button

### Ongoing Transcription with Silence/Noise Detection

- Enable "Ongoing transcription" in the Recording tab for streaming updates.
- During silence/noise the app shows "Listening…" and avoids sending audio to Whisper.
- Speech triggers chunking with lead‑in; sustained silence stops the chunk with hangover.
- Only voiced subsegments are sent to Whisper — reducing hallucinations from quiet parts.

Configure under Settings:
- VAD Engine: `energy` (default) or `webrtc`
- VAD Mode: `conservative`, `balanced` (default), or `aggressive`

More details and guidance: `docs/features/ongoing-transcription-silence-detection.md`

### GPU / Hardware Acceleration

Enable faster transcription by selecting a hardware backend in Settings → **Performance**:

| Backend | Platform | Speedup |
|---------|----------|---------|
| **Metal** | macOS (Apple Silicon) | 3–5× |
| **CoreML** | macOS (Apple Neural Engine) | Best on Apple Silicon |
| **CUDA** | Windows/Linux (NVIDIA GPU) | Significant |
| **Vulkan** | Windows/Linux (AMD/Intel GPU) | Broad GPU support |
| **CPU only** | All platforms | Baseline |

The app **auto-detects** the best backend on startup. If a selected backend is unsupported by the whisper.cpp binary, the app falls back automatically (CUDA → Vulkan → CPU).

Configure under Settings → **Performance**:
- **Hardware acceleration** toggle (enabled by default)
- **Acceleration backend** dropdown (`Auto-detect` / `Metal` / `CoreML` / `CUDA` / `Vulkan` / `CPU only`)
- **Thread count** — number of CPU threads used during inference

More details: `docs/features/gpu-acceleration.md`

### Using Initial Prompt for Better Accuracy

You can provide an initial prompt to help the transcription model better recognize specific terms, names, or context:

1. Open the Settings panel
2. Enter your custom vocabulary or context in the "Initial Prompt" field
3. Save the settings
4. Transcribe your audio or video file

The initial prompt will guide the model to better recognize specialized terminology, proper names, or domain-specific vocabulary. For example:

- For medical transcriptions: "Patient John Smith, diagnosis hypertension, medication lisinopril"
- For technical discussions: "JavaScript, React, Node.js, API, frontend, backend, database"
- For business meetings: "Acme Corporation, quarterly report, fiscal year, shareholders, CEO Jane Doe"

## Supported File Formats

### Audio
- MP3
- WAV
- M4A
- FLAC
- OGG

### Video
- MP4
- MOV
- AVI
- MKV
- WEBM

## Architecture

The application follows a client-side MVC architecture with the following components:

- **UI Layer**: Web interface and components
- **Service Layer**: File processing, recording, and transcription services
- **Data Layer**: File storage and configuration management

For more details, see the [architecture documentation](./.architecture/whisper-wrapper/).

VAD design and integration details: `docs/architecture/vad-silence-detection-implementation.md`

## Development Status

### ✅ Phase 1: Project Setup and Basic Structure (COMPLETED)
- ✅ Project initialization and dependencies
- ✅ Electron application shell with main and renderer processes
- ✅ Basic UI with tabbed interface (Upload, Record, Transcription)
- ✅ Service layer foundation (File, Recording, Transcription, Export services)
- ✅ Configuration system with electron-store
- ✅ Development tools setup (ESLint, Prettier, Jest)
- ✅ Build and packaging scripts
- ✅ Basic test suite

### ✅ Phase 2: Core Functionality (COMPLETED)
- ✅ File upload and processing implementation
- ✅ Whisper API integration
- ✅ Error handling and validation
- ✅ IPC communication system
- ✅ Native file dialogs and drag-and-drop
- ✅ Real-time transcription progress
- ✅ Settings management with API key validation

### ✅ Phase 3: Recording Functionality (COMPLETED)
- ✅ Audio capture using Web Audio API
- ✅ Recording controls and visualization
- ✅ Audio processing and storage
- ✅ Recording service with pause/resume functionality
- ✅ Recording settings and quality management
- ✅ Recording history and validation
- ✅ Integration tests for recording workflow

### ✅ Phase 4: Transcription Display and Editing (COMPLETED)
- ✅ Enhanced transcription display with real-time editing
- ✅ Auto-save functionality with 2-second delay
- ✅ Undo/redo system with 50-step history management
- ✅ Find & replace with case-insensitive search
- ✅ Export options (TXT, Markdown, JSON formats)
- ✅ Keyboard shortcuts for productivity
- ✅ Word and character count display
- ✅ Draft persistence across sessions
- ✅ Copy to clipboard functionality
- ✅ Comprehensive testing (33 tests passing)

### 📋 Phase 5: UI Refinement and Testing (PLANNED)
- UI polish and animations
- Comprehensive testing
- Performance optimization
- Accessibility improvements

## Development

### Project Structure

```
whisper-wrapper/
├── src/                # Source code
│   ├── main/           # Electron main process
│   ├── renderer/       # Electron renderer process
│   ├── services/       # Service layer
│   ├── utils/          # Utility functions
│   └── config/         # Configuration
├── tests/              # Test files
└── ...
```

### API Usage

You can use the LocalWhisperService programmatically in your own code:

```javascript
const { LocalWhisperService } = require('./src/services/localWhisperService');

// Initialize the service
const whisperService = new LocalWhisperService();

// Set an initial prompt with specialized vocabulary
whisperService.setInitialPrompt("Technical terms: Node.js, JavaScript, React, Redux, TypeScript, API");

// Transcribe a file (with optional GPU acceleration)
async function transcribeMyFile() {
  try {
    const result = await whisperService.transcribeFile('/path/to/audio.mp3', {
      model: 'medium',
      language: 'en',
      translate: false,
      threads: 4,
      hardwareAcceleration: true,  // enable GPU acceleration
      gpuBackend: 'auto'           // 'auto' | 'metal' | 'coreml' | 'cuda' | 'vulkan' | 'cpu'
    });
    
    console.log('Transcription:', result.text);
    console.log('Segments:', result.segments);
  } catch (error) {
    console.error('Transcription failed:', error);
  }
}

transcribeMyFile();
```

### Available Scripts

In the project directory, you can run:

#### `npm start`

Runs the app in development mode.

#### `npm test`

Launches the test runner.

#### `npm run build`

Builds the app for production to the `dist` folder.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [OpenAI Whisper](https://openai.com/research/whisper) for the speech recognition model
- [Electron](https://www.electronjs.org/) for the desktop application framework
- [FFmpeg](https://ffmpeg.org/) for audio/video processing

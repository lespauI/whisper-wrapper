---
description: Repository Information Overview
alwaysApply: true
---

# Whisper Wrapper Information

## Summary
A Node.js desktop application that provides a user-friendly interface for OpenAI's Whisper speech-to-text model. This application allows users to transcribe audio and video files, as well as record audio directly for transcription.

## Structure
```
whisper-wrapper/
├── src/                # Source code
│   ├── main/           # Electron main process
│   ├── renderer/       # Electron renderer process
│   ├── services/       # Service layer
│   ├── utils/          # Utility functions
│   └── config/         # Configuration
├── tests/              # Test files
│   ├── unit/           # Unit tests
│   ├── integration/    # Integration tests
│   └── e2e/            # End-to-end tests
├── scripts/            # Build and utility scripts
├── data/               # Application data and templates
└── whisper.cpp/        # Whisper C++ implementation (submodule)
```

## Language & Runtime
**Language**: JavaScript/Node.js
**Version**: Node.js v16+ required
**Build System**: npm scripts
**Package Manager**: npm (v8+)

## Dependencies
**Main Dependencies**:
- electron (Desktop application framework)
- axios (HTTP client)
- electron-store (Configuration storage)
- express (Web server)
- ffmpeg-static/fluent-ffmpeg (Audio/video processing)
- openai (OpenAI API client)

**Development Dependencies**:
- @playwright/test (E2E testing)
- jest (Unit/integration testing)
- electron-builder (Application packaging)
- typescript (Type definitions)
- eslint/prettier (Code quality)

## Build & Installation
```bash
# Install dependencies
npm install

# Start development mode
npm start

# Build for production
npm run build

# Package application
npm run package

# Setup Whisper (platform-specific)
npm run setup-whisper       # macOS/Linux
npm run setup-whisper:windows  # Windows
```

## Testing
**Framework**: Jest (unit/integration), Playwright (E2E)
**Test Location**: tests/ directory with unit/, integration/, and e2e/ subdirectories
**Naming Convention**: *.test.js
**Configuration**: jest.config.js with separate projects for unit, integration, and E2E tests
**Run Command**:
```bash
npm test              # Run all tests
npm run test:unit     # Run unit tests
npm run test:integration  # Run integration tests
npm run test:e2e      # Run E2E tests
```

## Architecture
The application follows a client-side MVC architecture with:
- **Main Process**: Electron main process (src/main/)
- **Renderer Process**: Web-based UI (src/renderer/)
- **Service Layer**: File processing, recording, and transcription services (src/services/)
- **Data Layer**: File storage and configuration management (electron-store)

The application integrates with OpenAI's Whisper model for speech-to-text transcription and uses FFmpeg for audio/video processing. It supports various audio and video formats and provides features like file upload, audio recording, transcription editing, and export options.
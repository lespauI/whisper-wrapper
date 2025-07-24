---
description: Repository Information Overview
alwaysApply: true
---

# Whisper Wrapper Information

## Summary
A Node.js desktop application that provides a user-friendly interface for OpenAI's Whisper speech-to-text model. This application allows users to transcribe audio and video files, as well as record audio directly for transcription.

## Structure
- **src/**: Source code containing main process, renderer process, services, utilities, and configuration
- **tests/**: Test files organized into unit, integration, and e2e tests
- **data/**: Configuration and template files
- **scripts/**: Utility scripts for building, testing, and setup
- **whisper.cpp/**: Submodule containing the Whisper C++ implementation
- **docs/**: Documentation files including architecture and testing guides

## Language & Runtime
**Language**: JavaScript (Node.js)
**Version**: Node.js v16+ required
**Build System**: npm scripts
**Package Manager**: npm v8+

## Dependencies
**Main Dependencies**:
- electron: Desktop application framework
- express: Web server for API endpoints
- ffmpeg-static/fluent-ffmpeg: Audio/video processing
- electron-store: Configuration storage
- axios: HTTP client for API requests
- openai: OpenAI API client
- marked: Markdown parsing

**Development Dependencies**:
- @playwright/test: End-to-end testing
- jest: Unit and integration testing
- electron-builder: Application packaging
- typescript: Type definitions
- eslint/prettier: Code linting and formatting

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
npm run setup-whisper       # Unix/Mac
npm run setup-whisper:windows  # Windows
```

## Testing
**Framework**: Jest with Playwright for E2E tests
**Test Location**: tests/ directory with unit/, integration/, and e2e/ subdirectories
**Naming Convention**: *.test.js
**Configuration**: jest.config.js with separate projects for unit, integration, and e2e tests
**Run Command**:
```bash
npm test              # Run all tests
npm run test:unit     # Run unit tests only
npm run test:integration  # Run integration tests only
npm run test:e2e      # Run end-to-end tests
```

## Architecture
**Main Process**: Electron main process (src/main/index.js)
**Renderer Process**: Web-based UI (src/renderer/)
**Service Layer**: File processing, recording, and transcription services (src/services/)
**Data Layer**: File storage and configuration management (electron-store)
**IPC Communication**: Communication between main and renderer processes

## Packaging & Distribution
**Build Tool**: electron-builder
**Output Directory**: dist/
**Supported Platforms**: macOS, Windows, Linux
**Package Configuration**: Defined in package.json under "build" section
**Application ID**: com.whisper-wrapper.app
**Product Name**: Whisper Wrapper
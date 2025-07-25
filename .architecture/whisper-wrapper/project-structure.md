# Whisper Wrapper Project Structure

This document outlines the recommended project structure for the Whisper Wrapper application.

```
whisper-wrapper/
├── .architecture/              # Architecture documentation
│   └── whisper-wrapper/
│       ├── architecture-overview.md
│       ├── component-diagram.md
│       ├── implementation-plan.md
│       ├── technical-requirements.md
│       └── project-structure.md
│
├── .github/                    # GitHub configuration
│   └── workflows/              # CI/CD workflows
│
├── src/                        # Source code
│   ├── main/                   # Electron main process
│   │   ├── index.js            # Main entry point
│   │   ├── menu.js             # Application menu
│   │   └── preload.js          # Preload script
│   │
│   ├── renderer/               # Electron renderer process
│   │   ├── index.html          # Main HTML file
│   │   ├── index.js            # Renderer entry point
│   │   ├── components/         # UI components
│   │   │   ├── App.js          # Root component
│   │   │   ├── FileUpload.js   # File upload component
│   │   │   ├── Recorder.js     # Recording component
│   │   │   └── Transcription.js # Transcription display/edit component
│   │   │
│   │   ├── styles/             # CSS styles
│   │   │   ├── main.css        # Main stylesheet
│   │   │   └── components/     # Component-specific styles
│   │   │
│   │   └── assets/             # Static assets
│   │       ├── icons/          # Application icons
│   │       └── images/         # Images used in the UI
│   │
│   ├── services/               # Service layer
│   │   ├── fileService.js      # File handling service
│   │   ├── recordingService.js # Audio recording service
│   │   ├── transcriptionService.js # Whisper API integration
│   │   └── exportService.js    # Export functionality
│   │
│   ├── utils/                  # Utility functions
│   │   ├── formatters.js       # Text formatting utilities
│   │   ├── validators.js       # Input validation
│   │   └── ffmpeg.js           # FFmpeg wrapper utilities
│   │
│   └── config/                 # Configuration
│       ├── index.js            # Configuration exports
│       └── default.js          # Default configuration
│
├── tests/                      # Test files
│   ├── unit/                   # Unit tests
│   │   ├── services/           # Service tests
│   │   └── utils/              # Utility tests
│   │
│   ├── integration/            # Integration tests
│   │   └── api/                # API integration tests
│   │
│   └── fixtures/               # Test fixtures
│       └── audio/              # Sample audio files for testing
│
├── scripts/                    # Build and utility scripts
│   ├── build.js                # Build script
│   └── package.js              # Packaging script
│
├── dist/                       # Build output
│   └── ...                     # Generated files
│
├── .eslintrc.js                # ESLint configuration
├── .prettierrc                 # Prettier configuration
├── .gitignore                  # Git ignore file
├── package.json                # npm package configuration
├── package-lock.json           # npm package lock
├── README.md                   # Project README
└── LICENSE                     # Project license
```

## Key Directories and Files

### Source Code Organization

#### Main Process (`src/main/`)
Contains Electron's main process code that runs in Node.js environment:
- `index.js`: Application entry point
- `menu.js`: Application menu configuration
- `preload.js`: Preload script for secure renderer access

#### Renderer Process (`src/renderer/`)
Contains code that runs in Electron's renderer process (browser environment):
- `index.html`: Main HTML file
- `index.js`: Renderer entry point
- `components/`: UI components
- `styles/`: CSS stylesheets
- `assets/`: Static assets like images and icons

#### Services (`src/services/`)
Contains business logic and external integrations:
- `fileService.js`: Handles file operations
- `recordingService.js`: Manages audio recording
- `transcriptionService.js`: Integrates with Whisper API
- `exportService.js`: Handles export functionality

#### Utilities (`src/utils/`)
Contains helper functions and utilities:
- `formatters.js`: Text formatting utilities
- `validators.js`: Input validation functions
- `ffmpeg.js`: FFmpeg wrapper utilities

#### Configuration (`src/config/`)
Contains application configuration:
- `index.js`: Exports configuration
- `default.js`: Default configuration values

### Testing Structure

#### Unit Tests (`tests/unit/`)
Contains unit tests for individual components and functions:
- `services/`: Tests for service layer
- `utils/`: Tests for utility functions

#### Integration Tests (`tests/integration/`)
Contains tests that verify integration between components:
- `api/`: Tests for API integrations

#### Test Fixtures (`tests/fixtures/`)
Contains test data and fixtures:
- `audio/`: Sample audio files for testing

### Build and Utility Scripts (`scripts/`)
Contains scripts for building and packaging the application:
- `build.js`: Build script
- `package.js`: Packaging script

### Build Output (`dist/`)
Contains the compiled and packaged application.

## File Naming Conventions

- Use camelCase for JavaScript files
- Use kebab-case for CSS files
- Use PascalCase for component files (if using a component framework)
- Use lowercase for directories

## Module Organization

- Group files by feature or functionality
- Keep related files close to each other
- Use index.js files to export module APIs
- Minimize dependencies between modules

## Configuration Files

- `.eslintrc.js`: ESLint configuration
- `.prettierrc`: Prettier configuration
- `.gitignore`: Git ignore file
- `package.json`: npm package configuration
- `README.md`: Project documentation
- `LICENSE`: Project license
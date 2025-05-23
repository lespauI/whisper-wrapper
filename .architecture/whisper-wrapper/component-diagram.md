# Whisper Wrapper Component Diagram

## Detailed Component Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Whisper Wrapper Application                     │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                        UI Components                             │    │
│  │                                                                 │    │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐    │    │
│  │  │ Upload        │  │ Recording     │  │ Transcription     │    │    │
│  │  │ Component     │  │ Component     │  │ Display Component │    │    │
│  │  │               │  │               │  │                   │    │    │
│  │  │ - Drag & Drop │  │ - Record      │  │ - MD Formatter    │    │    │
│  │  │ - File Select │  │ - Pause/Stop  │  │ - Text Editor     │    │    │
│  │  │ - Progress    │  │ - Timer       │  │ - Download Button │    │    │
│  │  └───────────────┘  └───────────────┘  └───────────────────┘    │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                        Service Layer                             │    │
│  │                                                                 │    │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐    │    │
│  │  │ File          │  │ Recording     │  │ Transcription     │    │    │
│  │  │ Service       │  │ Service       │  │ Service           │    │    │
│  │  │               │  │               │  │                   │    │    │
│  │  │ - Validation  │  │ - Audio       │  │ - Whisper API     │    │    │
│  │  │ - Processing  │  │   Capture     │  │   Integration     │    │    │
│  │  │ - Conversion  │  │ - Storage     │  │ - Result Parsing  │    │    │
│  │  └───────┬───────┘  └───────┬───────┘  └────────┬──────────┘    │    │
│  │          │                  │                   │               │    │
│  │          └──────────────────┼───────────────────┘               │    │
│  │                             │                                   │    │
│  │                    ┌────────┴────────┐                          │    │
│  │                    │ Export Service  │                          │    │
│  │                    │                │                          │    │
│  │                    │ - Formatting   │                          │    │
│  │                    │ - Download     │                          │    │
│  │                    └────────────────┘                          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                        Data Layer                                │    │
│  │                                                                 │    │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐    │    │
│  │  │ File          │  │ Configuration │  │ Transcription     │    │    │
│  │  │ Storage       │  │ Storage       │  │ Storage           │    │    │
│  │  │               │  │               │  │                   │    │    │
│  │  │ - Temp Files  │  │ - API Keys    │  │ - Results Cache   │    │    │
│  │  │ - Recordings  │  │ - User Prefs  │  │ - Edit History    │    │    │
│  │  └───────────────┘  └───────────────┘  └───────────────────┘    │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      External Integrations                       │    │
│  │                                                                 │    │
│  │                     ┌───────────────────┐                        │    │
│  │                     │  OpenAI Whisper   │                        │    │
│  │                     │  API              │                        │    │
│  │                     └───────────────────┘                        │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Interactions

### Upload Flow
```
User → Upload Component → File Service → Transcription Service → OpenAI Whisper API → Transcription Display Component
```

### Recording Flow
```
User → Recording Component → Recording Service → File Service → Transcription Service → OpenAI Whisper API → Transcription Display Component
```

### Export Flow
```
User → Transcription Display Component → Export Service → File Download
```

## Component Responsibilities

### UI Components

#### Upload Component
- Provides interface for file selection
- Handles drag-and-drop functionality
- Displays upload progress
- Validates file types visually

#### Recording Component
- Provides recording controls
- Displays recording status and time
- Manages recording states (idle, recording, paused)
- Provides visual feedback during recording

#### Transcription Display Component
- Renders transcription results in Markdown format
- Provides text editing capabilities
- Offers formatting controls
- Includes download options

### Service Layer

#### File Service
- Validates file formats and sizes
- Processes files for transcription
- Handles file conversion if needed
- Manages temporary file storage

#### Recording Service
- Captures audio using Web Audio API
- Processes recorded audio
- Saves recordings to temporary storage
- Handles recording errors and edge cases

#### Transcription Service
- Communicates with OpenAI Whisper API
- Sends files for transcription
- Processes and formats transcription results
- Handles API errors and retries

#### Export Service
- Formats transcription for export
- Generates downloadable files
- Supports multiple export formats
- Handles file naming and metadata

### Data Layer

#### File Storage
- Manages temporary storage of uploaded files
- Handles recorded audio files
- Implements cleanup procedures
- Ensures secure file handling

#### Configuration Storage
- Stores API keys securely
- Manages user preferences
- Handles application settings
- Persists configuration between sessions

#### Transcription Storage
- Caches transcription results
- Stores edit history
- Manages transcription metadata
- Implements data persistence

### External Integrations

#### OpenAI Whisper API
- Provides speech-to-text transcription
- Processes audio/video files
- Returns formatted transcription results
# Ongoing Translation Feature Architecture

## Overview

The "Ongoing Translation" feature extends the existing Whisper Wrapper application to provide real-time transcription and translation during audio recording. This feature is designed for live calls with foreigners, allowing users to see both the original transcription and translated text in real-time.

## Feature Requirements

### Core Functionality
- **Real-time Processing**: Transcribe and translate audio during recording
- **Dual Language Support**: Source language detection/selection and target language selection
- **Live Display**: Side-by-side original and translated text display
- **Session Storage**: Save complete recording with both original and translated transcripts
- **Local Processing**: Use existing Whisper.cpp and Ollama models

### User Interface
- Checkbox "Record with Transcript" in existing recording tab
- Source language dropdown (auto-detect or manual selection)
- Target language dropdown 
- Real-time dual-pane text display (scrollable)
- Sentence-based text segmentation

### Technical Requirements
- Process audio in 3-5 second chunks
- Maintain existing recording functionality
- Support sentence boundary detection
- Handle translation latency gracefully
- Export bilingual transcripts

## Architecture Components

### New Services
1. **OngoingTranslationService**: Coordinates real-time translation pipeline
2. **SentenceSegmentationService**: Handles text segmentation and alignment

### Enhanced Services
1. **RecordingService**: Extended with streaming mode support
2. **OllamaService**: Enhanced with translation capabilities
3. **TranscriptionService**: Support for chunked processing

### UI Components
1. **Translation Controls**: Language selection and mode toggle
2. **Live Translation Display**: Dual-pane real-time text display
3. **Translation Settings**: Configuration panel extensions

## Data Flow

```
Audio Input (Microphone)
        ↓
Audio Chunking (3-5 seconds)
        ↓
Whisper Transcription (LocalWhisperService)
        ↓
Sentence Segmentation
        ↓
Translation Queue (OllamaService)
        ↓
UI Display Update (Real-time)
        ↓
Session Storage (Audio + Transcripts)
```

## Integration Strategy

This feature extends the existing architecture without breaking changes:

- **Leverages Existing Infrastructure**: Uses current Whisper.cpp and Ollama integrations
- **Extends Current UI**: Adds controls to existing recording tab
- **Maintains Compatibility**: Preserves all existing recording functionality
- **Follows Existing Patterns**: Uses established service layer architecture

## Performance Expectations

- **Transcription Latency**: 1-3 seconds per 5-second audio chunk
- **Translation Latency**: 2-5 seconds per sentence
- **Total Latency**: 3-8 seconds from speech to translated display
- **Target Performance**: < 10 seconds end-to-end latency

## Implementation Phases

1. **Phase 1**: Core service development and streaming pipeline
2. **Phase 2**: UI integration and real-time display
3. **Phase 3**: Testing, optimization, and error handling

## Files Structure

```
docs/architecture/ongoing-translation/
├── README.md                    # This overview document
├── service-architecture.md     # Detailed service design
├── ui-design.md                # User interface specifications  
├── data-flow.md                # Processing pipeline details
├── translation-pipeline.md     # Translation logic and prompts
├── error-handling.md           # Error scenarios and recovery
└── implementation-plan.md      # Development roadmap
```

## Success Criteria

- Real-time translation with acceptable latency (< 10 seconds)
- Accurate sentence alignment between original and translated text
- Robust error handling and graceful degradation
- Seamless integration with existing recording workflow
- Complete session storage and export capabilities
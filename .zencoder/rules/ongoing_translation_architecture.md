---
description: Architecture design for ongoing translation feature that provides real-time transcription and translation during audio recording
alwaysApply: false
---

## Ongoing Translation Feature Architecture

**Purpose**: Real-time transcription and translation during audio recording for live calls with foreigners

**Key Components**:
1. **OngoingTranslationService**: Orchestrates real-time translation pipeline
2. **SentenceSegmentationService**: Handles intelligent text segmentation
3. **Enhanced RecordingService**: Extended with streaming mode support
4. **Enhanced OllamaService**: Translation capabilities using local models

**Data Flow**:
Audio Input → Audio Chunking (3-5s) → Whisper Transcription → Sentence Segmentation → Ollama Translation → UI Display → Session Storage

**UI Design**:
- Checkbox "Record with Transcript" in recording tab
- Source/target language dropdowns
- Side-by-side live display (original | translated text)
- Real-time updates with sentence-based alignment

**Technical Approach**:
- Uses existing Whisper.cpp for transcription
- Uses existing Ollama service for translation
- Process audio in 3-5 second overlapping chunks
- Maintain sentence alignment between original and translated text
- Store complete sessions with both audio and bilingual transcripts

**Performance Targets**:
- Total latency < 10 seconds from speech to translated display
- Transcription: < 3s per chunk, Translation: < 5s per sentence
- Graceful degradation on errors (transcription-only fallback)

**Implementation Phases**:
1. Core service development (Week 1-2)
2. UI integration (Week 3)  
3. Integration and testing (Week 4)

**Architecture Documents Location**: docs/architecture/ongoing-translation/
- README.md (overview)
- service-architecture.md (detailed service design)
- ui-design.md (UI specifications)
- data-flow.md (processing pipeline)
- translation-pipeline.md (translation logic)
- error-handling.md (error scenarios)
- implementation-plan.md (development roadmap)
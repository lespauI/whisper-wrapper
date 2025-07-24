# Service Architecture for Ongoing Translation

## Service Layer Overview

The ongoing translation feature introduces new services and extends existing ones to support real-time transcription and translation during audio recording.

## New Services

### OngoingTranslationService

**Purpose**: Orchestrates the real-time translation pipeline during recording sessions.

**Key Responsibilities**:
- Coordinate between recording, transcription, and translation services
- Manage audio chunking and processing queue
- Handle sentence segmentation and alignment
- Update UI with real-time results
- Manage session state and storage

**Class Structure**:
```javascript
class OngoingTranslationService {
    constructor() {
        this.recordingService = new RecordingService();
        this.transcriptionService = new TranscriptionService();
        this.ollamaService = new OllamaService();
        this.sentenceSegmentation = new SentenceSegmentationService();
        
        // State management
        this.isActive = false;
        this.sourceLanguage = 'auto';
        this.targetLanguage = 'en';
        this.processingQueue = [];
        this.completedSegments = [];
        this.sessionData = {};
    }

    // Core methods
    async startOngoingTranslation(options)
    async stopOngoingTranslation()
    async processAudioChunk(audioData, timestamp)
    
    // Processing pipeline
    async transcribeChunk(audioData)
    async translateSegment(text, sourceLanguage, targetLanguage)
    
    // UI updates
    emitTranscriptionUpdate(segment)
    emitTranslationUpdate(segment)
    
    // Session management
    saveSessionData()
    exportBilingualTranscript()
}
```

**Configuration Options**:
```javascript
const options = {
    sourceLanguage: 'auto' | 'en' | 'es' | 'fr' | ...,
    targetLanguage: 'en' | 'es' | 'fr' | ...,
    chunkSize: 3000, // milliseconds
    overlapSize: 500, // milliseconds for chunk overlap
    processingMode: 'realtime' | 'batch',
    translationModel: 'gemma3:8b' // Ollama model
};
```

### SentenceSegmentationService

**Purpose**: Handles intelligent text segmentation for proper sentence alignment.

**Key Responsibilities**:
- Segment transcribed text into sentences
- Handle incomplete sentences at chunk boundaries
- Maintain sentence alignment between original and translated text
- Provide sentence-level metadata

**Class Structure**:
```javascript
class SentenceSegmentationService {
    constructor() {
        this.pendingText = '';
        this.completedSentences = [];
        this.sentenceId = 0;
    }

    // Core methods
    processTextChunk(text, isComplete = false)
    detectSentenceBoundaries(text)
    mergePendingText(newText)
    
    // Sentence objects
    createSentenceSegment(text, startTime, confidence)
    
    // Utilities
    cleanText(text)
    validateSentence(text)
}
```

**Sentence Segment Structure**:
```javascript
const sentenceSegment = {
    id: 'sentence_001',
    originalText: 'Hello, how are you today?',
    translatedText: null, // Populated after translation
    startTime: 15.2, // seconds from recording start
    endTime: 18.7,
    sourceLanguage: 'en',
    targetLanguage: 'es',
    confidence: 0.95,
    status: 'transcribed' | 'translating' | 'translated' | 'error'
};
```

## Enhanced Existing Services

### RecordingService Extensions

**New Capabilities**:
- Streaming mode for real-time processing
- Audio chunk emission during recording
- Ongoing translation session management

**Extended Methods**:
```javascript
// New methods
async startStreamingRecording(options)
enableChunkedProcessing(chunkSize, overlap)
emitAudioChunk(audioData, timestamp)

// Enhanced existing methods
async startRecording(options) {
    // ... existing logic
    
    if (options.ongoingTranslation) {
        this.enableChunkedProcessing(options.chunkSize);
        this.ongoingTranslation = new OngoingTranslationService();
        await this.ongoingTranslation.startOngoingTranslation(options);
    }
}
```

### OllamaService Extensions

**New Translation Capabilities**:
- Translation-specific prompts and models
- Batch translation processing
- Translation quality optimization

**Extended Methods**:
```javascript
// New methods
async translateText(text, sourceLanguage, targetLanguage, options = {})
async batchTranslate(textSegments, sourceLanguage, targetLanguage)
generateTranslationPrompt(text, sourceLanguage, targetLanguage)

// Translation-specific settings
getTranslationSettings() {
    return {
        model: 'gemma3:8b', // Faster model for real-time
        temperature: 0.3, // Lower for consistent translations
        maxTokens: 1000,
        systemPrompt: this.getTranslationSystemPrompt()
    };
}

getTranslationSystemPrompt() {
    return `You are a professional translator. Translate the following text accurately while preserving meaning, tone, and context. Return only the translated text without explanations or additional comments.`;
}
```

### TranscriptionService Extensions

**Chunked Processing Support**:
- Process audio chunks independently
- Maintain context across chunks
- Handle overlapping audio segments

**Extended Methods**:
```javascript
// New methods
async transcribeChunk(audioData, options = {})
async processStreamingAudio(audioStream, options = {})
setStreamingMode(enabled, chunkSize)

// Enhanced for overlapping chunks
async transcribeBuffer(audioBuffer, options = {}) {
    // ... existing logic
    
    if (options.isChunk && options.previousChunk) {
        // Handle overlap resolution
        return this.mergeOverlappingTranscriptions(
            options.previousChunk,
            result
        );
    }
    
    return result;
}
```

## Service Integration Patterns

### Event-Driven Communication

Services communicate through events to maintain loose coupling:

```javascript
// OngoingTranslationService events
this.emit('transcription-update', { segment, timestamp });
this.emit('translation-update', { segment, timestamp });
this.emit('processing-error', { error, segment });
this.emit('session-complete', { sessionData });

// UI subscriptions
ongoingTranslationService.on('transcription-update', (data) => {
    updateOriginalTextDisplay(data.segment);
});

ongoingTranslationService.on('translation-update', (data) => {
    updateTranslatedTextDisplay(data.segment);
});
```

### Error Handling Strategy

Each service implements graceful degradation:

```javascript
class OngoingTranslationService {
    async processAudioChunk(audioData, timestamp) {
        try {
            // Attempt transcription
            const transcription = await this.transcribeChunk(audioData);
            this.emitTranscriptionUpdate(transcription);
            
            try {
                // Attempt translation
                const translation = await this.translateSegment(
                    transcription.text,
                    this.sourceLanguage,
                    this.targetLanguage
                );
                this.emitTranslationUpdate(translation);
            } catch (translationError) {
                // Continue with transcription only
                console.warn('Translation failed, continuing with transcription only:', translationError);
                this.emitTranslationUpdate({
                    ...transcription,
                    translatedText: '[Translation failed]',
                    status: 'translation-error'
                });
            }
        } catch (transcriptionError) {
            // Log error but continue processing
            console.error('Transcription failed for chunk:', transcriptionError);
            this.emit('processing-error', { error: transcriptionError, timestamp });
        }
    }
}
```

## Performance Considerations

### Processing Pipeline Optimization

1. **Parallel Processing**: Transcribe new chunks while translating previous ones
2. **Queue Management**: Intelligent queuing to prevent backlog
3. **Resource Management**: Monitor CPU/memory usage and adapt chunk sizes
4. **Cache Strategy**: Cache common translations for repeated phrases

### Model Selection Strategy

```javascript
const getOptimalModels = (systemResources) => {
    return {
        whisper: systemResources.cpu > 8 ? 'base' : 'tiny',
        translation: systemResources.memory > 8000 ? 'gemma3:12b' : 'gemma3:8b'
    };
};
```

## Data Storage Strategy

### Session Data Structure

```javascript
const ongoingTranslationSession = {
    sessionId: 'ot_20241203_143022',
    startTime: '2024-12-03T14:30:22.000Z',
    endTime: '2024-12-03T14:45:18.000Z',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    
    // Audio data (same as regular recording)
    audio: {
        filePath: '/path/to/recording.wav',
        duration: 896000, // milliseconds
        format: 'wav',
        size: 17920000 // bytes
    },
    
    // Transcription and translation data
    segments: [
        {
            id: 'segment_001',
            startTime: 0.0,
            endTime: 3.2,
            originalText: 'Hello, how are you today?',
            translatedText: 'Hola, ¿cómo estás hoy?',
            confidence: 0.95,
            sourceLanguage: 'en',
            targetLanguage: 'es'
        }
        // ... more segments
    ],
    
    // Processing metadata
    metadata: {
        modelUsed: {
            whisper: 'base',
            translation: 'gemma3:8b'
        },
        processingTime: {
            totalTranscription: 45.2, // seconds
            totalTranslation: 67.8
        },
        chunkSettings: {
            chunkSize: 3000,
            overlapSize: 500
        }
    }
};
```

This service architecture provides a robust foundation for real-time translation while maintaining compatibility with the existing system architecture.
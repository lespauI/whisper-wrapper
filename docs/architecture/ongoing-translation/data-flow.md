# Data Flow for Ongoing Translation

## Overview

This document describes the complete data flow for the ongoing translation feature, from audio input to translated text display and storage.

## High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Ongoing Translation Pipeline                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Microphone] → [Audio Chunks] → [Whisper] → [Segmentation] → [Translation] │
│       │              │             │             │               │          │
│       │              │             │             │               ↓          │
│       │              │             │             │         [UI Display]     │
│       │              │             │             │               │          │
│       │              ↓             ↓             ↓               ↓          │
│       └─────────→ [Recording Storage] ←─── [Complete Session] ←─────────────┘
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Detailed Processing Pipeline

### 1. Audio Capture and Chunking

**Input**: Real-time audio stream from microphone
**Output**: Audio chunks with timing metadata

```javascript
// Audio chunking process
const audioChunking = {
    chunkSize: 3000, // 3 seconds
    overlapSize: 500, // 0.5 seconds overlap
    sampleRate: 16000, // Hz
    channels: 1, // Mono
    
    process: function(audioStream) {
        const chunks = [];
        let currentChunk = {
            data: new Float32Array(this.chunkSize * this.sampleRate),
            startTime: 0,
            endTime: this.chunkSize / 1000,
            timestamp: Date.now()
        };
        
        // Process audio data in real-time
        return chunks;
    }
};
```

**Data Structure - Audio Chunk**:
```javascript
const audioChunk = {
    id: 'chunk_001',
    data: Float32Array, // Raw audio data
    startTime: 0.0, // Seconds from recording start
    endTime: 3.0, // Seconds from recording start
    duration: 3.0, // Chunk duration in seconds
    timestamp: 1701615022000, // Unix timestamp
    sampleRate: 16000,
    channels: 1,
    format: 'float32',
    overlap: {
        previous: 0.5, // Overlap with previous chunk
        next: 0.5 // Overlap with next chunk
    }
};
```

### 2. Transcription Processing

**Input**: Audio chunk data
**Output**: Transcribed text with confidence scores

```javascript
// Transcription flow
const transcriptionFlow = async (audioChunk) => {
    // Convert audio chunk to temporary WAV file
    const tempFile = await convertChunkToWav(audioChunk);
    
    // Process with Whisper
    const transcriptionResult = await whisperService.transcribeFile(tempFile, {
        model: 'base',
        language: sourceLanguage === 'auto' ? null : sourceLanguage,
        temperature: 0.0, // Deterministic output
        initialPrompt: getCurrentInitialPrompt(),
        wordTimestamps: true
    });
    
    // Clean up temporary file
    await fs.unlink(tempFile);
    
    return transcriptionResult;
};
```

**Data Structure - Transcription Result**:
```javascript
const transcriptionResult = {
    chunkId: 'chunk_001',
    text: 'Hello, how are you today? The weather is very nice.',
    language: 'en', // Detected or specified language
    confidence: 0.94,
    segments: [
        {
            id: 0,
            text: 'Hello, how are you today?',
            start: 0.0,
            end: 2.1,
            words: [
                { word: 'Hello', start: 0.0, end: 0.5, confidence: 0.99 },
                { word: 'how', start: 0.8, end: 1.0, confidence: 0.95 },
                // ... more words
            ]
        },
        {
            id: 1,
            text: 'The weather is very nice.',
            start: 2.5,
            end: 4.2,
            words: [
                // ... word-level timestamps
            ]
        }
    ],
    processingTime: 1.2, // Seconds
    model: 'base'
};
```

### 3. Sentence Segmentation

**Input**: Raw transcription text from multiple chunks
**Output**: Complete sentences with proper boundaries

```javascript
// Sentence segmentation process
class SentenceSegmentationFlow {
    constructor() {
        this.pendingText = '';
        this.completedSentences = [];
        this.sentenceBuffer = '';
    }
    
    processTranscriptionChunk(transcriptionResult) {
        // Add new text to buffer
        this.sentenceBuffer += ' ' + transcriptionResult.text;
        
        // Extract complete sentences
        const sentences = this.extractCompleteSentences(this.sentenceBuffer);
        
        // Process each complete sentence
        sentences.forEach(sentence => {
            const sentenceSegment = this.createSentenceSegment(
                sentence,
                transcriptionResult
            );
            this.completedSentences.push(sentenceSegment);
            this.emitSentenceReady(sentenceSegment);
        });
        
        return sentences;
    }
    
    extractCompleteSentences(text) {
        const sentenceEnders = /[.!?]+/g;
        const sentences = [];
        let lastIndex = 0;
        let match;
        
        while ((match = sentenceEnders.exec(text)) !== null) {
            const sentence = text.substring(lastIndex, match.index + match[0].length).trim();
            if (sentence.length > 0) {
                sentences.push(sentence);
                lastIndex = match.index + match[0].length;
            }
        }
        
        // Update buffer with remaining text
        this.sentenceBuffer = text.substring(lastIndex).trim();
        
        return sentences;
    }
}
```

**Data Structure - Sentence Segment**:
```javascript
const sentenceSegment = {
    id: 'sentence_001',
    text: 'Hello, how are you today?',
    translatedText: null, // Will be populated after translation
    
    // Timing information
    startTime: 0.0, // Seconds from recording start
    endTime: 2.1,
    duration: 2.1,
    
    // Language information
    sourceLanguage: 'en',
    targetLanguage: 'es',
    detectedLanguage: 'en',
    
    // Quality metrics
    confidence: 0.95,
    wordCount: 6,
    
    // Processing state
    status: 'transcribed', // 'transcribed' | 'translating' | 'translated' | 'error'
    
    // Metadata
    chunkId: 'chunk_001',
    timestamp: 1701615025000,
    model: {
        transcription: 'base',
        translation: null
    },
    
    // Word-level details (optional)
    words: [
        { word: 'Hello', start: 0.0, end: 0.5, confidence: 0.99 },
        // ... more words
    ]
};
```

### 4. Translation Processing

**Input**: Complete sentence segments
**Output**: Translated sentence segments

```javascript
// Translation flow
const translationFlow = async (sentenceSegment) => {
    // Update status
    sentenceSegment.status = 'translating';
    emitUI('sentence-update', sentenceSegment);
    
    try {
        // Generate translation prompt
        const prompt = generateTranslationPrompt(
            sentenceSegment.text,
            sentenceSegment.sourceLanguage,
            sentenceSegment.targetLanguage
        );
        
        // Call Ollama for translation
        const translationResult = await ollamaService.refineText(
            sentenceSegment.text,
            prompt
        );
        
        if (translationResult.success) {
            // Update segment with translation
            sentenceSegment.translatedText = translationResult.refinedText;
            sentenceSegment.status = 'translated';
            sentenceSegment.model.translation = getCurrentTranslationModel();
            sentenceSegment.translationTime = translationResult.processingTime;
        } else {
            // Handle translation error
            sentenceSegment.status = 'error';
            sentenceSegment.error = translationResult.message;
            sentenceSegment.translatedText = '[Translation failed]';
        }
        
    } catch (error) {
        sentenceSegment.status = 'error';
        sentenceSegment.error = error.message;
        sentenceSegment.translatedText = '[Translation error]';
    }
    
    // Emit updated segment
    emitUI('sentence-update', sentenceSegment);
    
    return sentenceSegment;
};
```

### 5. UI Update Flow

**Input**: Sentence segments with status updates
**Output**: Real-time UI updates

```javascript
// UI update flow
class UIUpdateFlow {
    constructor() {
        this.originalTextDisplay = document.getElementById('original-text-display');
        this.translatedTextDisplay = document.getElementById('translated-text-display');
        this.sentenceMap = new Map(); // Track sentence elements
    }
    
    handleSentenceUpdate(sentenceSegment) {
        switch (sentenceSegment.status) {
            case 'transcribed':
                this.displayOriginalSentence(sentenceSegment);
                this.displayTranslatingPlaceholder(sentenceSegment);
                break;
                
            case 'translating':
                this.updateTranslatingStatus(sentenceSegment);
                break;
                
            case 'translated':
                this.displayTranslatedSentence(sentenceSegment);
                break;
                
            case 'error':
                this.displayTranslationError(sentenceSegment);
                break;
        }
        
        // Auto-scroll to latest content
        this.scrollToLatest();
    }
    
    displayOriginalSentence(segment) {
        const sentenceElement = this.createSentenceElement(segment, 'original');
        this.originalTextDisplay.appendChild(sentenceElement);
        this.sentenceMap.set(segment.id + '_original', sentenceElement);
    }
    
    displayTranslatedSentence(segment) {
        const existingElement = this.sentenceMap.get(segment.id + '_translated');
        if (existingElement) {
            this.updateSentenceElement(existingElement, segment, 'translated');
        } else {
            const sentenceElement = this.createSentenceElement(segment, 'translated');
            this.translatedTextDisplay.appendChild(sentenceElement);
            this.sentenceMap.set(segment.id + '_translated', sentenceElement);
        }
    }
}
```

### 6. Session Storage Flow

**Input**: Complete ongoing translation session data
**Output**: Stored session files and metadata

```javascript
// Session storage flow
const sessionStorageFlow = {
    async saveOngoingTranslationSession(sessionData) {
        const sessionId = sessionData.sessionId;
        const sessionDir = path.join(getDataDirectory(), 'ongoing-translations', sessionId);
        
        // Ensure directory exists
        await fs.mkdir(sessionDir, { recursive: true });
        
        // Save audio file
        const audioPath = path.join(sessionDir, 'audio.wav');
        await fs.copyFile(sessionData.audio.tempPath, audioPath);
        
        // Save transcript data
        const transcriptPath = path.join(sessionDir, 'transcript.json');
        await fs.writeFile(transcriptPath, JSON.stringify({
            sessionId,
            metadata: sessionData.metadata,
            segments: sessionData.segments
        }, null, 2));
        
        // Save bilingual transcript exports
        await this.generateBilingualExports(sessionData, sessionDir);
        
        // Update session index
        await this.updateSessionIndex(sessionData);
        
        return {
            sessionId,
            audioPath,
            transcriptPath,
            sessionDir
        };
    },
    
    async generateBilingualExports(sessionData, sessionDir) {
        // Generate side-by-side text export
        const sideBySidePath = path.join(sessionDir, 'bilingual.txt');
        const sideBySideContent = this.generateSideBySideText(sessionData.segments);
        await fs.writeFile(sideBySidePath, sideBySideContent);
        
        // Generate original-only transcript
        const originalPath = path.join(sessionDir, 'original.txt');
        const originalContent = sessionData.segments
            .map(s => s.text)
            .join(' ');
        await fs.writeFile(originalPath, originalContent);
        
        // Generate translated-only transcript
        const translatedPath = path.join(sessionDir, 'translated.txt');
        const translatedContent = sessionData.segments
            .filter(s => s.translatedText && s.status === 'translated')
            .map(s => s.translatedText)
            .join(' ');
        await fs.writeFile(translatedPath, translatedContent);
        
        // Generate SRT subtitles for both languages
        await this.generateBilingualSRT(sessionData.segments, sessionDir);
    }
};
```

## Data Synchronization

### Real-time State Management

```javascript
// Central state manager for ongoing translation
class OngoingTranslationState {
    constructor() {
        this.session = null;
        this.segments = new Map(); // segment_id -> segment_data
        this.processingQueue = [];
        this.uiUpdateQueue = [];
        
        // Event emitters for different components
        this.events = new EventEmitter();
    }
    
    // State updates flow through central manager
    updateSegment(segmentId, updates) {
        const segment = this.segments.get(segmentId);
        if (segment) {
            Object.assign(segment, updates);
            this.events.emit('segment-updated', segment);
            this.queueUIUpdate(segment);
        }
    }
    
    // Batch UI updates to prevent overwhelming the interface
    queueUIUpdate(segment) {
        this.uiUpdateQueue.push(segment);
        
        // Debounce UI updates
        if (!this.uiUpdateTimeout) {
            this.uiUpdateTimeout = setTimeout(() => {
                this.flushUIUpdates();
                this.uiUpdateTimeout = null;
            }, 100); // 100ms batching
        }
    }
    
    flushUIUpdates() {
        const updates = [...this.uiUpdateQueue];
        this.uiUpdateQueue = [];
        
        // Group updates by type for efficient DOM manipulation
        const groupedUpdates = updates.reduce((groups, segment) => {
            const key = segment.status;
            if (!groups[key]) groups[key] = [];
            groups[key].push(segment);
            return groups;
        }, {});
        
        // Apply updates in batches
        Object.entries(groupedUpdates).forEach(([status, segments]) => {
            this.applyUIUpdates(status, segments);
        });
    }
}
```

## Error Handling in Data Flow

### Graceful Degradation Strategy

```javascript
// Error handling at each stage
const errorHandlingFlow = {
    // Audio processing errors
    handleAudioError(error, chunk) {
        console.error('Audio processing error:', error);
        
        // Continue with next chunk
        this.events.emit('chunk-skipped', { chunkId: chunk.id, error });
        
        // Don't stop the entire session
        return { continue: true, skipChunk: true };
    },
    
    // Transcription errors
    handleTranscriptionError(error, chunk) {
        console.error('Transcription error:', error);
        
        // Try with smaller chunk or different model
        const fallbackOptions = {
            model: 'tiny', // Faster, more reliable model
            temperature: 0.1,
            chunkSize: chunk.duration / 2 // Smaller chunks
        };
        
        return { retry: true, fallbackOptions };
    },
    
    // Translation errors
    handleTranslationError(error, segment) {
        console.error('Translation error:', error);
        
        // Mark segment as failed but continue
        segment.status = 'error';
        segment.error = error.message;
        segment.translatedText = '[Translation failed - showing original]';
        
        // Don't stop processing other segments
        return { continue: true, showOriginal: true };
    }
};
```

## Performance Optimization

### Data Flow Optimization Strategies

1. **Parallel Processing**: Process transcription and translation in parallel pipelines
2. **Chunk Overlapping**: Use overlapping audio chunks to improve accuracy
3. **Batched UI Updates**: Group UI updates to prevent interface lag
4. **Memory Management**: Clean up processed chunks to prevent memory leaks
5. **Adaptive Quality**: Adjust processing quality based on system performance

```javascript
// Performance monitoring and adaptation
class PerformanceManager {
    constructor() {
        this.metrics = {
            avgTranscriptionTime: 0,
            avgTranslationTime: 0,
            systemLoad: 0,
            memoryUsage: 0
        };
    }
    
    adaptProcessingSettings() {
        if (this.metrics.avgTranscriptionTime > 5000) { // > 5 seconds
            // Switch to faster model
            return { whisperModel: 'tiny', chunkSize: 2000 };
        }
        
        if (this.metrics.avgTranslationTime > 8000) { // > 8 seconds
            // Use faster translation model
            return { translationModel: 'llama3:8b', batchSize: 1 };
        }
        
        return null; // No changes needed
    }
}
```

This data flow design ensures robust, real-time processing of audio to translated text while maintaining good performance and error resilience.
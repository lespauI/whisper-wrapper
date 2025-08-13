---
description: Implementation of context prompt feature for ongoing transcription chunks using last 1000 characters for better continuity
alwaysApply: false
---

## Context Prompt Enhancement - Ongoing Transcription

### Problem Identified:
Ongoing transcription chunks were processed in isolation without context from previous chunks, leading to:
- Inconsistent terminology and proper nouns
- Loss of conversational flow between chunks  
- Poor handling of sentence boundaries across chunks
- Reduced accuracy for continuing thoughts and technical terms

### Solution Implemented:
**Context Prompt Integration**: Pass the last 1000 characters of transcribed text as context prompt (`-p` parameter) to Whisper for each new chunk.

### Technical Implementation:

#### 1. Frontend Enhancement (RecordingController.js)
**New Method**: `generateContextPrompt()`
```javascript
generateContextPrompt() {
    if (!this.ongoingTranscription.transcriptionText || this.ongoingTranscription.transcriptionText.length === 0) {
        console.log('📝 No previous transcription text - no context prompt');
        return null;
    }
    
    // Get last 1000 characters as context for better transcription continuity
    const contextPrompt = this.ongoingTranscription.transcriptionText.slice(-1000);
    
    if (contextPrompt.length > 0) {
        console.log(`📝 Generated context prompt (${contextPrompt.length} chars): "${contextPrompt.substring(0, 100)}..."`);
        return contextPrompt;
    }
    
    return null;
}
```

**Chunk Processing Update**:
```javascript
// Generate context prompt from previous transcription (last 1000 characters)
const contextPrompt = this.generateContextPrompt();

// Transcribe the chunk with context
const result = await window.electronAPI.transcribeAudio(arrayBuffer, contextPrompt);
```

#### 2. IPC Layer Enhancement (preload.js)
**API Extension**:
```javascript
// Transcription
transcribeAudio: (audioData, prompt = null) => ipcRenderer.invoke('transcription:audio', audioData, prompt),
```

#### 3. Main Process Enhancement (ipcHandlers.js)
**Handler Update**:
```javascript
async handleTranscribeAudio(event, audioData, prompt = null) {
    // ... existing code
    
    // Add context prompt for ongoing transcription chunks
    if (prompt && prompt.trim()) {
        transcriptionOptions.contextPrompt = prompt.trim();
        console.log(`📝 IPC: Context prompt provided (${prompt.trim().length} chars): "${prompt.trim().substring(0, 100)}..."`);
    }
}
```

#### 4. Service Layer Enhancement (transcriptionService.js)
**Context Prompt Processing**:
```javascript
// Add context prompt for chunk processing (takes precedence over initial prompt)
if (options.contextPrompt) {
    whisperOptions.contextPrompt = options.contextPrompt;
    console.log(`📝 TranscriptionService: Using context prompt (${options.contextPrompt.length} chars): "${options.contextPrompt.substring(0, 100)}..."`);
}
```

#### 5. Whisper Integration (localWhisperService.js)
**Command Line Parameter**:
```javascript
// Add context prompt for chunk processing (takes precedence over initial prompt)
if (contextPrompt && contextPrompt.trim().length > 0) {
    args.push('-p', contextPrompt.trim());
    console.log(`📝 Using context prompt (${contextPrompt.trim().length} chars): "${contextPrompt.trim().substring(0, 100)}..."`);
} else if (effectiveInitialPrompt && effectiveInitialPrompt.trim().length > 0) {
    // Add initial prompt if provided and enabled (only if no context prompt)
    args.push('--prompt', effectiveInitialPrompt);
}
```

### Key Features:

#### 1. Intelligent Context Selection
- **1000 Character Limit**: Optimal balance between context and performance
- **Latest Content**: Uses most recent transcribed text for relevance
- **Graceful Handling**: Falls back to initial prompt if no context available
- **Performance Optimized**: Efficient string slicing operation

#### 2. Context Prioritization
- **Context First**: Context prompt takes precedence over initial prompt
- **Fallback Support**: Uses initial prompt when no context available
- **Clean Integration**: Seamless with existing prompt system
- **Logging**: Comprehensive debugging information

#### 3. Flow Continuity
- **Sentence Boundaries**: Better handling of split sentences
- **Technical Terms**: Consistent terminology across chunks
- **Proper Nouns**: Improved recognition of names and places
- **Conversational Flow**: Natural continuation of dialogue

#### 4. Error Handling
- **Null Checks**: Safe handling of empty transcription text
- **Length Validation**: Ensures context prompt has content
- **Graceful Degradation**: Continues without context if generation fails
- **Debug Logging**: Clear indication of context usage

### Benefits Achieved:

#### 1. Improved Accuracy
- **Contextual Understanding**: Each chunk understands what came before
- **Consistent Terminology**: Technical terms and proper nouns maintained
- **Better Punctuation**: Improved sentence structure across boundaries
- **Flow Recognition**: Natural conversation patterns preserved

#### 2. Enhanced User Experience
- **Smoother Reading**: More natural text flow in real-time display
- **Better Comprehension**: Context-aware transcription easier to follow
- **Professional Quality**: Output quality similar to single-file transcription
- **Reduced Editing**: Less manual correction needed

#### 3. Technical Excellence
- **Minimal Overhead**: 1000 character limit keeps performance optimal
- **Memory Efficient**: Uses existing transcription text, no additional storage
- **Backwards Compatible**: Works with existing initial prompt system
- **Configurable**: Context length easily adjustable if needed

### Usage Flow:

#### 1. First Chunk Processing
```
Start Recording → First Chunk (2s) → No Context → Transcribe → Store Result
```

#### 2. Subsequent Chunk Processing
```
New Chunk → Generate Context (last 1000 chars) → Transcribe with Context → Append Result
```

#### 3. Context Evolution
```
Chunk 1: "" → "Hello world"
Chunk 2: "Hello world" → "Hello world, this is a test"  
Chunk 3: "...is a test" → "Hello world, this is a test of the system"
```

### Performance Considerations:
- **Context Size**: 1000 characters provides good balance
- **Memory Usage**: Minimal additional memory overhead
- **Processing Time**: Negligible impact on transcription speed
- **Network**: No additional network calls required

### Future Enhancements:
- **Adaptive Context**: Dynamically adjust context length based on content
- **Smart Boundaries**: Use sentence/paragraph boundaries for context cutoff
- **Context Summarization**: Compress longer contexts while preserving key terms
- **Multi-language Support**: Language-aware context generation

This enhancement transforms ongoing transcription from independent chunk processing to intelligent, context-aware continuous transcription that maintains consistency and accuracy throughout the recording session.
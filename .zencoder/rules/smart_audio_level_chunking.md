---
description: Smart audio level-based chunking to avoid cutting words mid-speech
alwaysApply: false
---

## Smart Audio Level Chunking Implementation

### Problem Solved:
Fixed the issue where sequential chunking cut words in the middle (e.g., "Антарк..." instead of "Антарктиде"), causing Whisper to struggle with word fragment recognition.

### Solution: Audio Level Monitoring for Smart Cut Points
Reuses existing audio level visualization to intelligently determine when to cut chunks during natural speech pauses.

### Technical Implementation:

#### Smart Chunking Settings:
```javascript
ongoingTranscription: {
    audioLevelThreshold: 15,    // Below 15% = quiet moment, good to cut
    maxExtensionTime: 2000,     // Maximum 2 seconds extension
    chunkStartTime: null,       // When current chunk started
    pendingStop: false          // Whether waiting for quiet moment
}
```

#### Audio Level Integration:
- **Reuses existing visualization**: `updateAudioLevel()` already calculates audio percentage
- **Real-time monitoring**: Current audio level stored as `this.currentAudioLevel`
- **Smart detection**: `checkSmartChunkStop()` called during every audio update

#### Smart Chunking Algorithm:

1. **Base Timer**: Start normal 5-second timer for chunk
2. **Timer Expires**: Check current audio level
   - **If quiet (< 15%)**: Stop chunk immediately  
   - **If loud (≥ 15%)**: Set `pendingStop = true`, wait for quiet moment
3. **Continuous Checking**: Every audio update checks if conditions met
4. **Force Stop**: After max extension (2 seconds), stop regardless

#### Workflow:
```
Normal Case:
[0────5s] Timer → Audio 8% → ✂️ Stop (quiet moment)

Extension Case:  
[0────5s────6.2s] Timer → Audio 45% → Wait → Audio 12% → ✂️ Stop

Max Extension:
[0────5s────────7s] Timer → Audio 45% → Wait → Max time → ✂️ Force stop
```

### Key Methods:

#### Enhanced Audio Monitoring:
```javascript
updateAudioLevel() {
    // Calculate audio percentage (existing code)
    this.currentAudioLevel = percentage;
    
    // Check smart chunking conditions
    this.checkSmartChunkStop();
}
```

#### Smart Stop Logic:
```javascript
checkSmartChunkStop() {
    if (pendingStop) {
        const isQuiet = currentLevel < threshold;
        const maxTimeReached = chunkAge > maxExtension;
        
        if (isQuiet || maxTimeReached) {
            stopChunk(); // Cut during quiet moment or force stop
        }
    }
}
```

#### Smart Timer Setup:
```javascript
setTimeout(() => {
    if (currentLevel < threshold) {
        chunkRecorder.stop(); // Immediate stop if quiet
    } else {
        this.pendingStop = true; // Wait for quiet moment
    }
}, chunkDuration * 1000);
```

### Configuration:

#### Audio Level Threshold:
- **15%**: Optimal balance - detects natural speech pauses
- **Lower (10%)**: More aggressive cutting, risk of cutting during soft speech
- **Higher (25%)**: More conservative, may miss some quiet moments

#### Extension Time:
- **2 seconds**: Allows time to find quiet moments without delaying too much
- **1 second**: Faster but may not catch longer words/phrases
- **3 seconds**: More flexibility but slower real-time feedback

### Benefits:

#### Accuracy Improvement:
- **Natural Boundaries**: Cuts during speech pauses, not mid-word
- **Complete Words**: Whisper receives full words instead of fragments
- **Better Recognition**: Reduced transcription errors from cut words

#### Performance:
- **Minimal Overhead**: Reuses existing audio monitoring
- **Real-time**: Decisions made during normal visualization updates
- **Adaptive**: Extends chunks only when needed

#### User Experience:
- **Transparent**: No noticeable delay in most cases
- **Reliable**: Falls back to force stop if no quiet moments found
- **Visual Feedback**: Uses existing audio level display

### Logging & Debugging:
```
Base duration reached for chunk 2. Audio level: 45%
⏳ Waiting for quiet moment: 45% (need < 15%)
⏳ Waiting for quiet moment: 32% (need < 15%)  
⏳ Waiting for quiet moment: 28% (need < 15%)
✂️ Smart stop: quiet moment (12% < 15%), chunk age: 6s
```

### Expected Results:
- **Before**: "Сейчас вы... взрывчаткой... кто построил..."
- **After**: "Сейчас вы узнаете, когда в Антарктиде росли джунгли, как киты снабжали весь мир взрывчаткой, кто построил церковь..."

This implementation combines the simplicity of sequential chunking with intelligent word boundary detection for optimal transcription accuracy.
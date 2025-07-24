# UI Design for Ongoing Translation

## Overview

The ongoing translation feature extends the existing recording tab with new controls and a real-time translation display. The design maintains consistency with the current UI while adding new functionality seamlessly.

## UI Components Layout

### Recording Tab Extensions

The recording tab will be enhanced with additional controls and a live translation area:

```
┌─────────────────────────────────────────────────────────────┐
│                    Recording Tab                            │
├─────────────────────────────────────────────────────────────┤
│ [Existing Recording Settings]                               │
│ Quality: [Medium ↓]  Format: [WAV ↓]  Auto-transcribe: ☑   │
│                                                             │
│ ┌─ NEW: Ongoing Translation Settings ─────────────────────┐ │
│ │ ☐ Record with Transcript                               │ │
│ │                                                        │ │
│ │ Source Language: [Auto-detect    ↓]                   │ │
│ │ Target Language: [English        ↓]                   │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Existing Recording Controls]                               │
│ ● Record    ⏸ Pause    ⏹ Stop    Timer: 00:02:34          │
│                                                             │
│ ┌─ NEW: Live Translation Display ─────────────────────────┐ │
│ │ Original Text              │ Translated Text           │ │
│ │ ──────────────────────────┼───────────────────────────│ │
│ │ Hello, how are you today? │ Hola, ¿cómo estás hoy?   │ │
│ │ The weather is very nice. │ El clima está muy bueno.  │ │
│ │ I hope we can finish...   │ [Translating...]          │ │
│ │ ↓ (scrollable)            │ ↓ (scrollable)            │ │
│ └───────────────────────────┴───────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Component Specifications

### 1. Translation Mode Toggle

**Component**: Checkbox "Record with Transcript"
**Location**: Recording settings section
**Behavior**:
- When unchecked: Standard recording mode (existing functionality)
- When checked: Enable ongoing translation mode and show additional controls

**HTML Structure**:
```html
<div class="translation-mode-section">
    <div class="checkbox-container">
        <input type="checkbox" id="ongoing-translation-checkbox" class="styled-checkbox">
        <label for="ongoing-translation-checkbox">Record with Transcript</label>
    </div>
    <div class="form-text">Enable real-time transcription and translation during recording</div>
</div>
```

### 2. Language Selection Controls

**Components**: Source and Target language dropdowns
**Location**: Below translation mode checkbox (shown only when enabled)

**Source Language Options**:
```javascript
const sourceLanguages = [
    { code: 'auto', name: 'Auto-detect' },
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh', name: 'Chinese (Mandarin)' }
];
```

**Target Language Options**:
```javascript
const targetLanguages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh', name: 'Chinese (Mandarin)' }
];
```

**HTML Structure**:
```html
<div id="translation-language-controls" class="translation-languages hidden">
    <div class="language-row">
        <div class="language-group">
            <label for="source-language-select">Source Language:</label>
            <select id="source-language-select" class="form-control">
                <option value="auto" selected>Auto-detect</option>
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <!-- ... more options ... -->
            </select>
        </div>
        <div class="language-group">
            <label for="target-language-select">Target Language:</label>
            <select id="target-language-select" class="form-control">
                <option value="en" selected>English</option>
                <option value="es">Spanish</option>
                <!-- ... more options ... -->
            </select>
        </div>
    </div>
</div>
```

### 3. Live Translation Display

**Component**: Dual-pane scrollable text display
**Location**: Below recording controls (shown only during ongoing translation)

**Features**:
- Side-by-side layout with original and translated text
- Real-time updates as transcription and translation complete
- Auto-scroll to show latest content
- Sentence-based alignment
- Status indicators for processing states
- Copy text functionality

**HTML Structure**:
```html
<div id="live-translation-display" class="live-translation-container hidden">
    <div class="translation-header">
        <h4>Live Translation</h4>
        <div class="translation-controls">
            <button id="clear-translation-btn" class="btn btn-sm btn-outline">Clear</button>
            <button id="copy-original-btn" class="btn btn-sm btn-outline">Copy Original</button>
            <button id="copy-translated-btn" class="btn btn-sm btn-outline">Copy Translation</button>
        </div>
    </div>
    
    <div class="translation-panes">
        <div class="translation-pane original-pane">
            <div class="pane-header">
                <h5>Original (<span id="source-language-display">Auto-detect</span>)</h5>
            </div>
            <div id="original-text-display" class="text-display">
                <!-- Dynamically populated sentence segments -->
            </div>
        </div>
        
        <div class="translation-pane translated-pane">
            <div class="pane-header">
                <h5>Translation (<span id="target-language-display">English</span>)</h5>
            </div>
            <div id="translated-text-display" class="text-display">
                <!-- Dynamically populated sentence segments -->
            </div>
        </div>
    </div>
</div>
```

### 4. Sentence Segment Components

**Component**: Individual sentence display elements
**Behavior**: 
- Show transcription immediately when available
- Show "Translating..." placeholder while translation is in progress
- Update with translated text when available
- Maintain alignment between original and translated sentences

**Sentence Segment Structure**:
```html
<div class="sentence-segment" data-segment-id="segment_001">
    <div class="sentence-text">Hello, how are you today?</div>
    <div class="sentence-metadata">
        <span class="timestamp">00:15</span>
        <span class="confidence">95%</span>
    </div>
</div>
```

**Translation States**:
```html
<!-- Transcribed, waiting for translation -->
<div class="sentence-segment translating" data-segment-id="segment_002">
    <div class="sentence-text">I hope we can finish this project soon.</div>
    <div class="translation-status">
        <span class="status-indicator">⏳ Translating...</span>
    </div>
</div>

<!-- Translation complete -->
<div class="sentence-segment translated" data-segment-id="segment_002">
    <div class="sentence-text">Espero que podamos terminar este proyecto pronto.</div>
    <div class="sentence-metadata">
        <span class="timestamp">00:22</span>
        <span class="translation-model">gemma3:8b</span>
    </div>
</div>

<!-- Translation error -->
<div class="sentence-segment error" data-segment-id="segment_003">
    <div class="sentence-text">[Translation failed - server error]</div>
    <div class="error-status">
        <span class="status-indicator">❌ Translation Error</span>
        <button class="retry-btn btn-sm">Retry</button>
    </div>
</div>
```

## CSS Styling

### Translation Controls Styling

```css
.translation-mode-section {
    margin: 15px 0;
    padding: 15px;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    background-color: #f9f9f9;
}

.translation-languages {
    margin-top: 15px;
    padding: 10px 0;
}

.language-row {
    display: flex;
    gap: 20px;
    align-items: center;
}

.language-group {
    flex: 1;
    min-width: 200px;
}

.language-group label {
    display: block;
    margin-bottom: 5px;
    font-weight: 500;
    color: #333;
}

.language-group select {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 14px;
}
```

### Live Translation Display Styling

```css
.live-translation-container {
    margin-top: 20px;
    border: 1px solid #ddd;
    border-radius: 8px;
    background-color: #fff;
    min-height: 300px;
    max-height: 500px;
}

.translation-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
    border-bottom: 1px solid #eee;
    background-color: #f8f9fa;
}

.translation-panes {
    display: flex;
    height: 400px;
}

.translation-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    border-right: 1px solid #eee;
}

.translation-pane:last-child {
    border-right: none;
}

.pane-header {
    padding: 10px 15px;
    background-color: #f1f3f4;
    border-bottom: 1px solid #e0e0e0;
    font-weight: 500;
}

.text-display {
    flex: 1;
    padding: 15px;
    overflow-y: auto;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    font-size: 14px;
    line-height: 1.5;
}

.sentence-segment {
    margin-bottom: 15px;
    padding: 10px;
    border-left: 3px solid #007acc;
    background-color: #f9f9f9;
    border-radius: 4px;
    transition: all 0.3s ease;
}

.sentence-segment.translating {
    border-left-color: #ffa500;
    background-color: #fff8dc;
}

.sentence-segment.translated {
    border-left-color: #28a745;
    background-color: #f0fff0;
}

.sentence-segment.error {
    border-left-color: #dc3545;
    background-color: #fff0f0;
}

.sentence-text {
    font-size: 14px;
    color: #333;
    margin-bottom: 5px;
}

.sentence-metadata {
    display: flex;
    gap: 10px;
    align-items: center;
    font-size: 12px;
    color: #666;
}

.translation-status,
.error-status {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    color: #666;
}

.status-indicator {
    font-weight: 500;
}

.retry-btn {
    padding: 2px 8px;
    font-size: 11px;
    background-color: #007acc;
    color: white;
    border: none;
    border-radius: 3px;
    cursor: pointer;
}
```

## Responsive Design

### Mobile/Tablet Adaptations

For smaller screens, the dual-pane layout converts to a stacked layout:

```css
@media (max-width: 768px) {
    .translation-panes {
        flex-direction: column;
        height: auto;
    }
    
    .translation-pane {
        border-right: none;
        border-bottom: 1px solid #eee;
        min-height: 200px;
    }
    
    .language-row {
        flex-direction: column;
        gap: 15px;
    }
}
```

## Accessibility Features

### Screen Reader Support

```html
<!-- ARIA labels for screen readers -->
<div class="live-translation-container" role="region" aria-label="Live translation display">
    <div class="translation-pane original-pane" role="log" aria-label="Original transcription">
        <!-- Content -->
    </div>
    <div class="translation-pane translated-pane" role="log" aria-label="Translated text">
        <!-- Content -->
    </div>
</div>

<!-- Status announcements -->
<div id="translation-announcements" class="sr-only" aria-live="polite" aria-atomic="true">
    <!-- Dynamic status updates for screen readers -->
</div>
```

### Keyboard Navigation

```javascript
// Keyboard shortcuts for translation controls
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case 't':
                e.preventDefault();
                toggleOngoingTranslation();
                break;
            case 'c':
                if (e.shiftKey) {
                    e.preventDefault();
                    copyTranslatedText();
                } else {
                    e.preventDefault();
                    copyOriginalText();
                }
                break;
        }
    }
});
```

## Animation and Feedback

### Visual Feedback for State Changes

```css
/* Smooth transitions for new content */
.sentence-segment {
    animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Pulsing animation for "translating" state */
.sentence-segment.translating .translation-status {
    animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
}

/* Success flash for completed translations */
.sentence-segment.translated {
    animation: successFlash 0.5s ease-out;
}

@keyframes successFlash {
    0% { background-color: #d4edda; }
    100% { background-color: #f0fff0; }
}
```

This UI design provides an intuitive and accessible interface for the ongoing translation feature while maintaining consistency with the existing application design.
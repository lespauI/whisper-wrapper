/**
 * Unit Tests for Timestamped Transcription Display
 * Tests the parsing and display of Whisper segments with timestamps and paragraph formatting
 */

const { JSDOM } = require('jsdom');

describe('Timestamped Transcription Display', () => {
    let dom;
    let window;
    let document;
    let app;
    let mockElectronAPI;

    // Mock Whisper JSON response with segments
    const mockWhisperSegments = [
        {
            id: 0,
            start: 0.0,
            end: 3.5,
            text: " Hello, this is a test transcription."
        },
        {
            id: 1,
            start: 3.5,
            end: 7.2,
            text: " This is the second segment of the audio."
        },
        {
            id: 2,
            start: 7.2,
            end: 9.8,
            text: " And this is a short pause."
        },
        {
            id: 3,
            start: 12.1,
            end: 16.5,
            text: " After a longer pause, we start a new paragraph."
        },
        {
            id: 4,
            start: 16.5,
            end: 20.0,
            text: " This continues the same paragraph."
        },
        {
            id: 5,
            start: 20.0,
            end: 22.8,
            text: " And this concludes it."
        },
        {
            id: 6,
            start: 25.5,
            end: 29.0,
            text: " Finally, this is the last paragraph after another pause."
        }
    ];

    const mockWhisperResult = {
        success: true,
        text: "Hello, this is a test transcription. This is the second segment of the audio. And this is a short pause. After a longer pause, we start a new paragraph. This continues the same paragraph. And this concludes it. Finally, this is the last paragraph after another pause.",
        segments: mockWhisperSegments,
        language: "en",
        model: "base"
    };

    beforeEach(() => {
        // Create DOM environment with all necessary elements
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    .hidden { display: none; }
                    .transcription-segments { display: block; }
                    .transcription-segment { margin-bottom: 1rem; }
                    .segment-timestamp { font-weight: bold; }
                    .segment-text { margin-top: 0.5rem; }
                    .segment-paragraph-break { height: 1rem; border-bottom: 1px dashed #ccc; }
                </style>
            </head>
            <body>
                <div id="transcription-editor">
                    <div id="transcription-segments" class="transcription-segments hidden"></div>
                    <textarea id="transcription-text" class="hidden"></textarea>
                </div>
                <div id="transcription-empty" class="empty-state"></div>
                <div id="transcription-loading" class="loading-state hidden"></div>
                <button id="toggle-view-btn">🕒 Timestamped View</button>
                <div id="transcription-status">Ready to transcribe</div>
            </body>
            </html>
        `, { url: 'http://localhost' });

        window = dom.window;
        document = window.document;
        global.window = window;
        global.document = document;

        // Mock navigator.clipboard
        global.navigator = {
            clipboard: {
                writeText: jest.fn().mockResolvedValue()
            }
        };

        // Mock console methods
        global.console = {
            log: jest.fn(),
            error: jest.fn()
        };

        // Create app instance with timestamped transcription methods
        app = {
            transcriptionState: {
                originalText: '',
                currentText: '',
                isDirty: false,
                lastSaved: null,
                autoSaveTimer: null,
                history: [],
                historyIndex: -1,
                segments: [],
                viewMode: 'timestamped'
            }
        };

        // Add the methods we need to test
        app.updateStatus = jest.fn();
        app.showError = jest.fn();
        app.updateTranscriptionStatus = jest.fn();

        // Timestamped transcription methods
        app.showTranscriptionResult = function(text, segments = null) {
            const transcriptionText = document.getElementById('transcription-text');
            const transcriptionSegments = document.getElementById('transcription-segments');
            const emptyState = document.getElementById('transcription-empty');
            const loadingState = document.getElementById('transcription-loading');
            
            // Hide loading and empty states
            emptyState.classList.add('hidden');
            loadingState.classList.add('hidden');
            
            // Initialize transcription state
            this.transcriptionState.originalText = text;
            this.transcriptionState.currentText = text;
            this.transcriptionState.isDirty = false;
            this.transcriptionState.lastSaved = new Date();
            this.transcriptionState.history = [text];
            this.transcriptionState.historyIndex = 0;
            this.transcriptionState.segments = segments || [];
            
            // Set up both views
            transcriptionText.value = text;
            
            if (segments && segments.length > 0) {
                this.renderTimestampedSegments(segments);
                this.transcriptionState.viewMode = 'timestamped';
                this.showTimestampedView();
            } else {
                // Fallback to plain text view if no segments
                this.transcriptionState.viewMode = 'plain';
                this.showPlainTextView();
            }
            
            // Update UI indicators
            this.updateTranscriptionStatus();
            this.updateToggleButton();
        };

        app.renderTimestampedSegments = function(segments) {
            const container = document.getElementById('transcription-segments');
            container.innerHTML = '';
            
            // Group segments into paragraphs based on pauses or content breaks
            const paragraphs = this.groupSegmentsIntoParagraphs(segments);
            
            paragraphs.forEach((paragraph, paragraphIndex) => {
                paragraph.forEach((segment, segmentIndex) => {
                    const segmentDiv = document.createElement('div');
                    segmentDiv.className = 'transcription-segment';
                    segmentDiv.dataset.segmentId = segment.id || `${paragraphIndex}-${segmentIndex}`;
                    
                    // Create timestamp
                    const timestampDiv = document.createElement('div');
                    timestampDiv.className = 'segment-timestamp';
                    timestampDiv.textContent = this.formatTimestamp(segment.start);
                    
                    // Create text content
                    const textDiv = document.createElement('div');
                    textDiv.className = 'segment-text';
                    textDiv.textContent = segment.text.trim();
                    
                    segmentDiv.appendChild(timestampDiv);
                    segmentDiv.appendChild(textDiv);
                    container.appendChild(segmentDiv);
                });
                
                // Add paragraph break if not the last paragraph
                if (paragraphIndex < paragraphs.length - 1) {
                    const breakDiv = document.createElement('div');
                    breakDiv.className = 'segment-paragraph-break';
                    container.appendChild(breakDiv);
                }
            });
        };

        app.groupSegmentsIntoParagraphs = function(segments) {
            if (!segments || segments.length === 0) return [];
            
            const paragraphs = [];
            let currentParagraph = [];
            
            for (let i = 0; i < segments.length; i++) {
                const segment = segments[i];
                const nextSegment = segments[i + 1];
                
                currentParagraph.push(segment);
                
                // Start new paragraph if:
                // 1. There's a significant pause (>2 seconds) between segments
                // 2. The text ends with sentence-ending punctuation and there's a pause
                // 3. We've reached a reasonable paragraph length (>5 segments)
                const shouldBreak = nextSegment && (
                    (nextSegment.start - segment.end > 2.0) || // 2+ second pause
                    (segment.text.trim().match(/[.!?]$/) && nextSegment.start - segment.end > 1.0) || // Sentence end + pause
                    (currentParagraph.length >= 5 && nextSegment.start - segment.end > 0.8) // Long paragraph + pause
                );
                
                if (shouldBreak || !nextSegment) {
                    paragraphs.push([...currentParagraph]);
                    currentParagraph = [];
                }
            }
            
            return paragraphs;
        };

        app.formatTimestamp = function(seconds) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = Math.floor(seconds % 60);
            const milliseconds = Math.floor((seconds % 1) * 100);
            
            return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
        };

        app.toggleViewMode = function() {
            if (this.transcriptionState.viewMode === 'timestamped') {
                this.transcriptionState.viewMode = 'plain';
                this.showPlainTextView();
            } else {
                this.transcriptionState.viewMode = 'timestamped';
                this.showTimestampedView();
            }
            this.updateToggleButton();
        };

        app.showTimestampedView = function() {
            const transcriptionText = document.getElementById('transcription-text');
            const transcriptionSegments = document.getElementById('transcription-segments');
            
            transcriptionText.classList.add('hidden');
            transcriptionSegments.classList.remove('hidden');
        };

        app.showPlainTextView = function() {
            const transcriptionText = document.getElementById('transcription-text');
            const transcriptionSegments = document.getElementById('transcription-segments');
            
            transcriptionSegments.classList.add('hidden');
            transcriptionText.classList.remove('hidden');
        };

        app.updateToggleButton = function() {
            const toggleBtn = document.getElementById('toggle-view-btn');
            
            if (this.transcriptionState.segments.length === 0) {
                // No segments available, disable timestamped view
                toggleBtn.disabled = true;
                toggleBtn.textContent = '📝 Plain Text Only';
                toggleBtn.title = 'No timestamp data available';
                return;
            }
            
            toggleBtn.disabled = false;
            
            if (this.transcriptionState.viewMode === 'timestamped') {
                toggleBtn.textContent = '📝 Plain Text View';
                toggleBtn.title = 'Switch to plain text editing view';
            } else {
                toggleBtn.textContent = '🕒 Timestamped View';
                toggleBtn.title = 'Switch to timestamped segments view';
            }
        };

        app.copyTranscription = function() {
            let textToCopy = '';
            
            if (this.transcriptionState.viewMode === 'timestamped' && this.transcriptionState.segments.length > 0) {
                // Copy with timestamps in the format [timestamp] text
                const paragraphs = this.groupSegmentsIntoParagraphs(this.transcriptionState.segments);
                
                paragraphs.forEach((paragraph, paragraphIndex) => {
                    paragraph.forEach(segment => {
                        textToCopy += `[${this.formatTimestamp(segment.start)}] ${segment.text.trim()}\n`;
                    });
                    
                    // Add paragraph break
                    if (paragraphIndex < paragraphs.length - 1) {
                        textToCopy += '\n';
                    }
                });
            } else {
                // Copy plain text
                const transcriptionText = document.getElementById('transcription-text');
                textToCopy = transcriptionText.value;
            }
            
            if (textToCopy) {
                navigator.clipboard.writeText(textToCopy).then(() => {
                    this.updateStatus('Transcription copied to clipboard');
                }).catch(() => {
                    this.showError('Failed to copy to clipboard');
                });
            }
        };
    });

    afterEach(() => {
        dom.window.close();
    });

    describe('Timestamp Formatting', () => {
        test('should format timestamps correctly', () => {
            expect(app.formatTimestamp(0)).toBe('00:00.00');
            expect(app.formatTimestamp(3.5)).toBe('00:03.50');
            expect(app.formatTimestamp(65.25)).toBe('01:05.25');
            expect(app.formatTimestamp(125.789)).toBe('02:05.78');
        });
    });

    describe('Segment Grouping', () => {
        test('should group segments into paragraphs based on pauses', () => {
            const paragraphs = app.groupSegmentsIntoParagraphs(mockWhisperSegments);
            
            // Should create 3 paragraphs based on the pause patterns
            expect(paragraphs).toHaveLength(3);
            
            // First paragraph: segments 0, 1, 2 (short pauses)
            expect(paragraphs[0]).toHaveLength(3);
            expect(paragraphs[0][0].text).toContain('Hello, this is a test');
            expect(paragraphs[0][1].text).toContain('second segment');
            expect(paragraphs[0][2].text).toContain('short pause');
            
            // Second paragraph: segments 3, 4, 5 (after longer pause)
            expect(paragraphs[1]).toHaveLength(3);
            expect(paragraphs[1][0].text).toContain('After a longer pause');
            expect(paragraphs[1][1].text).toContain('continues the same');
            expect(paragraphs[1][2].text).toContain('concludes it');
            
            // Third paragraph: segment 6 (after another pause)
            expect(paragraphs[2]).toHaveLength(1);
            expect(paragraphs[2][0].text).toContain('Finally, this is the last');
        });

        test('should handle empty segments array', () => {
            const paragraphs = app.groupSegmentsIntoParagraphs([]);
            expect(paragraphs).toHaveLength(0);
        });

        test('should handle single segment', () => {
            const singleSegment = [mockWhisperSegments[0]];
            const paragraphs = app.groupSegmentsIntoParagraphs(singleSegment);
            expect(paragraphs).toHaveLength(1);
            expect(paragraphs[0]).toHaveLength(1);
        });
    });

    describe('Timestamped Display Rendering', () => {
        test('should render timestamped segments correctly', () => {
            app.showTranscriptionResult(mockWhisperResult.text, mockWhisperResult.segments);
            
            const container = document.getElementById('transcription-segments');
            const segments = container.querySelectorAll('.transcription-segment');
            const paragraphBreaks = container.querySelectorAll('.segment-paragraph-break');
            
            // Should render all 7 segments
            expect(segments).toHaveLength(7);
            
            // Should have 2 paragraph breaks (between 3 paragraphs)
            expect(paragraphBreaks).toHaveLength(2);
            
            // Check first segment
            const firstSegment = segments[0];
            const firstTimestamp = firstSegment.querySelector('.segment-timestamp');
            const firstText = firstSegment.querySelector('.segment-text');
            
            expect(firstTimestamp.textContent).toBe('00:00.00');
            expect(firstText.textContent).toBe('Hello, this is a test transcription.');
            
            // Check a middle segment
            const fourthSegment = segments[3];
            const fourthTimestamp = fourthSegment.querySelector('.segment-timestamp');
            const fourthText = fourthSegment.querySelector('.segment-text');
            
            expect(fourthTimestamp.textContent).toBe('00:12.09');
            expect(fourthText.textContent).toBe('After a longer pause, we start a new paragraph.');
        });

        test('should show timestamped view when segments are available', () => {
            app.showTranscriptionResult(mockWhisperResult.text, mockWhisperResult.segments);
            
            const transcriptionText = document.getElementById('transcription-text');
            const transcriptionSegments = document.getElementById('transcription-segments');
            
            expect(transcriptionText.classList.contains('hidden')).toBe(true);
            expect(transcriptionSegments.classList.contains('hidden')).toBe(false);
            expect(app.transcriptionState.viewMode).toBe('timestamped');
        });

        test('should fallback to plain text when no segments available', () => {
            app.showTranscriptionResult(mockWhisperResult.text, null);
            
            const transcriptionText = document.getElementById('transcription-text');
            const transcriptionSegments = document.getElementById('transcription-segments');
            
            expect(transcriptionText.classList.contains('hidden')).toBe(false);
            expect(transcriptionSegments.classList.contains('hidden')).toBe(true);
            expect(app.transcriptionState.viewMode).toBe('plain');
        });
    });

    describe('View Mode Toggle', () => {
        beforeEach(() => {
            app.showTranscriptionResult(mockWhisperResult.text, mockWhisperResult.segments);
        });

        test('should toggle between timestamped and plain text views', () => {
            const transcriptionText = document.getElementById('transcription-text');
            const transcriptionSegments = document.getElementById('transcription-segments');
            
            // Initially in timestamped view
            expect(app.transcriptionState.viewMode).toBe('timestamped');
            expect(transcriptionSegments.classList.contains('hidden')).toBe(false);
            expect(transcriptionText.classList.contains('hidden')).toBe(true);
            
            // Toggle to plain text
            app.toggleViewMode();
            expect(app.transcriptionState.viewMode).toBe('plain');
            expect(transcriptionSegments.classList.contains('hidden')).toBe(true);
            expect(transcriptionText.classList.contains('hidden')).toBe(false);
            
            // Toggle back to timestamped
            app.toggleViewMode();
            expect(app.transcriptionState.viewMode).toBe('timestamped');
            expect(transcriptionSegments.classList.contains('hidden')).toBe(false);
            expect(transcriptionText.classList.contains('hidden')).toBe(true);
        });

        test('should update toggle button text correctly', () => {
            const toggleBtn = document.getElementById('toggle-view-btn');
            
            // Initially in timestamped view
            app.updateToggleButton();
            expect(toggleBtn.textContent).toBe('📝 Plain Text View');
            expect(toggleBtn.disabled).toBe(false);
            
            // Switch to plain text view
            app.transcriptionState.viewMode = 'plain';
            app.updateToggleButton();
            expect(toggleBtn.textContent).toBe('🕒 Timestamped View');
            expect(toggleBtn.disabled).toBe(false);
        });

        test('should disable toggle button when no segments available', () => {
            app.transcriptionState.segments = [];
            app.updateToggleButton();
            
            const toggleBtn = document.getElementById('toggle-view-btn');
            expect(toggleBtn.disabled).toBe(true);
            expect(toggleBtn.textContent).toBe('📝 Plain Text Only');
        });
    });

    describe('Copy Functionality with Timestamps', () => {
        beforeEach(() => {
            app.showTranscriptionResult(mockWhisperResult.text, mockWhisperResult.segments);
        });

        test('should copy with timestamps in timestamped view', async () => {
            app.transcriptionState.viewMode = 'timestamped';
            await app.copyTranscription();
            
            expect(navigator.clipboard.writeText).toHaveBeenCalled();
            const copiedText = navigator.clipboard.writeText.mock.calls[0][0];
            
            // Should contain timestamps in [MM:SS.MS] format
            expect(copiedText).toContain('[00:00.00] Hello, this is a test transcription.');
            expect(copiedText).toContain('[00:03.50] This is the second segment of the audio.');
            expect(copiedText).toContain('[00:12.09] After a longer pause, we start a new paragraph.');
            
            // Should have paragraph breaks (double newlines)
            expect(copiedText.split('\n\n')).toHaveLength(3);
        });

        test('should copy plain text in plain text view', async () => {
            app.transcriptionState.viewMode = 'plain';
            await app.copyTranscription();
            
            expect(navigator.clipboard.writeText).toHaveBeenCalled();
            const copiedText = navigator.clipboard.writeText.mock.calls[0][0];
            
            // Should be plain text without timestamps
            expect(copiedText).toBe(mockWhisperResult.text);
            expect(copiedText).not.toContain('[00:00.00]');
        });
    });

    describe('State Management', () => {
        test('should properly initialize transcription state with segments', () => {
            app.showTranscriptionResult(mockWhisperResult.text, mockWhisperResult.segments);
            
            expect(app.transcriptionState.originalText).toBe(mockWhisperResult.text);
            expect(app.transcriptionState.currentText).toBe(mockWhisperResult.text);
            expect(app.transcriptionState.segments).toEqual(mockWhisperResult.segments);
            expect(app.transcriptionState.viewMode).toBe('timestamped');
            expect(app.transcriptionState.isDirty).toBe(false);
            expect(app.transcriptionState.history).toEqual([mockWhisperResult.text]);
            expect(app.transcriptionState.historyIndex).toBe(0);
        });

        test('should handle empty segments gracefully', () => {
            app.showTranscriptionResult(mockWhisperResult.text, []);
            
            expect(app.transcriptionState.segments).toEqual([]);
            expect(app.transcriptionState.viewMode).toBe('plain');
        });
    });
});
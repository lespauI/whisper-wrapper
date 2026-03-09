/**
 * Transcription Controller
 * Manages transcription text editing, undo/redo, export functionality, and view modes
 */

import { SELECTORS, CSS_CLASSES } from '../utils/Constants.js';
import { EventHandler } from '../utils/EventHandler.js';
import { UIHelpers } from '../utils/UIHelpers.js';

export class TranscriptionController {
    constructor(appState, statusController, tabController) {
        this.appState = appState;
        this.statusController = statusController;
        this.tabController = tabController;
        
        // Transcription state
        this.transcriptionState = {
            originalText: '',
            currentText: '',
            isDirty: false,
            lastSaved: null,
            autoSaveTimer: null,
            history: [''],
            historyIndex: 0,
            segments: [], // Store original segments with timestamps
            viewMode: 'timestamped' // 'timestamped' or 'plain'
        };
        
        this.currentSegments = [];
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupExportDropdown();
        this.loadTranscriptionDraft();
        this.updateUndoRedoButtons();
        this.updateTranscriptionStatus();
    }

    /**
     * Set up event listeners for transcription functionality
     */
    setupEventListeners() {
        // Copy transcription
        EventHandler.addListener('#copy-btn', 'click', () => {
            this.copyTranscription();
        });

        // Undo/Redo buttons
        EventHandler.addListener('#undo-btn', 'click', () => {
            this.undoTranscription();
        });

        EventHandler.addListener('#redo-btn', 'click', () => {
            this.redoTranscription();
        });

        // Clear draft button
        EventHandler.addListener('#clear-draft-btn', 'click', () => {
            this.clearDraft();
        });

        // View mode toggle
        EventHandler.addListener('#toggle-view-btn', 'click', () => {
            this.toggleViewMode();
        });

        // Transcription text editing
        const transcriptionText = UIHelpers.getElementById('transcription-text');
        if (transcriptionText) {
            transcriptionText.addEventListener('input', (e) => {
                this.handleTranscriptionEdit(e.target.value);
            });

            transcriptionText.addEventListener('keydown', (e) => {
                this.handleKeyboardShortcuts(e);
            });
        }

        // Export dropdown triggers
        EventHandler.addListener('#export-txt-btn', 'click', () => {
            this.exportAs('txt');
        });

        EventHandler.addListener('#export-md-btn', 'click', () => {
            this.exportAs('md');
        });

        EventHandler.addListener('#export-json-btn', 'click', () => {
            this.exportAs('json');
        });

        // Download transcription (optional - may not exist in all views)
        if (UIHelpers.getElementById('download-btn')) {
            EventHandler.addListener('#download-btn', 'click', () => {
                this.downloadTranscription();
            });
        }
    }

    /**
     * Setup export dropdown functionality
     */
    setupExportDropdown() {
        // Use string selectors for EventHandler
        EventHandler.addListener('#export-dropdown-btn', 'click', (e) => {
            e.stopPropagation();
            const dropdownMenu = UIHelpers.getElementById('export-dropdown');
            if (dropdownMenu) {
                UIHelpers.toggleClass(dropdownMenu, CSS_CLASSES.HIDDEN);
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            const dropdownMenu = UIHelpers.getElementById('export-dropdown');
            if (dropdownMenu) {
                UIHelpers.addClass(dropdownMenu, CSS_CLASSES.HIDDEN);
            }
        });
    }

    /**
     * Handle transcription text editing
     */
    handleTranscriptionEdit(newText) {
        const oldText = this.transcriptionState.currentText;
        
        if (newText !== oldText) {
            this.transcriptionState.currentText = newText;
            this.transcriptionState.isDirty = true;
            
            // Add to history for undo/redo
            if (this.transcriptionState.historyIndex < this.transcriptionState.history.length - 1) {
                // Remove future history if we're not at the end
                this.transcriptionState.history = this.transcriptionState.history.slice(0, this.transcriptionState.historyIndex + 1);
            }
            this.transcriptionState.history.push(newText);
            this.transcriptionState.historyIndex = this.transcriptionState.history.length - 1;
            
            // Limit history size
            if (this.transcriptionState.history.length > 50) {
                this.transcriptionState.history.shift();
                this.transcriptionState.historyIndex--;
            }
            
            this.updateTranscriptionStatus();
            this.updateUndoRedoButtons();
            this.scheduleAutoSave();
        }
    }

    /**
     * Schedule auto-save of transcription draft
     */
    scheduleAutoSave() {
        // Clear existing timer
        if (this.transcriptionState.autoSaveTimer) {
            clearTimeout(this.transcriptionState.autoSaveTimer);
        }
        
        // Schedule new auto-save
        this.transcriptionState.autoSaveTimer = setTimeout(() => {
            this.saveTranscriptionDraft();
        }, 2000);
    }

    /**
     * Save transcription draft to localStorage
     */
    async saveTranscriptionDraft() {
        if (this.transcriptionState.isDirty && this.transcriptionState.currentText) {
            try {
                const draft = {
                    text: this.transcriptionState.currentText,
                    originalText: this.transcriptionState.originalText,
                    timestamp: new Date().toISOString(),
                    wordCount: this.getWordCount(this.transcriptionState.currentText)
                };
                
                localStorage.setItem('whisper-transcription-draft', JSON.stringify(draft));
                this.transcriptionState.lastSaved = new Date();
                this.updateTranscriptionStatus();
                
                console.log('Draft auto-saved');
            } catch (error) {
                console.error('Failed to save draft:', error);
            }
        }
    }

    /**
     * Load transcription draft from localStorage
     */
    loadTranscriptionDraft() {
        try {
            const draftData = localStorage.getItem('whisper-transcription-draft');
            if (draftData) {
                const draft = JSON.parse(draftData);
                const transcriptionText = UIHelpers.getElementById('transcription-text');
                
                // Only load if there's no current transcription
                if (transcriptionText && !transcriptionText.value && draft.text) {
                    transcriptionText.value = draft.text;
                    this.transcriptionState.currentText = draft.text;
                    this.transcriptionState.originalText = draft.originalText || '';
                    this.transcriptionState.isDirty = true;
                    this.transcriptionState.lastSaved = new Date(draft.timestamp);
                    
                    this.updateTranscriptionStatus();
                    this.statusController.updateStatus('Draft loaded from previous session');
                    
                    // Show transcription tab content
                    const emptyState = UIHelpers.getElementById('transcription-empty');
                    if (emptyState) {
                        UIHelpers.addClass(emptyState, CSS_CLASSES.HIDDEN);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load draft:', error);
        }
    }

    /**
     * Clear transcription draft from localStorage
     */
    clearTranscriptionDraft() {
        localStorage.removeItem('whisper-transcription-draft');
        this.transcriptionState.isDirty = false;
        this.updateTranscriptionStatus();
    }

    /**
     * Copy transcription to clipboard
     */
    copyTranscription() {
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
            const transcriptionText = UIHelpers.getElementById('transcription-text');
            textToCopy = transcriptionText ? transcriptionText.value : '';
        }
        
        if (textToCopy) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                this.statusController.updateStatus('Transcription copied to clipboard');
            }).catch(() => {
                this.statusController.showError('Failed to copy to clipboard');
            });
        }
    }

    /**
     * Download transcription as text file
     */
    async downloadTranscription() {
        const transcriptionText = UIHelpers.getElementById('transcription-text');
        
        if (transcriptionText && transcriptionText.value) {
            try {
                const filename = `transcription-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
                const result = await window.electronAPI.saveFile(transcriptionText.value, filename);
                
                if (!result.canceled) {
                    this.statusController.updateStatus('Transcription saved successfully');
                    // Mark as saved
                    this.transcriptionState.isDirty = false;
                    this.transcriptionState.lastSaved = new Date();
                    this.updateTranscriptionStatus();
                }
            } catch (error) {
                console.error('Error saving transcription:', error);
                this.statusController.showError('Failed to save transcription');
            }
        }
    }

    /**
     * Export transcription in different formats
     */
    async exportAs(format) {
        const transcriptionText = UIHelpers.getElementById('transcription-text');
        
        if (!transcriptionText || !transcriptionText.value) {
            this.statusController.showError('No transcription to export');
            return;
        }
        
        try {
            let content = '';
            let extension = '';
            let mimeType = '';
            
            switch (format) {
                case 'txt':
                    content = transcriptionText.value;
                    extension = 'txt';
                    mimeType = 'text/plain';
                    break;
                    
                case 'md':
                    content = this.formatAsMarkdown(transcriptionText.value);
                    extension = 'md';
                    mimeType = 'text/markdown';
                    break;
                    
                case 'json':
                    content = this.formatAsJSON(transcriptionText.value);
                    extension = 'json';
                    mimeType = 'application/json';
                    break;
                    
                default:
                    throw new Error('Unsupported format');
            }
            
            const filename = `transcription-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${extension}`;
            const result = await window.electronAPI.saveFile(content, filename);
            
            if (!result.canceled) {
                this.statusController.updateStatus(`Transcription exported as ${format.toUpperCase()}`);
                // Mark as saved if it's the current content
                if (format === 'txt') {
                    this.transcriptionState.isDirty = false;
                    this.transcriptionState.lastSaved = new Date();
                    this.updateTranscriptionStatus();
                }
            }
            
            // Close export dropdown
            const dropdownMenu = UIHelpers.getElementById('export-dropdown');
            if (dropdownMenu) {
                UIHelpers.addClass(dropdownMenu, CSS_CLASSES.HIDDEN);
            }
            
        } catch (error) {
            console.error('Error exporting transcription:', error);
            this.statusController.showError(`Failed to export as ${format.toUpperCase()}`);
        }
    }

    /**
     * Format text as Markdown
     */
    formatAsMarkdown(text) {
        const timestamp = new Date().toISOString();
        const wordCount = this.getWordCount(text);
        
        return `# Transcription

**Generated:** ${timestamp}  
**Word Count:** ${wordCount}

---

${text}

---

*Generated by Whisper Wrapper*`;
    }

    /**
     * Format text as JSON
     */
    formatAsJSON(text) {
        const data = {
            transcription: text,
            metadata: {
                timestamp: new Date().toISOString(),
                wordCount: this.getWordCount(text),
                characterCount: this.getCharacterCount(text),
                generatedBy: 'Whisper Wrapper'
            }
        };
        
        return JSON.stringify(data, null, 2);
    }

    /**
     * Undo transcription changes
     */
    undoTranscription() {
        // Only perform the undo if there's history to undo to
        if (this.transcriptionState.historyIndex > 0) {
            this.transcriptionState.historyIndex--;
            const previousText = this.transcriptionState.history[this.transcriptionState.historyIndex];
            
            const transcriptionText = UIHelpers.getElementById('transcription-text');
            if (transcriptionText) {
                transcriptionText.value = previousText;
                this.transcriptionState.currentText = previousText;
                this.transcriptionState.isDirty = previousText !== this.transcriptionState.originalText;
                
                this.updateTranscriptionStatus();
                this.scheduleAutoSave();
            }
        } else {
            // If no history to undo to, just show a status update
            this.statusController.updateStatus('Nothing to undo');
        }
    }

    /**
     * Redo transcription changes
     */
    redoTranscription() {
        // Only perform the redo if there's history to redo to
        if (this.transcriptionState.historyIndex < this.transcriptionState.history.length - 1) {
            this.transcriptionState.historyIndex++;
            const nextText = this.transcriptionState.history[this.transcriptionState.historyIndex];
            
            const transcriptionText = UIHelpers.getElementById('transcription-text');
            if (transcriptionText) {
                transcriptionText.value = nextText;
                this.transcriptionState.currentText = nextText;
                this.transcriptionState.isDirty = nextText !== this.transcriptionState.originalText;
                
                this.updateTranscriptionStatus();
                this.scheduleAutoSave();
            }
        } else {
            // If no history to redo to, just show a status update
            this.statusController.updateStatus('Nothing to redo');
        }
    }

    /**
     * Clear current transcription draft
     */
    clearDraft() {
        if (confirm('Are you sure you want to clear the current transcription? This action cannot be undone.')) {
            const transcriptionText = UIHelpers.getElementById('transcription-text');
            const transcriptionSegments = UIHelpers.getElementById('transcription-segments');
            
            // Clear both text and segments
            if (transcriptionText) transcriptionText.value = '';
            if (transcriptionSegments) transcriptionSegments.innerHTML = '';
            
            // Reset state
            this.transcriptionState = {
                originalText: '',
                currentText: '',
                isDirty: false,
                lastSaved: null,
                autoSaveTimer: null,
                history: [''],
                historyIndex: 0,
                segments: [],
                viewMode: this.transcriptionState.viewMode || 'plain' // Preserve view mode
            };
            
            // Clear stored segments
            this.currentSegments = [];
            
            this.clearTranscriptionDraft();
            this.updateTranscriptionStatus();
            this.updateUndoRedoButtons();
            
            // Show empty state and hide both views
            const emptyState = UIHelpers.getElementById('transcription-empty');
            if (emptyState) UIHelpers.removeClass(emptyState, CSS_CLASSES.HIDDEN);
            if (transcriptionText) UIHelpers.addClass(transcriptionText, CSS_CLASSES.HIDDEN);
            if (transcriptionSegments) UIHelpers.addClass(transcriptionSegments, CSS_CLASSES.HIDDEN);
            
            console.log('🧹 Cleared transcription in both plain text and timestamped views');
            
            this.statusController.updateStatus('Transcription cleared');
        }
    }

    /**
     * Toggle between timestamped and plain text view modes
     */
    toggleViewMode() {
        if (this.transcriptionState.viewMode === 'timestamped') {
            this.transcriptionState.viewMode = 'plain';
            this.showPlainTextView();
        } else {
            this.transcriptionState.viewMode = 'timestamped';
            this.showTimestampedView();
        }
        
        this.updateToggleButton();
    }

    /**
     * Show timestamped view
     */
    showTimestampedView() {
        console.log('🎬 showTimestampedView called');
        const transcriptionText = UIHelpers.getElementById('transcription-text');
        const transcriptionSegments = UIHelpers.getElementById('transcription-segments');
        
        if (transcriptionText && transcriptionSegments) {
            UIHelpers.addClass(transcriptionText, CSS_CLASSES.HIDDEN);
            UIHelpers.removeClass(transcriptionSegments, CSS_CLASSES.HIDDEN);
            console.log('🎬 Switched to timestamped view');
        }
    }
    
    /**
     * Show plain text view
     */
    showPlainTextView() {
        console.log('🎬 showPlainTextView called');
        const transcriptionText = UIHelpers.getElementById('transcription-text');
        const transcriptionSegments = UIHelpers.getElementById('transcription-segments');
        
        // Ensure the textarea has the current text from the transcription state
        if (transcriptionText && this.transcriptionState.currentText) {
            transcriptionText.value = this.transcriptionState.currentText;
            console.log('🎬 Synced textarea with current text:', this.transcriptionState.currentText.substring(0, 50) + '...');
        }
        
        if (transcriptionText && transcriptionSegments) {
            UIHelpers.addClass(transcriptionSegments, CSS_CLASSES.HIDDEN);
            UIHelpers.removeClass(transcriptionText, CSS_CLASSES.HIDDEN);
            console.log('🎬 Switched to plain text view');
        }
    }

    /**
     * Update the view toggle button text
     */
    updateToggleButton() {
        const toggleBtn = UIHelpers.getElementById('toggle-view-btn');
        if (toggleBtn) {
            if (this.transcriptionState.viewMode === 'timestamped') {
                UIHelpers.setText(toggleBtn, '📝 Plain Text View');
                toggleBtn.title = 'Switch to plain text editing view';
            } else {
                UIHelpers.setText(toggleBtn, '🕒 Timestamped View');
                toggleBtn.title = 'Switch to timestamped segments view';
            }
        }
    }

    /**
     * Show transcription result
     */
    showTranscriptionResult(text, segments = null) {
        console.log('🎬 showTranscriptionResult called with:', {
            textLength: text?.length,
            segmentsCount: segments?.length,
            segments: segments 
        });

        const transcriptionText = UIHelpers.getElementById('transcription-text');
        const transcriptionSegments = UIHelpers.getElementById('transcription-segments');
        const emptyState = UIHelpers.getElementById('transcription-empty');
        
        console.log('🎬 Element lookup results:', {
            transcriptionText: !!transcriptionText,
            transcriptionSegments: !!transcriptionSegments,
            emptyState: !!emptyState
        });
        
        // Hide empty state
        if (emptyState) {
            UIHelpers.addClass(emptyState, CSS_CLASSES.HIDDEN);
            console.log('🎬 Hidden empty state');
        }
        
        // CRITICAL: Clear loading state immediately
        if (this.statusController && this.statusController.showTranscriptionLoading) {
            this.statusController.showTranscriptionLoading(false);
            console.log('🎬 Cleared transcription loading state');
        }

        // Update transcription state
        this.transcriptionState.originalText = text;
        this.transcriptionState.currentText = text;
        this.transcriptionState.isDirty = false;
        this.transcriptionState.lastSaved = new Date();
        this.transcriptionState.history = [text];
        this.transcriptionState.historyIndex = 0;
        this.transcriptionState.segments = segments || [];
        
        // Store segments for later use
        this.currentSegments = segments || [];
        
        if (segments && segments.length > 0) {
            // Display timestamped view by default when segments are available
            this.transcriptionState.viewMode = 'timestamped';
            
            if (transcriptionSegments) {
                this.renderTimestampedSegments(segments);
                this.showTimestampedView();
            }
        } else {
            // Use plain text view when no segments
            this.transcriptionState.viewMode = 'plain';
            this.showPlainTextView();
        }

        // Set plain text content
        if (transcriptionText) {
            transcriptionText.value = text;
            console.log('🎬 Set textarea value to:', text.substring(0, 50) + '...');
        } else {
            console.error('🎬 transcriptionText element not found!');
        }

        this.updateTranscriptionStatus();
        this.updateUndoRedoButtons();
        this.updateToggleButton();
        this.saveTranscriptionToHistory();

        // Switch to transcription tab
        if (this.tabController) {
            this.tabController.switchTab('transcription');
        }
    }

    /**
     * Render timestamped segments
     */
    renderTimestampedSegments(segments) {
        const container = UIHelpers.getElementById('transcription-segments');
        if (!container || !segments || segments.length === 0) return;

        container.innerHTML = '';
        
        const paragraphs = this.groupSegmentsIntoParagraphs(segments);
        
        paragraphs.forEach((paragraph, paragraphIndex) => {
            const paragraphDiv = document.createElement('div');
            paragraphDiv.className = 'transcript-paragraph';
            paragraphDiv.setAttribute('data-paragraph', paragraphIndex);
            
            paragraph.forEach((segment, segmentIndex) => {
                const segmentDiv = document.createElement('div');
                segmentDiv.className = 'transcript-segment';
                segmentDiv.setAttribute('data-start', segment.start);
                segmentDiv.setAttribute('data-end', segment.end);
                
                const timestamp = document.createElement('span');
                timestamp.className = 'transcript-timestamp';
                timestamp.textContent = this.formatTimestamp(segment.start);
                
                const text = document.createElement('span');
                text.className = 'transcript-text';
                text.textContent = segment.text.trim();
                
                segmentDiv.appendChild(timestamp);
                segmentDiv.appendChild(text);
                paragraphDiv.appendChild(segmentDiv);
            });
            
            container.appendChild(paragraphDiv);
        });
    }

    /**
     * Group segments into paragraphs
     */
    groupSegmentsIntoParagraphs(segments) {
        const paragraphs = [];
        let currentParagraph = [];
        
        segments.forEach((segment, index) => {
            currentParagraph.push(segment);
            
            // Start new paragraph after silence or at natural breaks
            const nextSegment = segments[index + 1];
            if (nextSegment) {
                const gap = nextSegment.start - segment.end;
                const endsWithPunctuation = /[.!?]\s*$/.test(segment.text.trim());
                
                if (gap > 2.0 || (gap > 1.0 && endsWithPunctuation)) {
                    paragraphs.push(currentParagraph);
                    currentParagraph = [];
                }
            }
        });
        
        if (currentParagraph.length > 0) {
            paragraphs.push(currentParagraph);
        }
        
        return paragraphs;
    }

    /**
     * Format timestamp for display
     */
    formatTimestamp(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Save transcription to history
     */
    saveTranscriptionToHistory() {
        // This method can be used to save important transcription milestones
        // For now, it's a placeholder for future implementation
        console.log('Transcription saved to history');
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + Z for undo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            this.undoTranscription();
        }
        
        // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y for redo
        if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') || 
            ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
            e.preventDefault();
            this.redoTranscription();
        }
        
        // Ctrl/Cmd + S for save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            this.downloadTranscription();
        }
    }

    /**
     * Get word count from text
     */
    getWordCount(text) {
        if (!text) return 0;
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    /**
     * Get character count from text
     */
    getCharacterCount(text) {
        return text ? text.length : 0;
    }

    /**
     * Update transcription status display
     */
    updateTranscriptionStatus() {
        const wordCount = this.getWordCount(this.transcriptionState.currentText);
        const charCount = this.getCharacterCount(this.transcriptionState.currentText);
        
        // Update status in footer or transcription area
        let statusText = `${wordCount} words, ${charCount} characters`;
        
        if (this.transcriptionState.isDirty) {
            statusText += ' • Unsaved changes';
        } else if (this.transcriptionState.lastSaved) {
            const timeSince = Math.floor((new Date() - this.transcriptionState.lastSaved) / 1000);
            if (timeSince < 60) {
                statusText += ' • Saved just now';
            } else if (timeSince < 3600) {
                statusText += ` • Saved ${Math.floor(timeSince / 60)}m ago`;
            } else {
                statusText += ` • Saved ${Math.floor(timeSince / 3600)}h ago`;
            }
        }
        
        // Update the status text
        const statusElement = UIHelpers.getElementById('transcription-status');
        if (statusElement) {
            UIHelpers.setText(statusElement, statusText);
        }
    }

    /**
     * Update undo/redo button states
     */
    updateUndoRedoButtons() {
        const undoBtn = UIHelpers.getElementById('undo-btn');
        const redoBtn = UIHelpers.getElementById('redo-btn');
        
        // Always keep buttons enabled as requested
        if (undoBtn) {
            undoBtn.disabled = false;
        }
        
        if (redoBtn) {
            redoBtn.disabled = false;
        }
    }

    /**
     * Get current transcription state
     */
    getCurrentState() {
        return {
            ...this.transcriptionState,
            hasContent: this.transcriptionState.currentText.length > 0,
            segmentCount: this.transcriptionState.segments.length
        };
    }

    /**
     * Load audio from a file path via IPC and set up the player
     * @param {string} filePath - Absolute path to the audio file
     */
    async loadAudio(filePath) {
        if (!filePath) {
            this.hideAudioPlayer();
            return;
        }
        try {
            const result = await window.electronAPI.readAudioFile(filePath);
            if (!result || !result.success) {
                this.hideAudioPlayer();
                return;
            }
            const player = document.getElementById('audio-player');
            if (!player) return;
            player.src = result.dataUrl;
            this.showAudioPlayer();
            this._setupAudioPlayerEvents(player);
        } catch (err) {
            this.hideAudioPlayer();
        }
    }

    /**
     * Load audio from a Blob URL (for recorded audio)
     * @param {string} blobUrl - Blob URL to play
     */
    loadAudioFromBlobUrl(blobUrl) {
        if (!blobUrl) {
            this.hideAudioPlayer();
            return;
        }
        const player = document.getElementById('audio-player');
        if (!player) return;
        player.src = blobUrl;
        this.showAudioPlayer();
        this._setupAudioPlayerEvents(player);
    }

    /**
     * Wire up all audio player DOM events, removing any previous listeners first.
     * @param {HTMLAudioElement} player
     */
    _setupAudioPlayerEvents(player) {
        this._teardownAudioPlayerEvents();

        const playBtn = document.getElementById('audio-play-btn');
        const seekBar = document.getElementById('audio-seek');
        const speedSelect = document.getElementById('audio-speed');
        const currentTimeEl = document.getElementById('audio-current-time');
        const durationEl = document.getElementById('audio-duration');

        const playerHandlers = {
            loadedmetadata: () => {
                if (seekBar) seekBar.max = player.duration;
                if (durationEl) durationEl.textContent = this._formatAudioTime(player.duration);
            },
            timeupdate: () => {
                if (seekBar && !seekBar._seeking) seekBar.value = player.currentTime;
                if (currentTimeEl) currentTimeEl.textContent = this._formatAudioTime(player.currentTime);
                this._highlightActiveSegment(player.currentTime);
            },
            ended: () => {
                if (playBtn) playBtn.innerHTML = '&#9654;';
            }
        };

        player.addEventListener('loadedmetadata', playerHandlers.loadedmetadata);
        player.addEventListener('timeupdate', playerHandlers.timeupdate);
        player.addEventListener('ended', playerHandlers.ended);

        const controlHandlers = { playBtn: null, seekBarMousedown: null, seekBarInput: null, seekBarChange: null, speedSelect: null };

        if (playBtn) {
            controlHandlers.playBtn = () => {
                if (player.paused) {
                    player.play();
                    playBtn.innerHTML = '&#9646;&#9646;';
                } else {
                    player.pause();
                    playBtn.innerHTML = '&#9654;';
                }
            };
            playBtn.addEventListener('click', controlHandlers.playBtn);
        }

        if (seekBar) {
            controlHandlers.seekBarMousedown = () => { seekBar._seeking = true; };
            controlHandlers.seekBarInput = () => {
                if (currentTimeEl) currentTimeEl.textContent = this._formatAudioTime(Number(seekBar.value));
            };
            controlHandlers.seekBarChange = () => {
                player.currentTime = Number(seekBar.value);
                seekBar._seeking = false;
            };
            seekBar.addEventListener('mousedown', controlHandlers.seekBarMousedown);
            seekBar.addEventListener('input', controlHandlers.seekBarInput);
            seekBar.addEventListener('change', controlHandlers.seekBarChange);
        }

        if (speedSelect) {
            controlHandlers.speedSelect = () => {
                player.playbackRate = Number(speedSelect.value);
            };
            speedSelect.addEventListener('change', controlHandlers.speedSelect);
        }

        this._audioHandlers = { player, playerHandlers, controlHandlers, playBtn, seekBar, speedSelect };
    }

    /**
     * Remove all audio player event listeners registered by _setupAudioPlayerEvents.
     */
    _teardownAudioPlayerEvents() {
        if (!this._audioHandlers) return;
        const { player, playerHandlers, controlHandlers, playBtn, seekBar, speedSelect } = this._audioHandlers;

        player.removeEventListener('loadedmetadata', playerHandlers.loadedmetadata);
        player.removeEventListener('timeupdate', playerHandlers.timeupdate);
        player.removeEventListener('ended', playerHandlers.ended);

        if (playBtn && controlHandlers.playBtn) playBtn.removeEventListener('click', controlHandlers.playBtn);
        if (seekBar) {
            if (controlHandlers.seekBarMousedown) seekBar.removeEventListener('mousedown', controlHandlers.seekBarMousedown);
            if (controlHandlers.seekBarInput) seekBar.removeEventListener('input', controlHandlers.seekBarInput);
            if (controlHandlers.seekBarChange) seekBar.removeEventListener('change', controlHandlers.seekBarChange);
        }
        if (speedSelect && controlHandlers.speedSelect) speedSelect.removeEventListener('change', controlHandlers.speedSelect);

        this._audioHandlers = null;
    }

    /**
     * Highlight the transcript segment that corresponds to the current playback time
     * @param {number} currentTime - Current audio playback time in seconds
     */
    _highlightActiveSegment(currentTime) {
        const container = document.getElementById('transcription-segments');
        if (!container || container.classList.contains('hidden')) return;

        const segments = container.querySelectorAll('.transcription-segment[data-start]');
        let activeEl = null;

        for (const seg of segments) {
            const start = parseFloat(seg.dataset.start);
            const end = parseFloat(seg.dataset.end);
            if (currentTime >= start && currentTime < end) {
                activeEl = seg;
                break;
            }
        }

        container.querySelectorAll('.transcription-segment--active').forEach(el => {
            el.classList.remove('transcription-segment--active');
        });

        if (activeEl) {
            activeEl.classList.add('transcription-segment--active');
            activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    /**
     * Seek the audio player to a specific time
     * @param {number} time - Time in seconds
     */
    seekToTime(time) {
        const player = document.getElementById('audio-player');
        if (!player || !player.src) return;
        player.currentTime = time;
        if (player.paused) {
            player.play();
            const playBtn = document.getElementById('audio-play-btn');
            if (playBtn) playBtn.innerHTML = '&#9646;&#9646;';
        }
    }

    /**
     * Show the audio player bar
     */
    showAudioPlayer() {
        const bar = document.getElementById('audio-player-bar');
        if (bar) bar.classList.remove('hidden');
    }

    /**
     * Hide the audio player bar
     */
    hideAudioPlayer() {
        const bar = document.getElementById('audio-player-bar');
        if (bar) bar.classList.add('hidden');
        const player = document.getElementById('audio-player');
        if (player) {
            player.pause();
            player.setAttribute('src', '');
        }
        this._teardownAudioPlayerEvents();
    }

    /**
     * Format time in seconds to M:SS display
     * @param {number} seconds
     * @returns {string}
     */
    _formatAudioTime(seconds) {
        if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    /**
     * Find the segment index whose time range contains the given time
     * @param {Array} segments - Array of segment objects with start and end
     * @param {number} time - Time in seconds
     * @returns {number} Index of the matching segment or -1
     */
    findSegmentAtTime(segments, time) {
        if (!segments || !segments.length) return -1;
        for (let i = 0; i < segments.length; i++) {
            if (time >= segments[i].start && time < segments[i].end) {
                return i;
            }
        }
        if (time >= segments[segments.length - 1].end) {
            return segments.length - 1;
        }
        return -1;
    }

    /**
     * Destroy the controller and clean up resources
     */
    destroy() {
        // Clear any auto-save timers
        if (this.transcriptionState.autoSaveTimer) {
            clearTimeout(this.transcriptionState.autoSaveTimer);
        }
        
        // Save final draft
        this.saveTranscriptionDraft();
        
        this.hideAudioPlayer();
    }
}
/**
 * File Upload Controller
 * Manages file selection, drag-and-drop, validation, and upload processing
 */

import { SUPPORTED_FORMATS, TABS, CSS_CLASSES, SELECTORS } from '../utils/Constants.js';
import { EventHandler } from '../utils/EventHandler.js';
import { UIHelpers } from '../utils/UIHelpers.js';

export class FileUploadController {
    constructor(appState, statusController, tabController) {
        this.appState = appState;
        this.statusController = statusController;
        this.tabController = tabController;
        this.init();
    }

    init() {
        this.setupFileUpload();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Listen to app state changes
        this.appState.subscribe('fileUpload', (data) => {
            this.handleFileUploadStateChange(data);
        });
    }

    /**
     * Set up file upload area with drag-and-drop and click handlers
     */
    setupFileUpload() {
        const uploadArea = UIHelpers.getElementById('file-upload');
        const browseBtn = UIHelpers.getElementById('browse-btn');

        if (!uploadArea || !browseBtn) {
            console.warn('File upload elements not found');
            return;
        }

        // Click to browse
        EventHandler.addListener(SELECTORS.BROWSE_BTN, 'click', () => {
            this.selectFile();
        });

        EventHandler.addListener(SELECTORS.FILE_UPLOAD, 'click', () => {
            this.selectFile();
        });

        // Drag and drop events
        EventHandler.addListener(SELECTORS.FILE_UPLOAD, 'dragover', (e) => {
            EventHandler.preventDefault(e);
            UIHelpers.addClass(uploadArea, CSS_CLASSES.DRAGOVER);
            this.appState.setUIState({ dragOver: true });
        });

        EventHandler.addListener(SELECTORS.FILE_UPLOAD, 'dragleave', (e) => {
            EventHandler.preventDefault(e);
            UIHelpers.removeClass(uploadArea, CSS_CLASSES.DRAGOVER);
            this.appState.setUIState({ dragOver: false });
        });

        EventHandler.addListener(SELECTORS.FILE_UPLOAD, 'drop', (e) => {
            EventHandler.preventDefault(e);
            UIHelpers.removeClass(uploadArea, CSS_CLASSES.DRAGOVER);
            this.appState.setUIState({ dragOver: false });
            
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                this.handleFileUpload(files[0].path);
            }
        });
    }

    /**
     * Open file selection dialog
     */
    async selectFile() {
        try {
            const result = await window.electronAPI.selectFile();
            
            if (!result.canceled) {
                await this.handleFileUpload(result.filePath, result.fileInfo);
            }
        } catch (error) {
            console.error('Error selecting file:', error);
            this.statusController.showError('Failed to select file');
        }
    }

    /**
     * Handle file upload and processing
     * @param {string} filePath - Path to the uploaded file
     * @param {Object} fileInfo - Additional file information
     */
    async handleFileUpload(filePath, fileInfo = null) {
        try {
            // Validate file
            if (!this.validateFile(filePath)) {
                return;
            }

            // Update states
            this.appState.setFileUploadState({
                currentFile: filePath,
                isProcessing: true,
                progress: 0
            });

            // Update UI
            this.statusController.updateStatus('Processing file...');
            this.statusController.showProgress(true);
            this.statusController.showTranscriptionLoading(true);
            
            // Set up progress listener
            window.electronAPI.onTranscriptionProgress((event, progress) => {
                this.statusController.updateTranscriptionProgress(progress);
                this.appState.setFileUploadState({ progress: progress.percentage || 0 });
            });

            // Start transcription
            const result = await window.electronAPI.transcribeFile(filePath);
            console.log('🎬 Transcription result from IPC:', result);
            
            if (result.success) {
                await this.handleTranscriptionSuccess(result);
            } else {
                throw new Error(result.error || 'Transcription failed');
            }
            
        } catch (error) {
            console.error('Error processing file:', error);
            this.statusController.showError(error.message || 'Failed to process file');
            this.appState.setFileUploadState({
                currentFile: null,
                isProcessing: false,
                progress: 0
            });
        } finally {
            // Always hide loading states and progress
            this.statusController.showProgress(false);
            this.statusController.showTranscriptionLoading(false);
            
            // Clean up progress listener
            if (window.electronAPI) {
                window.electronAPI.removeAllListeners('transcription:progress');
            }
        }
    }

    /**
     * Handle successful transcription
     * @param {Object} result - Transcription result
     */
    async handleTranscriptionSuccess(result) {
        // Update transcription state
        this.appState.setTranscriptionState({
            originalText: result.text,
            currentText: result.text,
            segments: result.segments || [],
            isDirty: false,
            lastSaved: new Date(),
            history: [result.text],
            historyIndex: 0
        });

        // Update file upload state
        this.appState.setFileUploadState({
            currentFile: null,
            isProcessing: false,
            progress: 100
        });

        // Show transcription result
        await this.showTranscriptionResult(result.text, result.segments);
        
        // Update status and switch to transcription tab
        this.statusController.updateStatus(`Transcription completed (Language: ${result.language || 'unknown'})`);
        await this.tabController.switchTab(TABS.TRANSCRIPTION);
    }

    /**
     * Display transcription result in the UI
     * @param {string} text - Transcribed text
     * @param {Array} segments - Timestamped segments (optional)
     */
    async showTranscriptionResult(text, segments = null) {
        console.log('🎬 showTranscriptionResult called with:', { 
            textLength: text?.length, 
            segmentsCount: segments?.length,
            segments: segments 
        });
        
        const transcriptionText = UIHelpers.getElementById('transcription-text');
        const transcriptionSegments = UIHelpers.getElementById('transcription-segments');
        const emptyState = UIHelpers.getElementById('transcription-empty');
        const loadingState = UIHelpers.getElementById('transcription-loading');
        const editor = UIHelpers.getElementById('transcription-editor');
        
        if (!transcriptionText || !editor) {
            console.error('Required transcription elements not found');
            return;
        }

        console.log('🎬 DOM elements found:', {
            transcriptionText: !!transcriptionText,
            transcriptionSegments: !!transcriptionSegments,
            emptyState: !!emptyState,
            loadingState: !!loadingState,
            editor: !!editor
        });
        
        // Hide loading and empty states, show editor
        UIHelpers.hide(emptyState);
        UIHelpers.hide(loadingState);
        UIHelpers.show(editor);
        console.log('🎬 Hidden loading and empty states, shown editor');
        
        // Set up both views
        UIHelpers.setValue(transcriptionText, text);
        console.log('🎬 Set transcription text value:', text?.substring(0, 50) + '...');
        
        if (segments && segments.length > 0) {
            console.log('🎬 Has segments, rendering timestamped view');
            await this.renderTimestampedSegments(segments);
            
            // Show appropriate view based on current mode
            const transcriptionState = this.appState.getTranscriptionState();
            if (transcriptionState.viewMode === 'timestamped') {
                console.log('🎬 Showing timestamped view after rendering segments');
                this.showTimestampedView();
            } else {
                console.log('🎬 Showing plain text view after rendering segments');
                this.showPlainTextView();
            }
        } else {
            // If no segments, always default to plain text view
            console.log('🎬 No segments, defaulting to plain text view');
            this.appState.setTranscriptionState({ viewMode: 'plain' });
            this.showPlainTextView();
        }

        // Update toggle button state
        if (window.app && window.app.updateToggleButton) {
            window.app.updateToggleButton();
        }
    }

    /**
     * Render timestamped segments
     * @param {Array} segments - Array of segment objects with start, end, and text
     */
    async renderTimestampedSegments(segments) {
        console.log('🎬 Rendering timestamped segments:', segments);
        
        const container = UIHelpers.getElementById('transcription-segments');
        if (!container) {
            console.error('🎬 ERROR: transcription-segments container not found!');
            return;
        }
        
        console.log('🎬 Container found, clearing content');
        UIHelpers.setHTML(container, '');
        
        // Group segments into paragraphs based on pauses or content breaks
        console.log('🎬 Grouping segments into paragraphs...');
        const paragraphs = this.groupSegmentsIntoParagraphs(segments);
        console.log('🎬 Grouped into', paragraphs.length, 'paragraphs');
        
        paragraphs.forEach((paragraph, paragraphIndex) => {
            paragraph.forEach((segment, segmentIndex) => {
                const segmentDiv = document.createElement('div');
                segmentDiv.className = 'transcription-segment';
                segmentDiv.dataset.segmentId = segment.id || `${paragraphIndex}-${segmentIndex}`;
                
                // Check if this is a speaker block
                const text = segment.text.trim();
                const isSpeakerBlock = this.detectSpeakerChange(text);
                if (isSpeakerBlock) {
                    UIHelpers.addClass(segmentDiv, 'speaker-block');
                }
                
                // Create timestamp
                const timestampDiv = document.createElement('div');
                timestampDiv.className = 'segment-timestamp';
                const timestampText = segment.originalSegments 
                    ? `${this.formatTimestamp(segment.start)} - ${this.formatTimestamp(segment.end)} (${segment.originalSegments.length} parts)`
                    : this.formatTimestamp(segment.start);
                UIHelpers.setText(timestampDiv, timestampText);
                
                // Create text content
                const textDiv = document.createElement('div');
                textDiv.className = 'segment-text';
                UIHelpers.setText(textDiv, text);
                
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
        
        console.log('🎬 Rendered', segments.length, 'segments in', paragraphs.length, 'paragraphs');
    }

    /**
     * Show timestamped view
     */
    showTimestampedView() {
        const transcriptionText = UIHelpers.getElementById('transcription-text');
        const transcriptionSegments = UIHelpers.getElementById('transcription-segments');
        
        UIHelpers.hide(transcriptionText);
        UIHelpers.show(transcriptionSegments);
        
        console.log('🎬 Switched to timestamped view');
    }

    /**
     * Show plain text view
     */
    showPlainTextView() {
        const transcriptionText = UIHelpers.getElementById('transcription-text');
        const transcriptionSegments = UIHelpers.getElementById('transcription-segments');
        
        UIHelpers.show(transcriptionText);
        UIHelpers.hide(transcriptionSegments);
        
        console.log('🎬 Switched to plain text view');
    }

    /**
     * Validate uploaded file
     * @param {string} filePath - File path to validate
     * @returns {boolean} True if valid
     */
    validateFile(filePath) {
        if (!filePath) {
            this.statusController.showError('No file selected');
            return false;
        }

        if (!this.isValidFileExtension(filePath)) {
            const supportedFormats = [...SUPPORTED_FORMATS.AUDIO, ...SUPPORTED_FORMATS.VIDEO].join(', ');
            this.statusController.showError(`Unsupported file format. Supported formats: ${supportedFormats}`);
            return false;
        }

        return true;
    }

    /**
     * Check if file has valid extension
     * @param {string} filename - Filename to check
     * @returns {boolean} True if valid extension
     */
    isValidFileExtension(filename) {
        const validExtensions = [...SUPPORTED_FORMATS.AUDIO, ...SUPPORTED_FORMATS.VIDEO];
        return validExtensions.some(ext => filename.toLowerCase().endsWith(ext));
    }

    /**
     * Group segments into paragraphs based on pauses
     * @param {Array} segments - Segment array
     * @returns {Array} Array of paragraph arrays
     */
    groupSegmentsIntoParagraphs(segments) {
        if (!segments || segments.length === 0) return [];
        
        const paragraphs = [];
        let currentParagraph = [];
        
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            const nextSegment = segments[i + 1];
            
            currentParagraph.push(segment);
            
            // Check for paragraph break conditions
            const isLastSegment = !nextSegment;
            const hasLongPause = nextSegment && (nextSegment.start - segment.end) > 2.0; // 2 second pause
            const endsWithPunctuation = segment.text.trim().match(/[.!?]$/);
            const nextStartsCapital = nextSegment && nextSegment.text.trim().match(/^[A-Z]/);
            
            if (isLastSegment || (hasLongPause && endsWithPunctuation && nextStartsCapital)) {
                paragraphs.push(currentParagraph);
                currentParagraph = [];
            }
        }
        
        // Add any remaining segments
        if (currentParagraph.length > 0) {
            paragraphs.push(currentParagraph);
        }
        
        return paragraphs;
    }

    /**
     * Detect speaker change in text
     * @param {string} text - Text to analyze
     * @returns {boolean} True if appears to be speaker change
     */
    detectSpeakerChange(text) {
        // Various dash formats that might indicate speaker changes
        const speakerPatterns = [
            /^[-–—]\s*\w/,  // Dash followed by word
            /^\w+:\s/,       // Name followed by colon
            /^Speaker\s*\d*:?/i,  // Speaker label
            /^[A-Z][a-z]+:\s/     // Capitalized name with colon
        ];
        
        return speakerPatterns.some(pattern => pattern.test(text.trim()));
    }

    /**
     * Format timestamp from seconds to MM:SS format
     * @param {number} seconds - Seconds to format
     * @returns {string} Formatted timestamp
     */
    formatTimestamp(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Handle file upload state changes
     * @param {Object} data - State change data
     */
    handleFileUploadStateChange(data) {
        // Update UI based on file upload state changes
        if (data.isProcessing !== undefined) {
            const uploadArea = UIHelpers.getElementById('file-upload');
            if (data.isProcessing) {
                UIHelpers.addClass(uploadArea, 'processing');
            } else {
                UIHelpers.removeClass(uploadArea, 'processing');
            }
        }

        if (data.progress !== undefined) {
            // Update progress bar if available
            this.statusController.updateProgressBar('.progress-bar', data.progress);
        }
    }

    /**
     * Get current file upload state
     * @returns {Object} Current file upload state
     */
    getCurrentState() {
        return this.appState.getFileUploadState();
    }

    /**
     * Reset file upload state
     */
    reset() {
        this.appState.setFileUploadState({
            currentFile: null,
            isProcessing: false,
            progress: 0
        });

        // Reset UI
        const uploadArea = UIHelpers.getElementById('file-upload');
        UIHelpers.removeClass(uploadArea, CSS_CLASSES.DRAGOVER);
        UIHelpers.removeClass(uploadArea, 'processing');
    }

    /**
     * Destroy the controller and clean up
     */
    destroy() {
        this.reset();
        console.log('FileUploadController destroyed');
    }
}
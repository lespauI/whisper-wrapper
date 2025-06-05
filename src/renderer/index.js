// Main renderer process script
class WhisperWrapperApp {
    constructor() {
        this.currentTab = 'upload';
        this.isRecording = false;
        this.isPaused = false;
        this.recordingStartTime = null;
        this.recordingTimer = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.dataArray = null;
        this.animationId = null;
        this.recordingBlob = null;
        this.recordingSettings = {
            quality: 'medium',
            format: 'wav',
            autoTranscribe: true,
            autoSaveInterval: 60000, // Save chunks every 60 seconds (1 minute)
            enableAutoSave: true
        };
        
        // Auto-save recording state
        this.recordingAutoSave = {
            sessionId: null,
            chunkIndex: 0,
            savedChunks: [],
            autoSaveTimer: null,
            tempDirectory: null
        };
        
        // Transcription editing state
        this.transcriptionState = {
            originalText: '',
            currentText: '',
            isDirty: false,
            lastSaved: null,
            autoSaveTimer: null,
            history: [],
            historyIndex: -1,
            segments: [], // Store original segments with timestamps
            viewMode: 'timestamped' // 'timestamped' or 'plain'
        };
        

        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupTabNavigation();
        this.setupFileUpload();
        this.setupRecording();
        this.setupTranscription();
        this.setupSettings();
        this.loadSettings();
        this.checkForOrphanedRecordings();
        this.updateStatus('Ready');
        this.updateToggleButton(); // Initialize toggle button state
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Settings modal
        document.getElementById('settings-btn').addEventListener('click', () => {
            this.openSettings();
        });

        document.getElementById('cancel-settings-btn').addEventListener('click', () => {
            this.closeSettings();
        });

        document.getElementById('save-settings-btn').addEventListener('click', () => {
            this.saveSettings();
        });

        document.querySelector('.modal-close').addEventListener('click', () => {
            this.closeSettings();
        });

        // Setup Whisper button
        document.getElementById('setup-whisper-btn').addEventListener('click', () => {
            this.setupWhisper();
        });

        // Close modal on backdrop click
        document.getElementById('settings-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.closeSettings();
            }
        });

        // Model comparison modal
        document.getElementById('model-info-btn').addEventListener('click', () => {
            this.openModelComparison();
        });

        document.getElementById('close-model-comparison-btn').addEventListener('click', () => {
            this.closeModelComparison();
        });

        // Close model comparison modal on backdrop click
        document.getElementById('model-comparison-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.closeModelComparison();
            }
        });

        // Close model comparison modal on close button click
        document.querySelector('#model-comparison-modal .modal-close').addEventListener('click', () => {
            this.closeModelComparison();
        });

        // Model selection change handler
        document.getElementById('model-select').addEventListener('change', (e) => {
            this.updateModelDescription(e.target.value);
        });
        
        // Initial prompt checkbox handler
        document.getElementById('use-initial-prompt-checkbox').addEventListener('change', () => {
            this.updateInitialPromptState();
        });
    }

    setupTabNavigation() {
        // Initial tab setup is handled in init
    }

    setupFileUpload() {
        const uploadArea = document.getElementById('file-upload');
        const browseBtn = document.getElementById('browse-btn');

        // Click to browse
        browseBtn.addEventListener('click', () => {
            this.selectFile();
        });

        uploadArea.addEventListener('click', () => {
            this.selectFile();
        });

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                this.handleFileUpload(files[0].path);
            }
        });
    }

    setupRecording() {
        const startBtn = document.getElementById('start-record-btn');
        const pauseBtn = document.getElementById('pause-record-btn');
        const resumeBtn = document.getElementById('resume-record-btn');
        const stopBtn = document.getElementById('stop-record-btn');
        const saveBtn = document.getElementById('save-record-btn');
        const transcribeBtn = document.getElementById('transcribe-record-btn');
        const clearBtn = document.getElementById('clear-record-btn');

        // Recording controls
        startBtn.addEventListener('click', () => {
            this.startRecording();
        });

        pauseBtn.addEventListener('click', () => {
            this.pauseRecording();
        });

        resumeBtn.addEventListener('click', () => {
            this.resumeRecording();
        });

        stopBtn.addEventListener('click', () => {
            this.stopRecording();
        });

        saveBtn.addEventListener('click', () => {
            this.saveRecording();
        });

        transcribeBtn.addEventListener('click', () => {
            this.transcribeRecording();
        });

        clearBtn.addEventListener('click', () => {
            this.clearRecording();
        });

        // Recording settings
        document.getElementById('quality-select').addEventListener('change', (e) => {
            this.recordingSettings.quality = e.target.value;
        });

        document.getElementById('format-select').addEventListener('change', (e) => {
            this.recordingSettings.format = e.target.value;
        });

        document.getElementById('auto-transcribe').addEventListener('change', (e) => {
            this.recordingSettings.autoTranscribe = e.target.checked;
            // Update UI to show/hide transcribe button if recording is completed
            this.updateRecordingUI();
        });

        // Initialize canvas for visualization
        this.initializeVisualization();
    }

    setupTranscription() {
        const copyBtn = document.getElementById('copy-btn');
        const transcriptionText = document.getElementById('transcription-text');

        // Basic actions
        copyBtn.addEventListener('click', () => {
            this.copyTranscription();
        });

        // Enhanced export options
        this.setupExportDropdown();

        // Undo/Redo buttons
        document.getElementById('undo-btn').addEventListener('click', () => {
            this.undoTranscription();
        });

        document.getElementById('redo-btn').addEventListener('click', () => {
            this.redoTranscription();
        });



        // Clear draft
        document.getElementById('clear-draft-btn').addEventListener('click', () => {
            this.clearDraft();
        });

        // Toggle view mode
        document.getElementById('toggle-view-btn').addEventListener('click', () => {
            this.toggleViewMode();
        });



        // Auto-save functionality
        transcriptionText.addEventListener('input', (e) => {
            this.handleTranscriptionEdit(e.target.value);
        });

        // Keyboard shortcuts
        transcriptionText.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // Load any saved draft on startup
        this.loadTranscriptionDraft();

        // Save draft before page unload
        window.addEventListener('beforeunload', () => {
            this.saveTranscriptionDraft();
        });

        // Update UI state periodically
        setInterval(() => {
            this.updateTranscriptionStatus();
            this.updateUndoRedoButtons();
        }, 1000);
    }

    setupSettings() {
        // Settings are handled in the modal event listeners
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        this.currentTab = tabName;
    }

    async selectFile() {
        try {
            const result = await window.electronAPI.selectFile();
            
            if (!result.canceled) {
                this.handleFileUpload(result.filePath, result.fileInfo);
            }
        } catch (error) {
            console.error('Error selecting file:', error);
            this.showError('Failed to select file');
        }
    }

    async handleFileUpload(filePath, fileInfo = null) {
        try {
            this.updateStatus('Processing file...');
            this.showProgress(true);
            this.showTranscriptionLoading(true);
            
            // Set up progress listener
            window.electronAPI.onTranscriptionProgress((event, progress) => {
                this.updateTranscriptionProgress(progress);
            });

            // Start transcription
            const result = await window.electronAPI.transcribeFile(filePath);
            console.log('🎬 Transcription result from IPC:', result);
            
            if (result.success) {
                this.showTranscriptionResult(result.text, result.segments);
                this.updateStatus(`Transcription completed (Language: ${result.language || 'unknown'})`);
                this.switchTab('transcription');
            } else {
                throw new Error('Transcription failed');
            }
            
        } catch (error) {
            console.error('Error processing file:', error);
            this.showError(error.message || 'Failed to process file');
        } finally {
            // Always hide loading states and progress
            this.showProgress(false);
            this.showTranscriptionLoading(false);
            // Clean up progress listener
            window.electronAPI.removeAllListeners('transcription:progress');
        }
    }

    isValidFileExtension(filename) {
        const validExtensions = ['.mp3', '.wav', '.m4a', '.flac', '.ogg', '.mp4', '.mov', '.avi', '.mkv', '.webm'];
        return validExtensions.some(ext => filename.toLowerCase().endsWith(ext));
    }

    async simulateProgress() {
        const progressFill = document.querySelector('.progress-fill');
        const progressText = document.querySelector('.progress-text');
        
        for (let i = 0; i <= 100; i += 10) {
            progressFill.style.width = `${i}%`;
            
            if (i < 30) {
                progressText.textContent = 'Validating file...';
            } else if (i < 70) {
                progressText.textContent = 'Processing audio...';
            } else {
                progressText.textContent = 'Preparing for transcription...';
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    async startRecording() {
        try {
            // Get recording constraints based on quality setting
            const constraints = this.getRecordingConstraints();
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Set up audio context for visualization and level monitoring
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.8;
            this.microphone.connect(this.analyser);
            
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);
            
            // Set up MediaRecorder
            const mimeType = this.getMimeType();
            this.mediaRecorder = new MediaRecorder(stream, { mimeType });
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: mimeType });
                this.recordingBlob = audioBlob;
                this.handleRecordingComplete(audioBlob);
            };
            
            this.mediaRecorder.start(100); // Collect data every 100ms
            this.isRecording = true;
            this.isPaused = false;
            this.recordingStartTime = Date.now();
            
            // Initialize auto-save session
            await this.initializeAutoSaveSession();
            
            this.updateRecordingUI();
            this.startRecordingTimer();
            this.startVisualization();
            this.startAutoSaveTimer();
            this.updateStatus('Recording... (Auto-save enabled)');
            
        } catch (error) {
            console.error('Error starting recording:', error);
            this.showError('Failed to start recording. Please check microphone permissions.');
        }
    }

    pauseRecording() {
        if (this.mediaRecorder && this.isRecording && !this.isPaused) {
            this.mediaRecorder.pause();
            this.isPaused = true;
            this.updateRecordingUI();
            this.stopRecordingTimer();
            this.stopVisualization();
            this.updateStatus('Recording paused');
        }
    }

    resumeRecording() {
        if (this.mediaRecorder && this.isPaused) {
            this.mediaRecorder.resume();
            this.isPaused = false;
            this.updateRecordingUI();
            this.startRecordingTimer();
            this.startVisualization();
            this.updateStatus('Recording...');
        }
    }

    async stopRecording() {
        if (this.mediaRecorder) {
            // Save final chunk before stopping
            await this.saveCurrentRecordingChunk();
            
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            
            // Clean up audio context
            if (this.audioContext) {
                this.audioContext.close();
                this.audioContext = null;
            }
            
            this.isRecording = false;
            this.isPaused = false;
            this.stopAutoSaveTimer();
            this.updateRecordingUI();
            this.stopRecordingTimer();
            this.stopVisualization();
            this.updateStatus('Processing recording...');
        }
    }

    updateRecordingUI() {
        const indicator = document.getElementById('record-indicator');
        const statusText = document.getElementById('record-status-text');
        const startBtn = document.getElementById('start-record-btn');
        const pauseBtn = document.getElementById('pause-record-btn');
        const resumeBtn = document.getElementById('resume-record-btn');
        const stopBtn = document.getElementById('stop-record-btn');
        const saveBtn = document.getElementById('save-record-btn');
        const transcribeBtn = document.getElementById('transcribe-record-btn');
        const clearBtn = document.getElementById('clear-record-btn');

        if (this.isRecording && !this.isPaused) {
            // Currently recording
            indicator.classList.add('recording');
            indicator.classList.remove('paused');
            statusText.textContent = 'Recording...';
            startBtn.classList.add('hidden');
            pauseBtn.classList.remove('hidden');
            resumeBtn.classList.add('hidden');
            stopBtn.classList.remove('hidden');
            saveBtn.classList.add('hidden');
            transcribeBtn.classList.add('hidden');
            clearBtn.classList.add('hidden');
        } else if (this.isPaused) {
            // Recording paused
            indicator.classList.remove('recording');
            indicator.classList.add('paused');
            statusText.textContent = 'Paused';
            startBtn.classList.add('hidden');
            pauseBtn.classList.add('hidden');
            resumeBtn.classList.remove('hidden');
            stopBtn.classList.remove('hidden');
            saveBtn.classList.add('hidden');
            transcribeBtn.classList.add('hidden');
            clearBtn.classList.add('hidden');
        } else if (this.recordingBlob) {
            // Recording completed
            indicator.classList.remove('recording', 'paused');
            statusText.textContent = 'Recording ready';
            startBtn.classList.remove('hidden');
            pauseBtn.classList.add('hidden');
            resumeBtn.classList.add('hidden');
            stopBtn.classList.add('hidden');
            saveBtn.classList.remove('hidden');
            clearBtn.classList.remove('hidden');
            
            // Always show transcribe button when recording is available
            // Users can transcribe again with different settings or models
            transcribeBtn.classList.remove('hidden');
        } else {
            // Ready to record
            indicator.classList.remove('recording', 'paused');
            statusText.textContent = 'Ready to record';
            startBtn.classList.remove('hidden');
            pauseBtn.classList.add('hidden');
            resumeBtn.classList.add('hidden');
            stopBtn.classList.add('hidden');
            saveBtn.classList.add('hidden');
            transcribeBtn.classList.add('hidden');
            clearBtn.classList.add('hidden');
        }
    }

    startRecordingTimer() {
        this.recordingTimer = setInterval(() => {
            const elapsed = Date.now() - this.recordingStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            document.getElementById('record-time').textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            // Update estimated file size
            this.updateRecordingSize(elapsed);
        }, 1000);
    }

    stopRecordingTimer() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
    }

    async handleRecordingComplete(audioBlob) {
        try {
            // Combine all saved chunks with the final recording
            const finalAudioBlob = await this.combineRecordingChunks(audioBlob);
            this.recordingBlob = finalAudioBlob;
            
            // Show recording info
            this.showRecordingInfo(finalAudioBlob);
            
            // Update UI to show the recording buttons now that recordingBlob is set
            this.updateRecordingUI();
            
            // Auto-transcribe if enabled
            if (this.recordingSettings.autoTranscribe) {
                this.showTranscriptionLoading(true);
                this.updateStatus('Processing recording...');
                
                // Convert blob to array buffer
                const arrayBuffer = await finalAudioBlob.arrayBuffer();
                
                // Set up progress listener
                window.electronAPI.onTranscriptionProgress((event, progress) => {
                    this.updateTranscriptionProgress(progress);
                });

                // Start transcription
                const result = await window.electronAPI.transcribeAudio(arrayBuffer);
                console.log('🎬 Audio transcription result from IPC:', result);
                console.log('🎬 Result text:', result.text);
                console.log('🎬 Result segments:', result.segments);
                console.log('🎬 Result segments length:', result.segments?.length);
                
                if (result.success) {
                    console.log('🎬 Calling showTranscriptionResult with:', {
                        text: result.text,
                        segments: result.segments,
                        textLength: result.text?.length,
                        segmentsLength: result.segments?.length
                    });
                    this.showTranscriptionResult(result.text, result.segments);
                    this.updateStatus(`Recording transcribed (Language: ${result.language || 'unknown'})`);
                    this.switchTab('transcription');
                    
                    // Keep recording available for saving or re-transcribing
                    // User can come back to recording tab and use the buttons
                } else {
                    throw new Error('Transcription failed');
                }
            } else {
                this.updateStatus('Recording completed. Use the buttons below to save, transcribe, or clear the recording.');
            }
            
        } catch (error) {
            console.error('Error processing recording:', error);
            this.showError('Failed to process recording');
            this.showTranscriptionLoading(false);
        } finally {
            // Clean up progress listener
            if (window.electronAPI) {
                window.electronAPI.removeAllListeners('transcription:progress');
            }
        }
    }

    showTranscriptionResult(text, segments = null) {
        console.log('🎬 showTranscriptionResult called with:', { 
            textLength: text?.length, 
            segmentsCount: segments?.length,
            segments: segments 
        });
        
        const transcriptionText = document.getElementById('transcription-text');
        const transcriptionSegments = document.getElementById('transcription-segments');
        const emptyState = document.getElementById('transcription-empty');
        const loadingState = document.getElementById('transcription-loading');
        const editor = document.getElementById('transcription-editor');
        
        console.log('🎬 DOM elements found:', {
            transcriptionText: !!transcriptionText,
            transcriptionSegments: !!transcriptionSegments,
            emptyState: !!emptyState,
            loadingState: !!loadingState,
            editor: !!editor
        });
        
        // Hide loading and empty states, show editor
        emptyState.classList.add('hidden');
        loadingState.classList.add('hidden');
        editor.classList.remove('hidden');
        console.log('🎬 Hidden loading and empty states, shown editor');
        
        // Initialize transcription state
        this.transcriptionState.originalText = text;
        this.transcriptionState.currentText = text;
        this.transcriptionState.isDirty = false;
        this.transcriptionState.lastSaved = new Date();
        this.transcriptionState.history = [text];
        this.transcriptionState.historyIndex = 0;
        this.transcriptionState.segments = segments || [];
        console.log('🎬 Updated transcription state');
        
        // Set up both views
        transcriptionText.value = text;
        console.log('🎬 Set transcription text value:', text?.substring(0, 50) + '...');
        
        if (segments && segments.length > 0) {
            console.log('🎬 Has segments, rendering timestamped view');
            this.renderTimestampedSegments(segments);
            this.transcriptionState.viewMode = 'timestamped';
            this.showTimestampedView();
        } else {
            console.log('🎬 No segments, showing plain text view');
            // Fallback to plain text view if no segments
            this.transcriptionState.viewMode = 'plain';
            this.showPlainTextView();
        }
        
        // Update UI indicators
        this.updateTranscriptionStatus();
        this.updateToggleButton();
    }

    renderTimestampedSegments(segments) {
        console.log('🎬 Rendering timestamped segments:', segments);
        console.log('🎬 First segment example:', segments[0]);
        
        const container = document.getElementById('transcription-segments');
        if (!container) {
            console.error('🎬 ERROR: transcription-segments container not found!');
            return;
        }
        
        console.log('🎬 Container found, clearing content');
        container.innerHTML = '';
        
        // Group segments into paragraphs based on pauses or content breaks
        console.log('🎬 Grouping segments into paragraphs...');
        const paragraphs = this.groupSegmentsIntoParagraphs(segments);
        console.log('🎬 Grouped into', paragraphs.length, 'paragraphs');
        
        paragraphs.forEach((paragraph, paragraphIndex) => {
            paragraph.forEach((segment, segmentIndex) => {
                const segmentDiv = document.createElement('div');
                segmentDiv.className = 'transcription-segment';
                segmentDiv.dataset.segmentId = segment.id || `${paragraphIndex}-${segmentIndex}`;
                
                // Check if this is a speaker block (various dash formats)
                const text = segment.text.trim();
                const isSpeakerBlock = this.detectSpeakerChange(text);
                if (isSpeakerBlock) {
                    segmentDiv.classList.add('speaker-block');
                }
                
                // Create timestamp with duration info for merged blocks
                const timestampDiv = document.createElement('div');
                timestampDiv.className = 'segment-timestamp';
                const duration = segment.end - segment.start;
                const timestampText = segment.originalSegments 
                    ? `${this.formatTimestamp(segment.start)} - ${this.formatTimestamp(segment.end)} (${segment.originalSegments.length} parts)`
                    : this.formatTimestamp(segment.start);
                timestampDiv.textContent = timestampText;
                
                // Create text content
                const textDiv = document.createElement('div');
                textDiv.className = 'segment-text';
                textDiv.textContent = text;
                
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
        console.log('🎬 Container innerHTML length:', container.innerHTML.length);
        console.log('🎬 Container children count:', container.children.length);
        
        // Debug container dimensions
        setTimeout(() => {
            const containerHeight = container.offsetHeight;
            const containerScrollHeight = container.scrollHeight;
            const containerClientHeight = container.clientHeight;
            console.log('🎬 Container dimensions:', {
                offsetHeight: containerHeight,
                scrollHeight: containerScrollHeight,
                clientHeight: containerClientHeight,
                hasScroll: containerScrollHeight > containerClientHeight,
                isVisible: !container.classList.contains('hidden'),
                innerHTML: container.innerHTML.substring(0, 200) + '...'
            });
        }, 100);
    }
    
    groupSegmentsIntoParagraphs(segments) {
        if (!segments || segments.length === 0) return [];
        
        console.log('🎭 Grouping segments by speaker...');
        
        // First, split segments that contain multiple speakers
        const expandedSegments = this.splitMultiSpeakerSegments(segments);
        console.log(`🎭 Expanded ${segments.length} segments into ${expandedSegments.length} segments after splitting multi-speaker segments`);
        
        const speakerBlocks = [];
        let currentBlock = [];
        
        for (let i = 0; i < expandedSegments.length; i++) {
            const segment = expandedSegments[i];
            const text = segment.text.trim();
            
            // Check if this segment indicates a new speaker (various dash formats)
            const isNewSpeaker = this.detectSpeakerChange(text);
            
            if (isNewSpeaker && currentBlock.length > 0) {
                // We hit a new speaker, so finish the current block
                const mergedBlock = this.mergeSegmentsIntoBlock(currentBlock);
                speakerBlocks.push([mergedBlock]);
                console.log(`🎭 Completed speaker block: ${mergedBlock.start}s-${mergedBlock.end}s (${currentBlock.length} segments)`);
                currentBlock = [];
            }
            
            // Add current segment to the block
            currentBlock.push(segment);
            
            // If this is the last segment, finish the current block
            if (i === expandedSegments.length - 1 && currentBlock.length > 0) {
                const mergedBlock = this.mergeSegmentsIntoBlock(currentBlock);
                speakerBlocks.push([mergedBlock]);
                console.log(`🎭 Completed final speaker block: ${mergedBlock.start}s-${mergedBlock.end}s (${currentBlock.length} segments)`);
            }
        }
        
        console.log(`🎭 Created ${speakerBlocks.length} speaker blocks from ${expandedSegments.length} expanded segments`);
        return speakerBlocks;
    }

    /**
     * Split segments that contain multiple speakers within the same segment
     */
    splitMultiSpeakerSegments(segments) {
        const expandedSegments = [];
        
        for (const segment of segments) {
            const text = segment.text.trim();
            
            // Find all speaker indicators within the text
            const speakerSplits = this.findSpeakerSplitsInText(text);
            
            if (speakerSplits.length <= 1) {
                // No splits needed, keep original segment
                expandedSegments.push(segment);
            } else {
                // Split the segment into multiple parts
                console.log(`🎭 Splitting segment with ${speakerSplits.length} speakers: "${text.substring(0, 50)}..."`);
                
                const duration = segment.end - segment.start;
                const segmentDuration = duration / speakerSplits.length;
                
                speakerSplits.forEach((splitText, index) => {
                    const startTime = segment.start + (index * segmentDuration);
                    const endTime = segment.start + ((index + 1) * segmentDuration);
                    
                    const newSegment = {
                        start: startTime,
                        end: endTime,
                        text: splitText.trim(),
                        id: segment.id ? `${segment.id}-split-${index}` : `split-${index}`,
                        originalSegment: segment // Keep reference to original
                    };
                    
                    expandedSegments.push(newSegment);
                    console.log(`🎭   Split ${index + 1}: ${startTime.toFixed(2)}s-${endTime.toFixed(2)}s "${splitText.trim().substring(0, 30)}..."`);
                });
            }
        }
        
        return expandedSegments;
    }

    /**
     * Find speaker splits within a text segment
     */
    findSpeakerSplitsInText(text) {
        if (!text || typeof text !== 'string') {
            return [text];
        }
        
        // Pattern to match speaker indicators (em dash, en dash, regular dash, double angle brackets)
        const speakerPattern = /(?:^|\s)(—|–|-|>>)\s*/g;
        
        const splits = [];
        let lastIndex = 0;
        let match;
        
        // Find all speaker indicators
        while ((match = speakerPattern.exec(text)) !== null) {
            const matchStart = match.index;
            const matchEnd = speakerPattern.lastIndex;
            
            // If this isn't the first match, add the previous text as a split
            if (matchStart > lastIndex) {
                const previousText = text.substring(lastIndex, matchStart).trim();
                if (previousText) {
                    splits.push(previousText);
                }
            }
            
            // Start the next split from this speaker indicator
            lastIndex = matchStart;
        }
        
        // Add the remaining text as the final split
        if (lastIndex < text.length) {
            const remainingText = text.substring(lastIndex).trim();
            if (remainingText) {
                splits.push(remainingText);
            }
        }
        
        // If no splits were found, return the original text
        if (splits.length === 0) {
            return [text];
        }
        
        return splits;
    }

    /**
     * Merge multiple segments into a single block with combined text and span timestamps
     */
    mergeSegmentsIntoBlock(segments) {
        if (!segments || segments.length === 0) {
            return { start: 0, end: 0, text: '' };
        }
           if (segments.length === 1) {
            return segments[0];
        }
        
        // Combine all text, preserving spaces
        const combinedText = segments
            .map(segment => segment.text.trim())
            .join(' ')
            .replace(/\s+/g, ' ') // Normalize multiple spaces
     
            .trim();
        
        // Use start time of first segment and end time of last segment
        const startTime = segments[0].start;
        const endTime = segments[segments.length - 1].end;
        
        console.log(`🎭 Merged ${segments.length} segments: ${startTime}s-${endTime}s "${combinedText.substring(0, 50)}..."`);
        
        return {
            start: startTime,
            end: endTime,
            text: combinedText,
            originalSegments: segments // Keep reference to original segments for debugging
        };
    }

    /**
     * Detect if text indicates a speaker change (various dash formats)
     */
    detectSpeakerChange(text) {
        if (!text || typeof text !== 'string') {
            return false;
        }
        
        // Normalize the text by trimming whitespace
        const normalizedText = text.trim();
        
        // Check for various speaker indicators:
        // "-", "- ", " -", " - ", "—", "— ", " —", " — ", ">>", ">> ", " >>", " >> ", etc.
        const speakerPatterns = [
            /^-\s*/, // Starts with regular dash, optionally followed by spaces
            /^\s*-\s*/, // Starts with optional spaces, regular dash, optional spaces
            /^—\s*/, // Starts with em dash, optionally followed by spaces
            /^\s*—\s*/, // Starts with optional spaces, em dash, optional spaces
            /^–\s*/, // Starts with en dash, optionally followed by spaces
            /^\s*–\s*/, // Starts with optional spaces, en dash, optional spaces
            /^>>\s*/, // Starts with double angle brackets, optionally followed by spaces
            /^\s*>>\s*/, // Starts with optional spaces, double angle brackets, optional spaces
        ];
        
        const isNewSpeaker = speakerPatterns.some(pattern => pattern.test(normalizedText));
        
        if (isNewSpeaker) {
            console.log(`🎭 Detected speaker change in: "${normalizedText.substring(0, 30)}..."`);
        }
        
        return isNewSpeaker;
    }
    
    formatTimestamp(seconds) {
        // Handle invalid or missing values
        if (seconds === null || seconds === undefined || isNaN(seconds) || seconds < 0) {
            console.warn('Invalid timestamp value:', seconds);
            return '00:00.00';
        }
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        const milliseconds = Math.floor((seconds % 1) * 100);
        
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
    }
    
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
    
    showTimestampedView() {
        console.log('🎬 showTimestampedView called');
        const transcriptionText = document.getElementById('transcription-text');
        const transcriptionSegments = document.getElementById('transcription-segments');
        
        console.log('🎬 showTimestampedView elements:', {
            transcriptionText: !!transcriptionText,
            transcriptionSegments: !!transcriptionSegments,
            segmentsContent: transcriptionSegments?.innerHTML?.length
        });
        
        transcriptionText.classList.add('hidden');
        transcriptionSegments.classList.remove('hidden');
        console.log('🎬 Switched to timestamped view');
    }
    
    showPlainTextView() {
        console.log('🎬 showPlainTextView called');
        const transcriptionText = document.getElementById('transcription-text');
        const transcriptionSegments = document.getElementById('transcription-segments');
        
        console.log('🎬 showPlainTextView elements:', {
            transcriptionText: !!transcriptionText,
            transcriptionSegments: !!transcriptionSegments,
            textValue: transcriptionText?.value?.length,
            stateText: this.transcriptionState?.currentText?.length
        });
        
        // Ensure the textarea has the current text from the transcription state
        if (transcriptionText && this.transcriptionState.currentText) {
            transcriptionText.value = this.transcriptionState.currentText;
            console.log('🎬 Synced textarea with current text:', this.transcriptionState.currentText.substring(0, 50) + '...');
        }
        
        transcriptionSegments.classList.add('hidden');
        transcriptionText.classList.remove('hidden');
        console.log('🎬 Switched to plain text view');
    }
    
    updateToggleButton() {
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
    }

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
    }

    async downloadTranscription() {
        const transcriptionText = document.getElementById('transcription-text');
        
        if (transcriptionText.value) {
            try {
                const filename = `transcription-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
                const result = await window.electronAPI.saveFile(transcriptionText.value, filename);
                
                if (!result.canceled) {
                    this.updateStatus('Transcription saved successfully');
                    // Mark as saved
                    this.transcriptionState.isDirty = false;
                    this.transcriptionState.lastSaved = new Date();
                    this.updateTranscriptionStatus();
                }
            } catch (error) {
                console.error('Error saving transcription:', error);
                this.showError('Failed to save transcription');
            }
        }
    }

    // Auto-save and editing functionality
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
            
            // Update status
            this.updateTranscriptionStatus();
            
            // Schedule auto-save
            this.scheduleAutoSave();
        }
    }

    scheduleAutoSave() {
        // Clear existing timer
        if (this.transcriptionState.autoSaveTimer) {
            clearTimeout(this.transcriptionState.autoSaveTimer);
        }
        
        // Schedule new auto-save in 2 seconds
        this.transcriptionState.autoSaveTimer = setTimeout(() => {
            this.saveTranscriptionDraft();
        }, 2000);
    }

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

    loadTranscriptionDraft() {
        try {
            const draftData = localStorage.getItem('whisper-transcription-draft');
            if (draftData) {
                const draft = JSON.parse(draftData);
                const transcriptionText = document.getElementById('transcription-text');
                
                // Only load if there's no current transcription
                if (!transcriptionText.value && draft.text) {
                    transcriptionText.value = draft.text;
                    this.transcriptionState.currentText = draft.text;
                    this.transcriptionState.originalText = draft.originalText || '';
                    this.transcriptionState.isDirty = true;
                    this.transcriptionState.lastSaved = new Date(draft.timestamp);
                    
                    this.updateTranscriptionStatus();
                    this.updateStatus('Draft loaded from previous session');
                    
                    // Show transcription tab content
                    const emptyState = document.getElementById('transcription-empty');
                    emptyState.classList.add('hidden');
                }
            }
        } catch (error) {
            console.error('Failed to load draft:', error);
        }
    }

    clearTranscriptionDraft() {
        localStorage.removeItem('whisper-transcription-draft');
        this.transcriptionState.isDirty = false;
        this.updateTranscriptionStatus();
    }

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
        

        
        // Ctrl/Cmd + A for select all
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            // Let default behavior happen
        }
    }

    undoTranscription() {
        if (this.transcriptionState.historyIndex > 0) {
            this.transcriptionState.historyIndex--;
            const previousText = this.transcriptionState.history[this.transcriptionState.historyIndex];
            
            const transcriptionText = document.getElementById('transcription-text');
            transcriptionText.value = previousText;
            this.transcriptionState.currentText = previousText;
            this.transcriptionState.isDirty = previousText !== this.transcriptionState.originalText;
            
            this.updateTranscriptionStatus();
            this.scheduleAutoSave();
        }
    }

    redoTranscription() {
        if (this.transcriptionState.historyIndex < this.transcriptionState.history.length - 1) {
            this.transcriptionState.historyIndex++;
            const nextText = this.transcriptionState.history[this.transcriptionState.historyIndex];
            
            const transcriptionText = document.getElementById('transcription-text');
            transcriptionText.value = nextText;
            this.transcriptionState.currentText = nextText;
            this.transcriptionState.isDirty = nextText !== this.transcriptionState.originalText;
            
            this.updateTranscriptionStatus();
            this.scheduleAutoSave();
        }
    }

    getWordCount(text) {
        if (!text) return 0;
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    getCharacterCount(text) {
        return text ? text.length : 0;
    }

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
        const statusElement = document.getElementById('transcription-status');
        if (statusElement) {
            statusElement.textContent = statusText;
        }
    }

    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        
        if (undoBtn) {
            undoBtn.disabled = this.transcriptionState.historyIndex <= 0;
        }
        
        if (redoBtn) {
            redoBtn.disabled = this.transcriptionState.historyIndex >= this.transcriptionState.history.length - 1;
        }
    }

    // Export dropdown functionality
    setupExportDropdown() {
        const dropdownBtn = document.getElementById('export-dropdown-btn');
        const dropdownMenu = document.getElementById('export-dropdown');
        
        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle('hidden');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            dropdownMenu.classList.add('hidden');
        });
        
        // Export handlers
        document.getElementById('export-txt-btn').addEventListener('click', () => {
            this.exportAs('txt');
            dropdownMenu.classList.add('hidden');
        });
        
        document.getElementById('export-md-btn').addEventListener('click', () => {
            this.exportAs('md');
            dropdownMenu.classList.add('hidden');
        });
        
        document.getElementById('export-json-btn').addEventListener('click', () => {
            this.exportAs('json');
            dropdownMenu.classList.add('hidden');
        });
    }

    async exportAs(format) {
        const transcriptionText = document.getElementById('transcription-text');
        
        if (!transcriptionText.value) {
            this.showError('No transcription to export');
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
                this.updateStatus(`Transcription exported as ${format.toUpperCase()}`);
                // Mark as saved if it's the current content
                if (format === 'txt') {
                    this.transcriptionState.isDirty = false;
                    this.transcriptionState.lastSaved = new Date();
                    this.updateTranscriptionStatus();
                }
            }
        } catch (error) {
            console.error('Error exporting transcription:', error);
            this.showError(`Failed to export as ${format.toUpperCase()}`);
        }
    }

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



    clearDraft() {
        if (confirm('Are you sure you want to clear the current transcription? This action cannot be undone.')) {
            const transcriptionText = document.getElementById('transcription-text');
            const transcriptionSegments = document.getElementById('transcription-segments');
            
            // Clear both text and segments
            transcriptionText.value = '';
            transcriptionSegments.innerHTML = '';
            
            // Reset state
            this.transcriptionState = {
                originalText: '',
                currentText: '',
                isDirty: false,
                lastSaved: null,
                autoSaveTimer: null,
                history: [''],
                historyIndex: 0,
                viewMode: this.transcriptionState.viewMode || 'plain' // Preserve view mode
            };
            
            // Clear stored segments
            this.currentSegments = [];
            
            this.clearTranscriptionDraft();
            this.updateTranscriptionStatus();
            this.updateUndoRedoButtons();
            
            // Show empty state and hide both views
            const emptyState = document.getElementById('transcription-empty');
            emptyState.classList.remove('hidden');
            transcriptionText.classList.add('hidden');
            transcriptionSegments.classList.add('hidden');
            
            console.log('🧹 Cleared transcription in both plain text and timestamped views');
            
            this.updateStatus('Transcription cleared');
        }
    }

    async openSettings() {
        document.getElementById('settings-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        
        // Ensure model options are populated
        await this.updateModelOptions();
        
        await this.checkWhisperStatus();
        await this.loadSettings();
    }

    closeSettings() {
        document.getElementById('settings-modal').classList.add('hidden');
        document.body.style.overflow = 'auto';
    }

    async saveSettings() {
        try {
            const model = document.getElementById('model-select').value;
            const language = document.getElementById('language-select').value;
            const threads = parseInt(document.getElementById('threads-select').value);
            const translate = document.getElementById('translate-checkbox').checked;
            const useInitialPrompt = document.getElementById('use-initial-prompt-checkbox').checked;
            const initialPrompt = document.getElementById('initial-prompt').value;
            
            const settings = {
                model,
                language,
                threads,
                translate,
                useInitialPrompt,
                initialPrompt
            };
            
            console.log('Saving settings:', settings);
            
            // Save settings via IPC
            const result = await window.electronAPI.setConfig(settings);
            
            // Check if model needs to be downloaded
            if (result.needsDownload) {
                const shouldDownload = await this.showModelDownloadDialog(result.modelName);
                if (shouldDownload) {
                    await this.downloadModel(result.modelName);
                    // Try saving settings again after download
                    const retryResult = await window.electronAPI.setConfig(settings);
                    if (!retryResult.success) {
                        throw new Error('Failed to save configuration after model download');
                    }
                } else {
                    // User cancelled download, don't save settings
                    return;
                }
            }
            
            this.closeSettings();
            this.updateStatus('Settings saved');
            
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showError(error.message || 'Failed to save settings');
        }
    }

    async loadSettings() {
        try {
            const settings = await window.electronAPI.getConfig();
            console.log('Loaded settings:', settings);
            
            if (settings.model) {
                document.getElementById('model-select').value = settings.model;
                this.updateModelDescription(settings.model);
            }
            if (settings.language) {
                document.getElementById('language-select').value = settings.language;
            }
            if (settings.threads) {
                document.getElementById('threads-select').value = settings.threads.toString();
            }
            if (settings.translate !== undefined) {
                document.getElementById('translate-checkbox').checked = settings.translate;
            }
            if (settings.useInitialPrompt !== undefined) {
                document.getElementById('use-initial-prompt-checkbox').checked = settings.useInitialPrompt;
            }
            if (settings.initialPrompt !== undefined) {
                document.getElementById('initial-prompt').value = settings.initialPrompt;
            }
            
            // Update initial prompt textarea state based on checkbox
            this.updateInitialPromptState();
            
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }
    
    updateInitialPromptState() {
        const useInitialPrompt = document.getElementById('use-initial-prompt-checkbox').checked;
        const initialPromptTextarea = document.getElementById('initial-prompt');
        
        initialPromptTextarea.disabled = !useInitialPrompt;
        initialPromptTextarea.style.opacity = useInitialPrompt ? '1' : '0.5';
    }

    openModelComparison() {
        document.getElementById('model-comparison-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        
        // Add click handlers for model rows
        document.querySelectorAll('.model-row[data-model]').forEach(row => {
            row.addEventListener('click', (e) => {
                const modelName = e.currentTarget.dataset.model;
                this.selectModelFromComparison(modelName);
            });
        });
    }

    closeModelComparison() {
        document.getElementById('model-comparison-modal').classList.add('hidden');
        document.body.style.overflow = 'auto';
    }

    selectModelFromComparison(modelName) {
        // Set the model in the settings dropdown
        const modelSelect = document.getElementById('model-select');
        if (modelSelect) {
            modelSelect.value = modelName;
            this.updateModelDescription(modelName);
        }
        
        // Close the comparison modal
        this.closeModelComparison();
        
        // Show a confirmation message
        this.updateStatus(`Selected model: ${modelName}`);
    }

    updateModelDescription(modelName) {
        const descriptions = {
            'tiny': 'Fastest model with basic accuracy. Best for quick transcription on low-resource devices.',
            'tiny.en': 'Fastest English-only model with improved accuracy over multilingual tiny. Ideal for English content.',
            'base': 'Good balance of speed and accuracy. Recommended for most general use cases.',
            'base.en': 'English-only base model with better accuracy than multilingual base for English content.',
            'small': 'Higher accuracy with moderate speed. Good for professional transcription needs.',
            'small.en': 'English-only small model with enhanced accuracy for English content.',
            'medium': 'High accuracy model suitable for professional and production use.',
            'medium.en': 'English-only medium model with excellent accuracy for English content.',
            'large': 'Highest accuracy model. Best for research, production, and critical applications.',
            'turbo': 'Optimized large model with 8x faster processing and minimal accuracy loss. Best overall choice for most users.'
        };

        const descriptionElement = document.getElementById('model-description');
        if (descriptionElement && descriptions[modelName]) {
            descriptionElement.textContent = descriptions[modelName];
        }
    }

    showProgress(show) {
        const uploadArea = document.getElementById('file-upload');
        const progressArea = document.getElementById('upload-progress');
        
        if (show) {
            uploadArea.classList.add('hidden');
            progressArea.classList.remove('hidden');
        } else {
            uploadArea.classList.remove('hidden');
            progressArea.classList.add('hidden');
        }
    }

    updateStatus(message) {
        document.getElementById('status-text').textContent = message;
    }

    showError(message) {
        this.updateStatus(`Error: ${message}`);
        console.error(message);
    }

    showTranscriptionLoading(show) {
        const loadingState = document.getElementById('transcription-loading');
        const emptyState = document.getElementById('transcription-empty');
        const editor = document.getElementById('transcription-editor');
        
        if (show) {
            loadingState.classList.remove('hidden');
            emptyState.classList.add('hidden');
            editor.classList.add('hidden');
        } else {
            loadingState.classList.add('hidden');
            editor.classList.remove('hidden');
        }
    }

    updateTranscriptionProgress(progress) {
        const progressText = document.querySelector('.progress-text');
        const loadingText = document.querySelector('#transcription-loading p');
        
        if (progress.status === 'processing') {
            if (progressText) {
                progressText.textContent = progress.message;
            }
            if (loadingText) {
                loadingText.textContent = progress.message;
            }
        } else if (progress.status === 'error') {
            this.showError(progress.message);
        }
    }

    // Enhanced Recording Methods

    getRecordingConstraints() {
        const constraints = { audio: true };
        
        switch (this.recordingSettings.quality) {
        case 'medium':
            constraints.audio = {
                sampleRate: { ideal: 22050 },
                channelCount: { ideal: 1 },
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            };
            break;
        case 'low':
            constraints.audio = {
                sampleRate: { ideal: 16000 },
                channelCount: { ideal: 1 },
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            };
            break;
        default:
            // Fallback to basic audio constraints
            constraints.audio = true;
            break;
        }
        
        return constraints;
    }

    getMimeType() {
        const format = this.recordingSettings.format;
        
        if (format === 'webm' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            return 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/wav')) {
            return 'audio/wav';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            return 'audio/mp4';
        } else {
            return 'audio/webm';
        }
    }

    initializeVisualization() {
        const canvas = document.getElementById('audio-visualizer');
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.fillStyle = '#f7fafc';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw placeholder text
        ctx.fillStyle = '#a0aec0';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Audio visualization will appear here during recording', canvas.width / 2, canvas.height / 2);
    }

    startVisualization() {
        if (!this.analyser) return;
        
        const canvas = document.getElementById('audio-visualizer');
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        const draw = () => {
            if (!this.isRecording || this.isPaused) return;
            
            this.animationId = requestAnimationFrame(draw);
            
            this.analyser.getByteFrequencyData(this.dataArray);
            
            // Clear canvas
            ctx.fillStyle = '#f7fafc';
            ctx.fillRect(0, 0, width, height);
            
            // Draw frequency bars
            const barWidth = width / this.dataArray.length * 2.5;
            let barHeight;
            let x = 0;
            
            for (let i = 0; i < this.dataArray.length; i++) {
                barHeight = (this.dataArray[i] / 255) * height * 0.8;
                
                const hue = (i / this.dataArray.length) * 360;
                ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
                
                ctx.fillRect(x, height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }
            
            // Update audio level meter
            this.updateAudioLevel();
        };
        
        draw();
    }

    stopVisualization() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Reset visualization
        this.initializeVisualization();
        
        // Reset audio level
        document.getElementById('audio-level-bar').style.width = '0%';
        document.getElementById('audio-level-text').textContent = '0%';
    }

    updateAudioLevel() {
        if (!this.analyser) return;
        
        this.analyser.getByteFrequencyData(this.dataArray);
        
        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i];
        }
        const average = sum / this.dataArray.length;
        const percentage = Math.round((average / 255) * 100);
        
        // Update UI
        document.getElementById('audio-level-bar').style.width = `${percentage}%`;
        document.getElementById('audio-level-text').textContent = `${percentage}%`;
    }

    updateRecordingSize(elapsed) {
        // Estimate file size based on quality settings and elapsed time
        let bytesPerSecond;
        
        switch (this.recordingSettings.quality) {
        case 'high':
            bytesPerSecond = 176400; // 44.1kHz * 2 channels * 2 bytes
            break;
        case 'medium':
            bytesPerSecond = 44100; // 22kHz * 1 channel * 2 bytes
            break;
        case 'low':
            bytesPerSecond = 32000; // 16kHz * 1 channel * 2 bytes
            break;
        default:
            bytesPerSecond = 44100;
        }
        
        const estimatedBytes = (elapsed / 1000) * bytesPerSecond;
        const sizeText = this.formatFileSize(estimatedBytes);
        
        document.getElementById('record-size').textContent = sizeText;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 KB';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    showRecordingInfo(audioBlob) {
        const duration = Date.now() - this.recordingStartTime;
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        const durationText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        const sizeText = this.formatFileSize(audioBlob.size);
        const qualityText = this.recordingSettings.quality.charAt(0).toUpperCase() + this.recordingSettings.quality.slice(1);
        
        document.getElementById('final-duration').textContent = durationText;
        document.getElementById('final-size').textContent = sizeText;
        document.getElementById('final-quality').textContent = qualityText;
        document.getElementById('recording-info').classList.remove('hidden');
    }

    async saveRecording() {
        if (!this.recordingBlob) {
            this.showError('No recording to save');
            return;
        }
        
        try {
            // Convert blob to array buffer
            const arrayBuffer = await this.recordingBlob.arrayBuffer();
            
            // Create filename with timestamp
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const extension = this.recordingSettings.format === 'webm' ? 'webm' : 'wav';
            const filename = `recording-${timestamp}.${extension}`;
            
            // Save file using Electron API
            const result = await window.electronAPI.saveFile(arrayBuffer, filename);
            
            if (!result.canceled) {
                this.updateStatus('Recording saved successfully');
            }
        } catch (error) {
            console.error('Error saving recording:', error);
            this.showError('Failed to save recording');
        }
    }

    async transcribeRecording() {
        if (!this.recordingBlob) {
            this.showError('No recording to transcribe');
            return;
        }
        
        try {
            this.showTranscriptionLoading(true);
            this.updateStatus('Processing recording...');
            
            // Convert blob to array buffer
            const arrayBuffer = await this.recordingBlob.arrayBuffer();
            
            // Set up progress listener
            window.electronAPI.onTranscriptionProgress((event, progress) => {
                this.updateTranscriptionProgress(progress);
            });

            // Start transcription
            const result = await window.electronAPI.transcribeAudio(arrayBuffer);
            console.log('🎬 Manual transcription result from IPC:', result);
            
            if (result.success) {
                this.showTranscriptionResult(result.text, result.segments);
                this.updateStatus(`Recording transcribed (Language: ${result.language || 'unknown'})`);
                this.switchTab('transcription');
            } else {
                throw new Error('Transcription failed');
            }
            
        } catch (error) {
            console.error('Error transcribing recording:', error);
            this.showError('Failed to transcribe recording');
            this.showTranscriptionLoading(false);
        } finally {
            // Clean up progress listener
            if (window.electronAPI) {
                window.electronAPI.removeAllListeners('transcription:progress');
            }
        }
    }

    clearRecording() {
        if (!this.recordingBlob) {
            return;
        }
        
        // Ask for confirmation
        if (confirm('Are you sure you want to clear the recording? This action cannot be undone.')) {
            // Clear recording state
            this.recordingBlob = null;
            this.updateRecordingUI();
            document.getElementById('recording-info').classList.add('hidden');
            document.getElementById('record-time').textContent = '00:00';
            document.getElementById('record-size').textContent = '0 KB';
            this.updateStatus('Recording cleared');
        }
    }

    // Local Whisper Methods

    async checkWhisperStatus() {
        try {
            const statusElement = document.getElementById('whisper-status');
            const statusText = document.getElementById('whisper-status-text');
            const setupButton = document.getElementById('setup-whisper-btn');
            
            statusText.textContent = 'Checking...';
            statusElement.className = 'status-indicator';
            setupButton.style.display = 'none';
            
            // Test local Whisper installation
            const testResult = await window.electronAPI.testWhisper();
            
            if (testResult.success) {
                statusText.textContent = 'Local Whisper is ready';
                statusElement.className = 'status-indicator success';
                
                // Update model options with available models
                this.updateModelOptions(testResult.details.availableModels);
            } else {
                statusText.textContent = testResult.message || 'Local Whisper not available';
                statusElement.className = 'status-indicator error';
                setupButton.style.display = 'inline-block';
            }
            
        } catch (error) {
            console.error('Error checking Whisper status:', error);
            const statusElement = document.getElementById('whisper-status');
            const statusText = document.getElementById('whisper-status-text');
            const setupButton = document.getElementById('setup-whisper-btn');
            
            statusText.textContent = 'Error checking Whisper status';
            statusElement.className = 'status-indicator error';
            setupButton.style.display = 'inline-block';
        }
    }

    async updateModelOptions(availableModels) {
        const modelSelect = document.getElementById('model-select');
        
        // Clear existing options
        modelSelect.innerHTML = '';
        
        // Always use the full list of models from configuration, not just the ones physically present
        let modelsToUse;
        try {
            const config = await window.electronAPI.getConfig();
            modelsToUse = config.whisper?.availableModels || this.getDefaultModels();
        } catch (error) {
            console.warn('Could not load models from config, using defaults:', error);
            modelsToUse = this.getDefaultModels();
        }
        
        // Create a set of available model names for marking which ones are downloaded
        const downloadedModels = new Set();
        if (availableModels && Array.isArray(availableModels)) {
            availableModels.forEach(model => {
                downloadedModels.add(model.name);
            });
        }
        
        modelsToUse.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            
            // Create display text based on model data
            let displayText;
            if (model.display) {
                displayText = model.display;
            } else {
                const displayName = model.name.includes('.en') 
                    ? `${model.name.replace('.en', '')} English-only`.replace(/^\w/, c => c.toUpperCase())
                    : model.name.charAt(0).toUpperCase() + model.name.slice(1);
                displayText = `${displayName} (${model.size}, ${model.vram}, ${model.speed} speed)`;
            }
            
            // Add download status indicator
            const isDownloaded = downloadedModels.has(model.name);
            if (isDownloaded) {
                option.textContent = `✓ ${displayText}`;
                option.style.color = '#22c55e'; // Green color for downloaded models
            } else {
                option.textContent = `⬇ ${displayText}`;
                option.style.color = '#6b7280'; // Gray color for not downloaded models
                option.disabled = true; // Disable models that aren't downloaded
            }
            
            modelSelect.appendChild(option);
        });
    }

    getDefaultModels() {
        return [
            { name: 'tiny', size: '39M params', vram: '~1GB', speed: '~10x', type: 'multilingual' },
            { name: 'tiny.en', size: '39M params', vram: '~1GB', speed: '~10x', type: 'english-only' },
            { name: 'base', size: '74M params', vram: '~1GB', speed: '~7x', type: 'multilingual' },
            { name: 'base.en', size: '74M params', vram: '~1GB', speed: '~7x', type: 'english-only' },
            { name: 'small', size: '244M params', vram: '~2GB', speed: '~4x', type: 'multilingual' },
            { name: 'small.en', size: '244M params', vram: '~2GB', speed: '~4x', type: 'english-only' },
            { name: 'medium', size: '769M params', vram: '~5GB', speed: '~2x', type: 'multilingual' },
            { name: 'medium.en', size: '769M params', vram: '~5GB', speed: '~2x', type: 'english-only' },
            { name: 'large', size: '1550M params', vram: '~10GB', speed: '1x', type: 'multilingual' },
            { name: 'turbo', size: '809M params', vram: '~6GB', speed: '~8x', type: 'multilingual' }
        ];
    }

    async showModelDownloadDialog(modelName) {
        return new Promise((resolve) => {
            // Create modal dialog
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Download Model</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>The model <strong>${modelName}</strong> is not downloaded yet.</p>
                        <p>Would you like to download it now?</p>
                        <div class="model-info">
                            <small>This will download the model file from Hugging Face.</small>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary cancel-btn">Cancel</button>
                        <button class="btn btn-primary download-btn">Download</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            document.body.style.overflow = 'hidden';

            // Event handlers
            const closeModal = (result) => {
                document.body.removeChild(modal);
                document.body.style.overflow = 'auto';
                resolve(result);
            };

            modal.querySelector('.modal-close').addEventListener('click', () => closeModal(false));
            modal.querySelector('.cancel-btn').addEventListener('click', () => closeModal(false));
            modal.querySelector('.download-btn').addEventListener('click', () => closeModal(true));

            // Close on overlay click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal(false);
            });
        });
    }

    async downloadModel(modelName) {
        return new Promise((resolve, reject) => {
            // Create download progress modal
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Downloading Model</h3>
                    </div>
                    <div class="modal-body">
                        <p>Downloading <strong>${modelName}</strong>...</p>
                        <div class="progress-container">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: 0%"></div>
                            </div>
                            <div class="progress-text">0%</div>
                        </div>
                        <div class="download-details">
                            <small id="download-size">Preparing download...</small>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            document.body.style.overflow = 'hidden';

            const progressFill = modal.querySelector('.progress-fill');
            const progressText = modal.querySelector('.progress-text');
            const downloadSize = modal.querySelector('#download-size');

            // Listen for progress updates
            const progressHandler = (event, progress) => {
                if (progress.modelName === modelName) {
                    progressFill.style.width = `${progress.progress}%`;
                    progressText.textContent = `${progress.progress}%`;
                    
                    if (progress.totalSize) {
                        const downloaded = this.formatBytes(progress.downloadedSize);
                        const total = this.formatBytes(progress.totalSize);
                        downloadSize.textContent = `${downloaded} / ${total}`;
                    }
                }
            };

            window.electronAPI.onModelDownloadProgress(progressHandler);

            // Start download
            window.electronAPI.downloadModel(modelName)
                .then((result) => {
                    // Clean up
                    window.electronAPI.removeAllListeners('model:download:progress');
                    document.body.removeChild(modal);
                    document.body.style.overflow = 'auto';
                    
                    this.updateStatus(`Model ${modelName} downloaded successfully`);
                    resolve(result);
                })
                .catch((error) => {
                    // Clean up
                    window.electronAPI.removeAllListeners('model:download:progress');
                    document.body.removeChild(modal);
                    document.body.style.overflow = 'auto';
                    
                    this.showError(`Failed to download model: ${error.message}`);
                    reject(error);
                });
        });
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async setupWhisper() {
        try {
            this.updateStatus('Setting up local Whisper...');
            
            // Show setup instructions
            const message = `To set up local Whisper:

1. Open a terminal in the project directory
2. Run the setup script:
   - macOS/Linux: ./scripts/setup-whisper.sh
   - Windows: scripts\\setup-whisper.bat

This will download and build whisper.cpp and the required models.

Would you like to open the project directory?`;
            
            if (confirm(message)) {
                await window.electronAPI.openProjectDirectory();
            }
            
        } catch (error) {
            console.error('Error setting up Whisper:', error);
            this.showError('Failed to setup Whisper');
        }
    }
    // Auto-save recording functionality
    async initializeAutoSaveSession() {
        if (!this.recordingSettings.enableAutoSave) {
            return;
        }

        try {
            // Generate unique session ID
            this.recordingAutoSave.sessionId = `recording_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.recordingAutoSave.chunkIndex = 0;
            this.recordingAutoSave.savedChunks = [];

            // Get temp directory from main process
            const paths = await window.electronAPI.getAppPaths();
            this.recordingAutoSave.tempDirectory = paths.temp;

            console.log(`Auto-save session initialized: ${this.recordingAutoSave.sessionId}`);
        } catch (error) {
            console.error('Failed to initialize auto-save session:', error);
            this.recordingSettings.enableAutoSave = false;
        }
    }

    startAutoSaveTimer() {
        if (!this.recordingSettings.enableAutoSave) {
            return;
        }

        this.recordingAutoSave.autoSaveTimer = setInterval(async () => {
            if (this.isRecording && !this.isPaused) {
                await this.saveCurrentRecordingChunk();
            }
        }, this.recordingSettings.autoSaveInterval);

        console.log(`Auto-save timer started (interval: ${this.recordingSettings.autoSaveInterval}ms)`);
    }

    stopAutoSaveTimer() {
        if (this.recordingAutoSave.autoSaveTimer) {
            clearInterval(this.recordingAutoSave.autoSaveTimer);
            this.recordingAutoSave.autoSaveTimer = null;
            console.log('Auto-save timer stopped');
        }
    }

    async saveCurrentRecordingChunk() {
        if (!this.recordingSettings.enableAutoSave || !this.audioChunks.length) {
            return;
        }

        try {
            // Create blob from current audio chunks
            const mimeType = this.getMimeType();
            const chunkBlob = new Blob([...this.audioChunks], { type: mimeType });
            
            if (chunkBlob.size === 0) {
                return; // No data to save
            }

            // Convert to array buffer
            const arrayBuffer = await chunkBlob.arrayBuffer();
            
            // Generate chunk filename
            const chunkFilename = `${this.recordingAutoSave.sessionId}_chunk_${this.recordingAutoSave.chunkIndex.toString().padStart(3, '0')}.webm`;
            
            // Save chunk via IPC
            const result = await window.electronAPI.saveRecordingChunk(arrayBuffer, chunkFilename);
            
            if (result.success) {
                this.recordingAutoSave.savedChunks.push({
                    filename: chunkFilename,
                    filePath: result.filePath,
                    size: result.size,
                    chunkIndex: this.recordingAutoSave.chunkIndex,
                    timestamp: Date.now()
                });
                
                this.recordingAutoSave.chunkIndex++;
                
                // Clear saved chunks from memory to prevent memory buildup
                this.audioChunks = [];
                
                console.log(`Saved recording chunk: ${chunkFilename} (${result.size} bytes)`);
                this.updateStatus(`Recording... (Auto-saved ${this.recordingAutoSave.savedChunks.length} chunks)`);
            }
        } catch (error) {
            console.error('Failed to save recording chunk:', error);
            // Don't disable auto-save on single failure, just log it
        }
    }

    async combineRecordingChunks(finalBlob) {
        if (!this.recordingSettings.enableAutoSave || this.recordingAutoSave.savedChunks.length === 0) {
            return finalBlob;
        }

        try {
            console.log(`Combining ${this.recordingAutoSave.savedChunks.length} saved chunks with final recording`);
            
            // Load all saved chunks
            const chunkBlobs = [];
            
            for (const chunkInfo of this.recordingAutoSave.savedChunks) {
                try {
                    const chunkData = await window.electronAPI.loadRecordingChunk(chunkInfo.filePath);
                    if (chunkData) {
                        chunkBlobs.push(new Blob([chunkData], { type: this.getMimeType() }));
                    }
                } catch (error) {
                    console.error(`Failed to load chunk ${chunkInfo.filename}:`, error);
                    // Continue with other chunks
                }
            }
            
            // Add final recording blob
            chunkBlobs.push(finalBlob);
            
            // Combine all blobs
            const combinedBlob = new Blob(chunkBlobs, { type: this.getMimeType() });
            
            // Clean up temporary files
            await this.cleanupAutoSaveFiles();
            
            console.log(`Combined recording: ${combinedBlob.size} bytes total`);
            return combinedBlob;
            
        } catch (error) {
            console.error('Failed to combine recording chunks:', error);
            // Return final blob as fallback
            return finalBlob;
        }
    }

    async cleanupAutoSaveFiles() {
        if (this.recordingAutoSave.savedChunks.length === 0) {
            return;
        }

        const failedChunks = [];
        
        for (const chunkInfo of this.recordingAutoSave.savedChunks) {
            try {
                await window.electronAPI.deleteRecordingChunk(chunkInfo.filePath);
            } catch (error) {
                console.error(`Failed to delete chunk ${chunkInfo.filePath}:`, error);
                failedChunks.push(chunkInfo);
            }
        }
        
        const deletedCount = this.recordingAutoSave.savedChunks.length - failedChunks.length;
        if (deletedCount > 0) {
            console.log(`Cleaned up ${deletedCount} temporary recording files`);
        }
        
        if (failedChunks.length > 0) {
            console.warn(`Failed to delete ${failedChunks.length} temporary files, will retry later`);
            this.recordingAutoSave.savedChunks = failedChunks;
        } else {
            // Only reset state if all chunks were successfully deleted
            this.recordingAutoSave.savedChunks = [];
            this.recordingAutoSave.chunkIndex = 0;
            this.recordingAutoSave.sessionId = null;
        }
    }

    async recoverRecordingFromChunks(sessionId) {
        try {
            // This function can be called to recover a recording from a previous session
            // if the app crashed before completion
            const recoveredChunks = await window.electronAPI.findRecordingChunks(sessionId);
            
            if (recoveredChunks.length > 0) {
                console.log(`Found ${recoveredChunks.length} chunks for session ${sessionId}`);
                
                const chunkBlobs = [];
                for (const chunkPath of recoveredChunks) {
                    const chunkData = await window.electronAPI.loadRecordingChunk(chunkPath);
                    if (chunkData) {
                        chunkBlobs.push(new Blob([chunkData], { type: this.getMimeType() }));
                    }
                }
                
                if (chunkBlobs.length > 0) {
                    const recoveredBlob = new Blob(chunkBlobs, { type: this.getMimeType() });
                    this.recordingBlob = recoveredBlob;
                    this.showRecordingInfo(recoveredBlob);
                    this.updateRecordingUI();
                    this.updateStatus(`Recovered recording from ${chunkBlobs.length} chunks`);
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.error('Failed to recover recording from chunks:', error);
            return false;
        }
    }

    async checkForOrphanedRecordings() {
        try {
            // Look for any recording chunks that might be left from a previous session
            const { app } = require('electron');
            const tempDir = await window.electronAPI.getAppPaths();
            
            // Get all files in the recordings temp directory
            const allChunks = await window.electronAPI.findRecordingChunks('recording_');
            
            if (allChunks.length > 0) {
                console.log(`Found ${allChunks.length} orphaned recording chunks`);
                
                // Group chunks by session ID
                const sessionGroups = {};
                allChunks.forEach(chunkPath => {
                    const filename = chunkPath.split('/').pop();
                    const sessionMatch = filename.match(/^(recording_\d+_[a-z0-9]+)_chunk_/);
                    if (sessionMatch) {
                        const sessionId = sessionMatch[1];
                        if (!sessionGroups[sessionId]) {
                            sessionGroups[sessionId] = [];
                        }
                        sessionGroups[sessionId].push(chunkPath);
                    }
                });
                
                // Show recovery dialog for sessions with multiple chunks
                const recoverableSessions = Object.entries(sessionGroups)
                    .filter(([sessionId, chunks]) => chunks.length > 0)
                    .sort(([, a], [, b]) => b.length - a.length); // Sort by chunk count
                
                if (recoverableSessions.length > 0) {
                    this.showRecoveryDialog(recoverableSessions);
                }
            }
        } catch (error) {
            console.error('Error checking for orphaned recordings:', error);
        }
    }

    showRecoveryDialog(recoverableSessions) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>🔄 Recover Previous Recordings</h2>
                    <span class="modal-close">&times;</span>
                </div>
                <div class="modal-body">
                    <p>Found ${recoverableSessions.length} incomplete recording(s) from previous sessions:</p>
                    <div id="recovery-sessions">
                        ${recoverableSessions.map(([sessionId, chunks], index) => `
                            <div class="recovery-session" data-session-id="${sessionId}">
                                <h4>Session ${index + 1}</h4>
                                <p>${chunks.length} chunks found</p>
                                <button class="btn btn-primary recover-btn" data-session-id="${sessionId}">
                                    Recover This Recording
                                </button>
                                <button class="btn btn-secondary delete-btn" data-session-id="${sessionId}">
                                    Delete Chunks
                                </button>
                            </div>
                        `).join('')}
                    </div>
                    <div class="recovery-actions">
                        <button class="btn btn-secondary" id="delete-all-chunks">Delete All</button>
                        <button class="btn btn-secondary" id="cancel-recovery">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listeners
        modal.querySelector('.modal-close').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.querySelector('#cancel-recovery').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.querySelector('#delete-all-chunks').addEventListener('click', async () => {
            try {
                for (const [sessionId, chunks] of recoverableSessions) {
                    for (const chunkPath of chunks) {
                        await window.electronAPI.deleteRecordingChunk(chunkPath);
                    }
                }
                this.updateStatus('All orphaned recording chunks deleted');
                document.body.removeChild(modal);
            } catch (error) {
                console.error('Error deleting chunks:', error);
                this.showError('Failed to delete some chunks');
            }
        });
        
        // Add recover button listeners
        modal.querySelectorAll('.recover-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const sessionId = e.target.dataset.sessionId;
                try {
                    const recovered = await this.recoverRecordingFromChunks(sessionId);
                    if (recovered) {
                        this.switchTab('record');
                        document.body.removeChild(modal);
                    } else {
                        this.showError('Failed to recover recording');
                    }
                } catch (error) {
                    console.error('Error recovering recording:', error);
                    this.showError('Failed to recover recording');
                }
            });
        });
        
        // Add delete button listeners
        modal.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const sessionId = e.target.dataset.sessionId;
                try {
                    const chunks = recoverableSessions.find(([id]) => id === sessionId)[1];
                    for (const chunkPath of chunks) {
                        await window.electronAPI.deleteRecordingChunk(chunkPath);
                    }
                    e.target.closest('.recovery-session').remove();
                    this.updateStatus(`Deleted chunks for session ${sessionId}`);
                } catch (error) {
                    console.error('Error deleting chunks:', error);
                    this.showError('Failed to delete chunks');
                }
            });
        });
    }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WhisperWrapperApp;
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WhisperWrapperApp();
});

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
        case 'o':
            e.preventDefault();
            // Trigger file open
            break;
        case 's':
            e.preventDefault();
            // Trigger save
            break;
        case 'r':
            e.preventDefault();
            if (e.shiftKey) {
                // Stop recording
            } else {
                // Start recording
            }
            break;
        }
    }
});
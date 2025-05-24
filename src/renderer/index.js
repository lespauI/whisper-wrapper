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
            autoTranscribe: true
        };
        
        // Transcription editing state
        this.transcriptionState = {
            originalText: '',
            currentText: '',
            isDirty: false,
            lastSaved: null,
            autoSaveTimer: null,
            history: [],
            historyIndex: -1
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
        this.updateStatus('Ready');
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

        // Recording settings
        document.getElementById('quality-select').addEventListener('change', (e) => {
            this.recordingSettings.quality = e.target.value;
        });

        document.getElementById('format-select').addEventListener('change', (e) => {
            this.recordingSettings.format = e.target.value;
        });

        document.getElementById('auto-transcribe').addEventListener('change', (e) => {
            this.recordingSettings.autoTranscribe = e.target.checked;
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

        // Find & Replace
        document.getElementById('find-replace-btn').addEventListener('click', () => {
            this.toggleFindReplace();
        });

        document.getElementById('close-find-btn').addEventListener('click', () => {
            this.closeFindReplace();
        });

        document.getElementById('find-next-btn').addEventListener('click', () => {
            this.findNext();
        });

        document.getElementById('find-prev-btn').addEventListener('click', () => {
            this.findPrevious();
        });

        document.getElementById('replace-btn').addEventListener('click', () => {
            this.replaceNext();
        });

        document.getElementById('replace-all-btn').addEventListener('click', () => {
            this.replaceAll();
        });

        // Clear draft
        document.getElementById('clear-draft-btn').addEventListener('click', () => {
            this.clearDraft();
        });

        // Find input events
        document.getElementById('find-input').addEventListener('input', () => {
            this.updateFindResults();
        });

        document.getElementById('find-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                    this.findPrevious();
                } else {
                    this.findNext();
                }
            } else if (e.key === 'Escape') {
                this.closeFindReplace();
            }
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
            
            if (result.success) {
                this.showTranscriptionResult(result.text);
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
            
            this.updateRecordingUI();
            this.startRecordingTimer();
            this.startVisualization();
            this.updateStatus('Recording...');
            
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

    stopRecording() {
        if (this.mediaRecorder) {
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            
            // Clean up audio context
            if (this.audioContext) {
                this.audioContext.close();
                this.audioContext = null;
            }
            
            this.isRecording = false;
            this.isPaused = false;
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
        } else if (this.recordingBlob) {
            // Recording completed
            indicator.classList.remove('recording', 'paused');
            statusText.textContent = 'Recording ready';
            startBtn.classList.remove('hidden');
            pauseBtn.classList.add('hidden');
            resumeBtn.classList.add('hidden');
            stopBtn.classList.add('hidden');
            saveBtn.classList.remove('hidden');
        } else {
            // Ready to record
            indicator.classList.remove('recording', 'paused');
            statusText.textContent = 'Ready to record';
            startBtn.classList.remove('hidden');
            pauseBtn.classList.add('hidden');
            resumeBtn.classList.add('hidden');
            stopBtn.classList.add('hidden');
            saveBtn.classList.add('hidden');
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
            // Show recording info
            this.showRecordingInfo(audioBlob);
            
            // Auto-transcribe if enabled
            if (this.recordingSettings.autoTranscribe) {
                this.showTranscriptionLoading(true);
                this.updateStatus('Processing recording...');
                
                // Convert blob to array buffer
                const arrayBuffer = await audioBlob.arrayBuffer();
                
                // Set up progress listener
                window.electronAPI.onTranscriptionProgress((event, progress) => {
                    this.updateTranscriptionProgress(progress);
                });

                // Start transcription
                const result = await window.electronAPI.transcribeAudio(arrayBuffer);
                
                if (result.success) {
                    this.showTranscriptionResult(result.text);
                    this.updateStatus(`Recording transcribed (Language: ${result.language || 'unknown'})`);
                    this.switchTab('transcription');
                } else {
                    throw new Error('Transcription failed');
                }
            } else {
                this.updateStatus('Recording completed. Click "Save Recording" or start a new recording.');
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

    showTranscriptionResult(text) {
        const transcriptionText = document.getElementById('transcription-text');
        const emptyState = document.getElementById('transcription-empty');
        const loadingState = document.getElementById('transcription-loading');
        
        transcriptionText.value = text;
        emptyState.classList.add('hidden');
        loadingState.classList.add('hidden');
        
        // Initialize transcription state
        this.transcriptionState.originalText = text;
        this.transcriptionState.currentText = text;
        this.transcriptionState.isDirty = false;
        this.transcriptionState.lastSaved = new Date();
        this.transcriptionState.history = [text];
        this.transcriptionState.historyIndex = 0;
        
        // Update UI indicators
        this.updateTranscriptionStatus();
    }

    copyTranscription() {
        const transcriptionText = document.getElementById('transcription-text');
        
        if (transcriptionText.value) {
            navigator.clipboard.writeText(transcriptionText.value).then(() => {
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
        
        // Ctrl/Cmd + F for find
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            this.toggleFindReplace();
        }
        
        // Escape to close find/replace
        if (e.key === 'Escape') {
            this.closeFindReplace();
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

    // Find & Replace functionality
    toggleFindReplace() {
        const panel = document.getElementById('find-replace-panel');
        const findInput = document.getElementById('find-input');
        
        if (panel.classList.contains('hidden')) {
            panel.classList.remove('hidden');
            findInput.focus();
            
            // Pre-fill with selected text if any
            const transcriptionText = document.getElementById('transcription-text');
            const selectedText = transcriptionText.value.substring(
                transcriptionText.selectionStart,
                transcriptionText.selectionEnd
            );
            
            if (selectedText) {
                findInput.value = selectedText;
                this.updateFindResults();
            }
        } else {
            this.closeFindReplace();
        }
    }

    closeFindReplace() {
        const panel = document.getElementById('find-replace-panel');
        panel.classList.add('hidden');
        
        // Clear highlights
        this.clearFindHighlights();
        
        // Focus back to textarea
        document.getElementById('transcription-text').focus();
    }

    updateFindResults() {
        const findInput = document.getElementById('find-input');
        const findResults = document.getElementById('find-results');
        const transcriptionText = document.getElementById('transcription-text');
        
        const searchTerm = findInput.value;
        if (!searchTerm) {
            findResults.textContent = '';
            this.clearFindHighlights();
            return;
        }
        
        const text = transcriptionText.value;
        const matches = this.findMatches(text, searchTerm);
        
        if (matches.length === 0) {
            findResults.textContent = 'No matches';
        } else {
            findResults.textContent = `${matches.length} matches`;
        }
        
        this.currentFindIndex = -1;
        this.findMatches = matches;
    }

    findMatches(text, searchTerm) {
        const matches = [];
        const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        let match;
        
        while ((match = regex.exec(text)) !== null) {
            matches.push({
                start: match.index,
                end: match.index + match[0].length,
                text: match[0]
            });
        }
        
        return matches;
    }

    findNext() {
        if (!this.findMatches || this.findMatches.length === 0) {
            return;
        }
        
        this.currentFindIndex = (this.currentFindIndex + 1) % this.findMatches.length;
        this.highlightMatch(this.currentFindIndex);
    }

    findPrevious() {
        if (!this.findMatches || this.findMatches.length === 0) {
            return;
        }
        
        this.currentFindIndex = this.currentFindIndex <= 0 ? 
            this.findMatches.length - 1 : 
            this.currentFindIndex - 1;
        this.highlightMatch(this.currentFindIndex);
    }

    highlightMatch(index) {
        if (!this.findMatches || index < 0 || index >= this.findMatches.length) {
            return;
        }
        
        const transcriptionText = document.getElementById('transcription-text');
        const match = this.findMatches[index];
        
        transcriptionText.focus();
        transcriptionText.setSelectionRange(match.start, match.end);
        
        // Update results text
        const findResults = document.getElementById('find-results');
        findResults.textContent = `${index + 1} of ${this.findMatches.length}`;
    }

    replaceNext() {
        if (!this.findMatches || this.currentFindIndex < 0) {
            return;
        }
        
        const replaceInput = document.getElementById('replace-input');
        const replaceText = replaceInput.value;
        const transcriptionText = document.getElementById('transcription-text');
        
        const match = this.findMatches[this.currentFindIndex];
        const newText = transcriptionText.value.substring(0, match.start) + 
                       replaceText + 
                       transcriptionText.value.substring(match.end);
        
        transcriptionText.value = newText;
        this.handleTranscriptionEdit(newText);
        
        // Update find results
        this.updateFindResults();
    }

    replaceAll() {
        const findInput = document.getElementById('find-input');
        const replaceInput = document.getElementById('replace-input');
        const transcriptionText = document.getElementById('transcription-text');
        
        const searchTerm = findInput.value;
        const replaceText = replaceInput.value;
        
        if (!searchTerm) {
            return;
        }
        
        const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        const newText = transcriptionText.value.replace(regex, replaceText);
        
        transcriptionText.value = newText;
        this.handleTranscriptionEdit(newText);
        
        // Update find results
        this.updateFindResults();
        
        this.updateStatus(`Replaced all occurrences of "${searchTerm}"`);
    }

    clearFindHighlights() {
        // Clear any highlighting (if we implement visual highlighting later)
        this.findMatches = [];
        this.currentFindIndex = -1;
    }

    clearDraft() {
        if (confirm('Are you sure you want to clear the current transcription? This action cannot be undone.')) {
            const transcriptionText = document.getElementById('transcription-text');
            transcriptionText.value = '';
            
            // Reset state
            this.transcriptionState = {
                originalText: '',
                currentText: '',
                isDirty: false,
                lastSaved: null,
                autoSaveTimer: null,
                history: [''],
                historyIndex: 0
            };
            
            this.clearTranscriptionDraft();
            this.updateTranscriptionStatus();
            this.updateUndoRedoButtons();
            
            // Show empty state
            const emptyState = document.getElementById('transcription-empty');
            emptyState.classList.remove('hidden');
            
            this.updateStatus('Transcription cleared');
        }
    }

    async openSettings() {
        document.getElementById('settings-modal').classList.remove('hidden');
        await this.checkWhisperStatus();
        await this.loadSettings();
    }

    closeSettings() {
        document.getElementById('settings-modal').classList.add('hidden');
    }

    async saveSettings() {
        try {
            const model = document.getElementById('model-select').value;
            const language = document.getElementById('language-select').value;
            const threads = parseInt(document.getElementById('threads-select').value);
            const translate = document.getElementById('translate-checkbox').checked;
            
            const settings = {
                model,
                language,
                threads,
                translate
            };
            
            // Save settings via IPC
            await window.electronAPI.setConfig(settings);
            
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
            
            if (settings.model) {
                document.getElementById('model-select').value = settings.model;
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
            
        } catch (error) {
            console.error('Error loading settings:', error);
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
        case 'high':
            constraints.audio = {
                sampleRate: 44100,
                channelCount: 2,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            };
            break;
        case 'medium':
            constraints.audio = {
                sampleRate: 22050,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            };
            break;
        case 'low':
            constraints.audio = {
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            };
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
                // Reset recording state
                this.recordingBlob = null;
                this.updateRecordingUI();
                document.getElementById('recording-info').classList.add('hidden');
                document.getElementById('record-time').textContent = '00:00';
                document.getElementById('record-size').textContent = '0 KB';
            }
        } catch (error) {
            console.error('Error saving recording:', error);
            this.showError('Failed to save recording');
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

    updateModelOptions(availableModels) {
        const modelSelect = document.getElementById('model-select');
        
        // Clear existing options
        modelSelect.innerHTML = '';
        
        if (availableModels && availableModels.length > 0) {
            availableModels.forEach(model => {
                const option = document.createElement('option');
                option.value = model.name;
                option.textContent = `${model.name.charAt(0).toUpperCase() + model.name.slice(1)} (${model.size})`;
                modelSelect.appendChild(option);
            });
        } else {
            // Fallback options
            const defaultModels = [
                { name: 'base', size: '39 MB' },
                { name: 'small', size: '244 MB' },
                { name: 'medium', size: '769 MB' },
                { name: 'large', size: '1550 MB' }
            ];
            
            defaultModels.forEach(model => {
                const option = document.createElement('option');
                option.value = model.name;
                option.textContent = `${model.name.charAt(0).toUpperCase() + model.name.slice(1)} (${model.size})`;
                modelSelect.appendChild(option);
            });
        }
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
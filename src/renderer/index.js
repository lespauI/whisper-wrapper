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
        const downloadBtn = document.getElementById('download-btn');

        copyBtn.addEventListener('click', () => {
            this.copyTranscription();
        });

        downloadBtn.addEventListener('click', () => {
            this.downloadTranscription();
        });
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
                }
            } catch (error) {
                console.error('Error saving transcription:', error);
                this.showError('Failed to save transcription');
            }
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
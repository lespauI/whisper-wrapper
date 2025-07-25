/**
 * Recording Controller
 * Manages audio recording, visualization, auto-save, and transcription
 */

import { RECORDING_SETTINGS, TABS, CSS_CLASSES, SELECTORS } from '../utils/Constants.js';
import { EventHandler } from '../utils/EventHandler.js';
import { UIHelpers } from '../utils/UIHelpers.js';

export class RecordingController {
    constructor(appState, statusController, tabController) {
        this.appState = appState;
        this.statusController = statusController;
        this.tabController = tabController;
        
        // Recording state
        this.mediaRecorder = null;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.dataArray = null;
        this.audioChunks = [];
        this.recordingBlob = null;
        this.isRecording = false;
        this.isPaused = false;
        this.recordingStartTime = null;
        this.recordingTimer = null;
        this.animationId = null;
        
        // Auto-save state
        this.recordingAutoSave = {
            sessionId: null,
            chunkIndex: 0,
            savedChunks: [],
            tempDirectory: null,
            autoSaveTimer: null
        };

        this.init();
    }

    init() {
        this.setupRecordingControls();
        this.setupRecordingSettings();
        this.initializeVisualization();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Listen to app state changes
        this.appState.subscribe('recording', (data) => {
            this.handleRecordingStateChange(data);
        });
    }

    /**
     * Set up recording control buttons
     */
    setupRecordingControls() {
        // Recording controls
        EventHandler.addListener('#start-record-btn', 'click', () => {
            this.startRecording();
        });

        EventHandler.addListener('#pause-record-btn', 'click', () => {
            this.pauseRecording();
        });

        EventHandler.addListener('#resume-record-btn', 'click', () => {
            this.resumeRecording();
        });

        EventHandler.addListener('#stop-record-btn', 'click', () => {
            this.stopRecording();
        });

        EventHandler.addListener('#save-record-btn', 'click', () => {
            this.saveRecording();
        });

        EventHandler.addListener('#transcribe-record-btn', 'click', () => {
            this.transcribeRecording();
        });

        EventHandler.addListener('#clear-record-btn', 'click', () => {
            this.clearRecording();
        });
    }

    /**
     * Set up recording settings controls
     */
    setupRecordingSettings() {
        EventHandler.addListener('#quality-select', 'change', (e) => {
            const settings = this.appState.getRecordingState();
            this.appState.setRecordingState({
                ...settings,
                quality: e.target.value
            });
        });

        EventHandler.addListener('#format-select', 'change', (e) => {
            const settings = this.appState.getRecordingState();
            this.appState.setRecordingState({
                ...settings,
                format: e.target.value
            });
        });

        EventHandler.addListener('#auto-transcribe', 'change', (e) => {
            const settings = this.appState.getRecordingState();
            this.appState.setRecordingState({
                ...settings,
                autoTranscribe: e.target.checked
            });
            this.updateRecordingUI();
        });
    }

    /**
     * Start audio recording
     */
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
            
            // Update state and UI
            this.appState.setRecordingState({
                isRecording: true,
                isPaused: false,
                startTime: this.recordingStartTime,
                blob: null
            });

            this.updateRecordingUI();
            this.startRecordingTimer();
            this.startVisualization();
            this.startAutoSaveTimer();
            this.statusController.updateStatus('Recording... (Auto-save enabled)');
            
        } catch (error) {
            console.error('Error starting recording:', error);
            this.statusController.showError('Failed to start recording. Please check microphone permissions.');
        }
    }

    /**
     * Pause recording
     */
    pauseRecording() {
        if (this.mediaRecorder && this.isRecording && !this.isPaused) {
            this.mediaRecorder.pause();
            this.isPaused = true;
            
            // Update state
            this.appState.setRecordingState({ isPaused: true });
            
            this.updateRecordingUI();
            this.stopRecordingTimer();
            this.stopVisualization();
            this.statusController.updateStatus('Recording paused');
        }
    }

    /**
     * Resume recording
     */
    resumeRecording() {
        if (this.mediaRecorder && this.isPaused) {
            this.mediaRecorder.resume();
            this.isPaused = false;
            
            // Update state
            this.appState.setRecordingState({ isPaused: false });
            
            this.updateRecordingUI();
            this.startRecordingTimer();
            this.startVisualization();
            this.statusController.updateStatus('Recording...');
        }
    }

    /**
     * Stop recording
     */
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
            
            // Update state
            this.appState.setRecordingState({
                isRecording: false,
                isPaused: false
            });
            
            this.statusController.updateStatus('Processing recording...');
        }
    }

    /**
     * Save recording to file
     */
    async saveRecording() {
        if (!this.recordingBlob) {
            this.statusController.showError('No recording to save');
            return;
        }
        
        try {
            // Convert blob to array buffer
            const arrayBuffer = await this.recordingBlob.arrayBuffer();
            
            // Create filename with timestamp
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const recordingState = this.appState.getRecordingState();
            const extension = recordingState.format === 'webm' ? 'webm' : 'wav';
            const filename = `recording-${timestamp}.${extension}`;
            
            // Save file using Electron API
            const result = await window.electronAPI.saveFile(arrayBuffer, filename);
            
            if (!result.canceled) {
                this.statusController.updateStatus('Recording saved successfully');
            }
        } catch (error) {
            console.error('Error saving recording:', error);
            this.statusController.showError('Failed to save recording');
        }
    }

    /**
     * Transcribe the recorded audio
     */
    async transcribeRecording() {
        if (!this.recordingBlob) {
            this.statusController.showError('No recording to transcribe');
            return;
        }
        
        try {
            this.statusController.showTranscriptionLoading(true);
            this.statusController.updateStatus('Processing recording...');
            
            // Convert blob to array buffer
            const arrayBuffer = await this.recordingBlob.arrayBuffer();
            
            // Set up progress listener
            window.electronAPI.onTranscriptionProgress((event, progress) => {
                this.statusController.updateTranscriptionProgress(progress);
            });

            // Start transcription
            const result = await window.electronAPI.transcribeAudio(arrayBuffer);
            console.log('🎬 Manual transcription result from IPC:', result);
            
            if (result.success) {
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

                // Show transcription result (this will be moved to TranscriptionController later)
                if (window.app && window.app.showTranscriptionResult) {
                    await window.app.showTranscriptionResult(result.text, result.segments);
                }
                
                this.statusController.updateStatus(`Recording transcribed (Language: ${result.language || 'unknown'})`);
                await this.tabController.switchTab(TABS.TRANSCRIPTION);
            } else {
                throw new Error('Transcription failed');
            }
            
        } catch (error) {
            console.error('Error transcribing recording:', error);
            this.statusController.showError('Failed to transcribe recording');
            this.statusController.showTranscriptionLoading(false);
        } finally {
            // Clean up progress listener
            if (window.electronAPI) {
                window.electronAPI.removeAllListeners('transcription:progress');
            }
        }
    }

    /**
     * Clear the current recording
     */
    clearRecording() {
        if (!this.recordingBlob) {
            return;
        }
        
        // Ask for confirmation
        if (confirm('Are you sure you want to clear the recording? This action cannot be undone.')) {
            // Clear recording state
            this.recordingBlob = null;
            this.appState.setRecordingState({ blob: null });
            
            this.updateRecordingUI();
            UIHelpers.hide('#recording-info');
            UIHelpers.setText('#record-time', '00:00');
            UIHelpers.setText('#record-size', '0 KB');
            this.statusController.updateStatus('Recording cleared');
        }
    }

    /**
     * Update recording UI based on current state
     */
    updateRecordingUI() {
        const indicator = UIHelpers.getElementById('record-indicator');
        const statusText = UIHelpers.getElementById('record-status-text');
        const startBtn = UIHelpers.getElementById('start-record-btn');
        const pauseBtn = UIHelpers.getElementById('pause-record-btn');
        const resumeBtn = UIHelpers.getElementById('resume-record-btn');
        const stopBtn = UIHelpers.getElementById('stop-record-btn');
        const saveBtn = UIHelpers.getElementById('save-record-btn');
        const transcribeBtn = UIHelpers.getElementById('transcribe-record-btn');
        const clearBtn = UIHelpers.getElementById('clear-record-btn');

        if (this.isRecording && !this.isPaused) {
            // Currently recording
            UIHelpers.addClass(indicator, 'recording');
            UIHelpers.removeClass(indicator, 'paused');
            UIHelpers.setText(statusText, 'Recording...');
            UIHelpers.hide(startBtn);
            UIHelpers.show(pauseBtn);
            UIHelpers.hide(resumeBtn);
            UIHelpers.show(stopBtn);
            UIHelpers.hide(saveBtn);
            UIHelpers.hide(transcribeBtn);
            UIHelpers.hide(clearBtn);
        } else if (this.isPaused) {
            // Recording paused
            UIHelpers.removeClass(indicator, 'recording');
            UIHelpers.addClass(indicator, 'paused');
            UIHelpers.setText(statusText, 'Paused');
            UIHelpers.hide(startBtn);
            UIHelpers.hide(pauseBtn);
            UIHelpers.show(resumeBtn);
            UIHelpers.show(stopBtn);
            UIHelpers.hide(saveBtn);
            UIHelpers.hide(transcribeBtn);
            UIHelpers.hide(clearBtn);
        } else if (this.recordingBlob) {
            // Recording completed
            UIHelpers.removeClass(indicator, 'recording');
            UIHelpers.removeClass(indicator, 'paused');
            UIHelpers.setText(statusText, 'Recording ready');
            UIHelpers.show(startBtn);
            UIHelpers.hide(pauseBtn);
            UIHelpers.hide(resumeBtn);
            UIHelpers.hide(stopBtn);
            UIHelpers.show(saveBtn);
            UIHelpers.show(clearBtn);
            UIHelpers.show(transcribeBtn);
        } else {
            // Ready to record
            UIHelpers.removeClass(indicator, 'recording');
            UIHelpers.removeClass(indicator, 'paused');
            UIHelpers.setText(statusText, 'Ready to record');
            UIHelpers.show(startBtn);
            UIHelpers.hide(pauseBtn);
            UIHelpers.hide(resumeBtn);
            UIHelpers.hide(stopBtn);
            UIHelpers.hide(saveBtn);
            UIHelpers.hide(transcribeBtn);
            UIHelpers.hide(clearBtn);
        }
    }

    /**
     * Handle recording completion
     */
    async handleRecordingComplete(audioBlob) {
        try {
            // Combine all saved chunks with the final recording
            const finalAudioBlob = await this.combineRecordingChunks(audioBlob);
            this.recordingBlob = finalAudioBlob;
            
            // Update state
            this.appState.setRecordingState({ blob: finalAudioBlob });
            
            // Show recording info
            this.showRecordingInfo(finalAudioBlob);
            
            // Update UI to show the recording buttons now that recordingBlob is set
            this.updateRecordingUI();
            
            // Auto-transcribe if enabled
            const recordingState = this.appState.getRecordingState();
            if (recordingState.autoTranscribe) {
                this.statusController.showTranscriptionLoading(true);
                this.statusController.updateStatus('Processing recording...');
                
                // Convert blob to array buffer
                const arrayBuffer = await finalAudioBlob.arrayBuffer();
                
                // Set up progress listener
                window.electronAPI.onTranscriptionProgress((event, progress) => {
                    this.statusController.updateTranscriptionProgress(progress);
                });

                // Start transcription
                const result = await window.electronAPI.transcribeAudio(arrayBuffer);
                console.log('🎬 Auto transcription result from IPC:', result);
                
                if (result.success) {
                    console.log('🎬 Calling showTranscriptionResult with:', {
                        textLength: result.text?.length,
                        segmentsCount: result.segments?.length
                    });
                    
                    // Show transcription result (this will be moved to TranscriptionController later)
                    if (window.app && window.app.showTranscriptionResult) {
                        await window.app.showTranscriptionResult(result.text, result.segments);
                    }
                    
                    this.statusController.updateStatus(`Recording transcribed (Language: ${result.language || 'unknown'})`);
                    await this.tabController.switchTab(TABS.TRANSCRIPTION);
                    
                    // Keep recording available for saving or re-transcribing
                    // User can come back to recording tab and use the buttons
                } else {
                    this.statusController.showError('Auto-transcription failed');
                }
            } else {
                this.statusController.updateStatus('Recording completed. Use the buttons below to save, transcribe, or clear the recording.');
            }
            
        } catch (error) {
            console.error('Error processing recording:', error);
            this.statusController.showError('Failed to process recording');
        } finally {
            this.statusController.showTranscriptionLoading(false);
            
            // Clean up progress listener
            if (window.electronAPI) {
                window.electronAPI.removeAllListeners('transcription:progress');
            }
        }
    }

    /**
     * Show recording information
     */
    showRecordingInfo(blob) {
        const recordingInfo = UIHelpers.getElementById('recording-info');
        const sizeElement = UIHelpers.getElementById('record-size');
        
        if (recordingInfo && sizeElement) {
            const sizeInMB = (blob.size / (1024 * 1024)).toFixed(2);
            UIHelpers.setText(sizeElement, `${sizeInMB} MB`);
            UIHelpers.show(recordingInfo);
        }
    }

    /**
     * Start recording timer
     */
    startRecordingTimer() {
        this.recordingTimer = setInterval(() => {
            const elapsed = Date.now() - this.recordingStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            UIHelpers.setText('#record-time', 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
            
            // Update estimated file size
            this.updateRecordingSize(elapsed);
        }, 1000);
    }

    /**
     * Stop recording timer
     */
    stopRecordingTimer() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
    }

    /**
     * Update estimated recording size
     */
    updateRecordingSize(elapsed) {
        const recordingState = this.appState.getRecordingState();
        let bytesPerSecond;
        
        switch (recordingState.quality) {
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
        const estimatedMB = (estimatedBytes / (1024 * 1024)).toFixed(2);
        
        UIHelpers.setText('#record-size', `~${estimatedMB} MB`);
    }

    /**
     * Get recording constraints based on quality setting
     */
    getRecordingConstraints() {
        const recordingState = this.appState.getRecordingState();
        const constraints = { audio: true };
        
        switch (recordingState.quality) {
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

    /**
     * Get appropriate MIME type for recording
     */
    getMimeType() {
        const recordingState = this.appState.getRecordingState();
        const format = recordingState.format;
        
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

    // ============================================================================
    // VISUALIZATION METHODS
    // ============================================================================

    /**
     * Initialize audio visualization canvas
     */
    initializeVisualization() {
        const canvas = UIHelpers.getElementById('audio-visualizer');
        if (!canvas) return;
        
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

    /**
     * Start audio visualization
     */
    startVisualization() {
        if (!this.analyser) return;
        
        const canvas = UIHelpers.getElementById('audio-visualizer');
        if (!canvas) return;
        
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

    /**
     * Stop audio visualization
     */
    stopVisualization() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Reset visualization
        this.initializeVisualization();
        
        // Reset audio level
        UIHelpers.setStyle('#audio-level-bar', 'width', '0%');
        UIHelpers.setText('#audio-level-text', '0%');
    }

    /**
     * Update audio level meter
     */
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
        UIHelpers.setStyle('#audio-level-bar', 'width', `${percentage}%`);
        UIHelpers.setText('#audio-level-text', `${percentage}%`);
    }

    // ============================================================================
    // AUTO-SAVE METHODS
    // ============================================================================

    /**
     * Initialize auto-save session
     */
    async initializeAutoSaveSession() {
        const recordingState = this.appState.getRecordingState();
        if (!recordingState.enableAutoSave) {
            console.log('Auto-save disabled');
            return;
        }

        try {
            const paths = await window.electronAPI.getAppPaths();
            this.recordingAutoSave.sessionId = `recording_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.recordingAutoSave.chunkIndex = 0;
            this.recordingAutoSave.savedChunks = [];
            
            // Store temp directory path
            this.recordingAutoSave.tempDirectory = paths.temp;
            
            console.log(`Auto-save session initialized: ${this.recordingAutoSave.sessionId}`);
        } catch (error) {
            console.error('Failed to initialize auto-save session:', error);
            // Disable auto-save if initialization fails
            this.appState.setRecordingState({ enableAutoSave: false });
        }
    }

    /**
     * Start auto-save timer
     */
    startAutoSaveTimer() {
        const recordingState = this.appState.getRecordingState();
        if (!recordingState.enableAutoSave) {
            return;
        }

        this.recordingAutoSave.autoSaveTimer = setInterval(async () => {
            try {
                await this.saveCurrentRecordingChunk();
            } catch (error) {
                console.error('Auto-save failed:', error);
            }
        }, recordingState.autoSaveInterval || 60000);

        console.log(`Auto-save timer started (interval: ${recordingState.autoSaveInterval || 60000}ms)`);
    }

    /**
     * Stop auto-save timer
     */
    stopAutoSaveTimer() {
        if (this.recordingAutoSave.autoSaveTimer) {
            clearInterval(this.recordingAutoSave.autoSaveTimer);
            this.recordingAutoSave.autoSaveTimer = null;
            console.log('Auto-save timer stopped');
        }
    }

    /**
     * Save current recording chunk
     */
    async saveCurrentRecordingChunk() {
        const recordingState = this.appState.getRecordingState();
        if (!recordingState.enableAutoSave || !this.audioChunks.length) {
            return;
        }

        try {
            // Create a blob from current chunks
            const chunkBlob = new Blob(this.audioChunks, { type: this.getMimeType() });
            const arrayBuffer = await chunkBlob.arrayBuffer();
            
            // Generate chunk filename
            const chunkFilename = `${this.recordingAutoSave.sessionId}_chunk_${this.recordingAutoSave.chunkIndex.toString().padStart(3, '0')}.webm`;
            
            // Save chunk using Electron API
            const result = await window.electronAPI.saveRecordingChunk(arrayBuffer, chunkFilename);
            
            if (result.success) {
                // Track saved chunk
                this.recordingAutoSave.savedChunks.push({
                    filename: chunkFilename,
                    path: result.path,
                    size: arrayBuffer.byteLength,
                    timestamp: Date.now(),
                    chunkIndex: this.recordingAutoSave.chunkIndex,
                    originalChunksCount: this.audioChunks.length
                });
                
                this.recordingAutoSave.chunkIndex++;
                
                // Clear processed chunks from memory
                this.audioChunks = [];
                
                // Update status to show auto-save progress
                this.statusController.updateStatus(`Recording... (Auto-saved ${this.recordingAutoSave.savedChunks.length} chunks)`);
            }
        } catch (error) {
            console.error('Failed to save recording chunk:', error);
            // Don't disable auto-save on single failure, just log it
        }
    }

    /**
     * Combine recording chunks with final audio
     */
    async combineRecordingChunks(finalAudioBlob) {
        const recordingState = this.appState.getRecordingState();
        if (!recordingState.enableAutoSave || this.recordingAutoSave.savedChunks.length === 0) {
            // Clean up any orphaned chunks
            await this.cleanupAutoSaveFiles();
            return finalAudioBlob;
        }

        try {
            console.log(`Combining ${this.recordingAutoSave.savedChunks.length} saved chunks with final recording`);
            
            const chunkBlobs = [];
            
            // Load all saved chunks
            for (const chunkInfo of this.recordingAutoSave.savedChunks) {
                try {
                    const chunkData = await window.electronAPI.loadRecordingChunk(chunkInfo.path);
                    if (chunkData) {
                        chunkBlobs.push(new Blob([chunkData], { type: this.getMimeType() }));
                    }
                } catch (error) {
                    console.error(`Failed to load chunk ${chunkInfo.filename}:`, error);
                }
            }
            
            // Add final recording blob
            chunkBlobs.push(finalAudioBlob);
            
            // Combine all blobs
            const combinedBlob = new Blob(chunkBlobs, { type: this.getMimeType() });
            
            // Clean up temporary files
            await this.cleanupAutoSaveFiles();
            
            return combinedBlob;
        } catch (error) {
            console.error('Error combining recording chunks:', error);
            return finalAudioBlob;
        }
    }

    /**
     * Clean up auto-save files
     */
    async cleanupAutoSaveFiles() {
        if (this.recordingAutoSave.savedChunks.length === 0) {
            return;
        }

        console.log(`Cleaning up ${this.recordingAutoSave.savedChunks.length} auto-save files`);
        
        const failedChunks = [];
        for (const chunkInfo of this.recordingAutoSave.savedChunks) {
            try {
                await window.electronAPI.deleteRecordingChunk(chunkInfo.path);
            } catch (error) {
                console.error(`Failed to delete chunk ${chunkInfo.filename}:`, error);
                failedChunks.push(chunkInfo);
            }
        }

        const deletedCount = this.recordingAutoSave.savedChunks.length - failedChunks.length;
        console.log(`Deleted ${deletedCount} chunks, ${failedChunks.length} failed`);

        if (failedChunks.length > 0) {
            console.warn('Some auto-save files could not be deleted:', failedChunks);
            this.recordingAutoSave.savedChunks = failedChunks;
        } else {
            // Reset auto-save state
            this.recordingAutoSave.savedChunks = [];
            this.recordingAutoSave.chunkIndex = 0;
            this.recordingAutoSave.sessionId = null;
        }
    }

    /**
     * Handle recording state changes from app state
     */
    handleRecordingStateChange(data) {
        // Update UI when recording state changes
        if (data.isRecording !== undefined || data.isPaused !== undefined) {
            this.updateRecordingUI();
        }
    }

    /**
     * Get current recording state
     */
    getCurrentState() {
        return {
            isRecording: this.isRecording,
            isPaused: this.isPaused,
            recordingBlob: this.recordingBlob,
            recordingStartTime: this.recordingStartTime
        };
    }

    /**
     * Reset recording state
     */
    reset() {
        // Stop recording if active
        if (this.isRecording) {
            this.stopRecording();
        }

        // Clean up state
        this.recordingBlob = null;
        this.isRecording = false;
        this.isPaused = false;
        this.recordingStartTime = null;

        // Update app state
        this.appState.setRecordingState({
            isRecording: false,
            isPaused: false,
            blob: null,
            startTime: null
        });

        // Update UI
        this.updateRecordingUI();
    }

    /**
     * Destroy the controller and clean up resources
     */
    destroy() {
        // Stop recording if active
        this.reset();

        // Clean up timers
        this.stopRecordingTimer();
        this.stopAutoSaveTimer();
        this.stopVisualization();

        // Clean up audio context
        if (this.audioContext) {
            this.audioContext.close();
        }

        console.log('RecordingController destroyed');
    }
}
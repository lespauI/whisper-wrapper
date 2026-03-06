/**
 * IPC Handlers - Handles communication between main and renderer processes
 */

const { ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const FileService = require('../services/fileService');
const TranscriptionService = require('../services/transcriptionService');
const RecordingService = require('../services/recordingService');
const TranscriptionStoreService = require('../services/transcriptionStoreService');
const config = require('../config');

class IPCHandlers {
    constructor(mainWindow = null) {
        this.mainWindow = mainWindow;
        this.fileService = new FileService();
        this.transcriptionService = new TranscriptionService();
        this.recordingService = new RecordingService();
        this.transcriptionStoreService = new TranscriptionStoreService();
        this.vadMetrics = null; // non-persistent in-memory snapshot
        this.setupHandlers();
    }

    setupHandlers() {
        // File dialog handlers
        ipcMain.handle('dialog:openFile', this.handleOpenFile.bind(this));
        ipcMain.handle('dialog:saveFile', this.handleSaveFile.bind(this));

        // Transcription handlers
        ipcMain.handle('transcription:file', this.handleTranscribeFile.bind(this));
        ipcMain.handle('transcription:audio', this.handleTranscribeAudio.bind(this));

        // Recording handlers
        ipcMain.handle('recording:start', this.handleStartRecording.bind(this));
        ipcMain.handle('recording:pause', this.handlePauseRecording.bind(this));
        ipcMain.handle('recording:resume', this.handleResumeRecording.bind(this));
        ipcMain.handle('recording:stop', this.handleStopRecording.bind(this));
        ipcMain.handle('recording:status', this.handleGetRecordingStatus.bind(this));
        ipcMain.handle('recording:settings', this.handleGetRecordingSettings.bind(this));
        ipcMain.handle('recording:updateSettings', this.handleUpdateRecordingSettings.bind(this));
        ipcMain.handle('recording:history', this.handleGetRecordingHistory.bind(this));
        ipcMain.handle('recording:constraints', this.handleGetRecordingConstraints.bind(this));
        // VAD metrics
        ipcMain.handle('recording:vadMetrics:get', this.handleGetVADMetrics.bind(this));
        ipcMain.handle('recording:vadMetrics:set', this.handleSetVADMetrics.bind(this));

        // Configuration handlers
        ipcMain.handle('config:get', this.handleGetConfig.bind(this));
        ipcMain.handle('config:set', this.handleSetConfig.bind(this));

        // App handlers
        ipcMain.handle('app:getPath', this.handleGetAppPath.bind(this));
        ipcMain.handle('app:getPaths', this.handleGetAppPaths.bind(this));
        ipcMain.handle('whisper:test', this.handleTestWhisper.bind(this));
        ipcMain.handle('app:openProjectDirectory', this.handleOpenProjectDirectory.bind(this));

        // Recording auto-save handlers
        ipcMain.handle('recording:saveChunk', this.handleSaveRecordingChunk.bind(this));
        ipcMain.handle('recording:loadChunk', this.handleLoadRecordingChunk.bind(this));
        ipcMain.handle('recording:deleteChunk', this.handleDeleteRecordingChunk.bind(this));
        ipcMain.handle('recording:findChunks', this.handleFindRecordingChunks.bind(this));

        // Model download handlers
        ipcMain.handle('model:download', this.handleDownloadModel.bind(this));
        ipcMain.handle('model:info', this.handleGetModelInfo.bind(this));

        // Transcription store handlers
        ipcMain.handle('transcriptions:store', this.handleTranscriptionsStore.bind(this));
        ipcMain.handle('transcriptions:list', this.handleTranscriptionsList.bind(this));
        ipcMain.handle('transcriptions:get', this.handleTranscriptionsGet.bind(this));
        ipcMain.handle('transcriptions:update', this.handleTranscriptionsUpdate.bind(this));
        ipcMain.handle('transcriptions:delete', this.handleTranscriptionsDelete.bind(this));
        ipcMain.handle('transcriptions:reindex', this.handleTranscriptionsReindex.bind(this));
    }

    async handleOpenFile() {
        try {
            const dialogOptions = {
                title: 'Select Audio or Video File',
                filters: [
                    {
                        name: 'Audio/Video Files',
                        extensions: ['mp3', 'wav', 'm4a', 'flac', 'ogg', 'mp4', 'mov', 'avi', 'mkv', 'webm']
                    },
                    {
                        name: 'Audio Files',
                        extensions: ['mp3', 'wav', 'm4a', 'flac', 'ogg']
                    },
                    {
                        name: 'Video Files',
                        extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm']
                    },
                    {
                        name: 'All Files',
                        extensions: ['*']
                    }
                ],
                properties: ['openFile']
            };

            // Add parent window if available to ensure proper modal behavior on macOS
            const result = this.mainWindow 
                ? await dialog.showOpenDialog(this.mainWindow, dialogOptions)
                : await dialog.showOpenDialog(dialogOptions);

            if (result.canceled) {
                return { canceled: true };
            }

            const filePath = result.filePaths[0];
            const fileInfo = this.fileService.getFileInfo(filePath);

            return {
                canceled: false,
                filePath,
                fileInfo
            };
        } catch (error) {
            console.error('Error opening file dialog:', error);
            throw new Error(`Failed to open file dialog: ${error.message}`);
        }
    }

    // VAD Metrics Handlers (non-persistent; for QA/devtools)
    async handleGetVADMetrics() {
        try {
            return this.vadMetrics || {};
        } catch (error) {
            console.error('Error getting VAD metrics:', error);
            return {};
        }
    }

    async handleSetVADMetrics(event, metrics) {
        try {
            if (metrics && typeof metrics === 'object') {
                this.vadMetrics = { ...metrics };
                // Small log for visibility in dev
                if (process.env.NODE_ENV !== 'production') {
                    console.log('Updated VAD metrics snapshot:', {
                        sessionId: this.vadMetrics.sessionId,
                        analyzedFrames: this.vadMetrics.analyzedFrames,
                        voicedFrames: this.vadMetrics.voicedFrames,
                        silentFrames: this.vadMetrics.silentFrames,
                        droppedChunks: this.vadMetrics.droppedChunks,
                        sentSegments: this.vadMetrics.sentSegments,
                        avgDecisionMs: this.vadMetrics.avgDecisionMs,
                        ambiguousDecisions: this.vadMetrics.ambiguousDecisions,
                    });
                }
                return { success: true };
            }
            return { success: false };
        } catch (error) {
            console.error('Error updating VAD metrics:', error);
            return { success: false };
        }
    }

    async handleSaveFile(event, content, defaultFilename = 'transcription.txt') {
        try {
            // Determine file type and filters based on filename
            const isAudioFile = defaultFilename.match(/\.(wav|webm|mp3|m4a)$/i);
            
            const filters = isAudioFile ? [
                {
                    name: 'Audio Files',
                    extensions: ['wav', 'webm', 'mp3', 'm4a']
                },
                {
                    name: 'All Files',
                    extensions: ['*']
                }
            ] : [
                {
                    name: 'Text Files',
                    extensions: ['txt']
                },
                {
                    name: 'Markdown Files',
                    extensions: ['md']
                },
                {
                    name: 'All Files',
                    extensions: ['*']
                }
            ];

            const dialogOptions = {
                title: isAudioFile ? 'Save Recording' : 'Save Transcription',
                defaultPath: defaultFilename,
                filters
            };

            // Add parent window if available to ensure proper modal behavior on macOS
            const result = this.mainWindow 
                ? await dialog.showSaveDialog(this.mainWindow, dialogOptions)
                : await dialog.showSaveDialog(dialogOptions);

            if (result.canceled) {
                return { canceled: true };
            }

            // Handle different content types
            if (content instanceof ArrayBuffer) {
                fs.writeFileSync(result.filePath, Buffer.from(content));
            } else if (Buffer.isBuffer(content)) {
                fs.writeFileSync(result.filePath, content);
            } else {
                fs.writeFileSync(result.filePath, content, 'utf8');
            }

            return {
                canceled: false,
                filePath: result.filePath
            };
        } catch (error) {
            console.error('Error saving file:', error);
            throw new Error(`Failed to save file: ${error.message}`);
        }
    }

    async handleTranscribeFile(event, filePath) {
        console.log('🎬 IPC: handleTranscribeFile called');
        console.log(`📁 File path: ${filePath}`);
        
        try {
            // Validate the file
            console.log('🔍 IPC: Validating file...');
            await this.fileService.validateFile(filePath);
            console.log('✅ IPC: File validation passed');

            // Get current configuration
            const currentConfig = config.getSimplified();
            console.log('⚙️ IPC: Current config:', currentConfig);

            // Check if local Whisper is available
            const isAvailable = this.transcriptionService.isAvailable();
            console.log(`🤖 IPC: Local Whisper available: ${isAvailable}`);
            
            if (!isAvailable) {
                console.log('❌ IPC: Local Whisper is not available');
                throw new Error('Local Whisper is not available. Please run the setup script first.');
            }

            // Set up transcription service with current config
            if (currentConfig.model) {
                console.log(`🎯 IPC: Setting model to: ${currentConfig.model}`);
                this.transcriptionService.setModel(currentConfig.model);
            }
            if (currentConfig.language) {
                console.log(`🌍 IPC: Setting language to: ${currentConfig.language}`);
                this.transcriptionService.setLanguage(currentConfig.language);
            }

            // Copy file to temp directory for processing
            console.log('📂 IPC: Copying file to temp directory...');
            const tempFilePath = await this.fileService.copyToTemp(filePath);
            console.log(`📂 IPC: Temp file created: ${tempFilePath}`);

            try {
                // Send progress update
                console.log('📡 IPC: Sending progress update - processing');
                event.sender.send('transcription:progress', { 
                    status: 'processing', 
                    message: 'Processing with local Whisper...' 
                });

                // Transcribe the file
                console.log('🎤 IPC: Starting transcription...');
                const transcriptionOptions = {
                    threads: currentConfig.threads || 4,
                    translate: currentConfig.translate || false
                };
                
                // Always pass both the useInitialPrompt flag and initialPrompt
                transcriptionOptions.useInitialPrompt = currentConfig.useInitialPrompt;
                if (currentConfig.initialPrompt) {
                    transcriptionOptions.initialPrompt = currentConfig.initialPrompt;
                    console.log(`🔤 IPC: Initial prompt ${currentConfig.useInitialPrompt ? 'ENABLED' : 'DISABLED'} (${currentConfig.initialPrompt.length} chars)`);
                }
                
                console.log('🎤 IPC: Transcription options:', transcriptionOptions);
                
                const result = await this.transcriptionService.transcribeFile(tempFilePath, transcriptionOptions);
                console.log('🎤 IPC: Transcription result:', {
                    success: result.success,
                    textLength: result.text?.length || 0,
                    language: result.language,
                    duration: result.duration
                });

                // Clean up temp file
                console.log('🗑️ IPC: Cleaning up temp file...');
                await this.fileService.cleanup(tempFilePath);
                console.log('✅ IPC: Temp file cleaned up');

                // Send completion update
                console.log('📡 IPC: Sending progress update - completed');
                event.sender.send('transcription:progress', { 
                    status: 'completed', 
                    message: 'Transcription completed successfully' 
                });

                const finalResult = {
                    success: true,
                    text: result.text,
                    language: result.language,
                    duration: result.duration,
                    segments: result.segments || []
                };

                this.transcriptionStoreService.store(result.text, {
                    sourceFile: path.basename(filePath),
                    language: result.language,
                    duration: result.duration,
                    model: currentConfig.model || ''
                }).catch(err => console.error('Failed to auto-store transcription:', err));

                console.log('🎉 IPC: handleTranscribeFile completed successfully!');
                return finalResult;

            } catch (transcriptionError) {
                console.log('❌ IPC: Transcription error occurred:', transcriptionError.message);
                // Clean up temp file on error
                await this.fileService.cleanup(tempFilePath);
                throw transcriptionError;
            }

        } catch (error) {
            console.error('❌ IPC: Error transcribing file:', error);
            console.error('❌ IPC: Error stack:', error.stack);
            
            // Send error update
            console.log('📡 IPC: Sending progress update - error');
            event.sender.send('transcription:progress', { 
                status: 'error', 
                message: error.message 
            });

            throw new Error(`Transcription failed: ${error.message}`);
        }
    }

    async handleTranscribeAudio(event, audioData, prompt = null) {
        try {
            // Get current configuration
            const currentConfig = config.getSimplified();

            // Check if local Whisper is available
            if (!this.transcriptionService.isAvailable()) {
                throw new Error('Local Whisper is not available. Please run the setup script first.');
            }

            // Set up transcription service with current config
            if (currentConfig.model) {
                this.transcriptionService.setModel(currentConfig.model);
            }
            if (currentConfig.language) {
                this.transcriptionService.setLanguage(currentConfig.language);
            }

            // Send progress update
            event.sender.send('transcription:progress', { 
                status: 'processing', 
                message: 'Processing recorded audio...' 
            });

            // Convert audio data to buffer if needed
            let audioBuffer;
            if (audioData instanceof ArrayBuffer) {
                audioBuffer = Buffer.from(audioData);
            } else if (Buffer.isBuffer(audioData)) {
                audioBuffer = audioData;
            } else {
                throw new Error('Invalid audio data format');
            }

            // Prepare transcription options
            const transcriptionOptions = {
                threads: currentConfig.threads || 4,
                translate: currentConfig.translate || false
            };
            
            // Always pass both the useInitialPrompt flag and initialPrompt
            transcriptionOptions.useInitialPrompt = currentConfig.useInitialPrompt;
            if (currentConfig.initialPrompt) {
                transcriptionOptions.initialPrompt = currentConfig.initialPrompt;
                console.log(`🔤 IPC: Initial prompt ${currentConfig.useInitialPrompt ? 'ENABLED' : 'DISABLED'} (${currentConfig.initialPrompt.length} chars)`);
            }
            
            // Add context prompt for ongoing transcription chunks
            if (prompt && prompt.trim()) {
                transcriptionOptions.contextPrompt = prompt.trim();
                console.log(`📝 IPC: Context prompt provided (${prompt.trim().length} chars): "${prompt.trim().substring(0, 100)}..."`);
            }
            
            // Transcribe the audio buffer
            const result = await this.transcriptionService.transcribeBuffer(
                audioBuffer,
                transcriptionOptions
            );

            // Send completion update
            event.sender.send('transcription:progress', { 
                status: 'completed', 
                message: 'Transcription completed successfully' 
            });

            this.transcriptionStoreService.store(result.text, {
                language: result.language,
                duration: result.duration,
                model: currentConfig.model || ''
            }).catch(err => console.error('Failed to auto-store transcription:', err));

            return {
                success: true,
                text: result.text,
                language: result.language,
                duration: result.duration,
                segments: result.segments || []
            };

        } catch (error) {
            console.error('Error transcribing audio:', error);
            
            // Send error update
            event.sender.send('transcription:progress', { 
                status: 'error', 
                message: error.message 
            });

            throw new Error(`Audio transcription failed: ${error.message}`);
        }
    }

    async handleGetConfig() {
        try {
            const base = config.getSimplified();
            // Extend with VAD + select recording keys needed by renderer
            const vad = typeof config.get === 'function' ? config.get('vad') : (config.vad || {});
            const silenceIndicator = typeof config.get === 'function' ? config.get('recording.silenceIndicator') : (config.recording && config.recording.silenceIndicator);
            return {
                ...base,
                vad,
                recording: {
                    silenceIndicator: silenceIndicator !== false
                }
            };
        } catch (error) {
            console.error('Error getting config:', error);
            return {};
        }
    }

    async handleSetConfig(event, newConfig) {
        try {
            // Test local Whisper if model is specified
            if (newConfig.model) {
                const testService = new TranscriptionService();
                const testResult = await testService.testConnection();
                
                if (!testResult.success) {
                    throw new Error(`Local Whisper test failed: ${testResult.message}`);
                }
                
                // Check if the specified model is available
                const availableModels = testService.getAvailableModels();
                const modelExists = availableModels.some(m => m.name === newConfig.model);
                
                if (!modelExists) {
                    // Check if it's a valid model name from the default configuration
                    const defaultConfig = require('../config/default');
                    const allModels = defaultConfig.whisper.availableModels || [];
                    const isValidModel = allModels.some(m => m.name === newConfig.model);
                    
                    if (!isValidModel) {
                        throw new Error(`Unknown model '${newConfig.model}'. Valid models: ${allModels.map(m => m.name).join(', ')}`);
                    }
                    
                    // Model is valid but not downloaded - return a special response
                    return {
                        success: false,
                        needsDownload: true,
                        modelName: newConfig.model,
                        message: `Model '${newConfig.model}' needs to be downloaded before use.`
                    };
                }
            }

            // Save configuration (basic Whisper-related fields)
            config.setSimplified(newConfig);

            // Persist VAD settings if provided
            if (newConfig.vad && typeof newConfig.vad === 'object') {
                try {
                    config.updateVADSettings(newConfig.vad);
                } catch (e) {
                    console.warn('Failed to update VAD settings:', e?.message);
                }
            }

            // Optionally allow updating recording-level flags (e.g., silenceIndicator)
            if (newConfig.recording && typeof newConfig.recording === 'object') {
                try {
                    if (Object.prototype.hasOwnProperty.call(newConfig.recording, 'silenceIndicator')) {
                        config.set('recording.silenceIndicator', !!newConfig.recording.silenceIndicator);
                    }
                } catch (e) {
                    console.warn('Failed to update recording settings:', e?.message);
                }
            }

            // Update TranscriptionService with new settings
            this.transcriptionService.updateSettings(newConfig);

            return { success: true };
        } catch (error) {
            console.error('Error setting config:', error);
            throw new Error(`Failed to save configuration: ${error.message}`);
        }
    }

    async handleGetAppPath() {
        try {
            const { app } = require('electron');
            return {
                userData: app.getPath('userData'),
                temp: app.getPath('temp'),
                documents: app.getPath('documents')
            };
        } catch (error) {
            console.error('Error getting app paths:', error);
            return {};
        }
    }

    async handleTestWhisper() {
        try {
            const testResult = await this.transcriptionService.testConnection();
            return testResult;
        } catch (error) {
            console.error('Error testing Whisper:', error);
            return {
                success: false,
                message: `Test failed: ${error.message}`
            };
        }
    }

    async handleOpenProjectDirectory() {
        try {
            const { shell } = require('electron');
            await shell.openPath(process.cwd());
            return { success: true };
        } catch (error) {
            console.error('Error opening project directory:', error);
            throw new Error(`Failed to open project directory: ${error.message}`);
        }
    }

    // Recording Handlers

    async handleStartRecording(event, options = {}) {
        try {
            const result = await this.recordingService.startRecording(options);
            console.log('Recording started via IPC:', result.recordingId);
            return result;
        } catch (error) {
            console.error('Error starting recording:', error);
            throw new Error(`Failed to start recording: ${error.message}`);
        }
    }

    async handlePauseRecording() {
        try {
            const result = await this.recordingService.pauseRecording();
            console.log('Recording paused via IPC:', result.recordingId);
            return result;
        } catch (error) {
            console.error('Error pausing recording:', error);
            throw new Error(`Failed to pause recording: ${error.message}`);
        }
    }

    async handleResumeRecording() {
        try {
            const result = await this.recordingService.resumeRecording();
            console.log('Recording resumed via IPC:', result.recordingId);
            return result;
        } catch (error) {
            console.error('Error resuming recording:', error);
            throw new Error(`Failed to resume recording: ${error.message}`);
        }
    }

    async handleStopRecording(event, audioData = null) {
        try {
            const result = await this.recordingService.stopRecording(audioData);
            console.log('Recording stopped via IPC:', result.recording.id);
            return result;
        } catch (error) {
            console.error('Error stopping recording:', error);
            throw new Error(`Failed to stop recording: ${error.message}`);
        }
    }

    async handleGetRecordingStatus() {
        try {
            return this.recordingService.getStatus();
        } catch (error) {
            console.error('Error getting recording status:', error);
            throw new Error(`Failed to get recording status: ${error.message}`);
        }
    }

    async handleGetRecordingSettings() {
        try {
            return this.recordingService.getSettings();
        } catch (error) {
            console.error('Error getting recording settings:', error);
            throw new Error(`Failed to get recording settings: ${error.message}`);
        }
    }

    async handleUpdateRecordingSettings(event, newSettings) {
        try {
            const result = this.recordingService.updateSettings(newSettings);
            console.log('Recording settings updated via IPC:', result);
            return { success: true, settings: result };
        } catch (error) {
            console.error('Error updating recording settings:', error);
            throw new Error(`Failed to update recording settings: ${error.message}`);
        }
    }

    async handleGetRecordingHistory() {
        try {
            return this.recordingService.getRecordingHistory();
        } catch (error) {
            console.error('Error getting recording history:', error);
            throw new Error(`Failed to get recording history: ${error.message}`);
        }
    }

    async handleGetRecordingConstraints() {
        try {
            return this.recordingService.getRecordingConstraints();
        } catch (error) {
            console.error('Error getting recording constraints:', error);
            throw new Error(`Failed to get recording constraints: ${error.message}`);
        }
    }

    // Model Download Handlers

    async handleDownloadModel(event, modelName) {
        try {
            console.log(`📥 Starting download for model: ${modelName}`);
            
            const result = await this.transcriptionService.downloadModel(modelName, (progress) => {
                // Send progress updates to the renderer
                event.sender.send('model:download:progress', {
                    modelName: progress.modelName,
                    progress: progress.progress,
                    downloadedSize: progress.downloadedSize,
                    totalSize: progress.totalSize
                });
            });
            
            console.log(`✅ Model download completed: ${modelName}`);
            return result;
        } catch (error) {
            console.error('Error downloading model:', error);
            throw new Error(`Failed to download model: ${error.message}`);
        }
    }

    async handleGetModelInfo(event, modelName) {
        try {
            return this.transcriptionService.getModelInfo(modelName);
        } catch (error) {
            console.error('Error getting model info:', error);
            throw new Error(`Failed to get model info: ${error.message}`);
        }
    }

    async handleGetAppPaths() {
        try {
            const { app } = require('electron');
            return {
                userData: app.getPath('userData'),
                temp: app.getPath('temp'),
                documents: app.getPath('documents')
            };
        } catch (error) {
            console.error('Error getting app paths:', error);
            return {};
        }
    }

    async handleSaveRecordingChunk(event, audioData, filename) {
        try {
            const { app } = require('electron');
            const tempDir = app.getPath('temp');
            const chunkPath = path.join(tempDir, 'whisper-wrapper-recordings', filename);
            
            // Ensure directory exists
            const dir = path.dirname(chunkPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Convert ArrayBuffer to Buffer if needed
            let buffer;
            if (audioData instanceof ArrayBuffer) {
                buffer = Buffer.from(audioData);
            } else if (Buffer.isBuffer(audioData)) {
                buffer = audioData;
            } else {
                throw new Error('Invalid audio data format');
            }

            // Write file
            fs.writeFileSync(chunkPath, buffer);
            const stats = fs.statSync(chunkPath);
            
            console.log(`Saved recording chunk: ${filename} (${stats.size} bytes)`);
            
            return {
                success: true,
                filePath: chunkPath,
                size: stats.size,
                savedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error saving recording chunk:', error);
            throw new Error(`Failed to save recording chunk: ${error.message}`);
        }
    }

    async handleLoadRecordingChunk(event, filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error('Recording chunk file not found');
            }

            const buffer = fs.readFileSync(filePath);
            console.log(`Loaded recording chunk: ${path.basename(filePath)} (${buffer.length} bytes)`);
            
            return buffer;
        } catch (error) {
            console.error('Error loading recording chunk:', error);
            throw new Error(`Failed to load recording chunk: ${error.message}`);
        }
    }

    async handleDeleteRecordingChunk(event, filePath) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`Deleted recording chunk: ${path.basename(filePath)}`);
            }
            
            return { success: true };
        } catch (error) {
            console.error('Error deleting recording chunk:', error);
            throw new Error(`Failed to delete recording chunk: ${error.message}`);
        }
    }

    async handleFindRecordingChunks(event, sessionId) {
        try {
            const { app } = require('electron');
            const tempDir = app.getPath('temp');
            const recordingsDir = path.join(tempDir, 'whisper-wrapper-recordings');
            
            if (!fs.existsSync(recordingsDir)) {
                return [];
            }

            const files = fs.readdirSync(recordingsDir);
            const sessionChunks = files
                .filter(file => file.startsWith(sessionId) && file.includes('_chunk_'))
                .sort() // Sort to maintain chunk order
                .map(file => path.join(recordingsDir, file));
            
            console.log(`Found ${sessionChunks.length} chunks for session ${sessionId}`);
            return sessionChunks;
        } catch (error) {
            console.error('Error finding recording chunks:', error);
            return [];
        }
    }

    // Transcription Store Handlers

    async handleTranscriptionsStore(event, { text, metadata } = {}) {
        try {
            const entry = await this.transcriptionStoreService.store(text, metadata || {});
            return { success: true, entry };
        } catch (error) {
            console.error('Error storing transcription:', error);
            return { success: false, error: error.message };
        }
    }

    async handleTranscriptionsList(event, filters = {}) {
        try {
            const entries = this.transcriptionStoreService.list(filters);
            return { entries };
        } catch (error) {
            console.error('Error listing transcriptions:', error);
            return { entries: [] };
        }
    }

    async handleTranscriptionsGet(event, { id } = {}) {
        try {
            const result = await this.transcriptionStoreService.get(id);
            return result || { entry: null, text: '' };
        } catch (error) {
            console.error('Error getting transcription:', error);
            return { entry: null, text: '' };
        }
    }

    async handleTranscriptionsUpdate(event, { id, changes } = {}) {
        if (!id || typeof id !== 'string') return { success: false, error: 'Invalid id' };
        if (!changes || typeof changes !== 'object') return { success: false, error: 'Invalid changes' };
        const allowedKeys = new Set(['title', 'labels']);
        const sanitized = {};
        for (const key of Object.keys(changes)) {
            if (allowedKeys.has(key)) sanitized[key] = changes[key];
        }
        try {
            const entry = await this.transcriptionStoreService.update(id, sanitized);
            if (!entry) return { success: false, error: 'Not found' };
            return { success: true, entry };
        } catch (error) {
            console.error('Error updating transcription:', error);
            return { success: false, error: error.message };
        }
    }

    async handleTranscriptionsDelete(event, { id } = {}) {
        try {
            const deleted = await this.transcriptionStoreService.delete(id);
            return { success: deleted };
        } catch (error) {
            console.error('Error deleting transcription:', error);
            return { success: false, error: error.message };
        }
    }

    async handleTranscriptionsReindex() {
        try {
            const count = await this.transcriptionStoreService.reindex();
            return { count };
        } catch (error) {
            console.error('Error reindexing transcriptions:', error);
            return { count: 0, error: error.message };
        }
    }
}

module.exports = IPCHandlers;

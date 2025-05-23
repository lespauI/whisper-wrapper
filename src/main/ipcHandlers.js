/**
 * IPC Handlers - Handles communication between main and renderer processes
 */

const { ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const FileService = require('../services/fileService');
const TranscriptionService = require('../services/transcriptionService');
const RecordingService = require('../services/recordingService');
const config = require('../config');

class IPCHandlers {
    constructor() {
        this.fileService = new FileService();
        this.transcriptionService = new TranscriptionService();
        this.recordingService = new RecordingService();
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

        // Configuration handlers
        ipcMain.handle('config:get', this.handleGetConfig.bind(this));
        ipcMain.handle('config:set', this.handleSetConfig.bind(this));

        // App handlers
        ipcMain.handle('app:getPath', this.handleGetAppPath.bind(this));
        ipcMain.handle('whisper:test', this.handleTestWhisper.bind(this));
        ipcMain.handle('app:openProjectDirectory', this.handleOpenProjectDirectory.bind(this));
    }

    async handleOpenFile() {
        try {
            const result = await dialog.showOpenDialog({
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
            });

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

            const result = await dialog.showSaveDialog({
                title: isAudioFile ? 'Save Recording' : 'Save Transcription',
                defaultPath: defaultFilename,
                filters
            });

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
        try {
            // Validate the file
            await this.fileService.validateFile(filePath);

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

            // Copy file to temp directory for processing
            const tempFilePath = await this.fileService.copyToTemp(filePath);

            try {
                // Send progress update
                event.sender.send('transcription:progress', { 
                    status: 'processing', 
                    message: 'Processing with local Whisper...' 
                });

                // Transcribe the file
                const result = await this.transcriptionService.transcribeFile(tempFilePath, {
                    threads: currentConfig.threads || 4,
                    translate: currentConfig.translate || false
                });

                // Clean up temp file
                await this.fileService.cleanup(tempFilePath);

                // Send completion update
                event.sender.send('transcription:progress', { 
                    status: 'completed', 
                    message: 'Transcription completed successfully' 
                });

                return {
                    success: true,
                    text: result.text,
                    language: result.language,
                    duration: result.duration
                };

            } catch (transcriptionError) {
                // Clean up temp file on error
                await this.fileService.cleanup(tempFilePath);
                throw transcriptionError;
            }

        } catch (error) {
            console.error('Error transcribing file:', error);
            
            // Send error update
            event.sender.send('transcription:progress', { 
                status: 'error', 
                message: error.message 
            });

            throw new Error(`Transcription failed: ${error.message}`);
        }
    }

    async handleTranscribeAudio(event, audioData) {
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

            // Transcribe the audio buffer
            const result = await this.transcriptionService.transcribeBuffer(
                audioBuffer,
                {
                    threads: currentConfig.threads || 4,
                    translate: currentConfig.translate || false
                }
            );

            // Send completion update
            event.sender.send('transcription:progress', { 
                status: 'completed', 
                message: 'Transcription completed successfully' 
            });

            return {
                success: true,
                text: result.text,
                language: result.language,
                duration: result.duration
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
            return config.getSimplified();
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
                    throw new Error(`Model '${newConfig.model}' not found. Available models: ${availableModels.map(m => m.name).join(', ')}`);
                }
            }

            // Save configuration
            config.setSimplified(newConfig);

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
}

module.exports = IPCHandlers;
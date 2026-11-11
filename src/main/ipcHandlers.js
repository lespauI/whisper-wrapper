/**
 * IPC Handlers - Handles communication between main and renderer processes
 */

const { ipcMain, dialog, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const FileService = require('../services/fileService');
const TranscriptionService = require('../services/transcriptionService');
const RecordingService = require('../services/recordingService');
const TranscriptionStoreService = require('../services/transcriptionStoreService');
const MeetingNotesService = require('../services/meetingNotesService');
const config = require('../config');

const MAX_RECORDING_CHUNK_BYTES = 100 * 1024 * 1024;
const RECORDING_SESSION_ID = /^recording_\d{10,16}_[a-z0-9]{1,16}$/;
const RECORDING_CHUNK_FILENAME = /^(recording_\d{10,16}_[a-z0-9]{1,16})_chunk_(\d{3,8})\.(webm|wav|m4a)$/;
const SAFE_OBJECT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

class IPCHandlers {
    constructor(mainWindow = null) {
        this.mainWindow = mainWindow;
        this.activeTranscriptions = new Map();
        this.recordingSessions = new Map();
        this.fileService = new FileService();
        this.transcriptionService = new TranscriptionService();
        this.recordingService = new RecordingService();
        this.transcriptionStoreService = new TranscriptionStoreService();
        this.meetingNotesService = new MeetingNotesService();
        this.vadMetrics = null; // non-persistent in-memory snapshot
        this.setupHandlers();
    }

    setupHandlers() {
        // File dialog handlers
        ipcMain.handle('dialog:openFile', this.handleOpenFile.bind(this));
        ipcMain.handle('dialog:saveFile', this.handleSaveFile.bind(this));

        // Transcription handlers
        ipcMain.handle('transcription:file', (event, filePath) =>
            this.runTranscription(event, signal => this.handleTranscribeFile(event, filePath, signal)));
        ipcMain.handle('transcription:audio', (event, audioData, prompt = null, options = {}) =>
            this.runTranscription(event, signal => this.handleTranscribeAudio(event, audioData, prompt, options, signal)));
        ipcMain.handle('transcription:resume', (event, historyId) =>
            this.runTranscription(event, signal => this.handleResumeTranscription(event, historyId, signal)));
        ipcMain.handle('transcription:cancel', this.handleCancelTranscription.bind(this));

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
        ipcMain.handle('recording:startChunkSession', this.handleStartRecordingChunkSession.bind(this));

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
        ipcMain.handle('transcriptions:regenerateMeta', this.handleTranscriptionsRegenerateMeta.bind(this));

        // Audio source handlers
        ipcMain.handle('recording:getAudioSources', this.handleGetAudioSources.bind(this));

        // GPU backend detection
        ipcMain.handle('whisper:detectGpuBackend', this.handleDetectGpuBackend.bind(this));

        // Meeting notes handlers
        ipcMain.handle('meetingNotes:getConfig', this.handleMeetingNotesGetConfig.bind(this));
        ipcMain.handle('meetingNotes:saveConfig', this.handleMeetingNotesSaveConfig.bind(this));
        ipcMain.handle('meetingNotes:generate', this.handleMeetingNotesGenerate.bind(this));
        ipcMain.handle('meetingNotes:get', this.handleMeetingNotesGet.bind(this));
        ipcMain.handle('meetingNotes:delete', this.handleMeetingNotesDelete.bind(this));
        ipcMain.handle('meetingNotes:hasNotes', this.handleMeetingNotesHasNotes.bind(this));
        ipcMain.handle('meetingNotes:getTemplates', this.handleMeetingNotesGetTemplates.bind(this));
        ipcMain.handle('meetingNotes:createTemplate', this.handleMeetingNotesCreateTemplate.bind(this));
        ipcMain.handle('meetingNotes:updateTemplate', this.handleMeetingNotesUpdateTemplate.bind(this));
        ipcMain.handle('meetingNotes:deleteTemplate', this.handleMeetingNotesDeleteTemplate.bind(this));

        // Audio file reading for playback
        ipcMain.handle('audio:readFile', this.handleAudioReadFile.bind(this));
    }

    _assertTrustedRenderer(event) {
        if (!event || !event.sender) return;

        const webContents = this.mainWindow && this.mainWindow.webContents;
        if (!webContents || event.sender !== webContents || event.senderFrame !== webContents.mainFrame ||
            (typeof webContents.isDestroyed === 'function' && webContents.isDestroyed())) {
            throw new Error('Access denied: untrusted renderer');
        }
    }

    _writeFileNoFollow(filePath, content) {
        try {
            const existing = fs.lstatSync(filePath);
            if (existing.isSymbolicLink() || !existing.isFile() || (typeof process.getuid === 'function' && existing.uid !== process.getuid())) {
                throw new Error('Refusing to write to an unowned or non-regular file');
            }
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }

        const noFollow = fs.constants.O_NOFOLLOW || 0;
        const descriptor = fs.openSync(
            filePath,
            fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | noFollow,
            0o600
        );
        try {
            const opened = fs.fstatSync(descriptor);
            if (!opened.isFile() || (typeof process.getuid === 'function' && opened.uid !== process.getuid())) {
                throw new Error('Refusing to write to an unowned or non-regular file');
            }
            fs.writeFileSync(descriptor, content);
        } finally {
            fs.closeSync(descriptor);
        }
    }

    _readFileNoFollow(filePath, maxBytes) {
        const noFollow = fs.constants.O_NOFOLLOW || 0;
        const descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | noFollow);
        try {
            const opened = fs.fstatSync(descriptor);
            if (!opened.isFile() || (typeof process.getuid === 'function' && opened.uid !== process.getuid())) {
                throw new Error('Refusing to read an unowned or non-regular file');
            }
            if (opened.size > maxBytes) throw new Error('Recording chunk is too large');
            return fs.readFileSync(descriptor);
        } finally {
            fs.closeSync(descriptor);
        }
    }

    _getRecordingsDirectory(create = false) {
        const { app } = require('electron');
        const tempDir = fs.realpathSync(app.getPath('temp'));
        const recordingsDir = path.join(tempDir, 'whisper-wrapper-recordings');
        if (create && !fs.existsSync(recordingsDir)) {
            fs.mkdirSync(recordingsDir, { recursive: true, mode: 0o700 });
        }

        let stats;
        try {
            stats = fs.lstatSync(recordingsDir);
        } catch (error) {
            if (error.code === 'ENOENT' && !create) return null;
            throw error;
        }
        if (stats.isSymbolicLink() || !stats.isDirectory() || (typeof process.getuid === 'function' && stats.uid !== process.getuid())) {
            throw new Error('Recording storage directory is not trusted');
        }
        if (fs.realpathSync(recordingsDir) !== recordingsDir) {
            throw new Error('Recording storage directory resolves outside its allowed location');
        }
        fs.chmodSync(recordingsDir, 0o700);
        return recordingsDir;
    }

    _resolveRecordingChunkPath(filePath) {
        if (typeof filePath !== 'string' || filePath.length > 4096) {
            throw new Error('Invalid recording chunk path');
        }
        const recordingsDir = this._getRecordingsDirectory();
        if (!recordingsDir) return null;
        const resolved = path.resolve(filePath);
        const filename = path.basename(resolved);
        if (path.dirname(resolved) !== recordingsDir || !RECORDING_CHUNK_FILENAME.test(filename)) {
            throw new Error('Recording chunk path is outside the allowed storage');
        }
        return path.join(recordingsDir, filename);
    }

    _assertRecordingChunkFile(filePath) {
        const stats = fs.lstatSync(filePath);
        if (stats.isSymbolicLink() || !stats.isFile() || (typeof process.getuid === 'function' && stats.uid !== process.getuid())) {
            throw new Error('Recording chunk is not an owned regular file');
        }
        if (fs.realpathSync(filePath) !== filePath) {
            throw new Error('Recording chunk resolves outside the allowed storage');
        }
        return stats;
    }

    _validateNotesId(id) {
        return typeof id === 'string' && SAFE_OBJECT_ID.test(id);
    }

    _getRecordingSessionOwner(event) {
        if (!event || !event.sender) throw new Error('Recording session owner is missing');
        return event.sender.id === undefined ? event.sender : event.sender.id;
    }

    _requireRecordingSession(event, sessionId) {
        this._assertTrustedRenderer(event);
        if (typeof sessionId !== 'string' || !RECORDING_SESSION_ID.test(sessionId)) {
            throw new Error('Invalid recording session id');
        }
        const session = this.recordingSessions.get(sessionId);
        if (!session || session.owner !== this._getRecordingSessionOwner(event)) {
            throw new Error('Recording session is not authorized for this renderer');
        }
        return session;
    }

    _requireRecordingChunk(event, filePath) {
        const chunkPath = this._resolveRecordingChunkPath(filePath);
        if (!chunkPath) throw new Error('Recording chunk file not found');
        const filename = path.basename(chunkPath);
        const match = filename.match(RECORDING_CHUNK_FILENAME);
        const session = this._requireRecordingSession(event, match[1]);
        if (!session.filenames.has(filename)) {
            throw new Error('Recording chunk is not authorized for this session');
        }
        return { chunkPath, filename, session };
    }

    async handleStartRecordingChunkSession(event) {
        try {
            this._assertTrustedRenderer(event);
            const owner = this._getRecordingSessionOwner(event);
            let sessionId;
            do {
                sessionId = `recording_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
            } while (this.recordingSessions.has(sessionId));
            this.recordingSessions.set(sessionId, { owner, filenames: new Set() });
            return { success: true, sessionId };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async _getOwnedTranscription(event, transcriptionId) {
        this._assertTrustedRenderer(event);
        if (!this._validateNotesId(transcriptionId)) return null;
        const result = await this.transcriptionStoreService.get(transcriptionId);
        if (!result || !result.entry || result.entry.id !== transcriptionId || typeof result.text !== 'string') return null;
        if (Buffer.byteLength(result.text, 'utf8') > 10 * 1024 * 1024) return null;
        return result;
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
            this._assertTrustedRenderer(event);
            if (typeof defaultFilename !== 'string' || defaultFilename.length > 255 ||
                defaultFilename.includes('/') || defaultFilename.includes('\\') ||
                Array.from(defaultFilename).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
                throw new Error('Invalid default filename');
            }

            let fileContent;
            if (content instanceof ArrayBuffer) {
                fileContent = Buffer.from(content);
            } else if (Buffer.isBuffer(content)) {
                fileContent = content;
            } else if (typeof content === 'string') {
                fileContent = content;
            } else {
                throw new Error('Invalid file content format');
            }

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
            if (typeof result.filePath !== 'string' || result.filePath.length > 4096) {
                throw new Error('Invalid destination file path');
            }
            this._writeFileNoFollow(result.filePath, fileContent);

            return {
                canceled: false,
                filePath: result.filePath
            };
        } catch (error) {
            console.error('Error saving file:', error);
            throw new Error(`Failed to save file: ${error.message}`);
        }
    }

    async runTranscription(event, task) {
        const owner = event.sender;
        const pending = this.activeTranscriptions.get(owner) || new Set();
        const previous = Array.from(pending).pop();
        const operation = { controller: new AbortController() };
        pending.add(operation);
        this.activeTranscriptions.set(owner, pending);
        operation.done = (async () => {
            try {
                if (previous) await previous.done.catch(() => undefined);
                if (operation.controller.signal.aborted) return { success: false, canceled: true };
                return await task(operation.controller.signal);
            } catch (error) {
                if (operation.controller.signal.aborted && !error.preserveError) return { success: false, canceled: true };
                throw error;
            } finally {
                pending.delete(operation);
                if (pending.size === 0) this.activeTranscriptions.delete(owner);
            }
        })();
        return operation.done;
    }

    handleCancelTranscription(event) {
        const pending = this.activeTranscriptions.get(event.sender);
        if (pending) {
            for (const operation of pending) operation.controller.abort();
        }
        return { success: true, canceled: !!pending?.size };
    }

    async handleTranscribeFile(event, filePath, signal) {
        console.log('🎬 IPC: handleTranscribeFile called');
        console.log(`📁 File path: ${filePath}`);
        
        try {
            // Validate the file
            console.log('🔍 IPC: Validating file...');
            await this.fileService.validateFile(filePath);
            if (signal?.aborted) throw new Error('Transcription canceled');
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
                if (signal?.aborted) throw new Error('Transcription canceled');
                // Send progress update
                console.log('📡 IPC: Sending progress update - processing');
                event.sender.send('transcription:progress', { 
                    status: 'processing', 
                    message: 'Processing with local Whisper...' 
                });

                // Transcribe the file
                console.log('🎤 IPC: Starting transcription...');
                const transcriptionOptions = {
                    signal,
                    threads: currentConfig.threads || 4,
                    translate: currentConfig.translate || false,
                    useGpu: currentConfig.useGpu !== undefined ? currentConfig.useGpu : true,
                    flashAttn: currentConfig.flashAttn !== undefined ? currentConfig.flashAttn : true,
                    gpuDevice: currentConfig.gpuDevice || 0
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

                const finalResult = {
                    success: true,
                    status: result.partial === true || result.status === 'partial' ? 'partial' : 'complete',
                    partial: result.partial === true || result.status === 'partial',
                    issues: Array.isArray(result.issues) ? result.issues : [],
                    resumeId: result.resumeId || null,
                    text: result.text,
                    language: result.language,
                    duration: result.duration,
                    audioDurationSeconds: result.audioDurationSeconds,
                    processingDurationMs: result.processingDurationMs,
                    segments: result.segments || [],
                    audioFilePath: filePath
                };

                let entry;
                try {
                    entry = await this.transcriptionStoreService.store(result.text, {
                        sourceFile: path.basename(filePath),
                        audioFilePath: filePath,
                        language: result.language,
                        duration: result.duration,
                        audioDurationSeconds: result.audioDurationSeconds,
                        processingDurationMs: result.processingDurationMs,
                        model: currentConfig.model || '',
                        status: finalResult.status,
                        partial: finalResult.partial,
                        issues: finalResult.issues,
                        resumeId: finalResult.partial ? finalResult.resumeId : null
                    });
                } catch (error) {
                    error.preserveError = true;
                    throw error;
                }
                if (entry?.id) finalResult.historyId = entry.id;

                try {
                    await this.fileService.cleanup(tempFilePath);
                } catch (error) {
                    finalResult.cleanupPending = true;
                    finalResult.cleanupError = error.message;
                }

                if (!finalResult.partial && finalResult.resumeId && this.transcriptionService.finalizeTranscription) {
                    try {
                        await this.finalizeResumeJobIfUnreferenced(finalResult.resumeId, entry?.id);
                    } catch (error) {
                        finalResult.cleanupPending = true;
                        finalResult.cleanupError = error.message;
                    }
                }

                event.sender.send('transcription:progress', {
                    status: finalResult.partial ? 'partial' : 'completed',
                    message: finalResult.partial
                        ? 'Transcription completed with audio requiring review'
                        : 'Transcription completed successfully'
                });

                console.log('🎉 IPC: handleTranscribeFile completed successfully!');
                return finalResult;

            } catch (transcriptionError) {
                console.log('❌ IPC: Transcription error occurred:', transcriptionError.message);
                try {
                    await this.fileService.cleanup(tempFilePath);
                } catch (cleanupError) {
                    transcriptionError.cleanupError = cleanupError;
                }
                throw transcriptionError;
            }

        } catch (error) {
            if (signal?.aborted && !error.preserveError) return { success: false, canceled: true };
            console.error('❌ IPC: Error transcribing file:', error);
            console.error('❌ IPC: Error stack:', error.stack);
            
            // Send error update
            console.log('📡 IPC: Sending progress update - error');
            event.sender.send('transcription:progress', { 
                status: 'error', 
                message: error.message 
            });

            const wrappedError = new Error(`Transcription failed: ${error.message}`);
            wrappedError.preserveError = error.preserveError;
            wrappedError.cleanupError = error.cleanupError;
            throw wrappedError;
        }
    }

    async handleTranscribeAudio(event, audioData, prompt = null, options = {}, signal) {
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
                signal,
                persistSourceAudio: !(options && typeof options === 'object' && options.skipStore === true),
                threads: currentConfig.threads || 4,
                translate: currentConfig.translate || false,
                useGpu: currentConfig.useGpu !== undefined ? currentConfig.useGpu : true,
                flashAttn: currentConfig.flashAttn !== undefined ? currentConfig.flashAttn : true,
                gpuDevice: currentConfig.gpuDevice || 0
            };
            
            transcriptionOptions.useInitialPrompt = currentConfig.useInitialPrompt;
            if (currentConfig.initialPrompt) {
                transcriptionOptions.initialPrompt = currentConfig.initialPrompt;
                console.log(`🔤 IPC: Initial prompt ${currentConfig.useInitialPrompt ? 'ENABLED' : 'DISABLED'} (${currentConfig.initialPrompt.length} chars)`);
            }
            
            if (prompt && prompt.trim()) {
                transcriptionOptions.contextPrompt = prompt.trim();
                console.log(`📝 IPC: Context prompt provided (${prompt.trim().length} chars): "${prompt.trim().substring(0, 100)}..."`);
            }
            
            // Transcribe the audio buffer
            const skipStore = !!(options && typeof options === 'object' && options.skipStore === true);
            const result = await this.transcriptionService.transcribeBuffer(
                audioBuffer,
                transcriptionOptions
            );

            const partial = result.partial === true || result.status === 'partial';
            const issues = Array.isArray(result.issues) ? result.issues : [];
            const resumeId = result.resumeId || null;
            let historyId;
            if (!skipStore) {
                try {
                    const entry = await this.transcriptionStoreService.store(result.text, {
                        language: result.language,
                        duration: result.duration,
                        audioDurationSeconds: result.audioDurationSeconds,
                        processingDurationMs: result.processingDurationMs,
                        model: currentConfig.model || '',
                        status: partial ? 'partial' : 'complete',
                        partial,
                        issues,
                        resumeId: partial ? resumeId : null
                    });
                    historyId = entry?.id;
                } catch (error) {
                    error.preserveError = true;
                    throw error;
                }
            }

            if (!partial && resumeId && this.transcriptionService.finalizeTranscription) {
                try {
                    await this.finalizeResumeJobIfUnreferenced(resumeId, historyId);
                } catch (error) {
                    console.error('Failed to remove completed transcription checkpoints:', error);
                }
            }

            event.sender.send('transcription:progress', {
                status: partial ? 'partial' : 'completed',
                message: partial
                    ? 'Transcription completed with audio requiring review'
                    : 'Transcription completed successfully'
            });

            return {
                success: true,
                status: partial ? 'partial' : 'complete',
                partial,
                issues,
                resumeId,
                historyId,
                text: result.text,
                language: result.language,
                duration: result.duration,
                audioDurationSeconds: result.audioDurationSeconds,
                processingDurationMs: result.processingDurationMs,
                segments: result.segments || []
            };

        } catch (error) {
            if (signal?.aborted && !error.preserveError) return { success: false, canceled: true };
            console.error('Error transcribing audio:', error);
            
            // Send error update
            event.sender.send('transcription:progress', { 
                status: 'error', 
                message: error.message 
            });

            const wrappedError = new Error(`Audio transcription failed: ${error.message}`);
            wrappedError.preserveError = error.preserveError;
            throw wrappedError;
        }
    }

    async handleResumeTranscription(event, historyId, signal) {
        if (typeof historyId !== 'string' || !historyId) {
            throw new Error('Invalid partial transcription history id');
        }
        const entry = this.transcriptionStoreService.list().find(item =>
            item.id === historyId && item.partial === true && typeof item.resumeId === 'string' && item.resumeId);
        if (!entry) throw new Error('Partial transcription was not found in history');
        const resumeId = entry.resumeId;

        event.sender.send('transcription:progress', {
            status: 'processing',
            message: 'Resuming transcription from saved audio...'
        });
        const result = await this.transcriptionService.resumeTranscription(resumeId, { signal });
        const partial = result.partial === true || result.status === 'partial';
        const issues = Array.isArray(result.issues) ? result.issues : [];
        const resultResumeId = partial ? (result.resumeId || resumeId) : null;
        const updatedEntry = await this.transcriptionStoreService.updateResult(entry.id, result.text, {
            language: result.language,
            duration: result.duration,
            audioDurationSeconds: result.audioDurationSeconds,
            processingDurationMs: result.processingDurationMs,
            model: result.model,
            status: partial ? 'partial' : 'complete',
            partial,
            issues,
            resumeId: resultResumeId
        });
        if (!updatedEntry) throw new Error('Partial transcription history entry was not found');

        let cleanupPending = false;
        let cleanupError = null;
        const jobsToClean = new Set();
        if (resumeId !== resultResumeId) jobsToClean.add(resumeId);
        if (!partial && result.resumeId) jobsToClean.add(result.resumeId);
        if (this.transcriptionService.finalizeTranscription) {
            for (const jobId of jobsToClean) {
                try {
                    await this.finalizeResumeJobIfUnreferenced(jobId, updatedEntry.id);
                } catch (error) {
                    cleanupPending = true;
                    cleanupError = error.message;
                }
            }
        }
        event.sender.send('transcription:progress', {
            status: partial ? 'partial' : 'completed',
            message: partial
                ? 'Transcription is still partial; review the flagged audio intervals'
                : 'Transcription resumed and completed successfully'
        });
        return { ...result, status: partial ? 'partial' : 'complete', partial, issues, resumeId: resultResumeId,
            historyId: updatedEntry.id, cleanupPending, cleanupError };
    }

    async finalizeResumeJobIfUnreferenced(resumeId, historyId) {
        const stillReferenced = this.transcriptionStoreService.list().some(entry =>
            entry.id !== historyId && entry.resumeId === resumeId);
        if (stillReferenced) return false;
        await this.transcriptionService.finalizeTranscription(resumeId);
        return true;
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

    async handleDetectGpuBackend() {
        try {
            const { LocalWhisperService } = require('../services/localWhisperService');
            const gpuInfo = LocalWhisperService.detectGpuInfo();
            return { success: true, ...gpuInfo };
        } catch (error) {
            console.error('Error detecting GPU info:', error);
            return { success: false, gpuLikely: false, expectedBackend: 'cpu', message: error.message };
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
            this._assertTrustedRenderer(event);
            if (typeof filename !== 'string') {
                throw new Error('Invalid recording chunk filename');
            }
            const filenameMatch = filename.match(RECORDING_CHUNK_FILENAME);
            if (!filenameMatch) throw new Error('Invalid recording chunk filename');
            const session = this._requireRecordingSession(event, filenameMatch[1]);

            let buffer;
            if (audioData instanceof ArrayBuffer) {
                buffer = Buffer.from(audioData);
            } else if (Buffer.isBuffer(audioData)) {
                buffer = audioData;
            } else {
                throw new Error('Invalid audio data format');
            }
            if (buffer.length > MAX_RECORDING_CHUNK_BYTES) {
                throw new Error('Recording chunk is too large');
            }

            const recordingsDir = this._getRecordingsDirectory(true);
            const chunkPath = path.join(recordingsDir, filename);
            if (fs.existsSync(chunkPath) && !session.filenames.has(filename)) {
                throw new Error('Recording chunk already exists outside this session');
            }
            this._writeFileNoFollow(chunkPath, buffer);
            const stats = this._assertRecordingChunkFile(chunkPath);
            session.filenames.add(filename);
            
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
            const { chunkPath, filename } = this._requireRecordingChunk(event, filePath);
            if (!fs.existsSync(chunkPath)) {
                throw new Error('Recording chunk file not found');
            }
            this._assertRecordingChunkFile(chunkPath);
            const buffer = this._readFileNoFollow(chunkPath, MAX_RECORDING_CHUNK_BYTES);
            console.log(`Loaded recording chunk: ${filename} (${buffer.length} bytes)`);
            
            return buffer;
        } catch (error) {
            console.error('Error loading recording chunk:', error);
            throw new Error(`Failed to load recording chunk: ${error.message}`);
        }
    }

    async handleDeleteRecordingChunk(event, filePath) {
        try {
            const { chunkPath, filename, session } = this._requireRecordingChunk(event, filePath);
            if (fs.existsSync(chunkPath)) {
                this._assertRecordingChunkFile(chunkPath);
                fs.unlinkSync(chunkPath);
                session.filenames.delete(filename);
                if (session.filenames.size === 0) {
                    this.recordingSessions.delete(filename.match(RECORDING_CHUNK_FILENAME)[1]);
                }
                console.log(`Deleted recording chunk: ${filename}`);
            }
            
            return { success: true };
        } catch (error) {
            console.error('Error deleting recording chunk:', error);
            throw new Error(`Failed to delete recording chunk: ${error.message}`);
        }
    }

    async handleFindRecordingChunks(event, sessionId) {
        try {
            this._assertTrustedRenderer(event);
            const owner = this._getRecordingSessionOwner(event);
            const isRecoveryScan = sessionId === 'recording_';
            if (typeof sessionId !== 'string' || sessionId.length > 64 ||
                (!isRecoveryScan && !RECORDING_SESSION_ID.test(sessionId))) {
                throw new Error('Invalid recording session id');
            }
            if (!isRecoveryScan) this._requireRecordingSession(event, sessionId);
            const recordingsDir = this._getRecordingsDirectory();
            if (!recordingsDir) {
                return [];
            }

            const sessionChunks = [];
            for (const filename of fs.readdirSync(recordingsDir).sort()) {
                const filenameMatch = filename.match(RECORDING_CHUNK_FILENAME);
                if (!filenameMatch || (!isRecoveryScan && filenameMatch[1] !== sessionId)) continue;

                let session = this.recordingSessions.get(filenameMatch[1]);
                if (session && session.owner !== owner) continue;
                if (!session && !isRecoveryScan) continue;

                const filePath = path.join(recordingsDir, filename);
                try {
                    const lstat = fs.lstatSync(filePath);
                    if (lstat.isSymbolicLink() || !lstat.isFile() ||
                        (typeof process.getuid === 'function' && lstat.uid !== process.getuid())) continue;
                    const stats = this._assertRecordingChunkFile(filePath);
                    if (stats.size > MAX_RECORDING_CHUNK_BYTES) continue;
                    if (!session) {
                        session = { owner, filenames: new Set() };
                        this.recordingSessions.set(filenameMatch[1], session);
                    }
                    session.filenames.add(filename);
                    sessionChunks.push(filePath);
                } catch (error) {
                    if (error.code !== 'ENOENT' && error.message !== 'Recording chunk is not an owned regular file') throw error;
                }
            }
            
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
            const saved = await this.transcriptionStoreService.get(id);
            const deleted = await this.transcriptionStoreService.delete(id);
            if (!deleted) return { success: false };
            if (saved?.entry?.resumeId && this.transcriptionService.finalizeTranscription) {
                try {
                    await this.finalizeResumeJobIfUnreferenced(saved.entry.resumeId, id);
                } catch (error) {
                    return { success: true, cleanupPending: true, error: error.message };
                }
            }
            return { success: true };
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

    async handleTranscriptionsRegenerateMeta(event, { id } = {}) {
        if (!id || typeof id !== 'string') return { success: false, error: 'Invalid id' };
        try {
            const entry = await this.transcriptionStoreService.regenerateMeta(id);
            if (!entry) return { success: false, error: 'Not found' };
            return { success: entry.metaStatus === 'success', entry };
        } catch (error) {
            console.error('Error regenerating transcription meta:', error);
            return { success: false, error: error.message };
        }
    }

    async handleAudioReadFile(event, filePath) {
        if (!filePath || typeof filePath !== 'string') {
            return { success: false, error: 'Invalid file path' };
        }
        const resolved = path.resolve(filePath);
        const { app } = require('electron');
        const allowedDirs = [os.homedir(), app.getPath('userData')];
        const isAllowed = allowedDirs.some(dir => {
            const rel = path.relative(dir, resolved);
            return !rel.startsWith('..') && !path.isAbsolute(rel);
        });
        if (!isAllowed) {
            return { success: false, error: 'Access denied: file path is outside allowed directories' };
        }
        if (!fs.existsSync(resolved)) {
            return { success: false, error: 'File not found' };
        }
        const stat = fs.statSync(resolved);
        if (!stat.isFile()) {
            return { success: false, error: 'Path is not a file' };
        }
        const MAX_SIZE = 300 * 1024 * 1024;
        if (stat.size > MAX_SIZE) {
            return { success: false, error: 'File too large for in-memory playback (max 300 MB)' };
        }
        try {
            const ext = path.extname(resolved).toLowerCase();
            const mimeTypes = {
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.m4a': 'audio/mp4',
                '.flac': 'audio/flac',
                '.ogg': 'audio/ogg',
                '.webm': 'audio/webm',
                '.mp4': 'video/mp4',
                '.mov': 'video/quicktime',
                '.avi': 'video/x-msvideo',
                '.mkv': 'video/x-matroska'
            };
            const mime = mimeTypes[ext] || 'audio/mpeg';
            const buffer = fs.readFileSync(resolved);
            const base64 = buffer.toString('base64');
            return { success: true, dataUrl: `data:${mime};base64,${base64}` };
        } catch (error) {
            console.error('Error reading audio file:', error);
            return { success: false, error: error.message };
        }
    }

    // Meeting Notes Handlers

    async handleMeetingNotesGetConfig(event) {
        try {
            this._assertTrustedRenderer(event);
            return {
                success: true,
                config: {
                    defaultProvider: config.get('meetingNotes.defaultProvider', 'claude'),
                    claudeModel: config.get('meetingNotes.claudeModel', 'claude-sonnet-4-20250514'),
                    codexModel: config.get('meetingNotes.codexModel', ''),
                    cliTimeoutSeconds: config.get('meetingNotes.cliTimeoutSeconds', 600)
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async handleMeetingNotesSaveConfig(event, request = {}) {
        try {
            this._assertTrustedRenderer(event);
            const { settings } = request && typeof request === 'object' && !Array.isArray(request) ? request : {};
            if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return { success: false, error: 'Invalid settings' };
            if (settings.defaultProvider !== undefined && !['ollama', 'claude', 'codex'].includes(settings.defaultProvider)) {
                return { success: false, error: 'Invalid default provider' };
            }
            for (const key of ['claudeModel', 'codexModel']) {
                if (settings[key] !== undefined && (typeof settings[key] !== 'string' || settings[key].length > 256)) {
                    return { success: false, error: `Invalid ${key}` };
                }
            }
            if (settings.cliTimeoutSeconds !== undefined &&
                (!Number.isInteger(settings.cliTimeoutSeconds) || settings.cliTimeoutSeconds < 10 || settings.cliTimeoutSeconds > 3600)) {
                return { success: false, error: 'Invalid CLI timeout' };
            }
            const allowedKeys = ['defaultProvider', 'claudeModel', 'codexModel', 'cliTimeoutSeconds'];
            for (const key of allowedKeys) {
                if (settings[key] !== undefined) {
                    config.set(`meetingNotes.${key}`, settings[key]);
                }
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async handleMeetingNotesGenerate(event, request = {}) {
        try {
            const { transcriptionId, options } = request && typeof request === 'object' && !Array.isArray(request) ? request : {};
            const result = await this._getOwnedTranscription(event, transcriptionId);
            if (!result) {
                return { success: false, error: 'Transcript not found' };
            }

            if (options !== undefined && (!options || typeof options !== 'object' || Array.isArray(options))) {
                return { success: false, error: 'Invalid options' };
            }
            const requestedOptions = options || {};
            const genOptions = {};
            if (requestedOptions.provider !== undefined) {
                if (!['ollama', 'claude', 'codex'].includes(requestedOptions.provider)) {
                    return { success: false, error: 'Invalid provider' };
                }
                genOptions.provider = requestedOptions.provider;
            }
            if (requestedOptions.model !== undefined) {
                if (typeof requestedOptions.model !== 'string' || requestedOptions.model.length > 256) {
                    return { success: false, error: 'Invalid model' };
                }
                genOptions.model = requestedOptions.model;
            }
            if (requestedOptions.templateId !== undefined) {
                if (!this._validateNotesId(requestedOptions.templateId)) {
                    return { success: false, error: 'Invalid template id' };
                }
                genOptions.templateId = requestedOptions.templateId;
            }
            if (requestedOptions.prePrompt !== undefined) {
                if (typeof requestedOptions.prePrompt !== 'string' || Buffer.byteLength(requestedOptions.prePrompt, 'utf8') > 20000) {
                    return { success: false, error: 'Invalid prompt context' };
                }
                genOptions.prePrompt = requestedOptions.prePrompt;
            }

            if (requestedOptions.contextTranscriptIds !== undefined) {
                if (!Array.isArray(requestedOptions.contextTranscriptIds) || requestedOptions.contextTranscriptIds.length > 20 ||
                    requestedOptions.contextTranscriptIds.some(id => !this._validateNotesId(id))) {
                    return { success: false, error: 'Invalid context transcript ids' };
                }
                const contextTranscripts = [];
                let contextBytes = 0;
                for (const ctxId of requestedOptions.contextTranscriptIds) {
                    if (ctxId === transcriptionId) continue; // skip self
                    const ctxResult = await this._getOwnedTranscription(event, ctxId);
                    if (ctxResult) {
                        contextBytes += Buffer.byteLength(ctxResult.text, 'utf8');
                        if (contextBytes > 25 * 1024 * 1024) {
                            return { success: false, error: 'Context transcripts are too large' };
                        }
                        contextTranscripts.push({
                            id: ctxId,
                            title: ctxResult.entry ? ctxResult.entry.title : ctxId,
                            text: ctxResult.text
                        });
                    }
                }
                genOptions.contextTranscripts = contextTranscripts;
            }

            const notesData = await this.meetingNotesService.generate(result.text, transcriptionId, genOptions);
            return { success: true, notes: notesData };
        } catch (error) {
            console.error('Error generating meeting notes:', error);
            return { success: false, error: error.message };
        }
    }

    async handleMeetingNotesGet(event, request = {}) {
        try {
            const { transcriptionId } = request && typeof request === 'object' && !Array.isArray(request) ? request : {};
            const result = await this._getOwnedTranscription(event, transcriptionId);
            if (!result) return { success: false, error: 'Transcript not found' };
            const notes = this.meetingNotesService.getNotes(transcriptionId);
            return { success: true, notes };
        } catch (error) {
            console.error('Error getting meeting notes:', error);
            return { success: false, error: error.message };
        }
    }

    async handleMeetingNotesDelete(event, request = {}) {
        try {
            const { transcriptionId } = request && typeof request === 'object' && !Array.isArray(request) ? request : {};
            const result = await this._getOwnedTranscription(event, transcriptionId);
            if (!result) return { success: false, error: 'Transcript not found' };
            const deleted = this.meetingNotesService.deleteNotes(transcriptionId);
            return { success: deleted };
        } catch (error) {
            console.error('Error deleting meeting notes:', error);
            return { success: false, error: error.message };
        }
    }

    async handleMeetingNotesHasNotes(event, request = {}) {
        try {
            const { transcriptionId } = request && typeof request === 'object' && !Array.isArray(request) ? request : {};
            const result = await this._getOwnedTranscription(event, transcriptionId);
            if (!result) return { hasNotes: false };
            return { hasNotes: this.meetingNotesService.hasNotes(transcriptionId) };
        } catch (error) {
            return { hasNotes: false };
        }
    }

    async handleMeetingNotesGetTemplates(event) {
        try {
            this._assertTrustedRenderer(event);
            const templates = this.meetingNotesService.loadTemplates();
            return { success: true, templates };
        } catch (error) {
            console.error('Error getting meeting notes templates:', error);
            return { success: true, templates: [] };
        }
    }

    async handleMeetingNotesCreateTemplate(event, request = {}) {
        try {
            this._assertTrustedRenderer(event);
            const { template } = request && typeof request === 'object' && !Array.isArray(request) ? request : {};
            if (!template || typeof template !== 'object' || Array.isArray(template)) {
                return { success: false, error: 'Invalid template' };
            }
            const created = this.meetingNotesService.createTemplate(template || {});
            return { success: true, template: created };
        } catch (error) {
            console.error('Error creating meeting notes template:', error);
            return { success: false, error: error.message };
        }
    }

    async handleMeetingNotesUpdateTemplate(event, request = {}) {
        try {
            this._assertTrustedRenderer(event);
            const { id, changes } = request && typeof request === 'object' && !Array.isArray(request) ? request : {};
            if (!this._validateNotesId(id) || !changes || typeof changes !== 'object' || Array.isArray(changes)) {
                return { success: false, error: 'Invalid template update' };
            }
            const updated = this.meetingNotesService.updateTemplate(id, changes || {});
            if (!updated) return { success: false, error: 'Template not found' };
            return { success: true, template: updated };
        } catch (error) {
            console.error('Error updating meeting notes template:', error);
            return { success: false, error: error.message };
        }
    }

    async handleMeetingNotesDeleteTemplate(event, request = {}) {
        try {
            this._assertTrustedRenderer(event);
            const { id } = request && typeof request === 'object' && !Array.isArray(request) ? request : {};
            if (!this._validateNotesId(id)) return { success: false, error: 'Invalid template id' };
            const deleted = this.meetingNotesService.deleteTemplate(id);
            return { success: deleted };
        } catch (error) {
            console.error('Error deleting meeting notes template:', error);
            return { success: false, error: error.message };
        }
    }

    async handleGetAudioSources() {
        try {
            const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
            const os = process.platform;

            const systemSources = sources.map((source) => ({
                id: source.id,
                name: source.name
            }));

            return {
                success: true,
                platform: os,
                sources: systemSources,
                systemAudioSupported: os === 'win32' || os === 'linux' || os === 'darwin'
            };
        } catch (error) {
            console.error('Error getting audio sources:', error);
            return {
                success: false,
                platform: process.platform,
                sources: [],
                systemAudioSupported: false,
                error: error.message
            };
        }
    }
}

module.exports = IPCHandlers;

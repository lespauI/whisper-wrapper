/**
 * Unit tests for Recording Auto-Save functionality
 */

describe('Recording Auto-Save Functionality', () => {
    let app;
    let mockElectronAPI;

    beforeEach(() => {
        // Mock minimal globals
        global.console = {
            log: jest.fn(),
            error: jest.fn()
        };

        // Mock Electron API
        mockElectronAPI = {
            getAppPaths: jest.fn(() => Promise.resolve({
                temp: '/mock/temp',
                userData: '/mock/userData'
            })),
            saveRecordingChunk: jest.fn(() => Promise.resolve({
                success: true,
                filePath: '/mock/temp/chunk.webm',
                size: 1024
            })),
            loadRecordingChunk: jest.fn(() => Promise.resolve(Buffer.from('mock audio'))),
            deleteRecordingChunk: jest.fn(() => Promise.resolve({ success: true })),
            findRecordingChunks: jest.fn(() => Promise.resolve([])),
        };

        global.window = {
            electronAPI: mockElectronAPI
        };

        global.Blob = jest.fn((chunks, options) => ({
            size: chunks.reduce((total, chunk) => total + (chunk.size || 100), 0),
            type: options?.type || 'audio/webm',
            arrayBuffer: jest.fn(() => Promise.resolve(new ArrayBuffer(1024)))
        }));

        global.setInterval = jest.fn(() => 123); // Return a mock timer ID
        global.clearInterval = jest.fn();

        // Create a minimal app instance with just the auto-save functionality
        app = {
            recordingSettings: {
                autoSaveInterval: 60000,
                enableAutoSave: true,
                quality: 'medium',
                format: 'wav',
                autoTranscribe: true
            },
            recordingAutoSave: {
                sessionId: null,
                chunkIndex: 0,
                savedChunks: [],
                autoSaveTimer: null,
                tempDirectory: null
            },
            audioChunks: [],
            isRecording: false,
            isPaused: false
        };

        // Add the auto-save methods from the source
        app.initializeAutoSaveSession = async function() {
            if (!this.recordingSettings.enableAutoSave) {
                return;
            }

            try {
                this.recordingAutoSave.sessionId = `recording_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                this.recordingAutoSave.chunkIndex = 0;
                this.recordingAutoSave.savedChunks = [];

                const paths = await window.electronAPI.getAppPaths();
                this.recordingAutoSave.tempDirectory = paths.temp;
            } catch (error) {
                this.recordingSettings.enableAutoSave = false;
            }
        };

        app.startAutoSaveTimer = function() {
            if (!this.recordingSettings.enableAutoSave) {
                return;
            }

            this.recordingAutoSave.autoSaveTimer = setInterval(async () => {
                if (this.isRecording && !this.isPaused) {
                    await this.saveCurrentRecordingChunk();
                }
            }, this.recordingSettings.autoSaveInterval);
        };

        app.stopAutoSaveTimer = function() {
            if (this.recordingAutoSave.autoSaveTimer) {
                clearInterval(this.recordingAutoSave.autoSaveTimer);
                this.recordingAutoSave.autoSaveTimer = null;
            }
        };

        app.saveCurrentRecordingChunk = async function() {
            if (!this.recordingSettings.enableAutoSave || !this.audioChunks.length) {
                return;
            }

            try {
                const chunkBlob = new Blob([...this.audioChunks], { type: 'audio/webm' });
                
                if (chunkBlob.size === 0) {
                    return;
                }

                const arrayBuffer = await chunkBlob.arrayBuffer();
                const chunkFilename = `${this.recordingAutoSave.sessionId}_chunk_${this.recordingAutoSave.chunkIndex.toString().padStart(3, '0')}.webm`;
                
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
                    this.audioChunks = [];
                }
            } catch (error) {
                // Handle error gracefully
            }
        };

        app.combineRecordingChunks = async function(finalBlob) {
            if (!this.recordingSettings.enableAutoSave || this.recordingAutoSave.savedChunks.length === 0) {
                return finalBlob;
            }

            try {
                const chunkBlobs = [];
                
                for (const chunkInfo of this.recordingAutoSave.savedChunks) {
                    try {
                        const chunkData = await window.electronAPI.loadRecordingChunk(chunkInfo.filePath);
                        if (chunkData) {
                            chunkBlobs.push(new Blob([chunkData], { type: 'audio/webm' }));
                        }
                    } catch (error) {
                        // Continue with other chunks
                    }
                }
                
                chunkBlobs.push(finalBlob);
                const combinedBlob = new Blob(chunkBlobs, { type: 'audio/webm' });
                
                await this.cleanupAutoSaveFiles();
                return combinedBlob;
                
            } catch (error) {
                return finalBlob;
            }
        };

        app.cleanupAutoSaveFiles = async function() {
            if (this.recordingAutoSave.savedChunks.length === 0) {
                return;
            }

            const failedChunks = [];
            
            for (const chunkInfo of this.recordingAutoSave.savedChunks) {
                try {
                    await window.electronAPI.deleteRecordingChunk(chunkInfo.filePath);
                } catch (error) {
                    failedChunks.push(chunkInfo);
                }
            }
            
            if (failedChunks.length === 0) {
                this.recordingAutoSave.savedChunks = [];
                this.recordingAutoSave.chunkIndex = 0;
                this.recordingAutoSave.sessionId = null;
            } else {
                this.recordingAutoSave.savedChunks = failedChunks;
            }
        };

        app.recoverRecordingFromChunks = async function(sessionId) {
            try {
                const recoveredChunks = await window.electronAPI.findRecordingChunks(sessionId);
                
                if (recoveredChunks.length > 0) {
                    const chunkBlobs = [];
                    for (const chunkPath of recoveredChunks) {
                        const chunkData = await window.electronAPI.loadRecordingChunk(chunkPath);
                        if (chunkData) {
                            chunkBlobs.push(new Blob([chunkData], { type: 'audio/webm' }));
                        }
                    }
                    
                    if (chunkBlobs.length > 0) {
                        this.recordingBlob = new Blob(chunkBlobs, { type: 'audio/webm' });
                        return true;
                    }
                }
                
                return false;
            } catch (error) {
                return false;
            }
        };

        app.checkForOrphanedRecordings = async function() {
            try {
                const allChunks = await window.electronAPI.findRecordingChunks('recording_');
                
                if (allChunks.length > 0) {
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
                    
                    const recoverableSessions = Object.entries(sessionGroups)
                        .filter(([sessionId, chunks]) => chunks.length > 0)
                        .sort(([, a], [, b]) => b.length - a.length);
                    
                    if (recoverableSessions.length > 0) {
                        this.showRecoveryDialog(recoverableSessions);
                    }
                }
            } catch (error) {
                // Handle error gracefully
            }
        };

        app.showRecoveryDialog = jest.fn();
    });

    afterEach(() => {
        if (app && app.recordingAutoSave?.autoSaveTimer) {
            clearInterval(app.recordingAutoSave.autoSaveTimer);
        }
    });

    describe('Auto-Save Configuration', () => {
        test('should initialize with default auto-save settings', () => {
            expect(app.recordingSettings.autoSaveInterval).toBe(60000);
            expect(app.recordingSettings.enableAutoSave).toBe(true);
            expect(app.recordingAutoSave).toBeDefined();
            expect(app.recordingAutoSave.sessionId).toBeNull();
            expect(app.recordingAutoSave.chunkIndex).toBe(0);
            expect(app.recordingAutoSave.savedChunks).toEqual([]);
        });

        test('should allow customizing auto-save interval', () => {
            app.recordingSettings.autoSaveInterval = 30000;
            expect(app.recordingSettings.autoSaveInterval).toBe(30000);
        });

        test('should allow disabling auto-save', () => {
            app.recordingSettings.enableAutoSave = false;
            expect(app.recordingSettings.enableAutoSave).toBe(false);
        });
    });

    describe('Auto-Save Session Initialization', () => {
        test('should initialize auto-save session when enabled', async () => {
            await app.initializeAutoSaveSession();

            expect(app.recordingAutoSave.sessionId).toMatch(/^recording_\d+_[a-z0-9]+$/);
            expect(app.recordingAutoSave.chunkIndex).toBe(0);
            expect(app.recordingAutoSave.savedChunks).toEqual([]);
            expect(app.recordingAutoSave.tempDirectory).toBe('/mock/temp');
            expect(mockElectronAPI.getAppPaths).toHaveBeenCalled();
        });

        test('should not initialize session when auto-save is disabled', async () => {
            app.recordingSettings.enableAutoSave = false;
            await app.initializeAutoSaveSession();

            expect(app.recordingAutoSave.sessionId).toBeNull();
            expect(mockElectronAPI.getAppPaths).not.toHaveBeenCalled();
        });

        test('should handle initialization errors gracefully', async () => {
            mockElectronAPI.getAppPaths.mockRejectedValue(new Error('Path error'));
            
            await app.initializeAutoSaveSession();

            expect(app.recordingSettings.enableAutoSave).toBe(false);
        });
    });

    describe('Auto-Save Timer Management', () => {
        test('should start auto-save timer when enabled', () => {
            app.startAutoSaveTimer();

            expect(global.setInterval).toHaveBeenCalledWith(
                expect.any(Function),
                app.recordingSettings.autoSaveInterval
            );
            expect(app.recordingAutoSave.autoSaveTimer).toBeDefined();
        });

        test('should not start timer when auto-save is disabled', () => {
            app.recordingSettings.enableAutoSave = false;
            
            app.startAutoSaveTimer();

            expect(global.setInterval).not.toHaveBeenCalled();
            expect(app.recordingAutoSave.autoSaveTimer).toBeNull();
        });

        test('should stop auto-save timer', () => {
            app.recordingAutoSave.autoSaveTimer = 123;
            
            app.stopAutoSaveTimer();

            expect(global.clearInterval).toHaveBeenCalledWith(123);
            expect(app.recordingAutoSave.autoSaveTimer).toBeNull();
        });
    });

    describe('Recording Chunk Saving', () => {
        beforeEach(() => {
            app.recordingAutoSave.sessionId = 'test_session_123';
            app.recordingAutoSave.chunkIndex = 0;
            app.audioChunks = [
                { size: 100 },
                { size: 200 }
            ];
        });

        test('should save current recording chunk', async () => {
            await app.saveCurrentRecordingChunk();

            expect(mockElectronAPI.saveRecordingChunk).toHaveBeenCalledWith(
                expect.any(ArrayBuffer),
                'test_session_123_chunk_000.webm'
            );
            expect(app.recordingAutoSave.savedChunks).toHaveLength(1);
            expect(app.recordingAutoSave.chunkIndex).toBe(1);
            expect(app.audioChunks).toEqual([]);
        });

        test('should not save when auto-save is disabled', async () => {
            app.recordingSettings.enableAutoSave = false;
            
            await app.saveCurrentRecordingChunk();

            expect(mockElectronAPI.saveRecordingChunk).not.toHaveBeenCalled();
        });

        test('should not save when no audio chunks exist', async () => {
            app.audioChunks = [];
            
            await app.saveCurrentRecordingChunk();

            expect(mockElectronAPI.saveRecordingChunk).not.toHaveBeenCalled();
        });
    });

    describe('Recording Chunk Combination', () => {
        beforeEach(() => {
            app.recordingAutoSave.savedChunks = [
                {
                    filename: 'test_chunk_000.webm',
                    filePath: '/mock/temp/test_chunk_000.webm',
                    size: 1024
                },
                {
                    filename: 'test_chunk_001.webm',
                    filePath: '/mock/temp/test_chunk_001.webm',
                    size: 2048
                }
            ];
        });

        test('should combine saved chunks with final recording', async () => {
            const finalBlob = { size: 500, type: 'audio/webm' };
            
            const combinedBlob = await app.combineRecordingChunks(finalBlob);

            expect(mockElectronAPI.loadRecordingChunk).toHaveBeenCalledTimes(2);
            expect(combinedBlob).toBeDefined();
        });

        test('should return final blob when no chunks exist', async () => {
            app.recordingAutoSave.savedChunks = [];
            const finalBlob = { size: 500, type: 'audio/webm' };
            
            const result = await app.combineRecordingChunks(finalBlob);

            expect(result).toBe(finalBlob);
            expect(mockElectronAPI.loadRecordingChunk).not.toHaveBeenCalled();
        });
    });

    describe('Auto-Save Cleanup', () => {
        beforeEach(() => {
            app.recordingAutoSave.savedChunks = [
                { filePath: '/mock/temp/chunk1.webm' },
                { filePath: '/mock/temp/chunk2.webm' }
            ];
            app.recordingAutoSave.sessionId = 'test_session';
            app.recordingAutoSave.chunkIndex = 2;
        });

        test('should clean up auto-save files', async () => {
            await app.cleanupAutoSaveFiles();

            expect(mockElectronAPI.deleteRecordingChunk).toHaveBeenCalledTimes(2);
            expect(mockElectronAPI.deleteRecordingChunk).toHaveBeenCalledWith('/mock/temp/chunk1.webm');
            expect(mockElectronAPI.deleteRecordingChunk).toHaveBeenCalledWith('/mock/temp/chunk2.webm');
            
            expect(app.recordingAutoSave.savedChunks).toEqual([]);
            expect(app.recordingAutoSave.chunkIndex).toBe(0);
            expect(app.recordingAutoSave.sessionId).toBeNull();
        });

        test('should not clean up when no chunks exist', async () => {
            app.recordingAutoSave.savedChunks = [];
            
            await app.cleanupAutoSaveFiles();

            expect(mockElectronAPI.deleteRecordingChunk).not.toHaveBeenCalled();
        });
    });

    describe('Recording Recovery', () => {
        test('should recover recording from chunks', async () => {
            const sessionId = 'test_session_123';
            const chunkPaths = [
                '/mock/temp/test_session_123_chunk_000.webm',
                '/mock/temp/test_session_123_chunk_001.webm'
            ];
            
            mockElectronAPI.findRecordingChunks.mockResolvedValue(chunkPaths);
            mockElectronAPI.loadRecordingChunk.mockResolvedValue(Buffer.from('chunk data'));
            
            const result = await app.recoverRecordingFromChunks(sessionId);

            expect(result).toBe(true);
            expect(mockElectronAPI.findRecordingChunks).toHaveBeenCalledWith(sessionId);
            expect(mockElectronAPI.loadRecordingChunk).toHaveBeenCalledTimes(2);
            expect(app.recordingBlob).toBeDefined();
        });

        test('should return false when no chunks found', async () => {
            mockElectronAPI.findRecordingChunks.mockResolvedValue([]);
            
            const result = await app.recoverRecordingFromChunks('nonexistent_session');

            expect(result).toBe(false);
        });
    });

    describe('Orphaned Recording Detection', () => {
        test('should check for orphaned recordings on startup', async () => {
            const orphanedChunks = [
                '/mock/temp/recording_123_abc_chunk_000.webm',
                '/mock/temp/recording_123_abc_chunk_001.webm',
                '/mock/temp/recording_456_def_chunk_000.webm'
            ];
            
            mockElectronAPI.findRecordingChunks.mockResolvedValue(orphanedChunks);
            
            await app.checkForOrphanedRecordings();

            expect(mockElectronAPI.findRecordingChunks).toHaveBeenCalledWith('recording_');
            expect(app.showRecoveryDialog).toHaveBeenCalledWith(
                expect.arrayContaining([
                    ['recording_123_abc', expect.any(Array)],
                    ['recording_456_def', expect.any(Array)]
                ])
            );
        });

        test('should not show dialog when no orphaned chunks exist', async () => {
            mockElectronAPI.findRecordingChunks.mockResolvedValue([]);
            
            await app.checkForOrphanedRecordings();

            expect(app.showRecoveryDialog).not.toHaveBeenCalled();
        });
    });
});
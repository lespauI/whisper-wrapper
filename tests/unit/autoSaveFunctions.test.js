/**
 * Unit tests for Auto-Save functions (isolated testing)
 */

const fs = require('fs');
const path = require('path');

// Mock fs module
jest.mock('fs');

// Use fake timers globally for this test file
jest.useFakeTimers();

describe('Auto-Save Functions (Isolated)', () => {
    let mockElectronAPI;
    let autoSaveFunctions;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
        // Mock electron API
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
            findRecordingChunks: jest.fn(() => Promise.resolve([]))
        };
        
        // Create isolated auto-save functions
        autoSaveFunctions = {
            recordingSettings: {
                autoSaveInterval: 60000,
                enableAutoSave: true
            },
            recordingAutoSave: {
                sessionId: null,
                chunkIndex: 0,
                savedChunks: [],
                autoSaveTimer: null,
                tempDirectory: null
            },
            audioChunks: [],

            async initializeAutoSaveSession() {
                if (!this.recordingSettings.enableAutoSave) {
                    return;
                }

                try {
                    this.recordingAutoSave.sessionId = `recording_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    this.recordingAutoSave.chunkIndex = 0;
                    this.recordingAutoSave.savedChunks = [];

                    const paths = await mockElectronAPI.getAppPaths();
                    this.recordingAutoSave.tempDirectory = paths.temp;
                } catch (error) {
                    this.recordingSettings.enableAutoSave = false;
                }
            },
        };
    });
        
    afterEach(() => {
        // Clean up any timers
        if (autoSaveFunctions && autoSaveFunctions.recordingAutoSave) {
            if (autoSaveFunctions.recordingAutoSave.autoSaveTimer) {
                clearInterval(autoSaveFunctions.recordingAutoSave.autoSaveTimer);
                autoSaveFunctions.recordingAutoSave.autoSaveTimer = null;
            }
        }
        jest.clearAllTimers();
    });

    // Complete the autoSaveFunctions object with all required methods
    beforeEach(() => {
        // Add methods to autoSaveFunctions object
        autoSaveFunctions.startAutoSaveTimer = function() {
            if (!this.recordingSettings.enableAutoSave) {
                return;
            }

            this.recordingAutoSave.autoSaveTimer = setInterval(async () => {
                if (this.isRecording && !this.isPaused) {
                    await this.saveCurrentRecordingChunk();
                }
            }, this.recordingSettings.autoSaveInterval);
        };

        autoSaveFunctions.stopAutoSaveTimer = function() {
            if (this.recordingAutoSave.autoSaveTimer) {
                clearInterval(this.recordingAutoSave.autoSaveTimer);
                this.recordingAutoSave.autoSaveTimer = null;
            }
        };

        autoSaveFunctions.saveCurrentRecordingChunk = async function() {
            if (!this.recordingSettings.enableAutoSave || !this.audioChunks.length) {
                return;
            }

            try {
                const chunkBlob = { size: this.audioChunks.reduce((total, chunk) => total + (chunk.size || 100), 0) };
                
                if (chunkBlob.size === 0) {
                    return;
                }

                const arrayBuffer = new ArrayBuffer(chunkBlob.size);
                const chunkFilename = `${this.recordingAutoSave.sessionId}_chunk_${this.recordingAutoSave.chunkIndex.toString().padStart(3, '0')}.webm`;
                
                const result = await mockElectronAPI.saveRecordingChunk(arrayBuffer, chunkFilename);
                
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

        autoSaveFunctions.combineRecordingChunks = async function(finalBlob) {
            if (!this.recordingSettings.enableAutoSave || this.recordingAutoSave.savedChunks.length === 0) {
                return finalBlob;
            }

            try {
                const chunkBlobs = [];
                
                for (const chunkInfo of this.recordingAutoSave.savedChunks) {
                    try {
                        const chunkData = await mockElectronAPI.loadRecordingChunk(chunkInfo.filePath);
                        if (chunkData) {
                            chunkBlobs.push({ data: chunkData, size: chunkData.length });
                        }
                    } catch (error) {
                        // Continue with other chunks
                    }
                }
                
                chunkBlobs.push(finalBlob);
                
                const combinedSize = chunkBlobs.reduce((total, blob) => total + blob.size, 0);
                const combinedBlob = { size: combinedSize, type: 'audio/webm' };
                
                await this.cleanupAutoSaveFiles();
                
                return combinedBlob;
                
            } catch (error) {
                return finalBlob;
            }
        };

        autoSaveFunctions.cleanupAutoSaveFiles = async function() {
            if (this.recordingAutoSave.savedChunks.length === 0) {
                return;
            }

            const failedChunks = [];
            
            for (const chunkInfo of this.recordingAutoSave.savedChunks) {
                try {
                    await mockElectronAPI.deleteRecordingChunk(chunkInfo.filePath);
                } catch (error) {
                    failedChunks.push(chunkInfo);
                }
            }
            
            if (failedChunks.length > 0) {
                this.recordingAutoSave.savedChunks = failedChunks;
            } else {
                // Only reset state if all chunks were successfully deleted
                this.recordingAutoSave.savedChunks = [];
                this.recordingAutoSave.chunkIndex = 0;
                this.recordingAutoSave.sessionId = null;
            }
        };

        autoSaveFunctions.recoverRecordingFromChunks = async function(sessionId) {
            try {
                const recoveredChunks = await mockElectronAPI.findRecordingChunks(sessionId);
                
                if (recoveredChunks.length > 0) {
                    const chunkBlobs = [];
                    for (const chunkPath of recoveredChunks) {
                        const chunkData = await mockElectronAPI.loadRecordingChunk(chunkPath);
                        if (chunkData) {
                            chunkBlobs.push({ data: chunkData, size: chunkData.length });
                        }
                    }
                    
                    if (chunkBlobs.length > 0) {
                        const recoveredBlob = { 
                            size: chunkBlobs.reduce((total, blob) => total + blob.size, 0),
                            type: 'audio/webm'
                        };
                        return true;
                    }
                }
                
                return false;
            } catch (error) {
                return false;
            }
        };
    });

    describe('Auto-Save Configuration', () => {
        test('should initialize with default auto-save settings', () => {
            expect(autoSaveFunctions.recordingSettings.autoSaveInterval).toBe(60000);
            expect(autoSaveFunctions.recordingSettings.enableAutoSave).toBe(true);
            expect(autoSaveFunctions.recordingAutoSave.sessionId).toBeNull();
            expect(autoSaveFunctions.recordingAutoSave.chunkIndex).toBe(0);
            expect(autoSaveFunctions.recordingAutoSave.savedChunks).toEqual([]);
        });

        test('should allow customizing auto-save interval', () => {
            autoSaveFunctions.recordingSettings.autoSaveInterval = 30000;
            expect(autoSaveFunctions.recordingSettings.autoSaveInterval).toBe(30000);
        });

        test('should allow disabling auto-save', () => {
            autoSaveFunctions.recordingSettings.enableAutoSave = false;
            expect(autoSaveFunctions.recordingSettings.enableAutoSave).toBe(false);
        });
    });

    describe('Auto-Save Session Initialization', () => {
        test('should initialize auto-save session when enabled', async () => {
            await autoSaveFunctions.initializeAutoSaveSession();

            expect(autoSaveFunctions.recordingAutoSave.sessionId).toMatch(/^recording_\d+_[a-z0-9]+$/);
            expect(autoSaveFunctions.recordingAutoSave.chunkIndex).toBe(0);
            expect(autoSaveFunctions.recordingAutoSave.savedChunks).toEqual([]);
            expect(autoSaveFunctions.recordingAutoSave.tempDirectory).toBe('/mock/temp');
            expect(mockElectronAPI.getAppPaths).toHaveBeenCalled();
        });

        test('should not initialize session when auto-save is disabled', async () => {
            autoSaveFunctions.recordingSettings.enableAutoSave = false;
            await autoSaveFunctions.initializeAutoSaveSession();

            expect(autoSaveFunctions.recordingAutoSave.sessionId).toBeNull();
            expect(mockElectronAPI.getAppPaths).not.toHaveBeenCalled();
        });

        test('should handle initialization errors gracefully', async () => {
            mockElectronAPI.getAppPaths.mockRejectedValue(new Error('Path error'));
            
            await autoSaveFunctions.initializeAutoSaveSession();

            expect(autoSaveFunctions.recordingSettings.enableAutoSave).toBe(false);
        });
    });

    describe('Auto-Save Timer Management', () => {
        test('should start auto-save timer when enabled', () => {
            const setIntervalSpy = jest.spyOn(global, 'setInterval');
            
            autoSaveFunctions.startAutoSaveTimer();

            expect(setIntervalSpy).toHaveBeenCalledWith(
                expect.any(Function),
                autoSaveFunctions.recordingSettings.autoSaveInterval
            );
            expect(autoSaveFunctions.recordingAutoSave.autoSaveTimer).toBeDefined();
        });

        test('should not start timer when auto-save is disabled', () => {
            const setIntervalSpy = jest.spyOn(global, 'setInterval');
            autoSaveFunctions.recordingSettings.enableAutoSave = false;
            
            autoSaveFunctions.startAutoSaveTimer();

            expect(setIntervalSpy).not.toHaveBeenCalled();
            expect(autoSaveFunctions.recordingAutoSave.autoSaveTimer).toBeNull();
        });

        test('should stop auto-save timer', () => {
            const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
            autoSaveFunctions.recordingAutoSave.autoSaveTimer = 123;
            
            autoSaveFunctions.stopAutoSaveTimer();

            expect(clearIntervalSpy).toHaveBeenCalledWith(123);
            expect(autoSaveFunctions.recordingAutoSave.autoSaveTimer).toBeNull();
        });
    });

    describe('Recording Chunk Saving', () => {
        beforeEach(() => {
            autoSaveFunctions.recordingAutoSave.sessionId = 'test_session_123';
            autoSaveFunctions.recordingAutoSave.chunkIndex = 0;
            autoSaveFunctions.audioChunks = [
                { size: 100 },
                { size: 200 }
            ];
        });

        test('should save current recording chunk', async () => {
            await autoSaveFunctions.saveCurrentRecordingChunk();

            expect(mockElectronAPI.saveRecordingChunk).toHaveBeenCalledWith(
                expect.any(ArrayBuffer),
                'test_session_123_chunk_000.webm'
            );
            expect(autoSaveFunctions.recordingAutoSave.savedChunks).toHaveLength(1);
            expect(autoSaveFunctions.recordingAutoSave.chunkIndex).toBe(1);
            expect(autoSaveFunctions.audioChunks).toEqual([]);
        });

        test('should not save when auto-save is disabled', async () => {
            autoSaveFunctions.recordingSettings.enableAutoSave = false;
            
            await autoSaveFunctions.saveCurrentRecordingChunk();

            expect(mockElectronAPI.saveRecordingChunk).not.toHaveBeenCalled();
        });

        test('should not save when no audio chunks exist', async () => {
            autoSaveFunctions.audioChunks = [];
            
            await autoSaveFunctions.saveCurrentRecordingChunk();

            expect(mockElectronAPI.saveRecordingChunk).not.toHaveBeenCalled();
        });

        test('should handle save errors gracefully', async () => {
            mockElectronAPI.saveRecordingChunk.mockRejectedValue(new Error('Save failed'));
            
            await autoSaveFunctions.saveCurrentRecordingChunk();

            expect(autoSaveFunctions.recordingAutoSave.savedChunks).toHaveLength(0);
            expect(autoSaveFunctions.recordingAutoSave.chunkIndex).toBe(0);
        });

        test('should increment chunk index correctly', async () => {
            await autoSaveFunctions.saveCurrentRecordingChunk();
            expect(autoSaveFunctions.recordingAutoSave.chunkIndex).toBe(1);

            autoSaveFunctions.audioChunks = [{ size: 150 }];
            await autoSaveFunctions.saveCurrentRecordingChunk();
            expect(autoSaveFunctions.recordingAutoSave.chunkIndex).toBe(2);

            expect(autoSaveFunctions.recordingAutoSave.savedChunks[1].filename).toBe('test_session_123_chunk_001.webm');
        });
    });

    describe('Recording Chunk Combination', () => {
        beforeEach(() => {
            autoSaveFunctions.recordingAutoSave.savedChunks = [
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
            
            const combinedBlob = await autoSaveFunctions.combineRecordingChunks(finalBlob);

            expect(mockElectronAPI.loadRecordingChunk).toHaveBeenCalledTimes(2);
            expect(combinedBlob).toBeDefined();
            expect(combinedBlob.size).toBeGreaterThan(finalBlob.size);
        });

        test('should return final blob when no chunks exist', async () => {
            autoSaveFunctions.recordingAutoSave.savedChunks = [];
            const finalBlob = { size: 500, type: 'audio/webm' };
            
            const result = await autoSaveFunctions.combineRecordingChunks(finalBlob);

            expect(result).toBe(finalBlob);
            expect(mockElectronAPI.loadRecordingChunk).not.toHaveBeenCalled();
        });

        test('should return final blob when auto-save is disabled', async () => {
            autoSaveFunctions.recordingSettings.enableAutoSave = false;
            const finalBlob = { size: 500, type: 'audio/webm' };
            
            const result = await autoSaveFunctions.combineRecordingChunks(finalBlob);

            expect(result).toBe(finalBlob);
        });

        test('should handle chunk loading errors gracefully', async () => {
            mockElectronAPI.loadRecordingChunk
                .mockResolvedValueOnce(Buffer.from('chunk1'))
                .mockRejectedValueOnce(new Error('Load failed'));
            
            const finalBlob = { size: 500, type: 'audio/webm' };
            const result = await autoSaveFunctions.combineRecordingChunks(finalBlob);

            expect(result).toBeDefined();
        });
    });

    describe('Auto-Save Cleanup', () => {
        beforeEach(() => {
            autoSaveFunctions.recordingAutoSave.savedChunks = [
                { filePath: '/mock/temp/chunk1.webm' },
                { filePath: '/mock/temp/chunk2.webm' }
            ];
            autoSaveFunctions.recordingAutoSave.sessionId = 'test_session';
            autoSaveFunctions.recordingAutoSave.chunkIndex = 2;
        });

        test('should clean up auto-save files', async () => {
            await autoSaveFunctions.cleanupAutoSaveFiles();

            expect(mockElectronAPI.deleteRecordingChunk).toHaveBeenCalledTimes(2);
            expect(mockElectronAPI.deleteRecordingChunk).toHaveBeenCalledWith('/mock/temp/chunk1.webm');
            expect(mockElectronAPI.deleteRecordingChunk).toHaveBeenCalledWith('/mock/temp/chunk2.webm');
            
            expect(autoSaveFunctions.recordingAutoSave.savedChunks).toEqual([]);
            expect(autoSaveFunctions.recordingAutoSave.chunkIndex).toBe(0);
            expect(autoSaveFunctions.recordingAutoSave.sessionId).toBeNull();
        });

        test('should not clean up when no chunks exist', async () => {
            autoSaveFunctions.recordingAutoSave.savedChunks = [];
            
            await autoSaveFunctions.cleanupAutoSaveFiles();

            expect(mockElectronAPI.deleteRecordingChunk).not.toHaveBeenCalled();
        });

        test('should handle cleanup errors gracefully', async () => {
            mockElectronAPI.deleteRecordingChunk.mockRejectedValue(new Error('Delete failed'));
            
            await autoSaveFunctions.cleanupAutoSaveFiles();

            // When deletion fails, chunks should remain in the array for retry
            expect(autoSaveFunctions.recordingAutoSave.savedChunks).toEqual([
                { filePath: '/mock/temp/chunk1.webm' },
                { filePath: '/mock/temp/chunk2.webm' }
            ]);
            // Session should not be reset when cleanup fails
            expect(autoSaveFunctions.recordingAutoSave.sessionId).toBe('test_session');
            expect(autoSaveFunctions.recordingAutoSave.chunkIndex).toBe(2);
        });

        test('should handle partial cleanup failures', async () => {
            // First chunk succeeds, second chunk fails
            mockElectronAPI.deleteRecordingChunk
                .mockResolvedValueOnce({ success: true })
                .mockRejectedValueOnce(new Error('Delete failed'));
            
            await autoSaveFunctions.cleanupAutoSaveFiles();

            // Only the failed chunk should remain
            expect(autoSaveFunctions.recordingAutoSave.savedChunks).toEqual([
                { filePath: '/mock/temp/chunk2.webm' }
            ]);
            // Session should not be reset when some chunks fail
            expect(autoSaveFunctions.recordingAutoSave.sessionId).toBe('test_session');
            expect(autoSaveFunctions.recordingAutoSave.chunkIndex).toBe(2);
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
            
            const result = await autoSaveFunctions.recoverRecordingFromChunks(sessionId);

            expect(result).toBe(true);
            expect(mockElectronAPI.findRecordingChunks).toHaveBeenCalledWith(sessionId);
            expect(mockElectronAPI.loadRecordingChunk).toHaveBeenCalledTimes(2);
        });

        test('should return false when no chunks found', async () => {
            mockElectronAPI.findRecordingChunks.mockResolvedValue([]);
            
            const result = await autoSaveFunctions.recoverRecordingFromChunks('nonexistent_session');

            expect(result).toBe(false);
        });

        test('should handle recovery errors gracefully', async () => {
            mockElectronAPI.findRecordingChunks.mockRejectedValue(new Error('Find failed'));
            
            const result = await autoSaveFunctions.recoverRecordingFromChunks('test_session');

            expect(result).toBe(false);
        });
    });
});
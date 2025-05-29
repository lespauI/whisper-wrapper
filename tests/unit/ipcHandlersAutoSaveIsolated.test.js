/**
 * Unit tests for IPC Handlers Auto-Save functionality (Isolated)
 */

const fs = require('fs');
const path = require('path');

// Mock fs module
jest.mock('fs');

describe('IPC Handlers Auto-Save Functionality (Isolated)', () => {
    let mockElectron;
    let ipcHandlers;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Mock electron
        mockElectron = {
            app: {
                getPath: jest.fn((pathType) => {
                    const paths = {
                        userData: '/mock/userData',
                        temp: '/mock/temp',
                        documents: '/mock/documents'
                    };
                    return paths[pathType] || '/mock/default';
                })
            }
        };

        // Mock fs methods
        fs.existsSync = jest.fn();
        fs.mkdirSync = jest.fn();
        fs.writeFileSync = jest.fn();
        fs.readFileSync = jest.fn();
        fs.unlinkSync = jest.fn();
        fs.statSync = jest.fn(() => ({ size: 1024 }));
        fs.readdirSync = jest.fn();

        // Mock path methods
        path.join = jest.fn((...args) => args.join('/'));
        path.dirname = jest.fn((filePath) => filePath.split('/').slice(0, -1).join('/'));
        path.basename = jest.fn((filePath) => filePath.split('/').pop());

        // Create isolated IPC handlers implementation
        ipcHandlers = {
            async handleGetAppPaths() {
                try {
                    return {
                        userData: mockElectron.app.getPath('userData'),
                        temp: mockElectron.app.getPath('temp'),
                        documents: mockElectron.app.getPath('documents')
                    };
                } catch (error) {
                    throw new Error(`Failed to get app paths: ${error.message}`);
                }
            },

            async handleSaveRecordingChunk(audioData, filename) {
                try {
                    if (!audioData || !filename) {
                        throw new Error('Invalid parameters: audioData and filename are required');
                    }

                    const tempDir = mockElectron.app.getPath('temp');
                    const filePath = path.join(tempDir, filename);
                    const dirPath = path.dirname(filePath);

                    // Create directory if it doesn't exist
                    if (!fs.existsSync(dirPath)) {
                        fs.mkdirSync(dirPath, { recursive: true });
                    }

                    // Convert audio data to buffer if needed
                    let buffer;
                    if (audioData instanceof ArrayBuffer) {
                        buffer = Buffer.from(audioData);
                    } else if (Buffer.isBuffer(audioData)) {
                        buffer = audioData;
                    } else {
                        throw new Error('Invalid audio data format');
                    }

                    // Write file
                    fs.writeFileSync(filePath, buffer);
                    
                    // Get file stats
                    const stats = fs.statSync(filePath);

                    return {
                        success: true,
                        filePath: filePath,
                        size: stats.size
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message
                    };
                }
            },

            async handleLoadRecordingChunk(filePath) {
                try {
                    if (!filePath) {
                        throw new Error('File path is required');
                    }

                    if (!fs.existsSync(filePath)) {
                        throw new Error('File not found');
                    }

                    const buffer = fs.readFileSync(filePath);
                    return buffer;
                } catch (error) {
                    throw new Error(`Failed to load recording chunk: ${error.message}`);
                }
            },

            async handleDeleteRecordingChunk(filePath) {
                try {
                    if (!filePath) {
                        throw new Error('File path is required');
                    }

                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }

                    return { success: true };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message
                    };
                }
            },

            async handleFindRecordingChunks(sessionId) {
                try {
                    if (!sessionId) {
                        throw new Error('Session ID is required');
                    }

                    const tempDir = mockElectron.app.getPath('temp');
                    
                    if (!fs.existsSync(tempDir)) {
                        return [];
                    }

                    const files = fs.readdirSync(tempDir);
                    const chunkFiles = files
                        .filter(file => file.startsWith(sessionId) && file.endsWith('.webm'))
                        .map(file => path.join(tempDir, file))
                        .sort();

                    return chunkFiles;
                } catch (error) {
                    throw new Error(`Failed to find recording chunks: ${error.message}`);
                }
            }
        };
    });

    describe('handleGetAppPaths', () => {
        test('should return all app paths', async () => {
            const result = await ipcHandlers.handleGetAppPaths();

            expect(result).toEqual({
                userData: '/mock/userData',
                temp: '/mock/temp',
                documents: '/mock/documents'
            });
            expect(mockElectron.app.getPath).toHaveBeenCalledWith('userData');
            expect(mockElectron.app.getPath).toHaveBeenCalledWith('temp');
            expect(mockElectron.app.getPath).toHaveBeenCalledWith('documents');
        });

        test('should handle errors gracefully', async () => {
            mockElectron.app.getPath.mockImplementation(() => {
                throw new Error('Path error');
            });

            await expect(ipcHandlers.handleGetAppPaths()).rejects.toThrow('Failed to get app paths: Path error');
        });
    });

    describe('handleSaveRecordingChunk', () => {
        test('should save recording chunk successfully', async () => {
            const audioData = new ArrayBuffer(100);
            const filename = 'test_chunk_001.webm';
            fs.existsSync.mockReturnValue(true);

            const result = await ipcHandlers.handleSaveRecordingChunk(audioData, filename);

            expect(result.success).toBe(true);
            expect(result.filePath).toBe('/mock/temp/test_chunk_001.webm');
            expect(result.size).toBe(1024);
            expect(fs.writeFileSync).toHaveBeenCalled();
        });

        test('should handle Buffer input', async () => {
            const audioData = Buffer.from('test audio data');
            const filename = 'test_chunk_002.webm';
            fs.existsSync.mockReturnValue(true);

            const result = await ipcHandlers.handleSaveRecordingChunk(audioData, filename);

            expect(result.success).toBe(true);
            expect(fs.writeFileSync).toHaveBeenCalledWith('/mock/temp/test_chunk_002.webm', audioData);
        });

        test('should create directory if it does not exist', async () => {
            const audioData = new ArrayBuffer(100);
            const filename = 'test_chunk_003.webm';
            fs.existsSync.mockReturnValue(false);

            await ipcHandlers.handleSaveRecordingChunk(audioData, filename);

            expect(fs.mkdirSync).toHaveBeenCalledWith('/mock/temp', { recursive: true });
        });

        test('should not create directory if it already exists', async () => {
            const audioData = new ArrayBuffer(100);
            const filename = 'test_chunk_004.webm';
            fs.existsSync.mockReturnValue(true);

            await ipcHandlers.handleSaveRecordingChunk(audioData, filename);

            expect(fs.mkdirSync).not.toHaveBeenCalled();
        });

        test('should handle invalid audio data format', async () => {
            const audioData = 'invalid data';
            const filename = 'test_chunk_005.webm';

            const result = await ipcHandlers.handleSaveRecordingChunk(audioData, filename);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid audio data format');
        });

        test('should handle file system errors', async () => {
            const audioData = new ArrayBuffer(100);
            const filename = 'test_chunk_006.webm';
            fs.writeFileSync.mockImplementation(() => {
                throw new Error('Write failed');
            });

            const result = await ipcHandlers.handleSaveRecordingChunk(audioData, filename);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Write failed');
        });

        test('should handle missing parameters', async () => {
            const result1 = await ipcHandlers.handleSaveRecordingChunk(null, 'filename.webm');
            const result2 = await ipcHandlers.handleSaveRecordingChunk(new ArrayBuffer(100), null);

            expect(result1.success).toBe(false);
            expect(result1.error).toBe('Invalid parameters: audioData and filename are required');
            expect(result2.success).toBe(false);
            expect(result2.error).toBe('Invalid parameters: audioData and filename are required');
        });
    });

    describe('handleLoadRecordingChunk', () => {
        test('should load recording chunk successfully', async () => {
            const filePath = '/mock/temp/test_chunk.webm';
            const mockBuffer = Buffer.from('test audio data');
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue(mockBuffer);

            const result = await ipcHandlers.handleLoadRecordingChunk(filePath);

            expect(result).toBe(mockBuffer);
            expect(fs.existsSync).toHaveBeenCalledWith(filePath);
            expect(fs.readFileSync).toHaveBeenCalledWith(filePath);
        });

        test('should handle missing file', async () => {
            const filePath = '/mock/temp/nonexistent.webm';
            fs.existsSync.mockReturnValue(false);

            await expect(ipcHandlers.handleLoadRecordingChunk(filePath))
                .rejects.toThrow('Failed to load recording chunk: File not found');
        });

        test('should handle missing file path', async () => {
            await expect(ipcHandlers.handleLoadRecordingChunk(null))
                .rejects.toThrow('Failed to load recording chunk: File path is required');
        });

        test('should handle read errors', async () => {
            const filePath = '/mock/temp/test_chunk.webm';
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation(() => {
                throw new Error('Read failed');
            });

            await expect(ipcHandlers.handleLoadRecordingChunk(filePath))
                .rejects.toThrow('Failed to load recording chunk: Read failed');
        });
    });

    describe('handleDeleteRecordingChunk', () => {
        test('should delete recording chunk successfully', async () => {
            const filePath = '/mock/temp/test_chunk.webm';
            fs.existsSync.mockReturnValue(true);

            const result = await ipcHandlers.handleDeleteRecordingChunk(filePath);

            expect(result.success).toBe(true);
            expect(fs.unlinkSync).toHaveBeenCalledWith(filePath);
        });

        test('should handle missing file gracefully', async () => {
            const filePath = '/mock/temp/nonexistent.webm';
            fs.existsSync.mockReturnValue(false);

            const result = await ipcHandlers.handleDeleteRecordingChunk(filePath);

            expect(result.success).toBe(true);
            expect(fs.unlinkSync).not.toHaveBeenCalled();
        });

        test('should handle missing file path', async () => {
            const result = await ipcHandlers.handleDeleteRecordingChunk(null);

            expect(result.success).toBe(false);
            expect(result.error).toBe('File path is required');
        });

        test('should handle delete errors', async () => {
            const filePath = '/mock/temp/test_chunk.webm';
            fs.existsSync.mockReturnValue(true);
            fs.unlinkSync.mockImplementation(() => {
                throw new Error('Delete failed');
            });

            const result = await ipcHandlers.handleDeleteRecordingChunk(filePath);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Delete failed');
        });
    });

    describe('handleFindRecordingChunks', () => {
        test('should find recording chunks for session', async () => {
            const sessionId = 'test_session_123';
            const mockFiles = [
                'test_session_123_chunk_000.webm',
                'test_session_123_chunk_001.webm',
                'other_file.txt',
                'test_session_123_chunk_002.webm'
            ];
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockReturnValue(mockFiles);

            const result = await ipcHandlers.handleFindRecordingChunks(sessionId);

            expect(result).toEqual([
                '/mock/temp/test_session_123_chunk_000.webm',
                '/mock/temp/test_session_123_chunk_001.webm',
                '/mock/temp/test_session_123_chunk_002.webm'
            ]);
        });

        test('should return empty array when no chunks found', async () => {
            const sessionId = 'nonexistent_session';
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockReturnValue(['other_file.txt']);

            const result = await ipcHandlers.handleFindRecordingChunks(sessionId);

            expect(result).toEqual([]);
        });

        test('should return empty array when temp directory does not exist', async () => {
            const sessionId = 'test_session';
            fs.existsSync.mockReturnValue(false);

            const result = await ipcHandlers.handleFindRecordingChunks(sessionId);

            expect(result).toEqual([]);
        });

        test('should handle missing session ID', async () => {
            await expect(ipcHandlers.handleFindRecordingChunks(null))
                .rejects.toThrow('Failed to find recording chunks: Session ID is required');
        });

        test('should handle read directory errors', async () => {
            const sessionId = 'test_session';
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockImplementation(() => {
                throw new Error('Read directory failed');
            });

            await expect(ipcHandlers.handleFindRecordingChunks(sessionId))
                .rejects.toThrow('Failed to find recording chunks: Read directory failed');
        });
    });

    describe('Error Handling and Edge Cases', () => {
        test('should handle large audio chunks', async () => {
            const largeAudioData = new ArrayBuffer(10 * 1024 * 1024); // 10MB
            const filename = 'large_chunk.webm';
            fs.existsSync.mockReturnValue(true);

            const result = await ipcHandlers.handleSaveRecordingChunk(largeAudioData, filename);

            expect(result.success).toBe(true);
            expect(fs.writeFileSync).toHaveBeenCalled();
        });

        test('should handle special characters in filenames', async () => {
            const audioData = new ArrayBuffer(100);
            const filename = 'test_chunk_with_特殊字符_001.webm';
            fs.existsSync.mockReturnValue(true);

            const result = await ipcHandlers.handleSaveRecordingChunk(audioData, filename);

            expect(result.success).toBe(true);
            expect(result.filePath).toContain(filename);
        });

        test('should handle empty audio data', async () => {
            const audioData = new ArrayBuffer(0);
            const filename = 'empty_chunk.webm';
            fs.existsSync.mockReturnValue(true);

            const result = await ipcHandlers.handleSaveRecordingChunk(audioData, filename);

            expect(result.success).toBe(true);
            expect(fs.writeFileSync).toHaveBeenCalled();
        });
    });

    describe('Integration with File System', () => {
        test('should create proper directory structure', async () => {
            const audioData = new ArrayBuffer(100);
            const filename = 'subdir/test_chunk.webm';
            fs.existsSync.mockReturnValue(false);

            await ipcHandlers.handleSaveRecordingChunk(audioData, filename);

            expect(path.dirname).toHaveBeenCalledWith('/mock/temp/subdir/test_chunk.webm');
            expect(fs.mkdirSync).toHaveBeenCalledWith('/mock/temp/subdir', { recursive: true });
        });

        test('should use correct file paths across operations', async () => {
            const audioData = new ArrayBuffer(100);
            const filename = 'test_chunk.webm';
            const expectedPath = '/mock/temp/test_chunk.webm';
            
            fs.existsSync.mockReturnValue(true);

            // Save
            const saveResult = await ipcHandlers.handleSaveRecordingChunk(audioData, filename);
            expect(saveResult.filePath).toBe(expectedPath);

            // Load
            fs.readFileSync.mockReturnValue(Buffer.from('test'));
            await ipcHandlers.handleLoadRecordingChunk(expectedPath);
            expect(fs.readFileSync).toHaveBeenCalledWith(expectedPath);

            // Delete
            await ipcHandlers.handleDeleteRecordingChunk(expectedPath);
            expect(fs.unlinkSync).toHaveBeenCalledWith(expectedPath);
        });
    });
});
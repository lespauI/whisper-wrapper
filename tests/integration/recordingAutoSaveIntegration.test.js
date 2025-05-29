/**
 * Integration tests for Recording Auto-Save functionality
 * Tests the complete workflow from recording start to recovery
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock Electron before any imports
jest.mock('electron', () => ({
    app: {
        getPath: jest.fn((pathType) => {
            const tempDir = '/tmp/whisper-wrapper-test';
            if (pathType === 'temp') return tempDir;
            if (pathType === 'userData') return tempDir;
            return tempDir; // Use tempDir for all paths to avoid permission issues
        }),
        getVersion: jest.fn(() => '1.0.0')
    },
    ipcMain: {
        handle: jest.fn(),
        on: jest.fn(),
        removeAllListeners: jest.fn()
    }
}));

describe('Recording Auto-Save Integration', () => {
    let IPCHandlers;
    let ipcHandlers;
    let tempDir;
    let recordingsDir;

    beforeAll(() => {
        // Create a real temporary directory for integration tests
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-wrapper-test-'));
        recordingsDir = path.join(tempDir, 'whisper-wrapper-recordings');
        
        // Ensure recordings directory exists
        if (!fs.existsSync(recordingsDir)) {
            fs.mkdirSync(recordingsDir, { recursive: true });
        }
    });

    afterAll(() => {
        // Clean up temporary directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    beforeEach(() => {
        // Clear any existing files
        if (fs.existsSync(recordingsDir)) {
            const files = fs.readdirSync(recordingsDir);
            files.forEach(file => {
                fs.unlinkSync(path.join(recordingsDir, file));
            });
        }

        // Update the mock to use our actual temp directory
        const { app } = require('electron');
        app.getPath.mockImplementation((pathType) => {
            if (pathType === 'temp') return tempDir;
            if (pathType === 'userData') return tempDir;
            return tempDir; // Use tempDir for all paths to avoid permission issues
        });

        // Import and create IPC handlers
        IPCHandlers = require('../../src/main/ipcHandlers');
        ipcHandlers = new IPCHandlers();
    });

    afterEach(() => {
        jest.resetModules();
    });

    describe('Complete Auto-Save Workflow', () => {
        test('should save, load, and delete recording chunks', async () => {
            const mockEvent = {};
            const sessionId = 'recording_1234567890_abcdef';
            
            // Create test audio data
            const chunk1Data = Buffer.from('audio chunk 1 data');
            const chunk2Data = Buffer.from('audio chunk 2 data');
            const chunk3Data = Buffer.from('audio chunk 3 data');
            
            // Save multiple chunks
            const save1 = await ipcHandlers.handleSaveRecordingChunk(
                mockEvent, 
                chunk1Data, 
                `${sessionId}_chunk_000.webm`
            );
            const save2 = await ipcHandlers.handleSaveRecordingChunk(
                mockEvent, 
                chunk2Data, 
                `${sessionId}_chunk_001.webm`
            );
            const save3 = await ipcHandlers.handleSaveRecordingChunk(
                mockEvent, 
                chunk3Data, 
                `${sessionId}_chunk_002.webm`
            );
            
            // Verify saves were successful
            expect(save1.success).toBe(true);
            expect(save2.success).toBe(true);
            expect(save3.success).toBe(true);
            
            // Verify files exist on disk
            expect(fs.existsSync(save1.filePath)).toBe(true);
            expect(fs.existsSync(save2.filePath)).toBe(true);
            expect(fs.existsSync(save3.filePath)).toBe(true);
            
            // Find chunks for the session
            const foundChunks = await ipcHandlers.handleFindRecordingChunks(mockEvent, sessionId);
            expect(foundChunks).toHaveLength(3);
            expect(foundChunks).toEqual([
                save1.filePath,
                save2.filePath,
                save3.filePath
            ]);
            
            // Load each chunk and verify content
            const loaded1 = await ipcHandlers.handleLoadRecordingChunk(mockEvent, save1.filePath);
            const loaded2 = await ipcHandlers.handleLoadRecordingChunk(mockEvent, save2.filePath);
            const loaded3 = await ipcHandlers.handleLoadRecordingChunk(mockEvent, save3.filePath);
            
            expect(loaded1).toEqual(chunk1Data);
            expect(loaded2).toEqual(chunk2Data);
            expect(loaded3).toEqual(chunk3Data);
            
            // Delete chunks
            await ipcHandlers.handleDeleteRecordingChunk(mockEvent, save1.filePath);
            await ipcHandlers.handleDeleteRecordingChunk(mockEvent, save2.filePath);
            await ipcHandlers.handleDeleteRecordingChunk(mockEvent, save3.filePath);
            
            // Verify files are deleted
            expect(fs.existsSync(save1.filePath)).toBe(false);
            expect(fs.existsSync(save2.filePath)).toBe(false);
            expect(fs.existsSync(save3.filePath)).toBe(false);
            
            // Verify no chunks found after deletion
            const foundAfterDelete = await ipcHandlers.handleFindRecordingChunks(mockEvent, sessionId);
            expect(foundAfterDelete).toHaveLength(0);
        });

        test('should handle multiple concurrent sessions', async () => {
            const mockEvent = {};
            const session1 = 'recording_111_aaa';
            const session2 = 'recording_222_bbb';
            const session3 = 'recording_333_ccc';
            
            // Save chunks for multiple sessions concurrently
            const savePromises = [
                ipcHandlers.handleSaveRecordingChunk(mockEvent, Buffer.from('s1c1'), `${session1}_chunk_000.webm`),
                ipcHandlers.handleSaveRecordingChunk(mockEvent, Buffer.from('s2c1'), `${session2}_chunk_000.webm`),
                ipcHandlers.handleSaveRecordingChunk(mockEvent, Buffer.from('s1c2'), `${session1}_chunk_001.webm`),
                ipcHandlers.handleSaveRecordingChunk(mockEvent, Buffer.from('s3c1'), `${session3}_chunk_000.webm`),
                ipcHandlers.handleSaveRecordingChunk(mockEvent, Buffer.from('s2c2'), `${session2}_chunk_001.webm`),
            ];
            
            const saveResults = await Promise.all(savePromises);
            expect(saveResults.every(result => result.success)).toBe(true);
            
            // Find chunks for each session
            const session1Chunks = await ipcHandlers.handleFindRecordingChunks(mockEvent, session1);
            const session2Chunks = await ipcHandlers.handleFindRecordingChunks(mockEvent, session2);
            const session3Chunks = await ipcHandlers.handleFindRecordingChunks(mockEvent, session3);
            
            expect(session1Chunks).toHaveLength(2);
            expect(session2Chunks).toHaveLength(2);
            expect(session3Chunks).toHaveLength(1);
            
            // Verify chunks are properly sorted
            expect(session1Chunks[0]).toContain('chunk_000');
            expect(session1Chunks[1]).toContain('chunk_001');
            expect(session2Chunks[0]).toContain('chunk_000');
            expect(session2Chunks[1]).toContain('chunk_001');
        });

        test('should handle orphaned chunk discovery', async () => {
            const mockEvent = {};
            
            // Create orphaned chunks from different sessions
            const orphanedSessions = [
                'recording_1111_aaaa',
                'recording_2222_bbbb',
                'recording_3333_cccc'
            ];
            
            // Save chunks for each session
            for (let i = 0; i < orphanedSessions.length; i++) {
                const sessionId = orphanedSessions[i];
                for (let j = 0; j < 3; j++) {
                    await ipcHandlers.handleSaveRecordingChunk(
                        mockEvent,
                        Buffer.from(`session ${i} chunk ${j}`),
                        `${sessionId}_chunk_${j.toString().padStart(3, '0')}.webm`
                    );
                }
            }
            
            // Find all orphaned chunks
            const allChunks = await ipcHandlers.handleFindRecordingChunks(mockEvent, 'recording_');
            expect(allChunks).toHaveLength(9); // 3 sessions × 3 chunks each
            
            // Find chunks for specific sessions
            for (const sessionId of orphanedSessions) {
                const sessionChunks = await ipcHandlers.handleFindRecordingChunks(mockEvent, sessionId);
                expect(sessionChunks).toHaveLength(3);
                
                // Verify chunk order
                expect(sessionChunks[0]).toContain('chunk_000');
                expect(sessionChunks[1]).toContain('chunk_001');
                expect(sessionChunks[2]).toContain('chunk_002');
            }
        });

        test('should handle large audio chunks', async () => {
            const mockEvent = {};
            const sessionId = 'recording_large_test';
            
            // Create large audio data (1MB)
            const largeChunk = Buffer.alloc(1024 * 1024, 'a');
            
            const saveResult = await ipcHandlers.handleSaveRecordingChunk(
                mockEvent,
                largeChunk,
                `${sessionId}_chunk_000.webm`
            );
            
            expect(saveResult.success).toBe(true);
            expect(saveResult.size).toBe(1024 * 1024);
            
            // Verify file exists and has correct size
            const stats = fs.statSync(saveResult.filePath);
            expect(stats.size).toBe(1024 * 1024);
            
            // Load and verify content
            const loadedChunk = await ipcHandlers.handleLoadRecordingChunk(mockEvent, saveResult.filePath);
            expect(loadedChunk).toEqual(largeChunk);
        });

        test('should handle chunk recovery after simulated crash', async () => {
            const mockEvent = {};
            const sessionId = 'recording_crash_test_123';
            
            // Simulate recording session that was interrupted
            const chunks = [
                Buffer.from('chunk 0 data'),
                Buffer.from('chunk 1 data'),
                Buffer.from('chunk 2 data'),
                Buffer.from('chunk 3 data')
            ];
            
            // Save chunks as if they were auto-saved during recording
            const savedChunks = [];
            for (let i = 0; i < chunks.length; i++) {
                const result = await ipcHandlers.handleSaveRecordingChunk(
                    mockEvent,
                    chunks[i],
                    `${sessionId}_chunk_${i.toString().padStart(3, '0')}.webm`
                );
                savedChunks.push(result);
            }
            
            // Simulate app restart - find orphaned chunks
            const recoveredChunks = await ipcHandlers.handleFindRecordingChunks(mockEvent, sessionId);
            expect(recoveredChunks).toHaveLength(4);
            
            // Load all chunks in order
            const loadedChunks = [];
            for (const chunkPath of recoveredChunks) {
                const chunkData = await ipcHandlers.handleLoadRecordingChunk(mockEvent, chunkPath);
                loadedChunks.push(chunkData);
            }
            
            // Verify chunks are loaded in correct order
            expect(loadedChunks[0]).toEqual(chunks[0]);
            expect(loadedChunks[1]).toEqual(chunks[1]);
            expect(loadedChunks[2]).toEqual(chunks[2]);
            expect(loadedChunks[3]).toEqual(chunks[3]);
            
            // Simulate recovery completion - clean up chunks
            for (const chunkPath of recoveredChunks) {
                await ipcHandlers.handleDeleteRecordingChunk(mockEvent, chunkPath);
            }
            
            // Verify cleanup
            const remainingChunks = await ipcHandlers.handleFindRecordingChunks(mockEvent, sessionId);
            expect(remainingChunks).toHaveLength(0);
        });

        test('should handle file system errors gracefully', async () => {
            const mockEvent = {};
            
            // Test with invalid path characters (if supported by OS)
            const invalidFilename = 'invalid<>:"|?*filename.webm';
            const audioData = Buffer.from('test data');
            
            try {
                await ipcHandlers.handleSaveRecordingChunk(mockEvent, audioData, invalidFilename);
                // If it succeeds, that's fine too (depends on OS)
            } catch (error) {
                expect(error.message).toContain('Failed to save recording chunk');
            }
            
            // Test loading non-existent file
            await expect(
                ipcHandlers.handleLoadRecordingChunk(mockEvent, '/nonexistent/path/file.webm')
            ).rejects.toThrow('Recording chunk file not found');
            
            // Test deleting non-existent file (should succeed gracefully)
            const deleteResult = await ipcHandlers.handleDeleteRecordingChunk(mockEvent, '/nonexistent/file.webm');
            expect(deleteResult.success).toBe(true);
        });

        test('should maintain chunk order with concurrent saves', async () => {
            const mockEvent = {};
            const sessionId = 'recording_concurrent_test';
            
            // Create chunks with different sizes to simulate real recording
            const chunks = Array.from({ length: 10 }, (_, i) => 
                Buffer.from(`chunk ${i.toString().padStart(2, '0')} data with some content`)
            );
            
            // Save chunks concurrently (simulating rapid auto-saves)
            const savePromises = chunks.map((chunk, index) =>
                ipcHandlers.handleSaveRecordingChunk(
                    mockEvent,
                    chunk,
                    `${sessionId}_chunk_${index.toString().padStart(3, '0')}.webm`
                )
            );
            
            const saveResults = await Promise.all(savePromises);
            expect(saveResults.every(result => result.success)).toBe(true);
            
            // Find chunks and verify order
            const foundChunks = await ipcHandlers.handleFindRecordingChunks(mockEvent, sessionId);
            expect(foundChunks).toHaveLength(10);
            
            // Verify chunks are in correct order
            for (let i = 0; i < 10; i++) {
                expect(foundChunks[i]).toContain(`chunk_${i.toString().padStart(3, '0')}`);
            }
            
            // Load chunks and verify content order
            const loadedChunks = [];
            for (const chunkPath of foundChunks) {
                const chunkData = await ipcHandlers.handleLoadRecordingChunk(mockEvent, chunkPath);
                loadedChunks.push(chunkData);
            }
            
            // Verify content matches original order
            for (let i = 0; i < chunks.length; i++) {
                expect(loadedChunks[i]).toEqual(chunks[i]);
            }
        });
    });

    describe('Performance and Reliability', () => {
        test('should handle rapid chunk saves without data loss', async () => {
            const mockEvent = {};
            const sessionId = 'recording_rapid_test';
            const chunkCount = 50;
            
            // Create many small chunks rapidly
            const savePromises = [];
            for (let i = 0; i < chunkCount; i++) {
                const chunkData = Buffer.from(`rapid chunk ${i} data`);
                const filename = `${sessionId}_chunk_${i.toString().padStart(3, '0')}.webm`;
                savePromises.push(
                    ipcHandlers.handleSaveRecordingChunk(mockEvent, chunkData, filename)
                );
            }
            
            // Wait for all saves to complete
            const results = await Promise.all(savePromises);
            expect(results.every(result => result.success)).toBe(true);
            
            // Verify all chunks were saved
            const foundChunks = await ipcHandlers.handleFindRecordingChunks(mockEvent, sessionId);
            expect(foundChunks).toHaveLength(chunkCount);
            
            // Verify no data corruption
            for (let i = 0; i < chunkCount; i++) {
                const chunkData = await ipcHandlers.handleLoadRecordingChunk(mockEvent, foundChunks[i]);
                expect(chunkData.toString()).toBe(`rapid chunk ${i} data`);
            }
        });

        test('should handle mixed session operations', async () => {
            const mockEvent = {};
            const sessions = ['session_a', 'session_b', 'session_c'];
            
            // Perform mixed operations across sessions
            const operations = [];
            
            // Save chunks for each session
            sessions.forEach((sessionId, sessionIndex) => {
                for (let i = 0; i < 3; i++) {
                    operations.push(
                        ipcHandlers.handleSaveRecordingChunk(
                            mockEvent,
                            Buffer.from(`${sessionId} chunk ${i}`),
                            `recording_${sessionId}_chunk_${i.toString().padStart(3, '0')}.webm`
                        )
                    );
                }
            });
            
            // Execute all operations
            const results = await Promise.all(operations);
            expect(results.every(result => result.success)).toBe(true);
            
            // Verify each session has correct chunks
            for (const sessionId of sessions) {
                const chunks = await ipcHandlers.handleFindRecordingChunks(mockEvent, `recording_${sessionId}`);
                expect(chunks).toHaveLength(3);
                
                // Verify content
                for (let i = 0; i < 3; i++) {
                    const chunkData = await ipcHandlers.handleLoadRecordingChunk(mockEvent, chunks[i]);
                    expect(chunkData.toString()).toBe(`${sessionId} chunk ${i}`);
                }
            }
            
            // Clean up one session
            const session1Chunks = await ipcHandlers.handleFindRecordingChunks(mockEvent, 'recording_session_a');
            for (const chunkPath of session1Chunks) {
                await ipcHandlers.handleDeleteRecordingChunk(mockEvent, chunkPath);
            }
            
            // Verify other sessions are unaffected
            const session2Chunks = await ipcHandlers.handleFindRecordingChunks(mockEvent, 'recording_session_b');
            const session3Chunks = await ipcHandlers.handleFindRecordingChunks(mockEvent, 'recording_session_c');
            
            expect(session2Chunks).toHaveLength(3);
            expect(session3Chunks).toHaveLength(3);
            
            // Verify deleted session has no chunks
            const deletedSessionChunks = await ipcHandlers.handleFindRecordingChunks(mockEvent, 'recording_session_a');
            expect(deletedSessionChunks).toHaveLength(0);
        });
    });
});
const fs = require('fs');
const os = require('os');
const path = require('path');

const mockTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-wrapper-ipc-security-'));
const mockDialog = { showSaveDialog: jest.fn() };
const mockTranscriptionStore = { get: jest.fn() };
const mockMeetingNotes = {
    generate: jest.fn(),
    getNotes: jest.fn(),
    deleteNotes: jest.fn(),
    hasNotes: jest.fn(),
    loadTemplates: jest.fn(),
    createTemplate: jest.fn(),
    updateTemplate: jest.fn(),
    deleteTemplate: jest.fn()
};

jest.mock('electron', () => ({
    app: { getPath: () => mockTempDir },
    dialog: mockDialog,
    ipcMain: { handle: jest.fn() },
    desktopCapturer: { getSources: jest.fn() }
}));
jest.mock('../../src/services/fileService', () => jest.fn().mockImplementation(() => ({})));
jest.mock('../../src/services/transcriptionService', () => jest.fn().mockImplementation(() => ({})));
jest.mock('../../src/services/recordingService', () => jest.fn().mockImplementation(() => ({})));
jest.mock('../../src/services/transcriptionStoreService', () => jest.fn().mockImplementation(() => mockTranscriptionStore));
jest.mock('../../src/services/meetingNotesService', () => jest.fn().mockImplementation(() => mockMeetingNotes));
jest.mock('../../src/config', () => ({ get: jest.fn(), set: jest.fn() }));

const IPCHandlers = require('../../src/main/ipcHandlers');

describe('IPC file and meeting notes protections', () => {
    let handlers;
    let webContents;
    let event;

    beforeEach(() => {
        fs.rmSync(mockTempDir, { recursive: true, force: true });
        fs.mkdirSync(mockTempDir, { recursive: true });
        jest.clearAllMocks();
        webContents = { mainFrame: {}, isDestroyed: jest.fn().mockReturnValue(false) };
        event = { sender: webContents, senderFrame: webContents.mainFrame };
        handlers = new IPCHandlers({ webContents });
    });

    async function startSession() {
        const result = await handlers.handleStartRecordingChunkSession(event);
        expect(result.success).toBe(true);
        expect(result.sessionId).toMatch(/^recording_\d{10,16}_[a-f0-9]{16}$/);
        return result.sessionId;
    }

    afterAll(() => {
        fs.rmSync(mockTempDir, { recursive: true, force: true });
    });

    test('preserves normal recording chunk save, load, and delete', async () => {
        const sessionId = await startSession();
        const filename = `${sessionId}_chunk_000.webm`;
        const audio = Buffer.from('recorded audio');
        const saved = await handlers.handleSaveRecordingChunk(event, audio, filename);

        expect(saved.success).toBe(true);
        expect(saved.filePath).toBe(path.join(fs.realpathSync(mockTempDir), 'whisper-wrapper-recordings', filename));
        await expect(handlers.handleLoadRecordingChunk(event, saved.filePath)).resolves.toEqual(audio);
        await expect(handlers.handleDeleteRecordingChunk(event, saved.filePath)).resolves.toEqual({ success: true });
        expect(fs.existsSync(saved.filePath)).toBe(false);
    });

    test('rejects invalid chunk names and paths outside recording storage', async () => {
        await expect(handlers.handleSaveRecordingChunk(event, Buffer.from('audio'), '../outside.webm'))
            .rejects.toThrow('Invalid recording chunk filename');
        fs.mkdirSync(path.join(fs.realpathSync(mockTempDir), 'whisper-wrapper-recordings'));
        const protectedFile = path.join(mockTempDir, 'protected.txt');
        fs.writeFileSync(protectedFile, 'keep');

        await expect(handlers.handleLoadRecordingChunk(event, protectedFile))
            .rejects.toThrow('outside the allowed storage');
        await expect(handlers.handleDeleteRecordingChunk(event, protectedFile))
            .rejects.toThrow('outside the allowed storage');
        expect(fs.readFileSync(protectedFile, 'utf8')).toBe('keep');
    });

    test('requires a main-issued session and denies chunks from another session', async () => {
        const activeSessionId = await startSession();
        const unregisteredPath = path.join(
            fs.realpathSync(mockTempDir),
            'whisper-wrapper-recordings',
            'recording_1794414300000_abc123xyz_chunk_000.webm'
        );
        fs.mkdirSync(path.dirname(unregisteredPath), { recursive: true });
        fs.writeFileSync(unregisteredPath, 'synthetic orphan');

        await expect(handlers.handleSaveRecordingChunk(
            event,
            Buffer.from('audio'),
            'recording_1794414300000_abc123xyz_chunk_001.webm'
        )).rejects.toThrow('not authorized');
        await expect(handlers.handleLoadRecordingChunk(event, unregisteredPath)).rejects.toThrow('not authorized');
        expect(activeSessionId).not.toBe('recording_1794414300000_abc123xyz');
    });

    test('claims valid orphan chunks through the recovery scan', async () => {
        const orphanSessionId = 'recording_1794414300000_abc123xyz';
        const filename = `${orphanSessionId}_chunk_004.webm`;
        const recordingsDir = path.join(fs.realpathSync(mockTempDir), 'whisper-wrapper-recordings');
        fs.mkdirSync(recordingsDir);
        const orphanPath = path.join(recordingsDir, filename);
        fs.writeFileSync(orphanPath, 'recovered audio');

        await expect(handlers.handleFindRecordingChunks(event, 'recording_')).resolves.toEqual([orphanPath]);
        await expect(handlers.handleLoadRecordingChunk(event, orphanPath)).resolves.toEqual(Buffer.from('recovered audio'));
    });

    test('rejects chunk operations from another renderer', async () => {
        const untrustedEvent = { sender: {}, senderFrame: {} };
        await expect(handlers.handleSaveRecordingChunk(
            untrustedEvent,
            Buffer.from('audio'),
            'recording_1794414300000_abc123xyz_chunk_000.webm'
        )).rejects.toThrow('untrusted renderer');
        expect(fs.existsSync(path.join(mockTempDir, 'whisper-wrapper-recordings'))).toBe(false);
    });

    test('rejects a chunk symlink without changing its target', async () => {
        const sessionId = await startSession();
        const filename = `${sessionId}_chunk_000.webm`;
        const saved = await handlers.handleSaveRecordingChunk(event, Buffer.from('audio'), filename);
        const protectedFile = path.join(mockTempDir, 'protected.txt');
        fs.writeFileSync(protectedFile, 'keep');
        fs.unlinkSync(saved.filePath);
        const linkPath = saved.filePath;
        fs.symlinkSync(protectedFile, linkPath);

        await expect(handlers.handleLoadRecordingChunk(event, linkPath)).rejects.toThrow('not an owned regular file');
        await expect(handlers.handleDeleteRecordingChunk(event, linkPath)).rejects.toThrow('not an owned regular file');
        expect(fs.readFileSync(protectedFile, 'utf8')).toBe('keep');
        expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(true);
    });

    test('rejects oversized chunks before reading them into memory', async () => {
        const sessionId = await startSession();
        const recordingsDir = path.join(fs.realpathSync(mockTempDir), 'whisper-wrapper-recordings');
        fs.mkdirSync(recordingsDir);
        const filename = `${sessionId}_chunk_000.webm`;
        const saved = await handlers.handleSaveRecordingChunk(event, Buffer.from('x'), filename);
        const filePath = saved.filePath;
        fs.truncateSync(filePath, 100 * 1024 * 1024 + 1);

        await expect(handlers.handleLoadRecordingChunk(event, filePath)).rejects.toThrow('too large');
        expect(fs.statSync(filePath).size).toBeGreaterThan(100 * 1024 * 1024);
    });

    test('saves to a user-selected regular file and rejects a symlink destination', async () => {
        const destination = path.join(mockTempDir, 'transcription.txt');
        fs.writeFileSync(destination, 'old content');
        mockDialog.showSaveDialog.mockResolvedValue({ canceled: false, filePath: destination });

        await handlers.handleSaveFile(event, 'new content', 'transcription.txt');
        expect(fs.readFileSync(destination, 'utf8')).toBe('new content');

        const protectedFile = path.join(mockTempDir, 'protected.txt');
        const symlinkPath = path.join(mockTempDir, 'linked.txt');
        fs.writeFileSync(protectedFile, 'keep');
        fs.symlinkSync(protectedFile, symlinkPath);
        mockDialog.showSaveDialog.mockResolvedValue({ canceled: false, filePath: symlinkPath });

        await expect(handlers.handleSaveFile(event, 'overwrite', 'linked.txt'))
            .rejects.toThrow('unowned or non-regular file');
        expect(fs.readFileSync(protectedFile, 'utf8')).toBe('keep');
    });

    test('allows user-selected recording exports larger than 300 MiB', async () => {
        const destination = path.join(mockTempDir, 'large-recording.wav');
        const largeRecording = Buffer.allocUnsafe(300 * 1024 * 1024 + 1);
        jest.spyOn(handlers, '_writeFileNoFollow').mockImplementation(() => {});
        mockDialog.showSaveDialog.mockResolvedValue({ canceled: false, filePath: destination });

        await expect(handlers.handleSaveFile(event, largeRecording, 'large-recording.wav'))
            .resolves.toEqual({ canceled: false, filePath: destination });
        expect(mockDialog.showSaveDialog).toHaveBeenCalledTimes(1);
        expect(handlers._writeFileNoFollow.mock.calls[0][0]).toBe(destination);
        expect(handlers._writeFileNoFollow.mock.calls[0][1]).toBe(largeRecording);
    });

    test('only reads or deletes notes for an existing transcription owner', async () => {
        mockTranscriptionStore.get.mockResolvedValue(null);
        const invalidId = await handlers.handleMeetingNotesDelete(event, { transcriptionId: '../protected' });
        const missingOwner = await handlers.handleMeetingNotesGet(event, { transcriptionId: 'owned-id' });

        expect(invalidId.success).toBe(false);
        expect(missingOwner.success).toBe(false);
        expect(mockTranscriptionStore.get).toHaveBeenCalledTimes(1);
        expect(mockMeetingNotes.deleteNotes).not.toHaveBeenCalled();
        expect(mockMeetingNotes.getNotes).not.toHaveBeenCalled();

        mockTranscriptionStore.get.mockResolvedValue({ entry: { id: 'owned-id' }, text: 'transcript' });
        mockMeetingNotes.getNotes.mockReturnValue({ notes: 'owned notes' });
        await expect(handlers.handleMeetingNotesGet(event, { transcriptionId: 'owned-id' }))
            .resolves.toEqual({ success: true, notes: { notes: 'owned notes' } });
    });
});

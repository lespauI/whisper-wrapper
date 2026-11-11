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

    afterAll(() => {
        fs.rmSync(mockTempDir, { recursive: true, force: true });
    });

    test('preserves normal recording chunk save, load, and delete', async () => {
        const filename = 'recording_1794414300000_abc123xyz_chunk_000.webm';
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
        const filename = 'recording_1794414300000_abc123xyz_chunk_000.webm';
        await handlers.handleSaveRecordingChunk(event, Buffer.from('audio'), filename);
        const protectedFile = path.join(mockTempDir, 'protected.txt');
        fs.writeFileSync(protectedFile, 'keep');
        const linkPath = path.join(fs.realpathSync(mockTempDir), 'whisper-wrapper-recordings', 'recording_1794414300000_abc123xyz_chunk_001.webm');
        fs.symlinkSync(protectedFile, linkPath);

        await expect(handlers.handleLoadRecordingChunk(event, linkPath)).rejects.toThrow('not an owned regular file');
        await expect(handlers.handleDeleteRecordingChunk(event, linkPath)).rejects.toThrow('not an owned regular file');
        expect(fs.readFileSync(protectedFile, 'utf8')).toBe('keep');
        expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(true);
    });

    test('rejects oversized chunks before reading them into memory', async () => {
        const recordingsDir = path.join(fs.realpathSync(mockTempDir), 'whisper-wrapper-recordings');
        fs.mkdirSync(recordingsDir);
        const filePath = path.join(recordingsDir, 'recording_1794414300000_abc123xyz_chunk_000.webm');
        fs.writeFileSync(filePath, 'x');
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

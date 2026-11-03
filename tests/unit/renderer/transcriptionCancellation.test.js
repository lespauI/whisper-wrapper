const { JSDOM } = require('jsdom');
const { StatusController } = require('../../../src/renderer/controllers/StatusController.js');
const { FileUploadController } = require('../../../src/renderer/controllers/FileUploadController.js');
const { RecordingController } = require('../../../src/renderer/controllers/RecordingController.js');

describe('transcription stop controls', () => {
    let dom;
    let status;
    let appState;

    beforeEach(() => {
        dom = new JSDOM(`<body>
            <span id="status-text"></span>
            <button id="stop-transcription-btn" class="hidden"></button>
            <div id="transcription-loading" class="hidden"></div>
            <div id="transcription-empty"></div>
            <div id="transcription-editor">Previous text</div>
            <div id="file-upload"></div><div id="upload-progress" class="hidden"></div>
        </body>`);
        global.window = dom.window;
        global.document = dom.window.document;
        window.electronAPI = {
            cancelTranscription: jest.fn().mockResolvedValue({ success: true, canceled: true }),
            transcribeFile: jest.fn().mockResolvedValue({ success: false, canceled: true }),
            transcribeAudio: jest.fn().mockResolvedValue({ success: false, canceled: true }),
            onTranscriptionProgress: jest.fn(),
            removeAllListeners: jest.fn()
        };
        appState = {
            subscribe: jest.fn(), setStatus: jest.fn(), setFileUploadState: jest.fn(),
            getFileUploadState: jest.fn().mockReturnValue({ isProcessing: false })
        };
        status = new StatusController(appState);
        jest.spyOn(status, 'showError').mockImplementation(() => {});
    });

    afterEach(() => {
        dom.window.close();
        delete global.window;
        delete global.document;
        jest.restoreAllMocks();
    });

    test('shows a stop button during processing and sends cancellation on click', async () => {
        const button = document.getElementById('stop-transcription-btn');
        const operation = status.beginTranscription();
        expect(button.classList.contains('hidden')).toBe(false);
        button.click();
        expect(window.electronAPI.cancelTranscription).toHaveBeenCalledTimes(1);
        expect(button.disabled).toBe(true);
        await Promise.resolve();
        status.endTranscription(operation);
        expect(button.classList.contains('hidden')).toBe(true);
        expect(document.getElementById('transcription-editor').textContent).toBe('Previous text');
    });

    test('canceled file processing restores the upload area without an error', async () => {
        const upload = Object.create(FileUploadController.prototype);
        Object.assign(upload, { appState, statusController: status, validateFile: () => true });
        await upload.handleFileUpload('/audio.wav');
        expect(status.showError).not.toHaveBeenCalled();
        expect(appState.setFileUploadState).toHaveBeenLastCalledWith({ currentFile: null, isProcessing: false, progress: 0 });
        expect(document.getElementById('file-upload').classList.contains('hidden')).toBe(false);
        expect(document.getElementById('status-text').textContent).toBe('Transcription stopped');
    });

    test('canceled recorded audio stays available for another attempt', async () => {
        const recording = Object.create(RecordingController.prototype);
        const recordingBlob = { arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1)) };
        Object.assign(recording, { recordingBlob, appState, statusController: status });
        await recording.transcribeRecording();
        expect(recording.recordingBlob).toBe(recordingBlob);
        expect(status.showError).not.toHaveBeenCalled();
        expect(document.getElementById('stop-transcription-btn').classList.contains('hidden')).toBe(true);
        expect(document.getElementById('status-text').textContent).toBe('Transcription stopped');
    });

    test('reports cancellation failure and permits retrying the stop action', async () => {
        window.electronAPI.cancelTranscription.mockRejectedValue(new Error('Connection lost'));
        await status.stopTranscription();
        expect(status.showError).toHaveBeenCalledWith('Connection lost');
        expect(document.getElementById('stop-transcription-btn').disabled).toBe(false);
    });
    test('stops before recorded audio finishes preparation', async () => {
        let finish;
        const recording = Object.create(RecordingController.prototype);
        Object.assign(recording, {
            recordingBlob: { arrayBuffer: () => new Promise(resolve => { finish = resolve; }) },
            appState, statusController: status
        });
        window.electronAPI.cancelTranscription.mockResolvedValue({ success: true, canceled: false });
        const task = recording.transcribeRecording();
        await status.stopTranscription();
        finish(new ArrayBuffer(1));
        await task;
        expect(window.electronAPI.transcribeAudio).not.toHaveBeenCalled();
        expect(status.showError).not.toHaveBeenCalled();
        expect(document.getElementById('status-text').textContent).toBe('Transcription stopped');
    });

    test('stops ongoing transcription and clears its pending chunks while retaining text', async () => {
        const recording = Object.create(RecordingController.prototype);
        const ongoingTranscription = { processingQueue: true, enabled: true, chunkQueue: ['waiting'], transcriptionText: 'Partial text' };
        appState.setRecordingState = jest.fn();
        Object.assign(recording, { ongoingTranscription, appState, stopOngoingTranscription: jest.fn() });
        window.whisperApp = { controllers: { recording } };
        await status.stopTranscription();
        expect(recording.stopOngoingTranscription).toHaveBeenCalled();
        expect(ongoingTranscription.enabled).toBe(false);
        expect(ongoingTranscription.chunkQueue).toEqual([]);
        expect(ongoingTranscription.transcriptionText).toBe('Partial text');
        expect(appState.setRecordingState).toHaveBeenCalledWith({ ongoingTranscription: false });
    });

    test('ignores a repeated manual start without hiding Stop or removing the active listener', async () => {
        let finish;
        const unsubscribe = jest.fn();
        window.electronAPI.onTranscriptionProgress.mockReturnValue(unsubscribe);
        window.electronAPI.transcribeAudio.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
        const recording = Object.create(RecordingController.prototype);
        Object.assign(recording, {
            recordingBlob: { arrayBuffer: async () => new ArrayBuffer(1) }, appState, statusController: status
        });
        const first = recording.transcribeRecording();
        await Promise.resolve();
        await recording.transcribeRecording();
        expect(window.electronAPI.transcribeAudio).toHaveBeenCalledTimes(1);
        expect(document.getElementById('stop-transcription-btn').classList.contains('hidden')).toBe(false);
        expect(unsubscribe).not.toHaveBeenCalled();
        expect(window.electronAPI.removeAllListeners).not.toHaveBeenCalled();
        finish({ success: false, canceled: true });
        await first;
        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    test('a new start cannot revive canceled preparation or have its loading state cleared by it', async () => {
        let finishPreparation;
        let finishCurrent;
        const recording = Object.create(RecordingController.prototype);
        Object.assign(recording, {
            recordingBlob: { arrayBuffer: () => new Promise(resolve => { finishPreparation = resolve; }) },
            appState, statusController: status
        });
        window.electronAPI.cancelTranscription.mockResolvedValue({ success: true, canceled: false });
        const old = recording.transcribeRecording();
        await status.stopTranscription();
        recording.recordingBlob = { arrayBuffer: async () => new ArrayBuffer(2) };
        window.electronAPI.transcribeAudio.mockImplementation(() => new Promise(resolve => { finishCurrent = resolve; }));
        const current = recording.transcribeRecording();
        await Promise.resolve();
        const currentOperation = recording.recordingTranscription;
        finishPreparation(new ArrayBuffer(1));
        await old;
        expect(window.electronAPI.transcribeAudio).toHaveBeenCalledTimes(1);
        expect(window.electronAPI.transcribeAudio.mock.calls[0][0].byteLength).toBe(2);
        expect(recording.recordingTranscription).toBe(currentOperation);
        expect(document.getElementById('transcription-loading').classList.contains('hidden')).toBe(false);
        expect(document.getElementById('stop-transcription-btn').classList.contains('hidden')).toBe(false);
        finishCurrent({ success: false, canceled: true });
        await current;
        expect(status.transcriptionOperations.size).toBe(0);
    });

    test('completion of a file keeps another recording cancelable and removes only its own listener', async () => {
        let finishFile;
        let finishRecording;
        const fileUnsubscribe = jest.fn();
        const recordingUnsubscribe = jest.fn();
        window.electronAPI.onTranscriptionProgress.mockReturnValueOnce(fileUnsubscribe).mockReturnValueOnce(recordingUnsubscribe);
        window.electronAPI.transcribeFile.mockImplementation(() => new Promise(resolve => { finishFile = resolve; }));
        window.electronAPI.transcribeAudio.mockImplementation(() => new Promise(resolve => { finishRecording = resolve; }));
        const upload = Object.create(FileUploadController.prototype);
        Object.assign(upload, { appState, statusController: status, validateFile: () => true });
        const recording = Object.create(RecordingController.prototype);
        Object.assign(recording, {
            recordingBlob: { arrayBuffer: async () => new ArrayBuffer(1) }, appState, statusController: status
        });
        const file = upload.handleFileUpload('/audio.wav');
        const audio = recording.transcribeRecording();
        await Promise.resolve();
        finishFile({ success: false, canceled: true });
        await file;
        expect(fileUnsubscribe).toHaveBeenCalledTimes(1);
        expect(recordingUnsubscribe).not.toHaveBeenCalled();
        expect(window.electronAPI.removeAllListeners).not.toHaveBeenCalled();
        expect(document.getElementById('stop-transcription-btn').classList.contains('hidden')).toBe(false);
        finishRecording({ success: false, canceled: true });
        await audio;
        expect(recordingUnsubscribe).toHaveBeenCalledTimes(1);
    });

    test('completion of a stopped background worker cannot stop its replacement', async () => {
        let finishOldPreparation;
        let finishNewPreparation;
        appState.setRecordingState = jest.fn();
        const recording = Object.create(RecordingController.prototype);
        Object.assign(recording, {
            appState, statusController: status,
            ongoingTranscription: {
                enabled: true, processingQueue: true, chunks: [], transcriptionText: '',
                chunkQueue: [{ chunkNumber: 1, blob: { arrayBuffer: () => new Promise(resolve => { finishOldPreparation = resolve; }) } }]
            },
            stopOngoingTranscription: jest.fn(() => recording.stopTranscriptionWorker()),
            _segmentChunkToWavs: async () => ({ wavBuffers: [new ArrayBuffer(1)], segments: [] }),
            generateContextPrompt: () => '', updateOngoingTranscriptionDisplay: jest.fn()
        });
        window.whisperApp = { controllers: { recording } };
        const old = recording.processTranscriptionQueue();
        await status.stopTranscription();
        recording.ongoingTranscription.enabled = true;
        recording.ongoingTranscription.processingQueue = true;
        recording.ongoingTranscription.chunkQueue.push({ chunkNumber: 2, blob: {
            arrayBuffer: () => new Promise(resolve => { finishNewPreparation = resolve; })
        } });
        window.electronAPI.transcribeAudio.mockImplementation(async () => {
            recording.ongoingTranscription.processingQueue = false;
            return { success: true, text: 'New speech' };
        });
        const current = recording.processTranscriptionQueue();
        finishOldPreparation(new ArrayBuffer(1));
        await old;
        expect(recording.ongoingTranscription.processingQueue).toBe(true);
        expect(window.electronAPI.transcribeAudio).not.toHaveBeenCalled();
        expect(document.getElementById('stop-transcription-btn').classList.contains('hidden')).toBe(false);
        finishNewPreparation(new ArrayBuffer(1));
        await current;
        expect(recording.ongoingTranscription.transcriptionText).toBe('New speech');
        expect(window.electronAPI.transcribeAudio).toHaveBeenCalledTimes(1);
    });

});

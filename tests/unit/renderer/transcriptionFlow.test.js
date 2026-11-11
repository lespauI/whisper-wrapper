const { JSDOM } = require('jsdom');
const { FileUploadController } = require('../../../src/renderer/controllers/FileUploadController.js');
const { TranscriptionController } = require('../../../src/renderer/controllers/TranscriptionController.js');

describe('Transcription result flow', () => {
    let dom;
    let transcriptionController;
    let fileUploadController;
    let statusController;

    beforeEach(() => {
        dom = new JSDOM(`
            <div id="transcription-editor">
                <textarea id="transcription-text"></textarea>
                <div id="transcription-segments" class="hidden"></div>
            </div>
            <div id="transcription-empty"></div>
            <div id="transcription-loading"></div>
            <div id="transcription-status"></div>
            <button id="toggle-view-btn"></button>
            <button id="undo-btn"></button>
            <button id="redo-btn"></button>
        `, { url: 'http://localhost' });

        global.window = dom.window;
        global.document = dom.window.document;
        global.localStorage = dom.window.localStorage;
        window.electronAPI = {
            saveFile: jest.fn().mockResolvedValue({ canceled: false })
        };

        statusController = {
            updateStatus: jest.fn(),
            showError: jest.fn(),
            showTranscriptionLoading: jest.fn()
        };
        transcriptionController = Object.create(TranscriptionController.prototype);
        transcriptionController.appState = {};
        transcriptionController.statusController = statusController;
        transcriptionController.tabController = { switchTab: jest.fn() };
        transcriptionController.transcriptionState = {
            originalText: 'Transcript A',
            currentText: 'Transcript A',
            isDirty: false,
            lastSaved: null,
            autoSaveTimer: null,
            history: ['Transcript A'],
            historyIndex: 0,
            segments: [{ start: 0, end: 1, text: 'Transcript A' }],
            viewMode: 'timestamped'
        };
        transcriptionController.currentSegments = transcriptionController.transcriptionState.segments;
        transcriptionController.scheduleAutoSave = jest.fn();
        transcriptionController.saveTranscriptionToHistory = jest.fn();
        transcriptionController.hideAudioPlayer = jest.fn();

        fileUploadController = Object.create(FileUploadController.prototype);
        fileUploadController.appState = {
            setTranscriptionState: jest.fn(),
            setFileUploadState: jest.fn()
        };
        fileUploadController.statusController = statusController;
        fileUploadController.tabController = { switchTab: jest.fn() };
        window.whisperApp = { controllers: { transcription: transcriptionController } };
    });

    afterEach(() => {
        dom.window.close();
        delete global.window;
        delete global.document;
        delete global.localStorage;
    });

    test('shows and exports the new result after an earlier edit and view switch', async () => {
        const textField = document.getElementById('transcription-text');
        textField.value = 'Transcript A';
        transcriptionController.handleTranscriptionEdit('Edited transcript A');

        const newSegments = [{ start: 0, end: 2, text: 'Transcript B' }];
        await fileUploadController.handleTranscriptionSuccess({
            text: 'Transcript B',
            segments: newSegments,
            language: 'en'
        });

        expect(transcriptionController.transcriptionState.currentText).toBe('Transcript B');
        expect(textField.value).toBe('Transcript B');

        transcriptionController.toggleViewMode();

        expect(transcriptionController.transcriptionState.viewMode).toBe('plain');
        expect(textField.value).toBe('Transcript B');

        await transcriptionController.exportAs('txt');

        expect(window.electronAPI.saveFile).toHaveBeenCalledWith(
            'Transcript B',
            expect.stringMatching(/transcription-.*\.txt/)
        );
    });
});

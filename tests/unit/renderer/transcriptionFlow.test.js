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
            showWarning: jest.fn(),
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
        transcriptionController.seekToTime = jest.fn();

        fileUploadController = Object.create(FileUploadController.prototype);
        const sharedTranscription = {};
        fileUploadController.appState = {
            setTranscriptionState: state => Object.assign(sharedTranscription, state),
            getTranscriptionState: () => sharedTranscription,
            setFileUploadState: jest.fn()
        };
        transcriptionController.appState = fileUploadController.appState;
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
            expect.stringMatching(/Status: Complete[\s\S]*\n\nTranscript B$/),
            expect.stringMatching(/transcription-.*\.txt/)
        );
    });

    test('clicking a segment in the shared renderer seeks to its start time', async () => {
        const segment = { start: 14.25, end: 17, text: 'Seek target' };
        await fileUploadController.showTranscriptionResult('Seek target', [segment]);

        const card = document.querySelector('#transcription-segments > .transcription-segment');
        expect(card.querySelector('div.segment-timestamp').textContent).toBe('0:14');
        expect(card.querySelector('div.segment-text').textContent).toBe('Seek target');
        card.click();

        expect(transcriptionController.seekToTime).toHaveBeenCalledWith(14.25);
    });

    test('includes the partial warning when saving from the editor', async () => {
        await fileUploadController.handleTranscriptionSuccess({
            text: 'Recognized text',
            segments: [],
            partial: true,
            issues: [{ start: 2, end: 4, message: 'Missing audio' }]
        });

        await transcriptionController.downloadTranscription();

        expect(window.electronAPI.saveFile).toHaveBeenCalledWith(
            expect.stringMatching(/Status: Partial; review required[\s\S]*Missing audio[\s\S]*Recognized text$/),
            expect.stringMatching(/transcription-.*\.txt/)
        );
    });
});

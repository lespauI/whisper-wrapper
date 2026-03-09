const { JSDOM } = require('jsdom');

let AppState;

describe('AppState', () => {
    let dom;
    let appState;

    beforeEach(async () => {
        dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost' });
        global.window = dom.window;
        global.document = dom.window.document;
        global.Node = dom.window.Node;

        jest.resetModules();

        const mod = await import('../../../src/renderer/app/AppState.js');
        AppState = mod.AppState;
        appState = new AppState();
    });

    afterEach(() => {
        delete global.window;
        delete global.document;
        delete global.Node;
    });

    describe('subscribe / notify', () => {
        it('should notify subscribers on state changes', () => {
            const cb = jest.fn();
            appState.subscribe('tab', cb);
            appState.setCurrentTab('record');
            expect(cb).toHaveBeenCalledWith({ tab: 'record' });
        });

        it('should support unsubscribing', () => {
            const cb = jest.fn();
            const unsub = appState.subscribe('tab', cb);
            unsub();
            appState.setCurrentTab('record');
            expect(cb).not.toHaveBeenCalled();
        });

        it('should support multiple subscribers on the same channel', () => {
            const cb1 = jest.fn();
            const cb2 = jest.fn();
            appState.subscribe('tab', cb1);
            appState.subscribe('tab', cb2);
            appState.setCurrentTab('library');
            expect(cb1).toHaveBeenCalledTimes(1);
            expect(cb2).toHaveBeenCalledTimes(1);
        });
    });

    describe('tab state', () => {
        it('should default to upload tab', () => {
            expect(appState.getCurrentTab()).toBe('upload');
        });

        it('should update current tab', () => {
            appState.setCurrentTab('transcription');
            expect(appState.getCurrentTab()).toBe('transcription');
        });
    });

    describe('recording state', () => {
        it('should return default recording state', () => {
            const state = appState.getRecordingState();
            expect(state.isRecording).toBe(false);
            expect(state.isPaused).toBe(false);
        });

        it('should update recording state and notify', () => {
            const cb = jest.fn();
            appState.subscribe('recording', cb);
            appState.setRecordingState({ isRecording: true });
            expect(appState.getRecordingState().isRecording).toBe(true);
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it('should return a copy, not a reference', () => {
            const state = appState.getRecordingState();
            state.isRecording = true;
            expect(appState.getRecordingState().isRecording).toBe(false);
        });
    });

    describe('file upload state', () => {
        it('should update file upload state', () => {
            appState.setFileUploadState({ isProcessing: true, currentFile: 'test.mp3' });
            const state = appState.getFileUploadState();
            expect(state.isProcessing).toBe(true);
            expect(state.currentFile).toBe('test.mp3');
        });
    });

    describe('status', () => {
        it('should update status and notify', () => {
            const cb = jest.fn();
            appState.subscribe('status', cb);
            appState.setStatus('Processing...', true);
            expect(appState.getStatus().message).toBe('Processing...');
            expect(appState.getStatus().isLoading).toBe(true);
            expect(cb).toHaveBeenCalledWith({
                message: 'Processing...',
                isLoading: true,
                error: null
            });
        });
    });

    describe('UI state', () => {
        it('should merge UI state updates', () => {
            appState.setUIState({ dragOver: true });
            appState.setUIState({ sidebarOpen: true });
            const state = appState.getUIState();
            expect(state.dragOver).toBe(true);
            expect(state.sidebarOpen).toBe(true);
        });
    });
});

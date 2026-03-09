const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('App – controller instantiation', () => {
    let dom;

    beforeEach(() => {
        const htmlPath = path.join(__dirname, '../../../src/renderer/index.html');
        const html = fs.readFileSync(htmlPath, 'utf-8');
        dom = new JSDOM(html, { url: 'http://localhost' });
        global.window = dom.window;
        global.document = dom.window.document;
        global.Node = dom.window.Node;
        global.navigator = dom.window.navigator;
        global.HTMLElement = dom.window.HTMLElement;
        global.Element = dom.window.Element;
        global.NodeList = dom.window.NodeList;
        global.localStorage = {
            data: {},
            getItem: jest.fn((key) => global.localStorage.data[key] || null),
            setItem: jest.fn((key, value) => { global.localStorage.data[key] = value; }),
            removeItem: jest.fn((key) => { delete global.localStorage.data[key]; }),
            clear: jest.fn(() => { global.localStorage.data = {}; })
        };

        global.window.electronAPI = {
            invoke: jest.fn(() => Promise.resolve({})),
            on: jest.fn(),
            send: jest.fn(),
            getSettings: jest.fn(() => Promise.resolve({})),
            saveSettings: jest.fn(() => Promise.resolve()),
            selectFile: jest.fn(() => Promise.resolve(null)),
            getTemplates: jest.fn(() => Promise.resolve([])),
            saveTemplate: jest.fn(() => Promise.resolve()),
            deleteTemplate: jest.fn(() => Promise.resolve()),
            transcribe: jest.fn(() => Promise.resolve({ text: '' })),
            onTranscriptionProgress: jest.fn(),
            checkWhisperSetup: jest.fn(() => Promise.resolve({ installed: true })),
            testOllamaConnection: jest.fn(() => Promise.resolve({ success: false })),
            getOllamaModels: jest.fn(() => Promise.resolve([])),
            refineTranscription: jest.fn(() => Promise.resolve({ refinedText: '' })),
            stopRefinement: jest.fn(() => Promise.resolve()),
            saveRecording: jest.fn(() => Promise.resolve()),
            searchLibrary: jest.fn(() => Promise.resolve([])),
            getEntry: jest.fn(() => Promise.resolve(null)),
            deleteEntry: jest.fn(() => Promise.resolve()),
            renameEntry: jest.fn(() => Promise.resolve()),
            reindexLibrary: jest.fn(() => Promise.resolve()),
            updateEntryTags: jest.fn(() => Promise.resolve()),
        };

        global.MediaRecorder = class {
            start() {}
            stop() {}
            addEventListener() {}
        };
        global.AudioContext = class {
            createAnalyser() { return { connect() {}, fftSize: 0, frequencyBinCount: 128 }; }
            createMediaStreamSource() { return { connect() {} }; }
            get sampleRate() { return 44100; }
            close() { return Promise.resolve(); }
        };

        jest.resetModules();
    });

    afterEach(() => {
        delete global.window;
        delete global.document;
        delete global.Node;
        delete global.navigator;
        delete global.HTMLElement;
        delete global.Element;
        delete global.NodeList;
        delete global.localStorage;
        delete global.MediaRecorder;
        delete global.AudioContext;
    });

    it('should instantiate all modular controllers', async () => {
        const { App } = await import('../../../src/renderer/app/App.js');
        const app = new App();

        expect(app.appState).toBeDefined();
        expect(app.statusController).toBeDefined();
        expect(app.tabController).toBeDefined();
        expect(app.settingsController).toBeDefined();
        expect(app.fileUploadController).toBeDefined();
        expect(app.transcriptionController).toBeDefined();
        expect(app.templateController).toBeDefined();
    });

    it('should expose itself on window.app for legacy compatibility', async () => {
        const { App } = await import('../../../src/renderer/app/App.js');
        const app = new App();
        expect(global.window.app).toBe(app);
    });

    it('should provide legacy methods used by RefinementController', async () => {
        const { App } = await import('../../../src/renderer/app/App.js');
        const app = new App();

        expect(typeof app.updateStatus).toBe('function');
        expect(typeof app.showError).toBe('function');
        expect(typeof app.loadTemplates).toBe('function');
        expect(typeof app.saveTranscriptionToHistory).toBe('function');
        expect(typeof app.updateTranscriptionText).toBe('function');
        expect(typeof app.updateToggleButton).toBe('function');
    });

    it('should have aiRefinementState and transcriptionState for RefinementController', async () => {
        const { App } = await import('../../../src/renderer/app/App.js');
        const app = new App();

        expect(app.aiRefinementState).toBeDefined();
        expect(app.aiRefinementState.templates).toEqual([]);
        expect(app.transcriptionState).toBeDefined();
        expect(app.transcriptionState.currentText).toBe('');
    });
});

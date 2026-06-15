/**
 * Unit tests for the Recording-screen Language Settings duplicate:
 *  - `''` <-> `'auto'` mapping on save/load
 *  - syncing from Recording screen to Settings panel
 *  - syncing from Settings panel back to Recording screen
 *  - failure/cancel paths must not desync UI from persisted config
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(__dirname, '../../../src/renderer/index.html');

function setupDom() {
    const html = fs.readFileSync(HTML_PATH, 'utf-8');
    const dom = new JSDOM(html, { url: 'http://localhost' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;
    global.Element = dom.window.Element;
    global.Node = dom.window.Node;
    global.navigator = dom.window.navigator;
    // jsdom returns null from canvas.getContext by default; stub a 2d context.
    dom.window.HTMLCanvasElement.prototype.getContext = () => ({
        fillStyle: '', fillRect: () => {}, clearRect: () => {},
        fillText: () => {}, font: '', textAlign: '', textBaseline: '',
        beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, stroke: () => {},
        strokeStyle: '', lineWidth: 0, save: () => {}, restore: () => {},
        translate: () => {}, scale: () => {},
    });
    return dom;
}

function teardownDom(dom) {
    dom.window.close();
    delete global.window;
    delete global.document;
    delete global.HTMLElement;
    delete global.Element;
    delete global.Node;
    delete global.navigator;
}

function fireChange(el) {
    el.dispatchEvent(new global.window.Event('change'));
}

describe('Recording-screen Language Settings', () => {
    let dom;
    let RecordingController;
    let SettingsController;
    let appState;
    let statusController;
    let tabController;

    function buildRecordingController() {
        return new RecordingController(appState, statusController, tabController);
    }

    function buildSettingsController() {
        return new SettingsController(appState, statusController);
    }

    beforeEach(() => {
        dom = setupDom();

        global.window.electronAPI = {
            getConfig: jest.fn().mockResolvedValue({}),
            setConfig: jest.fn().mockResolvedValue({ success: true }),
            testWhisper: jest.fn().mockResolvedValue({ success: true, details: {} }),
            detectGpuBackend: jest.fn().mockResolvedValue({
                success: true, expectedBackend: 'cpu', platform: 'linux'
            }),
            getAIRefinementSettings: jest.fn().mockResolvedValue({
                success: true,
                settings: { enabled: false, endpoint: '', model: '', timeoutSeconds: 300 }
            }),
            saveAIRefinementSettings: jest.fn().mockResolvedValue({ success: true }),
            getOllamaModels: jest.fn().mockResolvedValue({ success: true, models: [] }),
            testOllamaConnection: jest.fn().mockResolvedValue({ success: true }),
            meetingNotes: {
                getConfig: jest.fn().mockResolvedValue({ success: true, config: {} }),
                saveConfig: jest.fn().mockResolvedValue({ success: true }),
                getTemplates: jest.fn().mockResolvedValue({ success: true, templates: [] })
            }
        };

        // Stub APIs that RecordingController might touch in init.
        global.window.AudioContext = jest.fn();
        global.window.MediaRecorder = jest.fn();
        global.AudioContext = global.window.AudioContext;
        global.MediaRecorder = global.window.MediaRecorder;

        appState = {
            subscribe: jest.fn(),
            getRecordingState: jest.fn().mockReturnValue({}),
            setRecordingState: jest.fn(),
        };
        statusController = {
            updateStatus: jest.fn(),
            showError: jest.fn(),
        };
        tabController = { switchTab: jest.fn() };

        jest.isolateModules(() => {
            // eslint-disable-next-line global-require
            ({ RecordingController } = require('../../../src/renderer/controllers/RecordingController.js'));
            // eslint-disable-next-line global-require
            ({ SettingsController } = require('../../../src/renderer/controllers/SettingsController.js'));
        });
    });

    afterEach(() => {
        teardownDom(dom);
        jest.clearAllMocks();
    });

    test('selecting Auto-detect persists language as "auto"', async () => {
        buildRecordingController();

        const select = document.getElementById('record-language-select');
        select.value = '';
        fireChange(select);
        await new Promise((r) => setImmediate(r));

        expect(global.window.electronAPI.setConfig).toHaveBeenCalledWith({ language: 'auto' });
    });

    test('selecting a specific language persists that language code', async () => {
        buildRecordingController();

        const select = document.getElementById('record-language-select');
        select.value = 'fr';
        fireChange(select);
        await new Promise((r) => setImmediate(r));

        expect(global.window.electronAPI.setConfig).toHaveBeenCalledWith({ language: 'fr' });
    });

    test('persisted "auto" loads as empty (Auto-detect) on Recording screen', async () => {
        global.window.electronAPI.getConfig.mockResolvedValue({ language: 'auto', translate: false });
        const controller = buildRecordingController();

        await controller._loadVADSettingsIntoUI();

        expect(document.getElementById('record-language-select').value).toBe('');
    });

    test('persisted language code loads into Recording screen as-is', async () => {
        global.window.electronAPI.getConfig.mockResolvedValue({ language: 'de', translate: true });
        const controller = buildRecordingController();

        await controller._loadVADSettingsIntoUI();

        expect(document.getElementById('record-language-select').value).toBe('de');
        expect(document.getElementById('record-translate-checkbox').checked).toBe(true);
    });

    test('Recording -> Settings sync on successful save', async () => {
        buildRecordingController();

        const recLang = document.getElementById('record-language-select');
        const recTranslate = document.getElementById('record-translate-checkbox');
        recLang.value = 'es';
        fireChange(recLang);
        recTranslate.checked = true;
        fireChange(recTranslate);
        await new Promise((r) => setImmediate(r));

        expect(document.getElementById('language-select').value).toBe('es');
        expect(document.getElementById('translate-checkbox').checked).toBe(true);
    });

    test('Recording -> Settings: do NOT mirror when setConfig reports success:false', async () => {
        global.window.electronAPI.setConfig.mockResolvedValue({ success: false });
        buildRecordingController();

        // Seed settings panel with a known value so we can detect drift.
        document.getElementById('language-select').value = 'en';

        const recLang = document.getElementById('record-language-select');
        recLang.value = 'ja';
        fireChange(recLang);
        await new Promise((r) => setImmediate(r));

        expect(document.getElementById('language-select').value).toBe('en');
    });

    test('Recording -> Settings: do NOT mirror when setConfig throws', async () => {
        global.window.electronAPI.setConfig.mockRejectedValue(new Error('boom'));
        buildRecordingController();

        document.getElementById('translate-checkbox').checked = false;

        const recTranslate = document.getElementById('record-translate-checkbox');
        recTranslate.checked = true;
        fireChange(recTranslate);
        await new Promise((r) => setImmediate(r));

        expect(document.getElementById('translate-checkbox').checked).toBe(false);
    });

    test('Settings panel save mirrors language/translate into Recording screen', async () => {
        const controller = buildSettingsController();

        document.getElementById('model-select').value = 'base';
        document.getElementById('language-select').value = 'pt';
        document.getElementById('threads-select').value = '4';
        document.getElementById('translate-checkbox').checked = true;

        await controller.saveSettings();

        expect(document.getElementById('record-language-select').value).toBe('pt');
        expect(document.getElementById('record-translate-checkbox').checked).toBe(true);
        expect(global.window.electronAPI.setConfig).toHaveBeenCalledWith(
            expect.objectContaining({ language: 'pt', translate: true })
        );
    });

    test('Settings panel save with Auto-detect persists "auto" but keeps UI empty', async () => {
        const controller = buildSettingsController();

        document.getElementById('model-select').value = 'base';
        document.getElementById('language-select').value = '';
        document.getElementById('threads-select').value = '4';
        document.getElementById('translate-checkbox').checked = false;

        await controller.saveSettings();

        expect(global.window.electronAPI.setConfig).toHaveBeenCalledWith(
            expect.objectContaining({ language: 'auto' })
        );
        expect(document.getElementById('record-language-select').value).toBe('');
    });

    test('Settings panel save does NOT mirror to Recording screen when setConfig rejects', async () => {
        global.window.electronAPI.setConfig.mockRejectedValue(new Error('nope'));
        const controller = buildSettingsController();

        document.getElementById('record-language-select').value = 'en';
        document.getElementById('record-translate-checkbox').checked = false;
        document.getElementById('model-select').value = 'base';
        document.getElementById('language-select').value = 'ko';
        document.getElementById('threads-select').value = '4';
        document.getElementById('translate-checkbox').checked = true;

        await controller.saveSettings();

        expect(document.getElementById('record-language-select').value).toBe('en');
        expect(document.getElementById('record-translate-checkbox').checked).toBe(false);
    });

    test('Settings panel load maps persisted "auto" to empty in both UIs', async () => {
        global.window.electronAPI.getConfig.mockResolvedValue({
            model: 'base', language: 'auto', threads: 4, translate: false
        });
        const controller = buildSettingsController();

        await controller.loadSettings();

        expect(document.getElementById('language-select').value).toBe('');
        expect(document.getElementById('record-language-select').value).toBe('');
    });

    test('Settings panel load mirrors language/translate into Recording screen', async () => {
        global.window.electronAPI.getConfig.mockResolvedValue({
            model: 'base', language: 'it', threads: 4, translate: true
        });
        const controller = buildSettingsController();

        await controller.loadSettings();

        expect(document.getElementById('record-language-select').value).toBe('it');
        expect(document.getElementById('record-translate-checkbox').checked).toBe(true);
    });
});

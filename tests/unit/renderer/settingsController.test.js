/**
 * Unit tests for SettingsController — focused on AI Refinement load/save
 * to prevent regressions like the "Enable AI Refinement" checkbox always
 * loading as unchecked because the renderer reads the IPC wrapper at the
 * wrong nesting level.
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('SettingsController – AI Refinement persistence', () => {
    let SettingsController;
    let controller;
    let statusController;
    let appState;
    let dom;
    let aiState;

    beforeEach(() => {
        const htmlPath = path.join(__dirname, '../../../src/renderer/index.html');
        const html = fs.readFileSync(htmlPath, 'utf-8');
        dom = new JSDOM(html, { url: 'http://localhost' });
        global.window = dom.window;
        global.document = dom.window.document;
        global.HTMLElement = dom.window.HTMLElement;
        global.Element = dom.window.Element;
        global.Node = dom.window.Node;
        global.navigator = dom.window.navigator;

        aiState = {
            enabled: true,
            endpoint: 'http://localhost:11434',
            model: 'gemma3:12b',
            timeoutSeconds: 300,
            defaultTemplateId: null
        };

        // Match the real refinementHandlers contract: { success, settings }.
        global.window.electronAPI = {
            getConfig: jest.fn(() => Promise.resolve({
                model: 'base',
                language: 'en',
                threads: 4,
                whisper: { availableModels: [] }
            })),
            setConfig: jest.fn(() => Promise.resolve({ success: true })),
            testWhisper: jest.fn(() => Promise.resolve({ success: true, details: {} })),
            detectGpuBackend: jest.fn(() => Promise.resolve({
                success: true,
                expectedBackend: 'cpu',
                platform: 'linux'
            })),
            getAIRefinementSettings: jest.fn(() => Promise.resolve({
                success: true,
                settings: { ...aiState }
            })),
            saveAIRefinementSettings: jest.fn((partial) => {
                Object.assign(aiState, partial);
                return Promise.resolve({
                    success: true,
                    changed: true,
                    settings: { ...aiState }
                });
            }),
            getOllamaModels: jest.fn(() => Promise.resolve({
                success: true,
                models: [{ name: 'gemma3:12b', size: '7GB' }]
            })),
            testOllamaConnection: jest.fn(() => Promise.resolve({ success: true })),
            debugAIRefinementSettings: jest.fn(() => Promise.resolve({ success: true })),
            meetingNotes: {
                getConfig: jest.fn(() => Promise.resolve({ success: true, config: {} })),
                saveConfig: jest.fn(() => Promise.resolve({ success: true })),
                getTemplates: jest.fn(() => Promise.resolve({ success: true, templates: [] }))
            }
        };

        statusController = {
            updateStatus: jest.fn(),
            showError: jest.fn()
        };
        appState = {};

        // Import after globals are wired up.
        jest.isolateModules(() => {
            // eslint-disable-next-line global-require
            ({ SettingsController } = require('../../../src/renderer/controllers/SettingsController.js'));
        });
        controller = new SettingsController(appState, statusController);
    });

    afterEach(() => {
        dom.window.close();
        delete global.window;
        delete global.document;
    });

    test('loads enabled=true from { success, settings } wrapper into the checkbox', async () => {
        await controller.loadAIRefinementSettings();

        const checkbox = document.getElementById('ai-refinement-enabled-checkbox');
        expect(checkbox.checked).toBe(true);
    });

    test('loads enabled=false from { success, settings } wrapper into the checkbox', async () => {
        aiState.enabled = false;
        await controller.loadAIRefinementSettings();

        const checkbox = document.getElementById('ai-refinement-enabled-checkbox');
        expect(checkbox.checked).toBe(false);
    });

    test('loads endpoint, timeout, and model from the wrapper', async () => {
        aiState.endpoint = 'http://example.test:9999';
        aiState.timeoutSeconds = 120;
        await controller.loadAIRefinementSettings();

        expect(document.getElementById('ollama-endpoint').value).toBe('http://example.test:9999');
        expect(document.getElementById('ollama-timeout').value).toBe('120');
        expect(document.getElementById('ollama-model-select').value).toBe('gemma3:12b');
    });

    test('saveAIRefinementSettings preserves enabled=true after a load/save cycle', async () => {
        await controller.loadAIRefinementSettings();
        await controller.saveAIRefinementSettings();

        const savedWith = global.window.electronAPI.saveAIRefinementSettings.mock.calls.at(-1)[0];
        expect(savedWith.enabled).toBe(true);
        expect(aiState.enabled).toBe(true);
    });

    test('also works if the IPC layer ever returns the bare settings object', async () => {
        // Defensive: tolerate either shape.
        global.window.electronAPI.getAIRefinementSettings = jest.fn(() => Promise.resolve({
            enabled: true,
            endpoint: 'http://localhost:11434',
            model: 'gemma3:12b',
            timeoutSeconds: 300
        }));

        await controller.loadAIRefinementSettings();

        expect(document.getElementById('ai-refinement-enabled-checkbox').checked).toBe(true);
    });
});

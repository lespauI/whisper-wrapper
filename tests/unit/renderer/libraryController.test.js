const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('LibraryController', () => {
    let dom;
    let LibraryController;

    function buildDOM() {
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
        global.confirm = jest.fn(() => true);

        global.window.electronAPI = {
            transcriptions: {
                store: jest.fn().mockResolvedValue({ success: true }),
                list: jest.fn().mockResolvedValue({ entries: [] }),
                get: jest.fn().mockResolvedValue(null),
                update: jest.fn().mockResolvedValue({ success: true }),
                delete: jest.fn().mockResolvedValue({ success: true }),
                reindex: jest.fn().mockResolvedValue({ count: 0 }),
                regenerateMeta: jest.fn().mockResolvedValue({ success: true, entry: {} })
            }
        };
    }

    beforeEach(() => {
        jest.resetModules();
        buildDOM();
        const controllerCode = fs.readFileSync(
            path.join(__dirname, '../../../src/renderer/controllers/libraryController.js'),
            'utf-8'
        );
        dom.window.eval(controllerCode);
        LibraryController = dom.window.LibraryController;
    });

    afterEach(() => {
        delete global.window;
        delete global.document;
        delete global.Node;
        delete global.navigator;
        delete global.HTMLElement;
        delete global.Element;
        delete global.NodeList;
        delete global.confirm;
    });

    describe('showDetail — meta error display', () => {
        it('shows meta error banner when metaStatus is failed', async () => {
            const entry = {
                id: 'test-1',
                date: new Date().toISOString(),
                title: 'Test',
                summary: '',
                labels: [],
                metaStatus: 'failed',
                metaError: 'Request failed with status code 404',
                sourceFile: 'audio.wav',
                wordCount: 10
            };

            global.window.electronAPI.transcriptions.get.mockResolvedValue({
                entry,
                text: 'Some transcription text'
            });

            const ctrl = new LibraryController();
            await ctrl.showDetail('test-1');

            const metaErrorEl = document.getElementById('library-meta-error');
            expect(metaErrorEl.classList.contains('hidden')).toBe(false);

            const metaErrorText = document.getElementById('library-meta-error-text');
            expect(metaErrorText.textContent).toContain('Request failed with status code 404');
        });

        it('hides meta error banner when metaStatus is success', async () => {
            const entry = {
                id: 'test-2',
                date: new Date().toISOString(),
                title: 'Good Meta',
                summary: 'A good summary',
                labels: ['tag'],
                metaStatus: 'success',
                metaError: '',
                sourceFile: 'audio.wav',
                wordCount: 5
            };

            global.window.electronAPI.transcriptions.get.mockResolvedValue({
                entry,
                text: 'Some text'
            });

            const ctrl = new LibraryController();
            await ctrl.showDetail('test-2');

            const metaErrorEl = document.getElementById('library-meta-error');
            expect(metaErrorEl.classList.contains('hidden')).toBe(true);
        });

        it('displays entry title, summary, and labels in detail view', async () => {
            const entry = {
                id: 'test-3',
                date: new Date().toISOString(),
                title: 'Budget Meeting',
                summary: 'A meeting about quarterly budget',
                labels: ['budget', 'meeting'],
                metaStatus: 'success',
                metaError: '',
                sourceFile: 'budget.wav',
                wordCount: 100
            };

            global.window.electronAPI.transcriptions.get.mockResolvedValue({
                entry,
                text: 'Full transcription content'
            });

            const ctrl = new LibraryController();
            await ctrl.showDetail('test-3');

            expect(document.getElementById('library-detail-title').textContent).toBe('Budget Meeting');
            expect(document.getElementById('library-detail-summary-text').textContent).toBe('A meeting about quarterly budget');
            expect(document.getElementById('library-detail-text').textContent).toBe('Full transcription content');
        });
    });

    describe('regenerateMeta', () => {
        it('calls regenerateMeta API and refreshes detail on success', async () => {
            const entry = {
                id: 'regen-1',
                date: new Date().toISOString(),
                title: 'Old Title',
                summary: '',
                labels: [],
                metaStatus: 'failed',
                metaError: 'error',
                sourceFile: 'a.wav',
                wordCount: 5
            };

            global.window.electronAPI.transcriptions.get.mockResolvedValue({
                entry,
                text: 'Text'
            });

            const ctrl = new LibraryController();
            await ctrl.showDetail('regen-1');
            expect(ctrl.currentEntryId).toBe('regen-1');

            const updatedEntry = { ...entry, metaStatus: 'success', metaError: '', title: 'New AI Title', summary: 'New summary' };
            global.window.electronAPI.transcriptions.regenerateMeta.mockResolvedValue({
                success: true,
                entry: updatedEntry
            });
            global.window.electronAPI.transcriptions.get.mockResolvedValue({
                entry: updatedEntry,
                text: 'Text'
            });

            await ctrl.regenerateMeta();

            expect(global.window.electronAPI.transcriptions.regenerateMeta).toHaveBeenCalledWith('regen-1');
        });

        it('shows error banner when regeneration fails', async () => {
            const entry = {
                id: 'regen-2',
                date: new Date().toISOString(),
                title: 'Title',
                summary: '',
                labels: [],
                metaStatus: 'failed',
                metaError: 'original error',
                sourceFile: 'a.wav',
                wordCount: 5
            };

            global.window.electronAPI.transcriptions.get.mockResolvedValue({
                entry,
                text: 'Text'
            });

            const ctrl = new LibraryController();
            await ctrl.showDetail('regen-2');

            global.window.electronAPI.transcriptions.regenerateMeta.mockResolvedValue({
                success: false,
                entry: { ...entry, metaError: 'Model not found' }
            });

            await ctrl.regenerateMeta();

            const metaErrorEl = document.getElementById('library-meta-error');
            expect(metaErrorEl.classList.contains('hidden')).toBe(false);
        });

        it('does nothing when no entry is selected', async () => {
            const ctrl = new LibraryController();
            await ctrl.regenerateMeta();

            expect(global.window.electronAPI.transcriptions.regenerateMeta).not.toHaveBeenCalled();
        });

        it('disables both regenerate buttons during regeneration', async () => {
            const entry = {
                id: 'regen-3',
                date: new Date().toISOString(),
                title: 'Title',
                summary: '',
                labels: [],
                metaStatus: 'failed',
                metaError: 'error',
                sourceFile: 'a.wav',
                wordCount: 5
            };

            global.window.electronAPI.transcriptions.get.mockResolvedValue({
                entry,
                text: 'Text'
            });

            const ctrl = new LibraryController();
            await ctrl.showDetail('regen-3');

            let resolveRegen;
            global.window.electronAPI.transcriptions.regenerateMeta.mockImplementation(
                () => new Promise(resolve => { resolveRegen = resolve; })
            );

            const regenPromise = ctrl.regenerateMeta();

            const metaBtn = document.getElementById('library-regenerate-meta-btn');
            const regenBtn = document.getElementById('library-regenerate-btn');
            expect(metaBtn.disabled).toBe(true);
            expect(regenBtn.disabled).toBe(true);

            resolveRegen({ success: true, entry: { ...entry, metaStatus: 'success' } });
            global.window.electronAPI.transcriptions.get.mockResolvedValue({
                entry: { ...entry, metaStatus: 'success' },
                text: 'Text'
            });
            await regenPromise;

            expect(metaBtn.disabled).toBe(false);
            expect(regenBtn.disabled).toBe(false);
        });
    });

    describe('clearDetail', () => {
        it('hides detail content and meta error, shows empty state', () => {
            const ctrl = new LibraryController();
            ctrl.clearDetail();

            expect(document.getElementById('library-detail-empty').classList.contains('hidden')).toBe(false);
            expect(document.getElementById('library-detail-content').classList.contains('hidden')).toBe(true);
            expect(document.getElementById('library-meta-error').classList.contains('hidden')).toBe(true);
        });
    });

    describe('renderResults', () => {
        it('renders transcription entries in the results list', () => {
            const ctrl = new LibraryController();
            ctrl.renderResults([
                { id: 'e1', title: 'First', date: new Date().toISOString(), labels: ['a'], summary: 'Sum 1', wordCount: 10 },
                { id: 'e2', title: 'Second', date: new Date().toISOString(), labels: [], summary: '', wordCount: 5 }
            ]);

            const items = document.querySelectorAll('.library-result-item');
            expect(items.length).toBe(2);
        });

        it('shows empty message when no entries', () => {
            const ctrl = new LibraryController();
            ctrl.renderResults([]);

            const resultsEl = document.getElementById('library-results');
            expect(resultsEl.innerHTML).toContain('No transcriptions found');
        });
    });
});

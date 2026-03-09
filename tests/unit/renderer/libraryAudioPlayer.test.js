const { JSDOM } = require('jsdom');

describe('LibraryController - audio player wiring', () => {
    let dom;
    let LibraryController;
    let mockTranscriptionController;

    function buildDOM() {
        return new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <input id="library-search-input" />
                <input id="library-date-from" />
                <input id="library-date-to" />
                <button id="library-search-btn"></button>
                <button id="library-clear-btn"></button>
                <button id="library-reindex-btn"></button>
                <div id="library-results"></div>
                <div id="library-detail-empty"></div>
                <div id="library-detail-content" class="hidden"></div>
                <div id="library-detail-title"></div>
                <div id="library-detail-date"></div>
                <div id="library-detail-source"></div>
                <div id="library-detail-words"></div>
                <div id="library-detail-labels"></div>
                <div id="library-detail-summary-text"></div>
                <div id="library-detail-text"></div>
                <button id="library-copy-btn"></button>
                <button id="library-delete-btn"></button>
                <button id="library-rename-btn"></button>
                <div id="library-rename-form" class="hidden"></div>
                <input id="library-rename-input" />
                <button id="library-rename-save-btn"></button>
                <button id="library-rename-cancel-btn"></button>
                <button id="library-edit-tags-btn"></button>
                <div id="library-tags-form" class="hidden"></div>
                <div id="library-tags-list"></div>
                <input id="library-tag-input" />
                <button id="library-tag-add-btn"></button>
                <button id="library-tags-save-btn"></button>
                <button id="library-tags-cancel-btn"></button>
            </body>
            </html>
        `, { url: 'http://localhost' });
    }

    beforeEach(() => {
        dom = buildDOM();
        global.window = dom.window;
        global.document = dom.window.document;

        mockTranscriptionController = {
            loadAudio: jest.fn(),
            hideAudioPlayer: jest.fn()
        };

        global.window.whisperApp = {
            controllers: {
                transcription: mockTranscriptionController
            }
        };

        global.window.electronAPI = {
            transcriptions: {
                get: jest.fn(),
                list: jest.fn().mockResolvedValue({ entries: [] }),
                update: jest.fn(),
                delete: jest.fn(),
                reindex: jest.fn()
            }
        };

        const src = require('fs').readFileSync(
            require('path').join(__dirname, '../../../src/renderer/controllers/libraryController.js'),
            'utf8'
        );
        const fn = new Function('window', 'document', src + '\nreturn window.LibraryController;');
        LibraryController = fn(dom.window, dom.window.document);
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe('showDetail()', () => {
        it('calls loadAudio with audioFilePath when entry has one', async () => {
            const entry = {
                id: 'abc',
                title: 'Test',
                date: '2024-01-01T00:00:00.000Z',
                sourceFile: '/path/to/audio.mp3',
                audioFilePath: '/path/to/audio.mp3',
                labels: [],
                wordCount: 5,
                summary: 'A summary'
            };
            global.window.electronAPI.transcriptions.get.mockResolvedValue({ entry, text: 'hello' });

            const controller = new LibraryController();
            await controller.showDetail('abc');

            expect(mockTranscriptionController.loadAudio).toHaveBeenCalledWith('/path/to/audio.mp3');
            expect(mockTranscriptionController.hideAudioPlayer).not.toHaveBeenCalled();
        });

        it('calls hideAudioPlayer when entry has no audioFilePath', async () => {
            const entry = {
                id: 'def',
                title: 'No audio',
                date: '2024-01-01T00:00:00.000Z',
                sourceFile: '',
                audioFilePath: '',
                labels: [],
                wordCount: 3,
                summary: ''
            };
            global.window.electronAPI.transcriptions.get.mockResolvedValue({ entry, text: 'text' });

            const controller = new LibraryController();
            await controller.showDetail('def');

            expect(mockTranscriptionController.hideAudioPlayer).toHaveBeenCalled();
            expect(mockTranscriptionController.loadAudio).not.toHaveBeenCalled();
        });

        it('calls hideAudioPlayer when entry is missing entirely', async () => {
            global.window.electronAPI.transcriptions.get.mockResolvedValue({ entry: null, text: '' });

            const controller = new LibraryController();
            await controller.showDetail('missing');

            expect(mockTranscriptionController.hideAudioPlayer).toHaveBeenCalled();
        });

        it('does not throw when whisperApp is not initialised', async () => {
            global.window.whisperApp = undefined;
            const entry = {
                id: 'ghi',
                title: 'Test',
                date: '2024-01-01T00:00:00.000Z',
                sourceFile: '/audio.mp3',
                audioFilePath: '/audio.mp3',
                labels: [],
                wordCount: 1,
                summary: ''
            };
            global.window.electronAPI.transcriptions.get.mockResolvedValue({ entry, text: '' });

            const controller = new LibraryController();
            await expect(controller.showDetail('ghi')).resolves.not.toThrow();
        });
    });

    describe('clearDetail()', () => {
        it('calls hideAudioPlayer when clearing', () => {
            const controller = new LibraryController();
            controller.clearDetail();
            expect(mockTranscriptionController.hideAudioPlayer).toHaveBeenCalled();
        });

        it('does not throw when whisperApp is absent', () => {
            global.window.whisperApp = undefined;
            const controller = new LibraryController();
            expect(() => controller.clearDetail()).not.toThrow();
        });
    });
});

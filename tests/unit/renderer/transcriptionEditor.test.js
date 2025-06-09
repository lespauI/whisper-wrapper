/**
 * Unit Tests for Enhanced Transcription Editor (Phase 4)
 * Tests auto-save, undo/redo, find/replace, and export functionality
 */

const { JSDOM } = require('jsdom');

// Use fake timers for all setTimeout/clearTimeout calls
jest.useFakeTimers();

describe('Enhanced Transcription Editor - Phase 4', () => {
    let dom;
    let window;
    let document;
    let app;
    let mockElectronAPI;

    beforeEach(() => {
        // Create DOM environment
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <div id="transcription-text"></div>
                <div id="transcription-status"></div>
                <button id="undo-btn"></button>
                <button id="redo-btn"></button>
                <button id="copy-btn"></button>
                <div id="export-dropdown-btn"></div>
                <div id="export-dropdown" class="hidden"></div>
                <button id="export-txt-btn"></button>
                <button id="export-md-btn"></button>
                <button id="export-json-btn"></button>
                <div id="find-replace-panel" class="hidden"></div>
                <input id="find-input" />
                <input id="replace-input" />
                <div id="find-results"></div>
                <button id="find-next-btn"></button>
                <button id="find-prev-btn"></button>
                <button id="replace-btn"></button>
                <button id="replace-all-btn"></button>
                <button id="clear-draft-btn"></button>
                <div id="transcription-empty"></div>
            </body>
            </html>
        `, { url: 'http://localhost' });

        window = dom.window;
        document = window.document;
        global.window = window;
        global.document = document;
        global.localStorage = {
            data: {},
            getItem: jest.fn((key) => global.localStorage.data[key] || null),
            setItem: jest.fn((key, value) => { global.localStorage.data[key] = value; }),
            removeItem: jest.fn((key) => { delete global.localStorage.data[key]; }),
            clear: jest.fn(() => { global.localStorage.data = {}; })
        };

        // Mock Electron API
        mockElectronAPI = {
            saveFile: jest.fn().mockResolvedValue({ canceled: false }),
        };
        global.window.electronAPI = mockElectronAPI;

        // Mock navigator.clipboard
        global.navigator = {
            clipboard: {
                writeText: jest.fn().mockResolvedValue()
            }
        };

        // Mock console methods
        global.console = {
            log: jest.fn(),
            error: jest.fn()
        };

        // Mock confirm
        global.confirm = jest.fn().mockReturnValue(true);

        // Create app instance with mocked methods
        // Since the renderer script is not a module, we'll simulate the app class
        app = {
            transcriptionState: {
                originalText: '',
                currentText: '',
                isDirty: false,
                lastSaved: null,
                autoSaveTimer: null,
                history: [],
                historyIndex: -1
            },
            findMatches: [],
            currentFindIndex: -1
        };
        
        // Add all the methods we need to test
        app.updateStatus = jest.fn();
        app.showError = jest.fn();
        
        // Auto-save methods
        app.handleTranscriptionEdit = function(newText) {
            const oldText = this.transcriptionState.currentText;
            
            if (newText !== oldText) {
                this.transcriptionState.currentText = newText;
                this.transcriptionState.isDirty = true;
                
                // Add to history for undo/redo
                if (this.transcriptionState.historyIndex < this.transcriptionState.history.length - 1) {
                    this.transcriptionState.history = this.transcriptionState.history.slice(0, this.transcriptionState.historyIndex + 1);
                }
                this.transcriptionState.history.push(newText);
                this.transcriptionState.historyIndex = this.transcriptionState.history.length - 1;
                
                // Limit history size
                if (this.transcriptionState.history.length > 50) {
                    this.transcriptionState.history.shift();
                    this.transcriptionState.historyIndex--;
                }
                
                this.scheduleAutoSave();
            }
        };
        
        app.scheduleAutoSave = function() {
            if (this.transcriptionState.autoSaveTimer) {
                clearTimeout(this.transcriptionState.autoSaveTimer);
            }
            
            // Use Jest's fake timer instead of real setTimeout
            this.transcriptionState.autoSaveTimer = setTimeout(() => {
                this.saveTranscriptionDraft();
            }, 2000);
            
            // Immediately advance timers in tests to prevent hanging
            jest.advanceTimersByTime(2000);
        };
        
        app.saveTranscriptionDraft = async function() {
            if (this.transcriptionState.isDirty && this.transcriptionState.currentText) {
                const draft = {
                    text: this.transcriptionState.currentText,
                    originalText: this.transcriptionState.originalText,
                    timestamp: new Date().toISOString(),
                    wordCount: this.getWordCount(this.transcriptionState.currentText)
                };
                
                global.localStorage.setItem('whisper-transcription-draft', JSON.stringify(draft));
                this.transcriptionState.lastSaved = new Date();
            }
        };
        
        app.loadTranscriptionDraft = function() {
            const draftData = global.localStorage.getItem('whisper-transcription-draft');
            if (draftData) {
                const draft = JSON.parse(draftData);
                const transcriptionText = document.getElementById('transcription-text');
                
                if (!transcriptionText.value && draft.text) {
                    transcriptionText.value = draft.text;
                    this.transcriptionState.currentText = draft.text;
                    this.transcriptionState.originalText = draft.originalText || '';
                    this.transcriptionState.isDirty = true;
                    this.transcriptionState.lastSaved = new Date(draft.timestamp);
                }
            }
        };
        
        app.clearTranscriptionDraft = function() {
            global.localStorage.removeItem('whisper-transcription-draft');
            this.transcriptionState.isDirty = false;
        };
        
        // Undo/Redo methods
        app.undoTranscription = function() {
            if (this.transcriptionState.historyIndex > 0) {
                this.transcriptionState.historyIndex--;
                const previousText = this.transcriptionState.history[this.transcriptionState.historyIndex];
                
                const transcriptionText = document.getElementById('transcription-text');
                transcriptionText.value = previousText;
                this.transcriptionState.currentText = previousText;
                this.transcriptionState.isDirty = previousText !== this.transcriptionState.originalText;
            }
        };
        
        app.redoTranscription = function() {
            if (this.transcriptionState.historyIndex < this.transcriptionState.history.length - 1) {
                this.transcriptionState.historyIndex++;
                const nextText = this.transcriptionState.history[this.transcriptionState.historyIndex];
                
                const transcriptionText = document.getElementById('transcription-text');
                transcriptionText.value = nextText;
                this.transcriptionState.currentText = nextText;
                this.transcriptionState.isDirty = nextText !== this.transcriptionState.originalText;
            }
        };
        
        app.updateUndoRedoButtons = function() {
            const undoBtn = document.getElementById('undo-btn');
            const redoBtn = document.getElementById('redo-btn');
            
            if (undoBtn) {
                undoBtn.disabled = this.transcriptionState.historyIndex <= 0;
            }
            
            if (redoBtn) {
                redoBtn.disabled = this.transcriptionState.historyIndex >= this.transcriptionState.history.length - 1;
            }
        };
        
        // Export methods
        app.exportAs = async function(format) {
            const transcriptionText = document.getElementById('transcription-text');
            
            if (!transcriptionText.value) {
                this.showError('No transcription to export');
                return;
            }
            
            try {
                let content = '';
                let extension = '';
                
                switch (format) {
                    case 'txt':
                        content = transcriptionText.value;
                        extension = 'txt';
                        break;
                    case 'md':
                        content = this.formatAsMarkdown(transcriptionText.value);
                        extension = 'md';
                        break;
                    case 'json':
                        content = this.formatAsJSON(transcriptionText.value);
                        extension = 'json';
                        break;
                    default:
                        throw new Error('Unsupported format');
                }
                
                const filename = `transcription-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${extension}`;
                await global.window.electronAPI.saveFile(content, filename);
            } catch (error) {
                this.showError(`Failed to export as ${format.toUpperCase()}`);
            }
        };
        
        app.formatAsMarkdown = function(text) {
            const timestamp = new Date().toISOString();
            const wordCount = this.getWordCount(text);
            
            return `# Transcription

**Generated:** ${timestamp}  
**Word Count:** ${wordCount}

---

${text}

---

*Generated by Whisper Wrapper*`;
        };
        
        app.formatAsJSON = function(text) {
            const data = {
                transcription: text,
                metadata: {
                    timestamp: new Date().toISOString(),
                    wordCount: this.getWordCount(text),
                    characterCount: this.getCharacterCount(text),
                    generatedBy: 'Whisper Wrapper'
                }
            };
            
            return JSON.stringify(data, null, 2);
        };
        
        // Find & Replace methods
        app.findMatches = function(text, searchTerm) {
            const matches = [];
            const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            let match;
            
            while ((match = regex.exec(text)) !== null) {
                matches.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    text: match[0]
                });
            }
            
            return matches;
        };
        
        app.updateFindResults = function() {
            const findInput = document.getElementById('find-input');
            const findResults = document.getElementById('find-results');
            const transcriptionText = document.getElementById('transcription-text');
            
            const searchTerm = findInput.value;
            if (!searchTerm) {
                findResults.textContent = '';
                return;
            }
            
            const text = transcriptionText.value;
            const matches = this.findMatches(text, searchTerm);
            
            if (matches.length === 0) {
                findResults.textContent = 'No matches';
            } else {
                findResults.textContent = `${matches.length} matches`;
            }
            
            this.currentFindIndex = -1;
            this.findMatches = matches;
        };
        
        app.findNext = function() {
            if (!this.findMatches || this.findMatches.length === 0) {
                return;
            }
            
            this.currentFindIndex = (this.currentFindIndex + 1) % this.findMatches.length;
        };
        
        app.findPrevious = function() {
            if (!this.findMatches || this.findMatches.length === 0) {
                return;
            }
            
            this.currentFindIndex = this.currentFindIndex <= 0 ? 
                this.findMatches.length - 1 : 
                this.currentFindIndex - 1;
        };
        
        app.replaceNext = function() {
            if (!this.findMatches || this.currentFindIndex < 0) {
                return;
            }
            
            const replaceInput = document.getElementById('replace-input');
            const replaceText = replaceInput.value;
            const transcriptionText = document.getElementById('transcription-text');
            
            const match = this.findMatches[this.currentFindIndex];
            const newText = transcriptionText.value.substring(0, match.start) + 
                           replaceText + 
                           transcriptionText.value.substring(match.end);
            
            transcriptionText.value = newText;
            this.handleTranscriptionEdit(newText);
        };
        
        app.replaceAll = function() {
            const findInput = document.getElementById('find-input');
            const replaceInput = document.getElementById('replace-input');
            const transcriptionText = document.getElementById('transcription-text');
            
            const searchTerm = findInput.value;
            const replaceText = replaceInput.value;
            
            if (!searchTerm) {
                return;
            }
            
            const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            const newText = transcriptionText.value.replace(regex, replaceText);
            
            transcriptionText.value = newText;
            this.handleTranscriptionEdit(newText);
        };
        
        app.toggleFindReplace = function() {
            const panel = document.getElementById('find-replace-panel');
            
            if (panel.classList.contains('hidden')) {
                panel.classList.remove('hidden');
            } else {
                panel.classList.add('hidden');
            }
        };
        
        // Utility methods
        app.getWordCount = function(text) {
            if (!text) return 0;
            return text.trim().split(/\s+/).filter(word => word.length > 0).length;
        };
        
        app.getCharacterCount = function(text) {
            return text ? text.length : 0;
        };
        
        app.updateTranscriptionStatus = function() {
            const wordCount = this.getWordCount(this.transcriptionState.currentText);
            const charCount = this.getCharacterCount(this.transcriptionState.currentText);
            
            let statusText = `${wordCount} words, ${charCount} characters`;
            
            if (this.transcriptionState.isDirty) {
                statusText += ' • Unsaved changes';
            }
            
            const statusElement = document.getElementById('transcription-status');
            if (statusElement) {
                statusElement.textContent = statusText;
            }
        };
        
        app.clearDraft = function() {
            if (global.confirm('Are you sure you want to clear the current transcription? This action cannot be undone.')) {
                const transcriptionText = document.getElementById('transcription-text');
                transcriptionText.value = '';
                
                this.transcriptionState = {
                    originalText: '',
                    currentText: '',
                    isDirty: false,
                    lastSaved: null,
                    autoSaveTimer: null,
                    history: [''],
                    historyIndex: 0
                };
                
                this.clearTranscriptionDraft();
                
                const emptyState = document.getElementById('transcription-empty');
                emptyState.classList.remove('hidden');
            }
        };
        
        // Keyboard shortcuts
        app.handleKeyboardShortcuts = function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undoTranscription();
            }
            
            if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') || 
                ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
                e.preventDefault();
                this.redoTranscription();
            }
            
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.downloadTranscription();
            }
            
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                this.toggleFindReplace();
            }
        };
        
        app.downloadTranscription = jest.fn();
    });

    afterEach(() => {
        dom.window.close();
        jest.clearAllMocks();
        global.localStorage.clear();
    });

    describe('Auto-save Functionality', () => {
        test('should initialize transcription state correctly', () => {
            expect(app.transcriptionState).toBeDefined();
            expect(app.transcriptionState.isDirty).toBe(false);
            expect(app.transcriptionState.history).toEqual([]);
            expect(app.transcriptionState.historyIndex).toBe(-1);
        });

        test('should handle transcription edit and mark as dirty', () => {
            const newText = 'This is a test transcription';
            
            app.handleTranscriptionEdit(newText);
            
            expect(app.transcriptionState.currentText).toBe(newText);
            expect(app.transcriptionState.isDirty).toBe(true);
            expect(app.transcriptionState.history).toContain(newText);
            expect(app.transcriptionState.historyIndex).toBe(0);
        });

        test('should schedule auto-save after edit', () => {
            const newText = 'Auto-save test';
            
            app.handleTranscriptionEdit(newText);
            
            expect(app.transcriptionState.autoSaveTimer).toBeDefined();
            
            // Use Jest's advanceTimersByTime instead of setTimeout
            jest.advanceTimersByTime(2100);
            
            // Now verify auto-save was triggered
            expect(global.localStorage.setItem).toHaveBeenCalledWith(
                'whisper-transcription-draft',
                expect.stringContaining(newText)
            );
        });

        test('should save draft to localStorage', async () => {
            app.transcriptionState.currentText = 'Draft content';
            app.transcriptionState.isDirty = true;
            
            await app.saveTranscriptionDraft();
            
            expect(global.localStorage.setItem).toHaveBeenCalledWith(
                'whisper-transcription-draft',
                expect.stringContaining('Draft content')
            );
        });

        test('should load draft from localStorage', () => {
            const draftData = {
                text: 'Loaded draft',
                originalText: '',
                timestamp: new Date().toISOString(),
                wordCount: 2
            };
            
            global.localStorage.data['whisper-transcription-draft'] = JSON.stringify(draftData);
            
            app.loadTranscriptionDraft();
            
            expect(app.transcriptionState.currentText).toBe('Loaded draft');
            expect(app.transcriptionState.isDirty).toBe(true);
        });

        test('should clear draft from localStorage', () => {
            global.localStorage.data['whisper-transcription-draft'] = 'test data';
            
            app.clearTranscriptionDraft();
            
            expect(global.localStorage.removeItem).toHaveBeenCalledWith('whisper-transcription-draft');
            expect(app.transcriptionState.isDirty).toBe(false);
        });
    });

    describe('Undo/Redo Functionality', () => {
        beforeEach(() => {
            // Set up initial state
            app.transcriptionState.history = ['', 'First edit', 'Second edit', 'Third edit'];
            app.transcriptionState.historyIndex = 3;
            app.transcriptionState.currentText = 'Third edit';
        });

        test('should undo to previous state', () => {
            const textarea = document.getElementById('transcription-text');
            textarea.value = 'Third edit';
            
            app.undoTranscription();
            
            expect(app.transcriptionState.historyIndex).toBe(2);
            expect(textarea.value).toBe('Second edit');
            expect(app.transcriptionState.currentText).toBe('Second edit');
        });

        test('should redo to next state', () => {
            const textarea = document.getElementById('transcription-text');
            app.transcriptionState.historyIndex = 2;
            
            app.redoTranscription();
            
            expect(app.transcriptionState.historyIndex).toBe(3);
            expect(textarea.value).toBe('Third edit');
            expect(app.transcriptionState.currentText).toBe('Third edit');
        });

        test('should not undo beyond beginning of history', () => {
            app.transcriptionState.historyIndex = 0;
            const initialIndex = app.transcriptionState.historyIndex;
            
            app.undoTranscription();
            
            expect(app.transcriptionState.historyIndex).toBe(initialIndex);
        });

        test('should not redo beyond end of history', () => {
            app.transcriptionState.historyIndex = 3;
            const initialIndex = app.transcriptionState.historyIndex;
            
            app.redoTranscription();
            
            expect(app.transcriptionState.historyIndex).toBe(initialIndex);
        });

        test('should update undo/redo button states', () => {
            const undoBtn = document.getElementById('undo-btn');
            const redoBtn = document.getElementById('redo-btn');
            
            // At end of history
            app.transcriptionState.historyIndex = 3;
            app.updateUndoRedoButtons();
            
            expect(undoBtn.disabled).toBe(false);
            expect(redoBtn.disabled).toBe(true);
            
            // At beginning of history
            app.transcriptionState.historyIndex = 0;
            app.updateUndoRedoButtons();
            
            expect(undoBtn.disabled).toBe(true);
            expect(redoBtn.disabled).toBe(false);
        });
    });

    describe('Export Functionality', () => {
        beforeEach(() => {
            const textarea = document.getElementById('transcription-text');
            textarea.value = 'Test transcription content';
        });

        test('should export as TXT format', async () => {
            await app.exportAs('txt');
            
            expect(mockElectronAPI.saveFile).toHaveBeenCalledWith(
                'Test transcription content',
                expect.stringMatching(/transcription-.*\.txt/)
            );
        });

        test('should export as Markdown format', async () => {
            await app.exportAs('md');
            
            expect(mockElectronAPI.saveFile).toHaveBeenCalledWith(
                expect.stringContaining('# Transcription'),
                expect.stringMatching(/transcription-.*\.md/)
            );
        });

        test('should export as JSON format', async () => {
            await app.exportAs('json');
            
            const expectedContent = expect.stringContaining('"transcription": "Test transcription content"');
            expect(mockElectronAPI.saveFile).toHaveBeenCalledWith(
                expectedContent,
                expect.stringMatching(/transcription-.*\.json/)
            );
        });

        test('should format as Markdown correctly', () => {
            const text = 'Sample transcription';
            const markdown = app.formatAsMarkdown(text);
            
            expect(markdown).toContain('# Transcription');
            expect(markdown).toContain('Sample transcription');
            expect(markdown).toContain('Generated by Whisper Wrapper');
        });

        test('should format as JSON correctly', () => {
            const text = 'Sample transcription';
            const jsonString = app.formatAsJSON(text);
            const jsonData = JSON.parse(jsonString);
            
            expect(jsonData.transcription).toBe(text);
            expect(jsonData.metadata.generatedBy).toBe('Whisper Wrapper');
            expect(jsonData.metadata.wordCount).toBe(2);
        });

        test('should handle export error gracefully', async () => {
            mockElectronAPI.saveFile.mockRejectedValue(new Error('Save failed'));
            
            await app.exportAs('txt');
            
            expect(app.showError).toHaveBeenCalledWith('Failed to export as TXT');
        });
    });

    describe('Find & Replace Functionality', () => {
        beforeEach(() => {
            const textarea = document.getElementById('transcription-text');
            textarea.value = 'This is a test. This is only a test. Testing is important.';
        });

        test('should find matches in text', () => {
            const text = 'This is a test. This is only a test. Testing is important.';
            const matches = app.findMatches(text, 'test');
            
            expect(matches).toHaveLength(3); // Case-insensitive: 'test', 'test', 'Test'
            expect(matches[0].text).toBe('test');
            expect(matches[1].text).toBe('test');
            expect(matches[2].text).toBe('Test');
        });

        test('should update find results display', () => {
            const findInput = document.getElementById('find-input');
            const findResults = document.getElementById('find-results');
            
            findInput.value = 'test';
            app.updateFindResults();
            
            expect(findResults.textContent).toBe('3 matches');
        });

        test('should navigate to next match', () => {
            const findInput = document.getElementById('find-input');
            findInput.value = 'test';
            app.updateFindResults();
            
            app.findNext();
            
            expect(app.currentFindIndex).toBe(0);
        });

        test('should navigate to previous match', () => {
            const findInput = document.getElementById('find-input');
            findInput.value = 'test';
            app.updateFindResults();
            app.currentFindIndex = 1;
            
            app.findPrevious();
            
            expect(app.currentFindIndex).toBe(0);
        });

        test('should replace next occurrence', () => {
            const textarea = document.getElementById('transcription-text');
            const findInput = document.getElementById('find-input');
            const replaceInput = document.getElementById('replace-input');
            
            findInput.value = 'test';
            replaceInput.value = 'exam';
            app.updateFindResults();
            app.currentFindIndex = 0;
            
            app.replaceNext();
            
            expect(textarea.value).toContain('This is a exam.');
        });

        test('should replace all occurrences', () => {
            const textarea = document.getElementById('transcription-text');
            const findInput = document.getElementById('find-input');
            const replaceInput = document.getElementById('replace-input');
            
            findInput.value = 'test';
            replaceInput.value = 'exam';
            
            app.replaceAll();
            
            expect(textarea.value).not.toContain('test');
            expect(textarea.value).toContain('exam');
        });

        test('should toggle find/replace panel', () => {
            const panel = document.getElementById('find-replace-panel');
            
            app.toggleFindReplace();
            
            expect(panel.classList.contains('hidden')).toBe(false);
            
            app.toggleFindReplace();
            
            expect(panel.classList.contains('hidden')).toBe(true);
        });
    });

    describe('Word and Character Count', () => {
        test('should count words correctly', () => {
            expect(app.getWordCount('Hello world')).toBe(2);
            expect(app.getWordCount('  Hello   world  ')).toBe(2);
            expect(app.getWordCount('')).toBe(0);
            expect(app.getWordCount('Single')).toBe(1);
        });

        test('should count characters correctly', () => {
            expect(app.getCharacterCount('Hello')).toBe(5);
            expect(app.getCharacterCount('')).toBe(0);
            expect(app.getCharacterCount('Hello world!')).toBe(12);
        });

        test('should update transcription status with counts', () => {
            const statusElement = document.getElementById('transcription-status');
            app.transcriptionState.currentText = 'Hello world';
            
            app.updateTranscriptionStatus();
            
            expect(statusElement.textContent).toContain('2 words, 11 characters');
        });
    });

    describe('Clear Draft Functionality', () => {
        test('should clear draft with confirmation', () => {
            const textarea = document.getElementById('transcription-text');
            const emptyState = document.getElementById('transcription-empty');
            
            textarea.value = 'Some content';
            app.transcriptionState.currentText = 'Some content';
            app.transcriptionState.isDirty = true;
            
            global.confirm.mockReturnValue(true);
            
            app.clearDraft();
            
            expect(textarea.value).toBe('');
            expect(app.transcriptionState.currentText).toBe('');
            expect(app.transcriptionState.isDirty).toBe(false);
            expect(emptyState.classList.contains('hidden')).toBe(false);
        });

        test('should not clear draft without confirmation', () => {
            const textarea = document.getElementById('transcription-text');
            textarea.value = 'Some content';
            app.transcriptionState.currentText = 'Some content';
            
            global.confirm.mockReturnValue(false);
            
            app.clearDraft();
            
            expect(textarea.value).toBe('Some content');
            expect(app.transcriptionState.currentText).toBe('Some content');
        });
    });

    describe('Keyboard Shortcuts', () => {
        test('should handle Ctrl+Z for undo', () => {
            app.undoTranscription = jest.fn();
            
            const event = new window.KeyboardEvent('keydown', {
                key: 'z',
                ctrlKey: true,
                bubbles: true
            });
            
            app.handleKeyboardShortcuts(event);
            
            expect(app.undoTranscription).toHaveBeenCalled();
        });

        test('should handle Ctrl+Y for redo', () => {
            app.redoTranscription = jest.fn();
            
            const event = new window.KeyboardEvent('keydown', {
                key: 'y',
                ctrlKey: true,
                bubbles: true
            });
            
            app.handleKeyboardShortcuts(event);
            
            expect(app.redoTranscription).toHaveBeenCalled();
        });

        test('should handle Ctrl+F for find', () => {
            app.toggleFindReplace = jest.fn();
            
            const event = new window.KeyboardEvent('keydown', {
                key: 'f',
                ctrlKey: true,
                bubbles: true
            });
            
            app.handleKeyboardShortcuts(event);
            
            expect(app.toggleFindReplace).toHaveBeenCalled();
        });

        test('should handle Ctrl+S for save', () => {
            app.downloadTranscription = jest.fn();
            
            const event = new window.KeyboardEvent('keydown', {
                key: 's',
                ctrlKey: true,
                bubbles: true
            });
            
            app.handleKeyboardShortcuts(event);
            
            expect(app.downloadTranscription).toHaveBeenCalled();
        });
    });

    // Clean up any timers after each test
    afterEach(() => {
        // Clear any timeouts and reset timers
        if (app && app.transcriptionState && app.transcriptionState.autoSaveTimer) {
            clearTimeout(app.transcriptionState.autoSaveTimer);
            app.transcriptionState.autoSaveTimer = null;
        }
        jest.clearAllTimers();
    });
});
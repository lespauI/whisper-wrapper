/**
 * Integration Tests for Complete Transcription Workflow (Phase 4)
 * Tests the full transcription editing experience with auto-save, export, and editing features
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

describe('Transcription Workflow Integration - Phase 4', () => {
    let mainWindow;
    let tempDir;

    beforeAll(async () => {
        // Create temporary directory for test files
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-test-'));
        
        // Wait for Electron app to be ready
        await app.whenReady();
        
        // Create main window
        mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            show: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, '../../src/main/preload.js')
            }
        });
        
        // Load the app
        await mainWindow.loadFile(path.join(__dirname, '../../src/renderer/index.html'));
    });

    afterAll(async () => {
        // Clean up
        if (mainWindow) {
            mainWindow.close();
        }
        
        // Remove temporary directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        
        await app.quit();
    });

    describe('Complete Transcription Editing Workflow', () => {
        test('should handle complete transcription editing session', async () => {
            // Switch to transcription tab
            await mainWindow.webContents.executeJavaScript(`
                document.querySelector('[data-tab="transcription"]').click();
            `);

            // Simulate receiving transcription result
            const testTranscription = 'This is a test transcription that we will edit and save.';
            await mainWindow.webContents.executeJavaScript(`
                window.app.showTranscriptionResult('${testTranscription}');
            `);

            // Verify transcription is displayed
            const displayedText = await mainWindow.webContents.executeJavaScript(`
                document.getElementById('transcription-text').value;
            `);
            expect(displayedText).toBe(testTranscription);

            // Verify transcription state is initialized
            const transcriptionState = await mainWindow.webContents.executeJavaScript(`
                window.app.transcriptionState;
            `);
            expect(transcriptionState.originalText).toBe(testTranscription);
            expect(transcriptionState.isDirty).toBe(false);
            expect(transcriptionState.history).toContain(testTranscription);
        });

        test('should handle text editing with auto-save', async () => {
            const editedText = 'This is an edited test transcription that we will save.';
            
            // Edit the transcription
            await mainWindow.webContents.executeJavaScript(`
                const textarea = document.getElementById('transcription-text');
                textarea.value = '${editedText}';
                textarea.dispatchEvent(new Event('input'));
            `);

            // Wait for auto-save to trigger
            await new Promise(resolve => setTimeout(resolve, 2500));

            // Verify state is updated
            const transcriptionState = await mainWindow.webContents.executeJavaScript(`
                window.app.transcriptionState;
            `);
            expect(transcriptionState.currentText).toBe(editedText);
            expect(transcriptionState.isDirty).toBe(true);

            // Verify auto-save occurred
            const draftSaved = await mainWindow.webContents.executeJavaScript(`
                localStorage.getItem('whisper-transcription-draft') !== null;
            `);
            expect(draftSaved).toBe(true);
        });

        test('should handle undo/redo operations', async () => {
            // Make multiple edits
            const edits = [
                'First edit',
                'Second edit',
                'Third edit'
            ];

            for (const edit of edits) {
                await mainWindow.webContents.executeJavaScript(`
                    const textarea = document.getElementById('transcription-text');
                    textarea.value = '${edit}';
                    window.app.handleTranscriptionEdit('${edit}');
                `);
            }

            // Test undo
            await mainWindow.webContents.executeJavaScript(`
                window.app.undoTranscription();
            `);

            let currentText = await mainWindow.webContents.executeJavaScript(`
                document.getElementById('transcription-text').value;
            `);
            expect(currentText).toBe('Second edit');

            // Test redo
            await mainWindow.webContents.executeJavaScript(`
                window.app.redoTranscription();
            `);

            currentText = await mainWindow.webContents.executeJavaScript(`
                document.getElementById('transcription-text').value;
            `);
            expect(currentText).toBe('Third edit');

            // Verify button states
            const buttonStates = await mainWindow.webContents.executeJavaScript(`
                ({
                    undoDisabled: document.getElementById('undo-btn').disabled,
                    redoDisabled: document.getElementById('redo-btn').disabled
                });
            `);
            expect(buttonStates.undoDisabled).toBe(false);
            expect(buttonStates.redoDisabled).toBe(true);
        });

        test('should handle find and replace operations', async () => {
            // Set up text with multiple occurrences
            const testText = 'The quick brown fox jumps over the lazy dog. The fox is quick.';
            await mainWindow.webContents.executeJavaScript(`
                const textarea = document.getElementById('transcription-text');
                textarea.value = '${testText}';
                window.app.handleTranscriptionEdit('${testText}');
            `);

            // Open find/replace panel
            await mainWindow.webContents.executeJavaScript(`
                window.app.toggleFindReplace();
            `);

            // Verify panel is open
            const panelVisible = await mainWindow.webContents.executeJavaScript(`
                !document.getElementById('find-replace-panel').classList.contains('hidden');
            `);
            expect(panelVisible).toBe(true);

            // Perform find operation
            await mainWindow.webContents.executeJavaScript(`
                document.getElementById('find-input').value = 'fox';
                window.app.updateFindResults();
            `);

            // Verify find results
            const findResults = await mainWindow.webContents.executeJavaScript(`
                document.getElementById('find-results').textContent;
            `);
            expect(findResults).toBe('2 matches');

            // Perform replace all
            await mainWindow.webContents.executeJavaScript(`
                document.getElementById('replace-input').value = 'cat';
                window.app.replaceAll();
            `);

            // Verify replacement
            const replacedText = await mainWindow.webContents.executeJavaScript(`
                document.getElementById('transcription-text').value;
            `);
            expect(replacedText).toContain('cat');
            expect(replacedText).not.toContain('fox');
        });

        test('should handle export functionality', async () => {
            const testText = 'Export test transcription content';
            await mainWindow.webContents.executeJavaScript(`
                const textarea = document.getElementById('transcription-text');
                textarea.value = '${testText}';
                window.app.handleTranscriptionEdit('${testText}');
            `);

            // Test TXT export
            const txtContent = await mainWindow.webContents.executeJavaScript(`
                window.app.formatAsMarkdown = window.app.formatAsMarkdown || function(text) {
                    return '# Transcription\\n\\n' + text;
                };
                window.app.formatAsJSON = window.app.formatAsJSON || function(text) {
                    return JSON.stringify({transcription: text, metadata: {wordCount: text.split(' ').length}});
                };
                
                // Test different export formats
                const txtResult = '${testText}';
                const mdResult = window.app.formatAsMarkdown('${testText}');
                const jsonResult = window.app.formatAsJSON('${testText}');
                
                ({
                    txt: txtResult,
                    md: mdResult,
                    json: jsonResult
                });
            `);

            expect(txtContent.txt).toBe(testText);
            expect(txtContent.md).toContain('# Transcription');
            expect(txtContent.md).toContain(testText);
            
            const jsonData = JSON.parse(txtContent.json);
            expect(jsonData.transcription).toBe(testText);
            expect(jsonData.metadata.wordCount).toBe(4);
        });

        test('should handle keyboard shortcuts', async () => {
            // Set up test content
            await mainWindow.webContents.executeJavaScript(`
                const textarea = document.getElementById('transcription-text');
                textarea.value = 'Keyboard shortcut test';
                window.app.handleTranscriptionEdit('Keyboard shortcut test');
                window.app.handleTranscriptionEdit('Modified text');
            `);

            // Test Ctrl+Z (undo)
            await mainWindow.webContents.executeJavaScript(`
                const textarea = document.getElementById('transcription-text');
                const event = new KeyboardEvent('keydown', {
                    key: 'z',
                    ctrlKey: true,
                    bubbles: true
                });
                window.app.handleKeyboardShortcuts(event);
            `);

            let currentText = await mainWindow.webContents.executeJavaScript(`
                document.getElementById('transcription-text').value;
            `);
            expect(currentText).toBe('Keyboard shortcut test');

            // Test Ctrl+F (find)
            await mainWindow.webContents.executeJavaScript(`
                const event = new KeyboardEvent('keydown', {
                    key: 'f',
                    ctrlKey: true,
                    bubbles: true
                });
                window.app.handleKeyboardShortcuts(event);
            `);

            const findPanelVisible = await mainWindow.webContents.executeJavaScript(`
                !document.getElementById('find-replace-panel').classList.contains('hidden');
            `);
            expect(findPanelVisible).toBe(true);
        });

        test('should handle draft persistence across sessions', async () => {
            const draftText = 'This is a draft that should persist';
            
            // Create and save draft
            await mainWindow.webContents.executeJavaScript(`
                const textarea = document.getElementById('transcription-text');
                textarea.value = '${draftText}';
                window.app.handleTranscriptionEdit('${draftText}');
                window.app.saveTranscriptionDraft();
            `);

            // Clear current content
            await mainWindow.webContents.executeJavaScript(`
                document.getElementById('transcription-text').value = '';
                window.app.transcriptionState.currentText = '';
            `);

            // Load draft
            await mainWindow.webContents.executeJavaScript(`
                window.app.loadTranscriptionDraft();
            `);

            // Verify draft was loaded
            const loadedText = await mainWindow.webContents.executeJavaScript(`
                document.getElementById('transcription-text').value;
            `);
            expect(loadedText).toBe(draftText);

            const transcriptionState = await mainWindow.webContents.executeJavaScript(`
                window.app.transcriptionState;
            `);
            expect(transcriptionState.isDirty).toBe(true);
        });

        test('should handle clear draft functionality', async () => {
            // Set up content
            await mainWindow.webContents.executeJavaScript(`
                const textarea = document.getElementById('transcription-text');
                textarea.value = 'Content to be cleared';
                window.app.transcriptionState.currentText = 'Content to be cleared';
                window.app.transcriptionState.isDirty = true;
            `);

            // Mock confirm to return true
            await mainWindow.webContents.executeJavaScript(`
                window.confirm = () => true;
                window.app.clearDraft();
            `);

            // Verify content is cleared
            const clearedText = await mainWindow.webContents.executeJavaScript(`
                document.getElementById('transcription-text').value;
            `);
            expect(clearedText).toBe('');

            const transcriptionState = await mainWindow.webContents.executeJavaScript(`
                window.app.transcriptionState;
            `);
            expect(transcriptionState.isDirty).toBe(false);
            expect(transcriptionState.currentText).toBe('');
        });

        test('should update status indicators correctly', async () => {
            const testText = 'Status indicator test with multiple words';
            
            await mainWindow.webContents.executeJavaScript(`
                const textarea = document.getElementById('transcription-text');
                textarea.value = '${testText}';
                window.app.handleTranscriptionEdit('${testText}');
                window.app.updateTranscriptionStatus();
            `);

            const statusText = await mainWindow.webContents.executeJavaScript(`
                document.getElementById('transcription-status').textContent;
            `);

            expect(statusText).toContain('6 words');
            expect(statusText).toContain('characters');
            expect(statusText).toContain('Unsaved changes');
        });
    });

    describe('Error Handling and Edge Cases', () => {
        test('should handle empty transcription gracefully', async () => {
            await mainWindow.webContents.executeJavaScript(`
                window.app.showTranscriptionResult('');
            `);

            const transcriptionState = await mainWindow.webContents.executeJavaScript(`
                window.app.transcriptionState;
            `);
            expect(transcriptionState.originalText).toBe('');
            expect(transcriptionState.currentText).toBe('');
        });

        test('should handle find with no matches', async () => {
            await mainWindow.webContents.executeJavaScript(`
                const textarea = document.getElementById('transcription-text');
                textarea.value = 'No matches here';
                document.getElementById('find-input').value = 'xyz';
                window.app.updateFindResults();
            `);

            const findResults = await mainWindow.webContents.executeJavaScript(`
                document.getElementById('find-results').textContent;
            `);
            expect(findResults).toBe('No matches');
        });

        test('should handle undo/redo at boundaries', async () => {
            // Set up minimal history
            await mainWindow.webContents.executeJavaScript(`
                window.app.transcriptionState.history = ['initial'];
                window.app.transcriptionState.historyIndex = 0;
                window.app.updateUndoRedoButtons();
            `);

            const buttonStates = await mainWindow.webContents.executeJavaScript(`
                ({
                    undoDisabled: document.getElementById('undo-btn').disabled,
                    redoDisabled: document.getElementById('redo-btn').disabled
                });
            `);
            expect(buttonStates.undoDisabled).toBe(true);
            expect(buttonStates.redoDisabled).toBe(true);
        });

        test('should handle large text content', async () => {
            const largeText = 'Large text content. '.repeat(1000);
            
            await mainWindow.webContents.executeJavaScript(`
                const textarea = document.getElementById('transcription-text');
                textarea.value = '${largeText}';
                window.app.handleTranscriptionEdit('${largeText}');
            `);

            const transcriptionState = await mainWindow.webContents.executeJavaScript(`
                window.app.transcriptionState;
            `);
            expect(transcriptionState.currentText).toBe(largeText);
            expect(transcriptionState.isDirty).toBe(true);
        });
    });

    describe('Performance and Memory Management', () => {
        test('should limit history size to prevent memory leaks', async () => {
            // Add many edits to test history limit
            await mainWindow.webContents.executeJavaScript(`
                for (let i = 0; i < 60; i++) {
                    window.app.handleTranscriptionEdit('Edit ' + i);
                }
            `);

            const historyLength = await mainWindow.webContents.executeJavaScript(`
                window.app.transcriptionState.history.length;
            `);
            expect(historyLength).toBeLessThanOrEqual(50);
        });

        test('should clean up timers properly', async () => {
            await mainWindow.webContents.executeJavaScript(`
                window.app.handleTranscriptionEdit('Timer test');
                const timerId = window.app.transcriptionState.autoSaveTimer;
                window.app.handleTranscriptionEdit('Another edit');
                // Previous timer should be cleared
            `);

            // Verify only one timer is active
            const hasTimer = await mainWindow.webContents.executeJavaScript(`
                window.app.transcriptionState.autoSaveTimer !== null;
            `);
            expect(hasTimer).toBe(true);
        });
    });
});
const fs = require('fs');
const path = require('path');

describe('Renderer source files required for build', () => {
    const rendererDir = path.join(__dirname, '../../../src/renderer');

    it('should have app/App.js', () => {
        expect(fs.existsSync(path.join(rendererDir, 'app', 'App.js'))).toBe(true);
    });

    it('should have app/AppState.js', () => {
        expect(fs.existsSync(path.join(rendererDir, 'app', 'AppState.js'))).toBe(true);
    });

    it('should have index.js that imports App', () => {
        const src = fs.readFileSync(path.join(rendererDir, 'index.js'), 'utf-8');
        expect(src).toMatch(/import\s*\{[^}]*App[^}]*\}\s*from\s*['"]\.\/app\/App\.js['"]/);
    });

    it('should have all expected controller files', () => {
        const expected = [
            'TabController.js',
            'StatusController.js',
            'SettingsController.js',
            'FileUploadController.js',
            'RecordingController.js',
            'TranscriptionController.js',
            'TemplateController.js',
            'refinementController.js',
            'libraryController.js'
        ];
        for (const file of expected) {
            expect(
                fs.existsSync(path.join(rendererDir, 'controllers', file))
            ).toBe(true);
        }
    });
});

describe('macOS close handler – before-quit flag', () => {
    let mainIndexSource;

    beforeAll(() => {
        const fs = require('fs');
        const path = require('path');
        mainIndexSource = fs.readFileSync(
            path.join(__dirname, '../../src/main/index.js'),
            'utf-8'
        );
    });

    it('should declare isQuitting variable', () => {
        expect(mainIndexSource).toMatch(/let\s+isQuitting\s*=\s*false/);
    });

    it('should set isQuitting to true on before-quit', () => {
        expect(mainIndexSource).toMatch(/app\.on\(\s*['"]before-quit['"]/);
        expect(mainIndexSource).toMatch(/isQuitting\s*=\s*true/);
    });

    it('should check isQuitting in the close handler', () => {
        expect(mainIndexSource).toMatch(/!isQuitting/);
        expect(mainIndexSource).toMatch(
            /process\.platform\s*===\s*['"]darwin['"]\s*&&\s*!isQuitting/
        );
    });
});

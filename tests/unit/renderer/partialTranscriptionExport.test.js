const { TranscriptionController } = require('../../../src/renderer/controllers/TranscriptionController');

describe('partial transcription export metadata', () => {
    const issue = { code: 'decoder_recovery_failed', start: 12, end: 20, message: 'Retry failed' };
    let controller;

    beforeEach(() => {
        controller = Object.create(TranscriptionController.prototype);
        controller.appState = {
            getTranscriptionState: () => ({
                status: 'partial',
                partial: true,
                issues: [issue],
                resumeId: 'b'.repeat(64)
            })
        };
        controller.formatTimestamp = seconds => `${seconds}s`;
        controller.getWordCount = text => text.split(/\s+/).filter(Boolean).length;
        controller.getCharacterCount = text => text.length;
    });

    it('includes partial status, issue intervals, and resume id in text export', () => {
        const text = controller.formatAsText('recognized words', controller.getExportMetadata());
        expect(text).toContain('Status: Partial; review required');
        expect(text).toContain('Resume ID: ' + 'b'.repeat(64));
        expect(text).toContain('12s–20s: Retry failed');
    });

    it('includes the same contract in Markdown and JSON exports', () => {
        const metadata = controller.getExportMetadata();
        const markdown = controller.formatAsMarkdown('recognized words', metadata);
        const json = JSON.parse(controller.formatAsJSON('recognized words', metadata));

        expect(markdown).toContain('**Status:** Partial; review required');
        expect(markdown).toContain('12s–20s: Retry failed');
        expect(json.metadata).toMatchObject({
            status: 'partial',
            partial: true,
            issues: [issue],
            resumeId: 'b'.repeat(64)
        });
    });
});

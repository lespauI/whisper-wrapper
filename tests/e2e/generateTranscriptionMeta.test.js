/**
 * E2E Test: generateTranscriptionMeta
 *
 * Full pipeline test:
 *   1. Transcribe tests/data/summary-test.wav with local Whisper (tiny model)
 *   2. Feed the real transcription text to ollamaService.generateTranscriptionMeta()
 *   3. Assert summary is a non-empty string and labels is an array of strings
 *
 * Skips gracefully when Whisper or Ollama is not available.
 */

const path = require('path');
const fs = require('fs');
const axios = require('axios');

const TEST_WAV = path.join(process.cwd(), 'tests/data', 'summary-test.wav');
const OLLAMA_ENDPOINT = 'http://localhost:11434';

async function isOllamaRunning() {
    try {
        await axios.get(`${OLLAMA_ENDPOINT}/api/tags`, { timeout: 3000 });
        return true;
    } catch (_) {
        return false;
    }
}

describe('generateTranscriptionMeta E2E', () => {
    let ollamaAvailable = false;
    let ollamaService;
    let TranscriptionService;

    beforeAll(async () => {
        ollamaAvailable = await isOllamaRunning();
        ollamaService = require('../../src/services/ollamaService');
        TranscriptionService = require('../../src/services/transcriptionService');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('summary-test.wav exists in test data', () => {
        expect(fs.existsSync(TEST_WAV)).toBe(true);
    });

    test('transcribes summary-test.wav and generates non-empty summary and labels', async () => {
        if (!ollamaAvailable) {
            console.warn('Ollama not running — skipping');
            return;
        }

        const transcriptionService = new TranscriptionService();

        if (!transcriptionService.isAvailable()) {
            console.warn('Whisper not available — skipping');
            return;
        }

        transcriptionService.setModel('tiny');
        transcriptionService.setLanguage('auto');

        const FileService = require('../../src/services/fileService');
        const fileService = new FileService();
        const tempFile = await fileService.copyToTemp(TEST_WAV);

        let transcriptionText;
        try {
            const result = await transcriptionService.transcribeFile(tempFile, { threads: 4, translate: false });
            expect(result.success).toBe(true);
            transcriptionText = result.text;
        } finally {
            await fileService.cleanup(tempFile);
        }

        if (!transcriptionText || !transcriptionText.trim()) {
            console.warn('Empty transcription from tiny model — skipping meta generation');
            return;
        }

        console.log('Transcription text:', transcriptionText.substring(0, 200));

        jest.spyOn(ollamaService, 'updateSettings').mockImplementation(function () {
            this.settings = {
                enabled: true,
                endpoint: OLLAMA_ENDPOINT,
                model: 'qwen3.5:4b-q4_K_M',
                timeoutSeconds: 300
            };
        });

        const meta = await ollamaService.generateTranscriptionMeta(transcriptionText);

        console.log('Summary:', meta.summary);
        console.log('Labels:', meta.labels);

        expect(typeof meta.summary).toBe('string');
        expect(meta.summary.trim().length).toBeGreaterThan(0);
        expect(Array.isArray(meta.labels)).toBe(true);
        meta.labels.forEach(label => expect(typeof label).toBe('string'));
    }, 300000);
});

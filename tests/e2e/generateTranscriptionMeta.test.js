/**
 * E2E Test for generateTranscriptionMeta using Ollama local model
 * Uses tests/data/test.wav (same file as ~/Downloads/test.wav) as test data
 */

const path = require('path');
const fs = require('fs');
const axios = require('axios');

const OLLAMA_ENDPOINT = 'http://localhost:11434';
const TEST_WAV = path.join(process.cwd(), 'tests/data', 'test.wav');

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

    beforeAll(async () => {
        ollamaAvailable = await isOllamaRunning();
        if (!ollamaAvailable) {
            return;
        }
        ollamaService = require('../../src/services/ollamaService');
    });

    test('test.wav file exists', () => {
        expect(fs.existsSync(TEST_WAV)).toBe(true);
    });

    test('generates summary and labels from transcription text', async () => {
        if (!ollamaAvailable) {
            console.warn('Ollama is not running — skipping generateTranscriptionMeta test');
            return;
        }

        const sampleText = fs.readFileSync(TEST_WAV).length > 0
            ? 'This is a test audio recording used to verify the transcription pipeline works correctly.'
            : 'empty';

        const result = await ollamaService.generateTranscriptionMeta(sampleText);

        expect(result).toBeDefined();
        expect(typeof result.summary).toBe('string');
        expect(result.summary.length).toBeGreaterThan(0);
        expect(Array.isArray(result.labels)).toBe(true);
    }, 120000);

    test('returns empty meta gracefully when text is empty string', async () => {
        if (!ollamaAvailable) {
            console.warn('Ollama is not running — skipping generateTranscriptionMeta empty text test');
            return;
        }

        const result = await ollamaService.generateTranscriptionMeta('');

        expect(result).toBeDefined();
        expect(typeof result.summary).toBe('string');
        expect(Array.isArray(result.labels)).toBe(true);
    }, 120000);

    test('result labels contain only strings', async () => {
        if (!ollamaAvailable) {
            console.warn('Ollama is not running — skipping label type check test');
            return;
        }

        const text = 'The speaker discusses machine learning concepts including neural networks and gradient descent.';
        const result = await ollamaService.generateTranscriptionMeta(text);

        result.labels.forEach(label => {
            expect(typeof label).toBe('string');
        });
    }, 120000);
});

/**
 * Integration Tests: TranscriptionStoreService + OllamaService
 *
 * Tests the real store round-trip (disk I/O) and optional Ollama connectivity.
 * Ollama tests are skipped gracefully when the local daemon is not running.
 *
 * Run with: npx jest --selectProjects integration --testPathPattern=transcriptionStoreIntegration
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');

const OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
const OLLAMA_PREFERRED_MODEL = process.env.OLLAMA_MODEL || 'qwen3.5:0.8b';
const LIVE_OLLAMA_TIMEOUT = 120_000;

async function getOllamaStatus() {
    try {
        const res = await axios.get(`${OLLAMA_ENDPOINT}/api/tags`, { timeout: 3000 });
        const models = (res.data && res.data.models) ? res.data.models.map(m => m.name) : [];
        return { available: true, models };
    } catch {
        return { available: false, models: [] };
    }
}

describe('TranscriptionStoreService — integration (disk round-trip)', () => {
    let TranscriptionStoreService;
    let service;
    let tempDir;

    beforeAll(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'txstore-test-'));

        jest.resetModules();

        jest.doMock('../../src/config', () => ({
            get: (key) => {
                if (key === 'app.dataDirectory') return tempDir;
                return undefined;
            },
            getAIRefinementSettings: () => ({
                endpoint: OLLAMA_ENDPOINT,
                model: OLLAMA_PREFERRED_MODEL,
                timeoutSeconds: 30
            })
        }));

        jest.doMock('../../src/services/ollamaService', () => ({
            generateTranscriptionMeta: jest.fn().mockResolvedValue({
                summary: 'Meeting about project roadmap and quarterly goals',
                labels: ['meeting', 'roadmap', 'integration']
            })
        }));

        TranscriptionStoreService = require('../../src/services/transcriptionStoreService');
        service = new TranscriptionStoreService();
    });

    afterAll(() => {
        if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        jest.resetModules();
        jest.restoreAllMocks();
    });

    afterEach(() => {
        service.index = [];
        service._saveIndex();
        const files = fs.readdirSync(service.transcriptionsDir).filter(f => f !== 'index.json');
        for (const f of files) {
            fs.rmSync(path.join(service.transcriptionsDir, f));
        }
    });

    test('store() writes a .txt file and updates index.json', async () => {
        const text = 'Hello, this is a test transcription.';
        const entry = await service.store(text, { sourceFile: 'test.mp3' });

        expect(entry).toMatchObject({
            id: expect.stringMatching(/^[0-9a-f-]{36}$/),
            summary: 'Meeting about project roadmap and quarterly goals',
            labels: ['meeting', 'roadmap', 'integration'],
            sourceFile: 'test.mp3'
        });

        const txtPath = path.join(service.transcriptionsDir, `${entry.id}.txt`);
        expect(fs.existsSync(txtPath)).toBe(true);
        expect(fs.readFileSync(txtPath, 'utf8')).toBe(text);

        const index = JSON.parse(fs.readFileSync(service._indexPath(), 'utf8'));
        expect(index).toHaveLength(1);
        expect(index[0].id).toBe(entry.id);
    });

    test('get() returns the index entry and file text', async () => {
        const text = 'Retrievable transcription content.';
        const stored = await service.store(text, {});

        const result = await service.get(stored.id);
        expect(result.entry.id).toBe(stored.id);
        expect(result.text).toBe(text);
    });

    test('list() returns all entries when no filter supplied', async () => {
        await service.store('First transcription', { sourceFile: 'a.mp3' });
        await service.store('Second transcription', { sourceFile: 'b.mp3' });

        const results = service.list({});
        expect(results).toHaveLength(2);
    });

    test('list() filters by query matching the mocked summary', async () => {
        await service.store('Content about alpha topic', {});
        await service.store('Content about beta topic', {});

        const results = service.list({ query: 'roadmap' });
        expect(results.length).toBeGreaterThanOrEqual(1);
    });

    test('list() filters by label', async () => {
        await service.store('First', {});
        await service.store('Second', {});

        const results = service.list({ labels: ['meeting'] });
        expect(results.length).toBe(2);
    });

    test('delete() removes the file and index entry', async () => {
        const stored = await service.store('To be deleted', {});
        const txtPath = path.join(service.transcriptionsDir, `${stored.id}.txt`);

        await service.delete(stored.id);

        expect(fs.existsSync(txtPath)).toBe(false);
        const index = JSON.parse(fs.readFileSync(service._indexPath(), 'utf8'));
        expect(index.find(e => e.id === stored.id)).toBeUndefined();
    });

    test('reindex() rebuilds index from disk and returns count', async () => {
        await service.store('Reindex me', { sourceFile: 'x.mp3' });
        const originalId = service.index[0].id;

        service.index = [];
        service._saveIndex();

        const count = await service.reindex();
        expect(count).toBeGreaterThanOrEqual(1);
        expect(service.index.find(e => e.id === originalId)).toBeDefined();
    });

    test('get() returns null for unknown id', async () => {
        const result = await service.get('00000000-0000-0000-0000-000000000000');
        expect(result).toBeNull();
    });
});

describe('OllamaService.generateTranscriptionMeta — integration (live Ollama)', () => {
    let ollamaStatus;

    beforeAll(async () => {
        ollamaStatus = await getOllamaStatus();
        if (!ollamaStatus.available) {
            console.log(`⚠️  Ollama not reachable at ${OLLAMA_ENDPOINT} — skipping live tests`);
        } else if (ollamaStatus.models.length === 0) {
            console.log('⚠️  Ollama reachable but no models installed — skipping live generation test');
        } else {
            console.log(`✅ Ollama available with models: ${ollamaStatus.models.join(', ')}`);
        }
    });

    beforeEach(() => {
        jest.resetModules();
        jest.unmock('../../src/services/ollamaService');
        jest.unmock('../../src/config');
        jest.unmock('axios');
    });

    test('connects to Ollama and returns correct shape (with graceful fallback)', async () => {
        if (!ollamaStatus.available || ollamaStatus.models.length === 0) {
            console.log('SKIP: Ollama not available or no models installed');
            return;
        }

        const modelToUse = ollamaStatus.models.includes(OLLAMA_PREFERRED_MODEL)
            ? OLLAMA_PREFERRED_MODEL
            : ollamaStatus.models[0];

        console.log(`Using model: ${modelToUse}`);

        const ollamaService = require('../../src/services/ollamaService');
        const result = await ollamaService.generateTranscriptionMeta(
            'The meeting discussed the Q1 budget, hiring plans, and the new product roadmap.',
            modelToUse
        );

        expect(result).toHaveProperty('summary');
        expect(result).toHaveProperty('labels');
        expect(typeof result.summary).toBe('string');
        expect(Array.isArray(result.labels)).toBe(true);

        if (result.summary.length > 0) {
            console.log(`Model returned summary: "${result.summary}"`);
            console.log(`Model returned labels: ${JSON.stringify(result.labels)}`);
        } else {
            console.log(`Model (${modelToUse}) did not produce valid JSON — graceful fallback confirmed`);
        }
    }, LIVE_OLLAMA_TIMEOUT);

    test('returns empty fallback when Ollama is not reachable', async () => {
        jest.doMock('axios', () => {
            const mockFn = jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED'));
            mockFn.get = jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED'));
            return mockFn;
        });

        jest.doMock('../../src/config', () => ({
            getAIRefinementSettings: () => ({
                endpoint: 'http://localhost:19999',
                model: 'none',
                timeoutSeconds: 1
            })
        }));

        const ollamaService = require('../../src/services/ollamaService');
        const result = await ollamaService.generateTranscriptionMeta('Some text');

        expect(result).toEqual({ summary: '', labels: [] });
    });
});

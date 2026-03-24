/**
 * Unit tests for TranscriptionStoreService
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

jest.mock('../../../src/config', () => {
  const tmpDir = require('os').tmpdir();
  return {
    get: jest.fn((key) => {
      if (key === 'app.dataDirectory') return require('path').join(tmpDir, 'tss-test-data');
      return undefined;
    })
  };
});

jest.mock('../../../src/services/ollamaService', () => ({
  generateTranscriptionMeta: jest.fn().mockResolvedValue({
    title: 'Test Title',
    summary: 'Test summary.',
    labels: ['test', 'unit']
  })
}));

const ollamaService = require('../../../src/services/ollamaService');
const TranscriptionStoreService = require('../../../src/services/transcriptionStoreService');

describe('TranscriptionStoreService', () => {
  let service;
  let testDataDir;

  beforeEach(() => {
    jest.clearAllMocks();
    testDataDir = path.join(os.tmpdir(), 'tss-test-data', 'transcriptions');
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true });
    }
    service = new TranscriptionStoreService();
  });

  afterEach(() => {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true });
    }
  });

  describe('store()', () => {
    it('saves a .txt file and updates index.json', async () => {
      const entry = await service.store('Hello world transcription', { sourceFile: 'audio.wav' });

      expect(entry.id).toBeDefined();
      expect(entry.summary).toBe('Test summary.');
      expect(entry.labels).toEqual(['test', 'unit']);
      expect(entry.wordCount).toBe(3);
      expect(entry.metaStatus).toBe('success');
      expect(entry.title).toBe('Test Title');

      const txtPath = path.join(testDataDir, `${entry.id}.txt`);
      expect(fs.existsSync(txtPath)).toBe(true);
      expect(fs.readFileSync(txtPath, 'utf8')).toBe('Hello world transcription');

      const indexPath = path.join(testDataDir, 'index.json');
      const idx = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      expect(idx).toHaveLength(1);
      expect(idx[0].id).toBe(entry.id);
    });

    it('stores transcription even when Ollama fails (graceful fallback)', async () => {
      ollamaService.generateTranscriptionMeta.mockRejectedValueOnce(new Error('Ollama down'));

      const entry = await service.store('Some text', {});

      expect(entry.id).toBeDefined();
      expect(entry.summary).toBe('');
      expect(entry.labels).toEqual([]);
      expect(entry.metaStatus).toBe('failed');
      expect(entry.metaError).toBe('Ollama down');

      const txtPath = path.join(testDataDir, `${entry.id}.txt`);
      expect(fs.existsSync(txtPath)).toBe(true);
    });

    it('stores transcription with metaFailed flag from ollamaService', async () => {
      ollamaService.generateTranscriptionMeta.mockResolvedValueOnce({
        title: '', summary: '', labels: [], metaFailed: true, metaError: 'Request failed with status code 404'
      });

      const entry = await service.store('Some text', {});

      expect(entry.metaStatus).toBe('failed');
      expect(entry.metaError).toBe('Request failed with status code 404');
    });

    it('uses title from metadata when provided (overrides meta title)', async () => {
      const entry = await service.store('Text', { title: 'My Custom Title' });
      expect(entry.title).toBe('My Custom Title');
    });

    it('uses meta-generated title when no metadata title given', async () => {
      const entry = await service.store('Text', {});
      expect(entry.title).toBe('Test Title');
    });

    it('falls back to sourceFile when no title from metadata or meta', async () => {
      ollamaService.generateTranscriptionMeta.mockResolvedValueOnce({
        title: '', summary: '', labels: []
      });
      const entry = await service.store('Text', { sourceFile: '/path/to/meeting.wav' });
      expect(entry.title).toBe('meeting.wav');
    });

    it('stores audioFilePath in the index entry', async () => {
      const entry = await service.store('Audio path test', {
        sourceFile: 'recording.wav',
        audioFilePath: '/Users/test/recordings/recording.wav'
      });

      expect(entry.audioFilePath).toBe('/Users/test/recordings/recording.wav');

      const indexPath = path.join(testDataDir, 'index.json');
      const idx = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      expect(idx[0].audioFilePath).toBe('/Users/test/recordings/recording.wav');
    });

    it('stores empty audioFilePath when not provided', async () => {
      const entry = await service.store('No audio path', { sourceFile: 'file.wav' });
      expect(entry.audioFilePath).toBe('');
    });
  });

  describe('list()', () => {
    let e1, e2, e3;

    beforeEach(async () => {
      ollamaService.generateTranscriptionMeta
        .mockResolvedValueOnce({ title: 'Alpha Title', summary: 'Alpha summary', labels: ['alpha', 'meeting'] })
        .mockResolvedValueOnce({ title: 'Beta Title', summary: 'Beta summary', labels: ['beta'] })
        .mockResolvedValueOnce({ title: 'Gamma Title', summary: 'Gamma summary', labels: ['alpha', 'beta'] });

      e1 = await service.store('alpha text content', { title: 'Alpha', sourceFile: 'alpha.wav' });
      e2 = await service.store('beta text content', { title: 'Beta', sourceFile: 'beta.wav' });
      e3 = await service.store('gamma text content', { title: 'Gamma', sourceFile: 'gamma.wav' });
    });

    it('returns all entries sorted by date descending with no filters', () => {
      const results = service.list();
      expect(results).toHaveLength(3);
      const ids = results.map(r => r.id);
      expect(ids).toContain(e1.id);
      expect(ids).toContain(e2.id);
      expect(ids).toContain(e3.id);
      for (let i = 0; i < results.length - 1; i++) {
        expect(new Date(results[i].date).getTime()).toBeGreaterThanOrEqual(new Date(results[i + 1].date).getTime());
      }
    });

    it('filters by query string (matches title)', () => {
      const results = service.list({ query: 'alpha.wav' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(e1.id);
    });

    it('filters by query string (matches summary)', () => {
      const results = service.list({ query: 'Beta summary' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(e2.id);
    });

    it('filters by label', () => {
      const results = service.list({ labels: ['alpha'] });
      expect(results).toHaveLength(2);
      const ids = results.map(r => r.id);
      expect(ids).toContain(e1.id);
      expect(ids).toContain(e3.id);
    });

    it('filters by multiple labels (AND logic)', () => {
      const results = service.list({ labels: ['alpha', 'beta'] });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(e3.id);
    });

    it('filters by dateFrom and dateTo', async () => {
      const before = new Date(Date.now() - 2000).toISOString();
      const after = new Date(Date.now() + 2000).toISOString();
      const results = service.list({ dateFrom: before, dateTo: after });
      expect(results).toHaveLength(3);
    });

    it('returns empty array when nothing matches', () => {
      const results = service.list({ query: 'nonexistent_xyz' });
      expect(results).toHaveLength(0);
    });
  });

  describe('get()', () => {
    it('returns entry and text for a valid id', async () => {
      const entry = await service.store('Full content here', {});
      const result = await service.get(entry.id);
      expect(result).not.toBeNull();
      expect(result.entry.id).toBe(entry.id);
      expect(result.text).toBe('Full content here');
    });

    it('returns null for unknown id', async () => {
      const result = await service.get('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('delete()', () => {
    it('removes the txt file and index entry', async () => {
      const entry = await service.store('Delete me', {});
      const txtPath = path.join(testDataDir, `${entry.id}.txt`);
      expect(fs.existsSync(txtPath)).toBe(true);

      const deleted = await service.delete(entry.id);
      expect(deleted).toBe(true);
      expect(fs.existsSync(txtPath)).toBe(false);
      expect(service.list()).toHaveLength(0);
    });

    it('returns false for unknown id', async () => {
      const deleted = await service.delete('does-not-exist');
      expect(deleted).toBe(false);
    });
  });

  describe('update()', () => {
    it('updates the title of an existing entry', async () => {
      const entry = await service.store('Some text', { title: 'Old Title' });
      const updated = await service.update(entry.id, { title: 'New Title' });

      expect(updated).not.toBeNull();
      expect(updated.title).toBe('New Title');

      const indexPath = path.join(testDataDir, 'index.json');
      const idx = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      expect(idx[0].title).toBe('New Title');
    });

    it('updates the labels of an existing entry', async () => {
      const entry = await service.store('Some text', {});
      const updated = await service.update(entry.id, { labels: ['foo', 'bar'] });

      expect(updated.labels).toEqual(['foo', 'bar']);

      const indexPath = path.join(testDataDir, 'index.json');
      const idx = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      expect(idx[0].labels).toEqual(['foo', 'bar']);
    });

    it('updates both title and labels together', async () => {
      const entry = await service.store('Some text', { title: 'Original' });
      const updated = await service.update(entry.id, { title: 'Renamed', labels: ['x'] });

      expect(updated.title).toBe('Renamed');
      expect(updated.labels).toEqual(['x']);
    });

    it('ignores whitespace-only title and keeps the original', async () => {
      const entry = await service.store('Some text', { title: 'Keep Me' });
      const updated = await service.update(entry.id, { title: '   ' });

      expect(updated.title).toBe('Keep Me');
    });

    it('ignores labels if value is not an array', async () => {
      const entry = await service.store('Some text', {});
      const originalLabels = [...entry.labels];
      const updated = await service.update(entry.id, { labels: 'not-an-array' });

      expect(updated.labels).toEqual(originalLabels);
    });

    it('returns null for an unknown id', async () => {
      const result = await service.update('non-existent-id', { title: 'X' });
      expect(result).toBeNull();
    });

    it('does not modify the txt content file', async () => {
      const entry = await service.store('Original text', {});
      const txtPath = path.join(testDataDir, `${entry.id}.txt`);
      await service.update(entry.id, { title: 'New Title' });

      expect(fs.readFileSync(txtPath, 'utf8')).toBe('Original text');
    });
  });

  describe('regenerateMeta()', () => {
    it('regenerates meta successfully and updates entry', async () => {
      ollamaService.generateTranscriptionMeta.mockResolvedValueOnce({
        title: 'Old', summary: '', labels: [], metaFailed: true, metaError: 'fail'
      });
      const entry = await service.store('Some text for regen', {});
      expect(entry.metaStatus).toBe('failed');

      ollamaService.generateTranscriptionMeta.mockResolvedValueOnce({
        title: 'New AI Title', summary: 'New summary', labels: ['new']
      });
      const updated = await service.regenerateMeta(entry.id);
      expect(updated.metaStatus).toBe('success');
      expect(updated.title).toBe('New AI Title');
      expect(updated.summary).toBe('New summary');
      expect(updated.labels).toEqual(['new']);
    });

    it('returns null for unknown id', async () => {
      const result = await service.regenerateMeta('non-existent-id');
      expect(result).toBeNull();
    });

    it('sets metaStatus to failed when regeneration fails', async () => {
      const entry = await service.store('Some text', {});

      ollamaService.generateTranscriptionMeta.mockResolvedValueOnce({
        title: '', summary: '', labels: [], metaFailed: true, metaError: 'Ollama 404'
      });
      const updated = await service.regenerateMeta(entry.id);
      expect(updated.metaStatus).toBe('failed');
      expect(updated.metaError).toBe('Ollama 404');
    });
  });

  describe('reindex()', () => {
    it('rebuilds index from txt files on disk', async () => {
      const entry = await service.store('Reindex me', {});

      const count = await service.reindex();
      expect(count).toBe(1);
      expect(service.index[0].id).toBe(entry.id);
    });

    it('preserves existing metadata for known ids', async () => {
      const entry = await service.store('Keep my meta', {});
      const originalTitle = entry.title;
      const originalSummary = entry.summary;

      await service.reindex();
      const found = service.index.find(e => e.id === entry.id);
      expect(found.title).toBe(originalTitle);
      expect(found.summary).toBe(originalSummary);
    });

    it('creates stub entry for orphaned txt files (no existing index entry)', async () => {
      const id = 'orphan-id-1234';
      const txtPath = path.join(testDataDir, `${id}.txt`);
      if (!fs.existsSync(testDataDir)) fs.mkdirSync(testDataDir, { recursive: true });
      fs.writeFileSync(txtPath, 'orphan transcription content', 'utf8');

      service.index = [];

      const count = await service.reindex();
      expect(count).toBe(1);
      expect(service.index[0].id).toBe(id);
      expect(service.index[0].title).toContain(id.slice(0, 8));
    });

    it('returns 0 when no txt files present', async () => {
      const count = await service.reindex();
      expect(count).toBe(0);
    });
  });
});

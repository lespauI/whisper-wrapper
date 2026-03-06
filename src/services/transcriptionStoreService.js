/**
 * TranscriptionStoreService
 * Saves, indexes, searches, and retrieves transcriptions locally.
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const ollamaService = require('./ollamaService');

const INDEX_FILE = 'index.json';

class TranscriptionStoreService {
  constructor() {
    const dataDir = config.get ? config.get('app.dataDirectory') : config.app && config.app.dataDirectory;
    this.transcriptionsDir = path.join(
      dataDir || path.join(process.cwd(), 'data'),
      'transcriptions'
    );
    this._ensureDir();
    this.index = this._loadIndex();
  }

  _ensureDir() {
    if (!fs.existsSync(this.transcriptionsDir)) {
      fs.mkdirSync(this.transcriptionsDir, { recursive: true });
    }
  }

  _indexPath() {
    return path.join(this.transcriptionsDir, INDEX_FILE);
  }

  _loadIndex() {
    const p = this._indexPath();
    if (!fs.existsSync(p)) return [];
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
      return [];
    }
  }

  _saveIndex() {
    fs.writeFileSync(this._indexPath(), JSON.stringify(this.index, null, 2), 'utf8');
  }

  /**
   * Store a new transcription.
   * @param {string} text - The full transcription text.
   * @param {Object} metadata - Optional metadata: sourceFile, language, duration, model, title.
   * @returns {Promise<Object>} The created index entry.
   */
  async store(text, metadata = {}) {
    this._ensureDir();
    const id = uuidv4();
    const txtPath = path.join(this.transcriptionsDir, `${id}.txt`);
    fs.writeFileSync(txtPath, text, 'utf8');

    let summary = '';
    let labels = [];
    try {
      const meta = await ollamaService.generateTranscriptionMeta(text);
      summary = meta.summary || '';
      labels = meta.labels || [];
    } catch (err) {
      console.error('generateTranscriptionMeta threw unexpectedly:', err.message);
    }

    const title =
      metadata.title ||
      (metadata.sourceFile ? path.basename(metadata.sourceFile) : `Transcription ${new Date().toLocaleDateString()}`);

    const entry = {
      id,
      date: new Date().toISOString(),
      title,
      summary,
      labels,
      sourceFile: metadata.sourceFile || '',
      language: metadata.language || '',
      duration: metadata.duration || null,
      model: metadata.model || '',
      wordCount: text.trim().split(/\s+/).filter(Boolean).length,
      filePath: path.join('data', 'transcriptions', `${id}.txt`)
    };

    this.index.push(entry);
    this._saveIndex();
    return entry;
  }

  /**
   * List transcriptions, optionally filtered.
   * @param {Object} filters - { query?, dateFrom?, dateTo?, labels? }
   * @returns {Object[]} Matching entries sorted by date descending.
   */
  list(filters = {}) {
    const { query, dateFrom, dateTo, labels } = filters;
    let results = [...this.index];

    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      results = results.filter(e => new Date(e.date).getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime();
      results = results.filter(e => new Date(e.date).getTime() <= to);
    }
    if (labels && labels.length > 0) {
      results = results.filter(e =>
        labels.every(l => e.labels.map(x => x.toLowerCase()).includes(l.toLowerCase()))
      );
    }
    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      results = results.filter(e => {
        const haystack = [
          e.title,
          e.summary,
          e.sourceFile,
          ...(e.labels || [])
        ].join(' ').toLowerCase();
        return haystack.includes(q);
      });
    }

    return results.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  /**
   * Get a single transcription by id.
   * @param {string} id
   * @returns {Promise<{entry: Object, text: string}|null>}
   */
  async get(id) {
    const entry = this.index.find(e => e.id === id);
    if (!entry) return null;
    const txtPath = path.join(this.transcriptionsDir, `${id}.txt`);
    const text = fs.existsSync(txtPath) ? fs.readFileSync(txtPath, 'utf8') : '';
    return { entry, text };
  }

  /**
   * Update a transcription's mutable fields (title, labels).
   * @param {string} id
   * @param {Object} changes - { title?, labels? }
   * @returns {Promise<Object|null>} Updated entry or null if not found.
   */
  async update(id, changes = {}) {
    const entry = this.index.find(e => e.id === id);
    if (!entry) return null;
    if (changes.title !== undefined) entry.title = String(changes.title).trim() || entry.title;
    if (changes.labels !== undefined) entry.labels = Array.isArray(changes.labels) ? changes.labels : entry.labels;
    this._saveIndex();
    return entry;
  }

  /**
   * Delete a transcription by id.
   * @param {string} id
   * @returns {Promise<boolean>} True if found and deleted.
   */
  async delete(id) {
    const idx = this.index.findIndex(e => e.id === id);
    if (idx === -1) return false;
    const txtPath = path.join(this.transcriptionsDir, `${id}.txt`);
    if (fs.existsSync(txtPath)) fs.unlinkSync(txtPath);
    this.index.splice(idx, 1);
    this._saveIndex();
    return true;
  }

  /**
   * Rebuild the index by scanning *.txt files on disk.
   * Preserves existing metadata for known ids; adds bare entries for unknown files.
   * @returns {Promise<number>} Count of entries in the rebuilt index.
   */
  async reindex() {
    this._ensureDir();
    const files = fs.readdirSync(this.transcriptionsDir).filter(f => f.endsWith('.txt'));
    const existingById = {};
    for (const e of this.index) existingById[e.id] = e;

    const rebuilt = [];
    for (const file of files) {
      const id = file.replace(/\.txt$/, '');
      if (existingById[id]) {
        rebuilt.push(existingById[id]);
      } else {
        const txtPath = path.join(this.transcriptionsDir, file);
        const text = fs.readFileSync(txtPath, 'utf8');
        rebuilt.push({
          id,
          date: fs.statSync(txtPath).birthtime.toISOString(),
          title: `Transcription ${id.slice(0, 8)}`,
          summary: '',
          labels: [],
          sourceFile: '',
          language: '',
          duration: null,
          model: '',
          wordCount: text.trim().split(/\s+/).filter(Boolean).length,
          filePath: path.join('data', 'transcriptions', file)
        });
      }
    }

    this.index = rebuilt.sort((a, b) => new Date(b.date) - new Date(a.date));
    this._saveIndex();
    return this.index.length;
  }
}

module.exports = TranscriptionStoreService;

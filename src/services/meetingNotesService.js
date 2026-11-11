/**
 * MeetingNotesService
 * Generates AI meeting notes from transcripts using Ollama, Claude CLI, or Codex CLI.
 * Stores notes as individual JSON files in data/meeting-notes/{transcriptId}.json.
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const axios = require('axios');
const config = require('../config');

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const MAX_NOTES_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TEMPLATES_FILE_BYTES = 2 * 1024 * 1024;
const MAX_TEMPLATES = 100;

class MeetingNotesService {
    constructor() {
        const dataDir = config.get ? config.get('app.dataDirectory') : (config.app && config.app.dataDirectory);
        const resolvedDataDirectory = path.resolve(dataDir || path.join(process.cwd(), 'data'));
        this.dataDirectory = fs.existsSync(resolvedDataDirectory) ? fs.realpathSync(resolvedDataDirectory) : resolvedDataDirectory;
        this.notesDir = path.join(this.dataDirectory, 'meeting-notes');
        const workingDirectory = fs.realpathSync(process.cwd());
        this.templatesFile = path.join(workingDirectory, 'data', 'meeting-notes-templates.json');
        this._ensureDir();
    }

    _ensureDir() {
        if (!this._lstatOrNull(this.notesDir)) {
            fs.mkdirSync(this.notesDir, { recursive: true, mode: 0o700 });
        }
        const stats = fs.lstatSync(this.notesDir);
        if (stats.isSymbolicLink() || !stats.isDirectory() || this._isUnowned(stats)) {
            throw new Error('Meeting notes directory is not trusted');
        }
        if (fs.realpathSync(this.notesDir) !== this.notesDir) {
            throw new Error('Meeting notes directory resolves outside its allowed location');
        }
        fs.chmodSync(this.notesDir, 0o700);
    }

    _notePath(transcriptionId) {
        if (!this._isSafeId(transcriptionId)) throw new Error('Invalid transcription id');
        const filePath = path.join(this.notesDir, `${transcriptionId}.json`);
        if (path.dirname(filePath) !== this.notesDir) throw new Error('Invalid meeting notes path');
        return filePath;
    }

    _isSafeId(id) {
        return typeof id === 'string' && SAFE_ID.test(id);
    }

    _isUnowned(stats) {
        return typeof process.getuid === 'function' && stats.uid !== process.getuid();
    }

    _lstatOrNull(filePath) {
        try {
            return fs.lstatSync(filePath);
        } catch (error) {
            if (error.code === 'ENOENT') return null;
            throw error;
        }
    }

    _assertRegularFile(filePath, maxBytes) {
        const stats = this._lstatOrNull(filePath);
        if (!stats) return null;
        if (stats.isSymbolicLink() || !stats.isFile() || this._isUnowned(stats)) {
            throw new Error('Meeting notes file is not an owned regular file');
        }
        if (stats.size > maxBytes) throw new Error('Meeting notes file is too large');
        if (fs.realpathSync(filePath) !== filePath) throw new Error('Meeting notes file resolves outside its allowed location');
        return stats;
    }

    _assertDirectory(directory) {
        const stats = this._lstatOrNull(directory);
        if (!stats || stats.isSymbolicLink() || !stats.isDirectory() || this._isUnowned(stats)) {
            throw new Error('Meeting notes storage directory is not trusted');
        }
        if (fs.realpathSync(directory) !== path.resolve(directory)) {
            throw new Error('Meeting notes storage directory resolves outside its allowed location');
        }
    }

    _readFileNoFollow(filePath, maxBytes) {
        const descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
        try {
            const stats = fs.fstatSync(descriptor);
            if (!stats.isFile() || this._isUnowned(stats)) throw new Error('Meeting notes file is not an owned regular file');
            if (stats.size > maxBytes) throw new Error('Meeting notes file is too large');
            return fs.readFileSync(descriptor, 'utf8');
        } finally {
            fs.closeSync(descriptor);
        }
    }

    _writeFileNoFollow(filePath, content, maxBytes) {
        this._assertRegularFile(filePath, maxBytes);
        const noFollow = fs.constants.O_NOFOLLOW || 0;
        const descriptor = fs.openSync(
            filePath,
            fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | noFollow,
            0o600
        );
        try {
            const stats = fs.fstatSync(descriptor);
            if (!stats.isFile() || this._isUnowned(stats)) throw new Error('Meeting notes file is not an owned regular file');
            fs.writeFileSync(descriptor, content);
        } finally {
            fs.closeSync(descriptor);
        }
    }

    _validateTemplate(template, partial = false) {
        if (!template || typeof template !== 'object' || Array.isArray(template)) throw new Error('Invalid meeting notes template');
        const prototype = Object.getPrototypeOf(template);
        if (prototype !== Object.prototype && prototype !== null) throw new Error('Invalid meeting notes template');
        const stringLimits = { name: 200, description: 2000, prompt: 50000 };
        for (const [field, limit] of Object.entries(stringLimits)) {
            if (template[field] !== undefined && (typeof template[field] !== 'string' || Buffer.byteLength(template[field], 'utf8') > limit)) {
                throw new Error(`Invalid meeting notes template ${field}`);
            }
            if (!partial && field === 'name' && !template[field]) throw new Error('Invalid meeting notes template name');
        }
        if (template.isDefault !== undefined && typeof template.isDefault !== 'boolean') {
            throw new Error('Invalid meeting notes template default flag');
        }
        if (!partial && !this._isSafeId(template.id)) throw new Error('Invalid meeting notes template id');
        return template;
    }

    // ── Templates ──────────────────────────────────────────────

    loadTemplates() {
        const templatesDirectory = path.dirname(this.templatesFile);
        if (!this._lstatOrNull(templatesDirectory)) return [];
        this._assertDirectory(templatesDirectory);
        const stats = this._assertRegularFile(this.templatesFile, MAX_TEMPLATES_FILE_BYTES);
        if (!stats) return [];
        let templates;
        try {
            templates = JSON.parse(this._readFileNoFollow(this.templatesFile, MAX_TEMPLATES_FILE_BYTES));
        } catch (error) {
            console.error('Error loading meeting notes templates:', error.message);
            return [];
        }
        if (!Array.isArray(templates) || templates.length > MAX_TEMPLATES) throw new Error('Invalid meeting notes templates file');
        templates.forEach(template => this._validateTemplate(template));
        return templates;
    }

    saveTemplates(templates) {
        if (!Array.isArray(templates) || templates.length > MAX_TEMPLATES) throw new Error('Invalid meeting notes templates');
        templates.forEach(template => this._validateTemplate(template));
        const content = JSON.stringify(templates, null, 2);
        if (Buffer.byteLength(content, 'utf8') > MAX_TEMPLATES_FILE_BYTES) throw new Error('Meeting notes templates are too large');
        const dir = path.dirname(this.templatesFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
        this._assertDirectory(dir);
        this._writeFileNoFollow(this.templatesFile, content, MAX_TEMPLATES_FILE_BYTES);
    }

    getTemplate(templateId) {
        if (!this._isSafeId(templateId)) return null;
        const templates = this.loadTemplates();
        return templates.find(t => t.id === templateId) || null;
    }

    getDefaultTemplate() {
        const templates = this.loadTemplates();
        return templates.find(t => t.isDefault) || templates[0] || null;
    }

    createTemplate(data) {
        this._validateTemplate(data, true);
        const templates = this.loadTemplates();
        const template = {
            id: `meeting-notes-${Date.now()}`,
            name: data.name || 'Untitled Template',
            description: data.description || '',
            prompt: data.prompt || '',
            isDefault: data.isDefault || false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        if (template.isDefault) {
            templates.forEach(t => { t.isDefault = false; });
        }
        templates.push(template);
        this.saveTemplates(templates);
        return template;
    }

    updateTemplate(id, changes) {
        if (!this._isSafeId(id)) throw new Error('Invalid meeting notes template id');
        this._validateTemplate(changes, true);
        const allowed = new Set(['name', 'description', 'prompt', 'isDefault']);
        if (Object.keys(changes).some(key => !allowed.has(key))) throw new Error('Invalid meeting notes template fields');
        const templates = this.loadTemplates();
        const idx = templates.findIndex(t => t.id === id);
        if (idx === -1) return null;
        if (changes.isDefault) {
            templates.forEach(t => { t.isDefault = false; });
        }
        Object.assign(templates[idx], changes, { updatedAt: new Date().toISOString() });
        this.saveTemplates(templates);
        return templates[idx];
    }

    deleteTemplate(id) {
        if (!this._isSafeId(id)) throw new Error('Invalid meeting notes template id');
        const templates = this.loadTemplates();
        const idx = templates.findIndex(t => t.id === id);
        if (idx === -1) return false;
        templates.splice(idx, 1);
        this.saveTemplates(templates);
        return true;
    }

    // ── Notes CRUD ─────────────────────────────────────────────

    /**
   * Get notes for a transcription.
   * @param {string} transcriptionId
   * @returns {Object|null} The stored notes object or null.
   */
    getNotes(transcriptionId) {
        const p = this._notePath(transcriptionId);
        if (!this._assertRegularFile(p, MAX_NOTES_FILE_BYTES)) return null;
        try {
            const notes = JSON.parse(this._readFileNoFollow(p, MAX_NOTES_FILE_BYTES));
            if (!notes || typeof notes !== 'object' || Array.isArray(notes) ||
          (notes.transcriptionId !== undefined && notes.transcriptionId !== transcriptionId)) return null;
            return notes;
        } catch (error) {
            if (error instanceof SyntaxError) return null;
            throw error;
        }
    }

    /**
   * Check if notes exist for a transcription.
   */
    hasNotes(transcriptionId) {
        return Boolean(this._assertRegularFile(this._notePath(transcriptionId), MAX_NOTES_FILE_BYTES));
    }

    /**
   * Save notes for a transcription.
   */
    saveNotes(transcriptionId, notesData) {
        if (!notesData || typeof notesData !== 'object' || Array.isArray(notesData)) throw new Error('Invalid meeting notes data');
        if (notesData.transcriptionId !== undefined && notesData.transcriptionId !== transcriptionId) {
            throw new Error('Meeting notes do not belong to this transcription');
        }
        this._ensureDir();
        const p = this._notePath(transcriptionId);
        const content = JSON.stringify(notesData, null, 2);
        if (Buffer.byteLength(content, 'utf8') > MAX_NOTES_FILE_BYTES) throw new Error('Meeting notes are too large');
        this._writeFileNoFollow(p, content, MAX_NOTES_FILE_BYTES);
        return notesData;
    }

    /**
   * Delete notes for a transcription.
   */
    deleteNotes(transcriptionId) {
        const p = this._notePath(transcriptionId);
        if (this._assertRegularFile(p, MAX_NOTES_FILE_BYTES)) {
            fs.unlinkSync(p);
            return true;
        }
        return false;
    }

    // ── Generation ─────────────────────────────────────────────

    /**
   * Generate meeting notes from a transcript.
   * @param {string} transcriptionText - The raw transcript text
   * @param {string} transcriptionId - The transcript ID (for storage)
   * @param {Object} options
   * @param {string} options.provider - 'ollama' | 'claude' | 'codex'
   * @param {string} [options.model] - Model name (provider-specific)
   * @param {string} [options.templateId] - Template to use
   * @param {Array<{id: string, title: string, text: string}>} [options.contextTranscripts] - Other transcripts for context
   * @returns {Promise<Object>} Generated notes data
   */
    async generate(transcriptionText, transcriptionId, options = {}) {
        if (typeof transcriptionText !== 'string' || Buffer.byteLength(transcriptionText, 'utf8') > 10 * 1024 * 1024) {
            throw new Error('Invalid or oversized transcription text');
        }
        if (!this._isSafeId(transcriptionId)) throw new Error('Invalid transcription id');
        if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('Invalid meeting notes options');
        const provider = options.provider || this._getDefaultProvider();
        const templateId = options.templateId || null;
        const model = options.model || this._getDefaultModel(provider);
        const contextTranscripts = options.contextTranscripts || [];
        const prePrompt = options.prePrompt || '';
        if (!['ollama', 'claude', 'codex'].includes(provider)) throw new Error(`Unknown provider: ${provider}`);
        if (typeof model !== 'string' || model.length > 256 || (templateId && !this._isSafeId(templateId)) ||
        typeof prePrompt !== 'string' || Buffer.byteLength(prePrompt, 'utf8') > 20000 ||
        !Array.isArray(contextTranscripts) || contextTranscripts.length > 20) {
            throw new Error('Invalid meeting notes options');
        }
        let contextBytes = 0;
        for (const transcript of contextTranscripts) {
            if (!transcript || typeof transcript !== 'object' || !this._isSafeId(transcript.id) ||
          typeof transcript.text !== 'string' || (transcript.title !== undefined && typeof transcript.title !== 'string')) {
                throw new Error('Invalid context transcript');
            }
            contextBytes += Buffer.byteLength(transcript.text, 'utf8');
            if (contextBytes > 25 * 1024 * 1024) throw new Error('Context transcripts are too large');
        }

        // Resolve prompt from template
        const template = templateId ? this.getTemplate(templateId) : this.getDefaultTemplate();
        if (!template) {
            throw new Error('No meeting notes template found. Please create one in settings.');
        }

        // Build pre-prompt block
        let prePromptBlock = '';
        if (prePrompt.trim()) {
            prePromptBlock = `Additional context from the user: ${prePrompt.trim()}\n\n`;
        }

        // Build context block from other transcripts
        let contextBlock = '';
        if (contextTranscripts.length > 0) {
            const contextParts = contextTranscripts.map(ct =>
                `--- Context transcript: ${ct.title || ct.id} ---\n${ct.text}`
            );
            contextBlock = 'The following are previous meeting transcripts provided for context. Use them to understand recurring topics, people, projects, and terminology. Do NOT generate notes for these — only use them as background context.\n\n' +
        contextParts.join('\n\n') +
        '\n\n--- END OF CONTEXT ---\n\nNow generate notes for the following transcript:\n\n';
        }

        let prompt = template.prompt;
        const transcriptWithContext = prePromptBlock + contextBlock + transcriptionText;
        if (prompt.includes('{{text}}')) {
            prompt = prompt.replace(/\{\{text\}\}/g, transcriptWithContext);
        } else {
            prompt = `${prompt}\n\n${transcriptWithContext}`;
        }

        let notesText;
        const startTime = Date.now();

        switch (provider) {
        case 'ollama':
            notesText = await this._generateWithOllama(prompt, model);
            break;
        case 'claude':
            notesText = await this._generateWithClaude(prompt, model);
            break;
        case 'codex':
            notesText = await this._generateWithCodex(prompt, model);
            break;
        default:
            throw new Error(`Unknown provider: ${provider}`);
        }

        const notesData = {
            transcriptionId,
            generatedAt: new Date().toISOString(),
            provider,
            model,
            templateId: template.id,
            templateName: template.name,
            notes: notesText,
            generationTimeMs: Date.now() - startTime
        };

        this.saveNotes(transcriptionId, notesData);
        return notesData;
    }

    _getDefaultProvider() {
        return config.get('meetingNotes.defaultProvider', 'claude');
    }

    _getDefaultModel(provider) {
        switch (provider) {
        case 'ollama':
            return config.get('ollama.defaultModel', 'gemma3:12b');
        case 'claude':
            return config.get('meetingNotes.claudeModel', 'claude-sonnet-4-20250514');
        case 'codex':
            return config.get('meetingNotes.codexModel', '');
        default:
            return '';
        }
    }

    // ── Provider implementations ───────────────────────────────

    async _generateWithOllama(prompt, model) {
        const endpoint = config.get('ollama.endpoint', 'http://localhost:11434');
        const timeout = (config.get('ollama.timeoutSeconds', 300)) * 1000;

        const response = await axios({
            method: 'POST',
            url: `${endpoint}/api/generate`,
            timeout,
            data: {
                model,
                prompt,
                stream: false,
                options: { temperature: 0.5, num_predict: 4096 }
            }
        });

        const raw = (response.data && response.data.response) ? response.data.response.trim() : '';
        if (!raw) throw new Error('Empty response from Ollama');

        // Unload model after generation
        await axios({
            method: 'POST',
            url: `${endpoint}/api/generate`,
            timeout: 10000,
            data: { model, keep_alive: 0 }
        }).catch(() => {});

        return raw;
    }

    async _generateWithClaude(prompt, model) {
        const modelArg = model || 'claude-sonnet-4-20250514';
        return this._runCLI('claude', ['-p', prompt, '--model', modelArg]);
    }

    async _generateWithCodex(prompt, model) {
        const args = ['-q', prompt];
        if (model) args.push('--model', model);
        return this._runCLI('codex', args);
    }

    /**
   * Execute a CLI tool and return its stdout.
   */
    _runCLI(command, args) {
        return new Promise((resolve, reject) => {
            const timeout = (config.get('meetingNotes.cliTimeoutSeconds', 600)) * 1000;

            execFile(command, args, {
                timeout,
                maxBuffer: 10 * 1024 * 1024, // 10MB
                env: { ...process.env }
            }, (error, stdout, stderr) => {
                if (error) {
                    if (error.killed) {
                        reject(new Error(`${command} timed out after ${timeout / 1000}s`));
                    } else {
                        reject(new Error(`${command} failed: ${error.message}${stderr ? '\n' + stderr : ''}`));
                    }
                    return;
                }
                const output = stdout.trim();
                if (!output) {
                    reject(new Error(`${command} returned empty output`));
                    return;
                }
                resolve(output);
            });
        });
    }
}

module.exports = MeetingNotesService;

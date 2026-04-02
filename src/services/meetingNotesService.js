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

class MeetingNotesService {
  constructor() {
    const dataDir = config.get ? config.get('app.dataDirectory') : (config.app && config.app.dataDirectory);
    this.notesDir = path.join(dataDir || path.join(process.cwd(), 'data'), 'meeting-notes');
    this.templatesFile = path.join(process.cwd(), 'data', 'meeting-notes-templates.json');
    this._ensureDir();
  }

  _ensureDir() {
    if (!fs.existsSync(this.notesDir)) {
      fs.mkdirSync(this.notesDir, { recursive: true });
    }
  }

  _notePath(transcriptionId) {
    return path.join(this.notesDir, `${transcriptionId}.json`);
  }

  // ── Templates ──────────────────────────────────────────────

  loadTemplates() {
    try {
      if (fs.existsSync(this.templatesFile)) {
        return JSON.parse(fs.readFileSync(this.templatesFile, 'utf8'));
      }
    } catch (err) {
      console.error('Error loading meeting notes templates:', err.message);
    }
    return [];
  }

  saveTemplates(templates) {
    const dir = path.dirname(this.templatesFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.templatesFile, JSON.stringify(templates, null, 2), 'utf8');
  }

  getTemplate(templateId) {
    const templates = this.loadTemplates();
    return templates.find(t => t.id === templateId) || null;
  }

  getDefaultTemplate() {
    const templates = this.loadTemplates();
    return templates.find(t => t.isDefault) || templates[0] || null;
  }

  createTemplate(data) {
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
    if (!fs.existsSync(p)) return null;
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
      return null;
    }
  }

  /**
   * Check if notes exist for a transcription.
   */
  hasNotes(transcriptionId) {
    return fs.existsSync(this._notePath(transcriptionId));
  }

  /**
   * Save notes for a transcription.
   */
  saveNotes(transcriptionId, notesData) {
    this._ensureDir();
    const p = this._notePath(transcriptionId);
    fs.writeFileSync(p, JSON.stringify(notesData, null, 2), 'utf8');
    return notesData;
  }

  /**
   * Delete notes for a transcription.
   */
  deleteNotes(transcriptionId) {
    const p = this._notePath(transcriptionId);
    if (fs.existsSync(p)) {
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
    const provider = options.provider || this._getDefaultProvider();
    const templateId = options.templateId || null;
    const model = options.model || this._getDefaultModel(provider);
    const contextTranscripts = options.contextTranscripts || [];
    const prePrompt = options.prePrompt || '';

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

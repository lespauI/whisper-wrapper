/**
 * Unit tests for MeetingNotesService
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const mockTestDataDir = path.join(os.tmpdir(), 'mns-test-data');

jest.mock('../../../src/config', () => {
  const tmpDir = require('os').tmpdir();
  const mockDataDir = require('path').join(tmpDir, 'mns-test-data');
  return {
    get: jest.fn((key, defaultValue) => {
      if (key === 'app.dataDirectory') return mockDataDir;
      if (key === 'meetingNotes.defaultProvider') return 'claude';
      if (key === 'meetingNotes.claudeModel') return 'claude-sonnet-4-20250514';
      if (key === 'meetingNotes.codexModel') return '';
      if (key === 'meetingNotes.cliTimeoutSeconds') return 600;
      if (key === 'ollama.endpoint') return 'http://localhost:11434';
      if (key === 'ollama.defaultModel') return 'gemma3:12b';
      if (key === 'ollama.timeoutSeconds') return 300;
      return defaultValue;
    })
  };
});

jest.mock('axios');
jest.mock('child_process', () => ({
  execFile: jest.fn()
}));

const axios = require('axios');
const { execFile } = require('child_process');
const MeetingNotesService = require('../../../src/services/meetingNotesService');

const originalProcessCwd = process.cwd;

describe('MeetingNotesService', () => {
  let service;
  const testNotesDir = path.join(mockTestDataDir, 'meeting-notes');
  const testTemplatesFile = path.join(mockTestDataDir, 'data', 'meeting-notes-templates.json');

  function writeTestTemplates() {
    const dir = path.dirname(testTemplatesFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(testTemplatesFile, JSON.stringify([
      {
        id: 'test-template-1',
        name: 'Test Template',
        description: 'A test template',
        prompt: 'Generate notes from: {{text}}',
        isDefault: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'test-template-2',
        name: 'Another Template',
        description: 'Another template',
        prompt: 'Quick summary: {{text}}',
        isDefault: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    ]), 'utf8');
  }

  beforeEach(() => {
    jest.clearAllMocks();

    // Clean test dirs
    if (fs.existsSync(mockTestDataDir)) {
      fs.rmSync(mockTestDataDir, { recursive: true });
    }
    fs.mkdirSync(mockTestDataDir, { recursive: true });

    writeTestTemplates();

    // Override process.cwd so TEMPLATES_FILE resolves to test dir
    process.cwd = jest.fn().mockReturnValue(mockTestDataDir);

    service = new MeetingNotesService();
  });

  afterEach(() => {
    process.cwd = originalProcessCwd;
    if (fs.existsSync(mockTestDataDir)) {
      fs.rmSync(mockTestDataDir, { recursive: true });
    }
  });

  // ── Templates ────────────────────────────────────────────

  describe('loadTemplates()', () => {
    it('loads templates from JSON file', () => {
      const templates = service.loadTemplates();
      expect(templates).toHaveLength(2);
      expect(templates[0].id).toBe('test-template-1');
      expect(templates[1].id).toBe('test-template-2');
    });

    it('returns empty array when file does not exist', () => {
      fs.unlinkSync(testTemplatesFile);
      const templates = service.loadTemplates();
      expect(templates).toEqual([]);
    });
  });

  describe('getTemplate()', () => {
    it('returns template by id', () => {
      const template = service.getTemplate('test-template-1');
      expect(template).not.toBeNull();
      expect(template.name).toBe('Test Template');
    });

    it('returns null for unknown id', () => {
      expect(service.getTemplate('nonexistent')).toBeNull();
    });
  });

  describe('getDefaultTemplate()', () => {
    it('returns the default template', () => {
      const template = service.getDefaultTemplate();
      expect(template).not.toBeNull();
      expect(template.id).toBe('test-template-1');
      expect(template.isDefault).toBe(true);
    });
  });

  describe('createTemplate()', () => {
    it('creates a new template', () => {
      const template = service.createTemplate({
        name: 'New Template',
        description: 'A new one',
        prompt: 'Do something with {{text}}'
      });

      expect(template.id).toMatch(/^meeting-notes-/);
      expect(template.name).toBe('New Template');
      expect(service.loadTemplates()).toHaveLength(3);
    });

    it('unsets other defaults when new template is default', () => {
      service.createTemplate({
        name: 'New Default',
        prompt: '{{text}}',
        isDefault: true
      });

      const all = service.loadTemplates();
      const defaults = all.filter(t => t.isDefault);
      expect(defaults).toHaveLength(1);
      expect(defaults[0].name).toBe('New Default');
    });
  });

  describe('updateTemplate()', () => {
    it('updates an existing template', () => {
      const updated = service.updateTemplate('test-template-1', { name: 'Updated Name' });
      expect(updated).not.toBeNull();
      expect(updated.name).toBe('Updated Name');
    });

    it('returns null for unknown id', () => {
      expect(service.updateTemplate('nonexistent', { name: 'X' })).toBeNull();
    });
  });

  describe('deleteTemplate()', () => {
    it('deletes a template', () => {
      expect(service.deleteTemplate('test-template-2')).toBe(true);
      expect(service.loadTemplates()).toHaveLength(1);
    });

    it('returns false for unknown id', () => {
      expect(service.deleteTemplate('nonexistent')).toBe(false);
    });
  });

  // ── Notes CRUD ───────────────────────────────────────────

  describe('getNotes()', () => {
    it('returns null when no notes exist', () => {
      expect(service.getNotes('some-id')).toBeNull();
    });

    it('returns notes data when file exists', () => {
      const notesData = {
        transcriptionId: 'abc-123',
        notes: 'Test notes content',
        provider: 'claude'
      };
      service.saveNotes('abc-123', notesData);

      const loaded = service.getNotes('abc-123');
      expect(loaded).not.toBeNull();
      expect(loaded.notes).toBe('Test notes content');
      expect(loaded.provider).toBe('claude');
    });
  });

  describe('hasNotes()', () => {
    it('returns false when no notes exist', () => {
      expect(service.hasNotes('some-id')).toBe(false);
    });

    it('returns true when notes exist', () => {
      service.saveNotes('existing-id', { notes: 'content' });
      expect(service.hasNotes('existing-id')).toBe(true);
    });
  });

  describe('saveNotes()', () => {
    it('saves notes as JSON file', () => {
      service.saveNotes('save-test', { notes: 'Saved notes' });

      const filePath = path.join(testNotesDir, 'save-test.json');
      expect(fs.existsSync(filePath)).toBe(true);

      const loaded = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(loaded.notes).toBe('Saved notes');
    });
  });

  describe('deleteNotes()', () => {
    it('deletes existing notes', () => {
      service.saveNotes('del-test', { notes: 'to delete' });
      expect(service.hasNotes('del-test')).toBe(true);

      expect(service.deleteNotes('del-test')).toBe(true);
      expect(service.hasNotes('del-test')).toBe(false);
    });

    it('returns false when notes do not exist', () => {
      expect(service.deleteNotes('nonexistent')).toBe(false);
    });
  });

  // ── Generation ───────────────────────────────────────────

  describe('generate()', () => {
    it('generates notes with Claude CLI and saves them', async () => {
      execFile.mockImplementation((cmd, args, opts, callback) => {
        callback(null, '# Meeting Notes\n\nThis is a test output.', '');
      });

      const result = await service.generate('Hello this is a test transcript', 'tx-001', {
        provider: 'claude',
        templateId: 'test-template-1'
      });

      expect(result.transcriptionId).toBe('tx-001');
      expect(result.notes).toContain('Meeting Notes');
      expect(result.provider).toBe('claude');
      expect(result.templateId).toBe('test-template-1');
      expect(result.generationTimeMs).toBeGreaterThanOrEqual(0);

      // Verify saved to disk
      const saved = service.getNotes('tx-001');
      expect(saved).not.toBeNull();
      expect(saved.notes).toBe(result.notes);
    });

    it('generates notes with Ollama', async () => {
      axios.mockResolvedValueOnce({
        data: { response: '## Summary\n\nOllama generated notes' }
      }).mockResolvedValueOnce({}); // unload request

      const result = await service.generate('Test transcript', 'tx-002', {
        provider: 'ollama',
        templateId: 'test-template-1'
      });

      expect(result.provider).toBe('ollama');
      expect(result.notes).toContain('Ollama generated notes');
      expect(axios).toHaveBeenCalledWith(expect.objectContaining({
        url: 'http://localhost:11434/api/generate'
      }));
    });

    it('generates notes with Codex CLI', async () => {
      execFile.mockImplementation((cmd, args, opts, callback) => {
        callback(null, 'Codex meeting notes output', '');
      });

      const result = await service.generate('Test transcript', 'tx-003', {
        provider: 'codex'
      });

      expect(result.provider).toBe('codex');
      expect(result.notes).toBe('Codex meeting notes output');
      expect(execFile).toHaveBeenCalledWith(
        'codex',
        expect.arrayContaining(['-q']),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('throws error for unknown provider', async () => {
      await expect(
        service.generate('Text', 'tx-004', { provider: 'unknown' })
      ).rejects.toThrow('Unknown provider: unknown');
    });

    it('throws error when no template is found', async () => {
      service.saveTemplates([]);

      await expect(
        service.generate('Text', 'tx-005', { provider: 'claude' })
      ).rejects.toThrow('No meeting notes template found');
    });

    it('handles CLI timeout error', async () => {
      const error = new Error('Command timed out');
      error.killed = true;
      execFile.mockImplementation((cmd, args, opts, callback) => {
        callback(error, '', '');
      });

      await expect(
        service.generate('Text', 'tx-006', { provider: 'claude' })
      ).rejects.toThrow('timed out');
    });

    it('handles CLI failure error', async () => {
      execFile.mockImplementation((cmd, args, opts, callback) => {
        callback(new Error('Command not found'), '', 'claude: command not found');
      });

      await expect(
        service.generate('Text', 'tx-007', { provider: 'claude' })
      ).rejects.toThrow('claude failed');
    });

    it('handles empty CLI output', async () => {
      execFile.mockImplementation((cmd, args, opts, callback) => {
        callback(null, '', '');
      });

      await expect(
        service.generate('Text', 'tx-008', { provider: 'claude' })
      ).rejects.toThrow('empty output');
    });

    it('handles Ollama empty response', async () => {
      axios.mockResolvedValueOnce({
        data: { response: '' }
      });

      await expect(
        service.generate('Text', 'tx-009', { provider: 'ollama' })
      ).rejects.toThrow('Empty response from Ollama');
    });

    it('uses default template when templateId not specified', async () => {
      execFile.mockImplementation((cmd, args, opts, callback) => {
        callback(null, 'Default template output', '');
      });

      const result = await service.generate('Text', 'tx-010', {
        provider: 'claude'
      });

      expect(result.templateName).toBe('Test Template');
    });

    it('replaces {{text}} placeholder in prompt', async () => {
      let capturedArgs;
      execFile.mockImplementation((cmd, args, opts, callback) => {
        capturedArgs = args;
        callback(null, 'Output', '');
      });

      await service.generate('MY TRANSCRIPT TEXT', 'tx-011', {
        provider: 'claude',
        templateId: 'test-template-1'
      });

      // -p is at index 0, prompt at index 1
      const promptArg = capturedArgs[1];
      expect(promptArg).toContain('MY TRANSCRIPT TEXT');
      expect(promptArg).not.toContain('{{text}}');
    });

    it('includes context transcripts in prompt when provided', async () => {
      let capturedArgs;
      execFile.mockImplementation((cmd, args, opts, callback) => {
        capturedArgs = args;
        callback(null, 'Output with context', '');
      });

      await service.generate('MAIN TRANSCRIPT', 'tx-012', {
        provider: 'claude',
        templateId: 'test-template-1',
        contextTranscripts: [
          { id: 'ctx-1', title: 'Previous Standup', text: 'Yesterday we discussed X' },
          { id: 'ctx-2', title: 'Planning Meeting', text: 'Sprint goals are Y' }
        ]
      });

      const promptArg = capturedArgs[1];
      expect(promptArg).toContain('MAIN TRANSCRIPT');
      expect(promptArg).toContain('Previous Standup');
      expect(promptArg).toContain('Yesterday we discussed X');
      expect(promptArg).toContain('Planning Meeting');
      expect(promptArg).toContain('Sprint goals are Y');
      expect(promptArg).toContain('background context');
      expect(promptArg).toContain('END OF CONTEXT');
    });

    it('does not include context block when contextTranscripts is empty', async () => {
      let capturedArgs;
      execFile.mockImplementation((cmd, args, opts, callback) => {
        capturedArgs = args;
        callback(null, 'Output no context', '');
      });

      await service.generate('MAIN ONLY', 'tx-013', {
        provider: 'claude',
        templateId: 'test-template-1',
        contextTranscripts: []
      });

      const promptArg = capturedArgs[1];
      expect(promptArg).toContain('MAIN ONLY');
      expect(promptArg).not.toContain('background context');
      expect(promptArg).not.toContain('END OF CONTEXT');
    });

    it('includes pre-prompt in the generated prompt', async () => {
      let capturedArgs;
      execFile.mockImplementation((cmd, args, opts, callback) => {
        capturedArgs = args;
        callback(null, 'Output with preprompt', '');
      });

      await service.generate('TRANSCRIPT TEXT', 'tx-014', {
        provider: 'claude',
        templateId: 'test-template-1',
        prePrompt: 'This is a 1-on-1 between Alex and Maria about Q2 planning'
      });

      const promptArg = capturedArgs[1];
      expect(promptArg).toContain('1-on-1 between Alex and Maria');
      expect(promptArg).toContain('Q2 planning');
      expect(promptArg).toContain('TRANSCRIPT TEXT');
    });

    it('does not include pre-prompt block when prePrompt is empty', async () => {
      let capturedArgs;
      execFile.mockImplementation((cmd, args, opts, callback) => {
        capturedArgs = args;
        callback(null, 'Output', '');
      });

      await service.generate('TEXT', 'tx-015', {
        provider: 'claude',
        templateId: 'test-template-1',
        prePrompt: '   '
      });

      const promptArg = capturedArgs[1];
      expect(promptArg).not.toContain('Additional context from the user');
    });
  });
});

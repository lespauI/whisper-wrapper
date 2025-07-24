/**
 * Unit tests for Template Manager Service
 */

const fs = require('fs');
const path = require('path');

// Mock the fs module
jest.mock('fs');

// Mock the config
jest.mock('../../../src/config', () => ({
  app: {
    dataDirectory: '/mock/data/directory'
  },
  getAIRefinementSettings: jest.fn().mockReturnValue({
    defaultTemplateId: 'format-email'
  }),
  saveAIRefinementSettings: jest.fn()
}));

// Import after mocking dependencies
const templateManager = require('../../../src/services/templateManager');

describe('Template Manager Service', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up basic mocks for fs
    fs.existsSync.mockReturnValue(false);
    fs.mkdirSync.mockImplementation(() => true);
    fs.writeFileSync.mockImplementation(() => true);
    fs.readFileSync.mockImplementation(() => JSON.stringify([]));
  });

  describe('initialization', () => {
    it('should create default templates when no templates file exists', () => {
      // Setup
      fs.existsSync.mockReturnValue(false);
      
      // Reset the templateManager to trigger loadTemplates
      templateManager.templates = [];
      templateManager.loadTemplates();
      
      // Assertions
      expect(templateManager.templates.length).toBeGreaterThan(0);
      expect(templateManager.templates.find(t => t.id === 'format-email')).toBeDefined();
      expect(templateManager.templates.find(t => t.id === 'bullet-points')).toBeDefined();
      expect(templateManager.templates.find(t => t.id === 'grammar-correction')).toBeDefined();
      expect(templateManager.templates.find(t => t.id === 'meeting-notes')).toBeDefined();
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should load templates from file when templates file exists', () => {
      // Setup
      const mockTemplates = [
        { id: 'test-template-1', name: 'Test 1', prompt: 'Test prompt 1' },
        { id: 'test-template-2', name: 'Test 2', prompt: 'Test prompt 2' }
      ];
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockTemplates));
      
      // Reset the templateManager to trigger loadTemplates
      templateManager.templates = [];
      templateManager.loadTemplates();
      
      // Assertions
      expect(templateManager.templates.length).toBe(2);
      expect(templateManager.templates[0].id).toBe('test-template-1');
      expect(templateManager.templates[1].id).toBe('test-template-2');
      expect(fs.readFileSync).toHaveBeenCalled();
    });
  });

  describe('template operations', () => {
    beforeEach(() => {
      // Set up test templates
      templateManager.templates = [
        {
          id: 'template-1',
          name: 'Template 1',
          description: 'Test template 1',
          prompt: 'Test prompt 1',
          isDefault: true,
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z'
        },
        {
          id: 'template-2',
          name: 'Template 2',
          description: 'Test template 2',
          prompt: 'Test prompt 2',
          isDefault: false,
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z'
        }
      ];
    });

    it('should get all templates', () => {
      const templates = templateManager.getAllTemplates();
      expect(templates.length).toBe(2);
      expect(templates[0].id).toBe('template-1');
      expect(templates[1].id).toBe('template-2');
    });

    it('should get template by ID', () => {
      const template = templateManager.getTemplateById('template-2');
      expect(template).toBeDefined();
      expect(template.name).toBe('Template 2');
    });

    it('should return null when getting non-existent template', () => {
      const template = templateManager.getTemplateById('non-existent');
      expect(template).toBeNull();
    });

    it('should get default template', () => {
      const template = templateManager.getDefaultTemplate();
      expect(template).toBeDefined();
      expect(template.id).toBe('template-1');
      expect(template.isDefault).toBe(true);
    });

    it('should create a new template', () => {
      const newTemplate = {
        name: 'New Template',
        description: 'New description',
        prompt: 'New prompt',
        isDefault: false
      };
      
      const created = templateManager.createTemplate(newTemplate);
      
      expect(created).toBeDefined();
      expect(created.name).toBe('New Template');
      expect(templateManager.templates.length).toBe(3);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should update an existing template', () => {
      const updated = templateManager.updateTemplate('template-2', {
        name: 'Updated Template',
        description: 'Updated description'
      });
      
      expect(updated).toBeDefined();
      expect(updated.name).toBe('Updated Template');
      expect(updated.description).toBe('Updated description');
      expect(updated.prompt).toBe('Test prompt 2'); // Unchanged
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should return null when updating non-existent template', () => {
      const updated = templateManager.updateTemplate('non-existent', {
        name: 'Updated Template'
      });
      
      expect(updated).toBeNull();
    });

    it('should delete a template', () => {
      const result = templateManager.deleteTemplate('template-2');
      
      expect(result).toBe(true);
      expect(templateManager.templates.length).toBe(1);
      expect(templateManager.templates[0].id).toBe('template-1');
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should return false when deleting non-existent template', () => {
      const result = templateManager.deleteTemplate('non-existent');
      
      expect(result).toBe(false);
      expect(templateManager.templates.length).toBe(2);
    });

    it('should set a default template', () => {
      const result = templateManager.setDefaultTemplate('template-2');
      
      expect(result).toBe(true);
      expect(templateManager.templates[0].isDefault).toBe(false);
      expect(templateManager.templates[1].isDefault).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should return false when setting non-existent template as default', () => {
      const result = templateManager.setDefaultTemplate('non-existent');
      
      expect(result).toBe(false);
      expect(templateManager.templates[0].isDefault).toBe(true); // Unchanged
    });
  });

  describe('error handling', () => {
    it('should handle file system errors when loading templates', () => {
      // Setup
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Mock file read error');
      });
      
      // Reset the templateManager to trigger loadTemplates
      templateManager.templates = [];
      const templates = templateManager.loadTemplates();
      
      // Should create default templates on error
      expect(templates.length).toBeGreaterThan(0);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should handle file system errors when saving templates', () => {
      // Setup
      fs.writeFileSync.mockImplementation(() => {
        throw new Error('Mock file write error');
      });
      
      // Try to save
      const result = templateManager.saveTemplates();
      
      // Should return false on error
      expect(result).toBe(false);
    });
  });
});
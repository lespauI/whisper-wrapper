/**
 * Unit tests for Template Service
 */

const path = require('path');
const TemplateService = require('../../../src/services/templateService');

// Mock console methods to prevent logs during tests
global.console = {
    ...global.console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
};

// Mock the fs module
jest.mock('fs', () => ({
    promises: {
        mkdir: jest.fn().mockResolvedValue(undefined),
        readFile: jest.fn(),
        writeFile: jest.fn().mockResolvedValue(undefined)
    }
}));

// Get the mocked fs module
const fs = require('fs');

// Mock the config
jest.mock('../../../src/config', () => ({
    app: {
        dataDirectory: '/mock/data/directory'
    }
}));

describe('TemplateService', () => {
    let templateService;
    const mockTemplatesPath = '/mock/data/directory/templates.json';
    const mockTemplates = [
        {
            id: 'test-template-1',
            name: 'Test Template 1',
            description: 'Test description 1',
            prompt: 'Test prompt with {{transcription}} placeholder',
            isActive: true
        },
        {
            id: 'test-template-2',
            name: 'Test Template 2',
            description: 'Test description 2',
            prompt: 'Another test prompt with {{transcription}} content',
            isActive: false
        }
    ];
    const mockSettings = {
        ollamaEndpoint: 'http://localhost:11434',
        defaultModel: 'test-model',
        timeoutSeconds: 30
    };

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Setup mock data
        fs.promises.readFile.mockResolvedValue(JSON.stringify({
            templates: mockTemplates,
            settings: mockSettings
        }));
        
        // Create a new instance for each test
        templateService = new TemplateService();
    });

    test('should initialize with templates from file', async () => {
        await templateService.initialize();
        
        expect(fs.promises.mkdir).toHaveBeenCalledWith('/mock/data/directory', { recursive: true });
        expect(fs.promises.readFile).toHaveBeenCalledWith(mockTemplatesPath, 'utf8');
        expect(templateService.templates).toEqual(mockTemplates);
        expect(templateService.settings).toEqual(mockSettings);
    });

    test('should create default templates if loading fails', async () => {
        fs.promises.readFile.mockRejectedValueOnce(new Error('File not found'));
        
        await templateService.initialize();
        
        expect(fs.promises.writeFile).toHaveBeenCalled();
        expect(templateService.templates.length).toBeGreaterThan(0);
        expect(templateService.templates[0]).toHaveProperty('id');
        expect(templateService.templates[0]).toHaveProperty('name');
        expect(templateService.templates[0]).toHaveProperty('prompt');
    });

    test('should get all templates', async () => {
        await templateService.initialize();
        const allTemplates = await templateService.getAllTemplates();
        
        expect(allTemplates).toEqual(mockTemplates);
    });

    test('should get active templates only', async () => {
        await templateService.initialize();
        const activeTemplates = await templateService.getActiveTemplates();
        
        expect(activeTemplates.length).toBe(1);
        expect(activeTemplates[0].id).toBe('test-template-1');
    });

    test('should get template by ID', async () => {
        await templateService.initialize();
        const template = await templateService.getTemplateById('test-template-2');
        
        expect(template).toEqual(mockTemplates[1]);
    });

    test('should create a new template', async () => {
        await templateService.initialize();
        
        const newTemplate = {
            name: 'New Template',
            description: 'New description',
            prompt: 'New prompt with {{transcription}} data',
            isActive: true
        };
        
        const result = await templateService.createTemplate(newTemplate);
        
        expect(result.name).toBe(newTemplate.name);
        expect(result.description).toBe(newTemplate.description);
        expect(result.prompt).toBe(newTemplate.prompt);
        expect(result.isActive).toBe(newTemplate.isActive);
        expect(result.id).toBeDefined();
        
        expect(fs.promises.writeFile).toHaveBeenCalled();
        expect(templateService.templates.length).toBe(3);
    });

    test('should update an existing template', async () => {
        await templateService.initialize();
        
        const updates = {
            name: 'Updated Name',
            description: 'Updated description'
        };
        
        const result = await templateService.updateTemplate('test-template-1', updates);
        
        expect(result.id).toBe('test-template-1');
        expect(result.name).toBe('Updated Name');
        expect(result.description).toBe('Updated description');
        expect(result.prompt).toBe(mockTemplates[0].prompt); // Should keep the original prompt
        
        expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    test('should throw error when updating non-existent template', async () => {
        await templateService.initialize();
        
        await expect(templateService.updateTemplate('non-existent-id', { name: 'New Name' }))
            .rejects.toThrow('Template with ID non-existent-id not found');
    });

    test('should delete a template', async () => {
        await templateService.initialize();
        
        const result = await templateService.deleteTemplate('test-template-1');
        
        expect(result).toBe(true);
        expect(templateService.templates.length).toBe(1);
        expect(templateService.templates[0].id).toBe('test-template-2');
        
        expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    test('should throw error when deleting non-existent template', async () => {
        await templateService.initialize();
        
        await expect(templateService.deleteTemplate('non-existent-id'))
            .rejects.toThrow('Template with ID non-existent-id not found');
    });

    test('should get settings', async () => {
        await templateService.initialize();
        
        const settings = await templateService.getSettings();
        
        expect(settings).toEqual(mockSettings);
    });

    test('should update settings', async () => {
        await templateService.initialize();
        
        const updatedSettings = {
            ollamaEndpoint: 'http://localhost:8000',
            timeoutSeconds: 60
        };
        
        const result = await templateService.updateSettings(updatedSettings);
        
        expect(result.ollamaEndpoint).toBe('http://localhost:8000');
        expect(result.timeoutSeconds).toBe(60);
        expect(result.defaultModel).toBe(mockSettings.defaultModel); // Should keep the original value
        
        expect(fs.promises.writeFile).toHaveBeenCalled();
    });
});
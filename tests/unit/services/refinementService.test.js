/**
 * Unit tests for Refinement Service
 */

const RefinementService = require('../../../src/services/refinementService');
const OllamaService = require('../../../src/services/ollamaService');
const TemplateService = require('../../../src/services/templateService');

// Mock dependencies
jest.mock('../../../src/services/ollamaService');
jest.mock('../../../src/services/templateService');

// Mock console methods to prevent logs during tests
global.console = {
    ...global.console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
};

describe('RefinementService', () => {
    let refinementService;
    let mockOllamaService;
    let mockTemplateService;
    
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Create mock implementations
        mockOllamaService = new OllamaService();
        mockTemplateService = new TemplateService();
        
        // Set up mock behavior
        mockOllamaService.isAvailable.mockResolvedValue(true);
        mockOllamaService.generateText.mockResolvedValue({
            success: true,
            text: 'Refined text result',
            model: 'llama3:latest'
        });
        
        mockTemplateService.getTemplateById.mockResolvedValue({
            id: 'test-template',
            name: 'Test Template',
            description: 'A test template',
            prompt: 'Refine this: {{transcription}}',
            isActive: true
        });
        
        mockTemplateService.getActiveTemplates.mockResolvedValue([
            {
                id: 'test-template',
                name: 'Test Template',
                description: 'A test template',
                prompt: 'Refine this: {{transcription}}',
                isActive: true
            },
            {
                id: 'another-template',
                name: 'Another Template',
                description: 'Another test template',
                prompt: 'Format this: {{transcription}}',
                isActive: true
            }
        ]);
        
        mockTemplateService.getSettings.mockResolvedValue({
            ollamaEndpoint: 'http://localhost:11434',
            defaultModel: 'llama3:latest',
            timeoutSeconds: 30
        });
        
        // Mock the OllamaService and TemplateService constructors
        OllamaService.mockImplementation(() => mockOllamaService);
        TemplateService.mockImplementation(() => mockTemplateService);
        
        // Create service instance
        refinementService = new RefinementService();
    });
    
    test('should initialize with OllamaService and TemplateService', () => {
        expect(OllamaService).toHaveBeenCalled();
        expect(TemplateService).toHaveBeenCalled();
        expect(refinementService.ollamaService).toBe(mockOllamaService);
        expect(refinementService.templateService).toBe(mockTemplateService);
        expect(global.ollamaService).toBe(mockOllamaService);
        expect(global.templateService).toBe(mockTemplateService);
    });
    
    test('should check if refinement is available', async () => {
        const result = await refinementService.isAvailable();
        
        expect(result).toBe(true);
        expect(mockOllamaService.isAvailable).toHaveBeenCalled();
    });
    
    test('should get available templates', async () => {
        const result = await refinementService.getAvailableTemplates();
        
        expect(result.length).toBe(2);
        expect(result[0].id).toBe('test-template');
        expect(result[1].id).toBe('another-template');
        expect(mockTemplateService.getActiveTemplates).toHaveBeenCalled();
    });
    
    test('should get template by ID', async () => {
        const result = await refinementService.getTemplate('test-template');
        
        expect(result.id).toBe('test-template');
        expect(result.name).toBe('Test Template');
        expect(mockTemplateService.getTemplateById).toHaveBeenCalledWith('test-template');
    });
    
    test('should format prompt with transcription', () => {
        const result = refinementService.formatPrompt(
            'This is a {{transcription}} with placeholders for {{variable}}',
            'sample transcription text',
            { variable: 'custom value' }
        );
        
        expect(result).toBe('This is a sample transcription text with placeholders for custom value');
    });
    
    test('should refine transcription using template', async () => {
        const result = await refinementService.refineTranscription(
            'Original transcription text',
            'test-template',
            { model: 'custom-model' }
        );
        
        expect(result.success).toBe(true);
        expect(result.original).toBe('Original transcription text');
        expect(result.refined).toBe('Refined text result');
        expect(result.templateId).toBe('test-template');
        expect(result.templateName).toBe('Test Template');
        expect(result.model).toBe('llama3:latest');
        
        expect(mockTemplateService.getTemplateById).toHaveBeenCalledWith('test-template');
        expect(mockOllamaService.generateText).toHaveBeenCalledWith(
            'Refine this: Original transcription text',
            expect.objectContaining({ model: 'custom-model' })
        );
    });
    
    test('should throw error if template is not found', async () => {
        mockTemplateService.getTemplateById.mockResolvedValueOnce(null);
        
        await expect(refinementService.refineTranscription(
            'Original transcription text',
            'non-existent-template'
        )).rejects.toThrow('Template with ID non-existent-template not found');
    });
    
    test('should throw error if Ollama is not available', async () => {
        mockOllamaService.isAvailable.mockResolvedValueOnce(false);
        
        await expect(refinementService.refineTranscription(
            'Original transcription text',
            'test-template'
        )).rejects.toThrow('Ollama is not available');
    });
    
    test('should throw error if refinement fails', async () => {
        mockOllamaService.generateText.mockRejectedValueOnce(new Error('Generation failed'));
        
        await expect(refinementService.refineTranscription(
            'Original transcription text',
            'test-template'
        )).rejects.toThrow('Refinement failed: Generation failed');
    });
    
    test('should validate template correctly', () => {
        const validTemplate = {
            name: 'Valid Template',
            prompt: 'This is a valid prompt with {{transcription}} placeholder'
        };
        
        const invalidNameTemplate = {
            name: '',
            prompt: 'This is a valid prompt with {{transcription}} placeholder'
        };
        
        const invalidPromptTemplate = {
            name: 'Invalid Prompt Template',
            prompt: 'This is an invalid prompt without the required placeholder'
        };
        
        const validResult = refinementService.validateTemplate(validTemplate);
        const invalidNameResult = refinementService.validateTemplate(invalidNameTemplate);
        const invalidPromptResult = refinementService.validateTemplate(invalidPromptTemplate);
        
        expect(validResult.valid).toBe(true);
        expect(validResult.errors.length).toBe(0);
        
        expect(invalidNameResult.valid).toBe(false);
        expect(invalidNameResult.errors).toContain('Template name is required');
        
        expect(invalidPromptResult.valid).toBe(false);
        expect(invalidPromptResult.errors).toContain('Template prompt must contain {{transcription}} placeholder');
    });
    
    test('should get refinement settings', async () => {
        const result = await refinementService.getSettings();
        
        expect(result).toEqual({
            ollamaEndpoint: 'http://localhost:11434',
            defaultModel: 'llama3:latest',
            timeoutSeconds: 30,
            isOllamaAvailable: true
        });
        
        expect(mockTemplateService.getSettings).toHaveBeenCalled();
        expect(mockOllamaService.isAvailable).toHaveBeenCalled();
    });
    
    test('should update refinement settings', async () => {
        const newSettings = {
            ollamaEndpoint: 'http://localhost:8000',
            defaultModel: 'gpt4:latest',
            timeoutSeconds: 60
        };
        
        await refinementService.updateSettings(newSettings);
        
        expect(mockTemplateService.updateSettings).toHaveBeenCalledWith(newSettings);
        expect(mockOllamaService.updateSettings).toHaveBeenCalledWith(newSettings);
    });
});
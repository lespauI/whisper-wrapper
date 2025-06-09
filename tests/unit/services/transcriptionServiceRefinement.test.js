/**
 * Unit tests for Transcription Service integration with Refinement
 */

const TranscriptionService = require('../../../src/services/transcriptionService');
const { LocalWhisperService } = require('../../../src/services/localWhisperService');
const TranscriptionFormatter = require('../../../src/services/transcriptionFormatter');
const RefinementService = require('../../../src/services/refinementService');

// Mock dependencies
jest.mock('../../../src/services/localWhisperService');
jest.mock('../../../src/services/transcriptionFormatter');
jest.mock('../../../src/services/refinementService');

// Mock console methods to prevent logs during tests
global.console = {
    ...global.console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
};

describe('TranscriptionService with Refinement', () => {
    let transcriptionService;
    let mockWhisperService;
    let mockFormatter;
    let mockRefinementService;
    
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Create mock implementations
        mockWhisperService = new LocalWhisperService();
        mockFormatter = new TranscriptionFormatter();
        mockRefinementService = new RefinementService();
        
        // Set up mock behavior for LocalWhisperService
        mockWhisperService.isAvailable.mockReturnValue(true);
        mockWhisperService.transcribeFile.mockResolvedValue({
            success: true,
            text: 'Original transcription text',
            segments: [{ id: 1, text: 'Original segment' }],
            language: 'en',
            model: 'base',
            duration: 60
        });
        
        mockWhisperService.transcribeBuffer.mockResolvedValue({
            success: true,
            text: 'Original buffer transcription',
            segments: [{ id: 1, text: 'Original buffer segment' }],
            language: 'en',
            model: 'base',
            duration: 30
        });
        
        // Set up mock behavior for TranscriptionFormatter
        mockFormatter.formatTranscription.mockImplementation(result => ({
            markdown: `# ${result.text}`,
            plainText: result.text,
            metadata: { duration: result.duration, segments: result.segments?.length || 0 }
        }));
        
        mockFormatter.generateSRT.mockReturnValue('1\\n00:00:00,000 --> 00:00:10,000\\nMocked SRT content');
        mockFormatter.generateVTT.mockReturnValue('WEBVTT\\n\\n00:00:00.000 --> 00:00:10.000\\nMocked VTT content');
        
        // Set up mock behavior for RefinementService
        mockRefinementService.isAvailable.mockResolvedValue(true);
        mockRefinementService.getAvailableTemplates.mockResolvedValue([
            { id: 'template-1', name: 'Template 1', description: 'Template 1 description', isActive: true },
            { id: 'template-2', name: 'Template 2', description: 'Template 2 description', isActive: true }
        ]);
        
        mockRefinementService.getTemplate.mockResolvedValue({
            id: 'template-1',
            name: 'Template 1',
            description: 'Template 1 description',
            prompt: 'Refine this: {{transcription}}',
            isActive: true
        });
        
        mockRefinementService.refineTranscription.mockResolvedValue({
            success: true,
            original: 'Original transcription text',
            refined: 'Refined transcription text',
            templateId: 'template-1',
            templateName: 'Template 1',
            model: 'llama3:latest'
        });
        
        mockRefinementService.getSettings.mockResolvedValue({
            ollamaEndpoint: 'http://localhost:11434',
            defaultModel: 'llama3:latest',
            timeoutSeconds: 30,
            isOllamaAvailable: true
        });
        
        // Mock constructors
        LocalWhisperService.mockImplementation(() => mockWhisperService);
        TranscriptionFormatter.mockImplementation(() => mockFormatter);
        RefinementService.mockImplementation(() => mockRefinementService);
        
        // Create service instance
        transcriptionService = new TranscriptionService();
    });
    
    test('should initialize with RefinementService', () => {
        expect(RefinementService).toHaveBeenCalled();
        expect(transcriptionService.refinementService).toBe(mockRefinementService);
        expect(transcriptionService.selectedTemplateId).toBeNull();
    });
    
    test('should include refinement data in settings', async () => {
        const settings = await transcriptionService.getSettings();
        
        expect(settings.selectedTemplateId).toBeNull();
        expect(settings.refinement).toBeDefined();
        expect(settings.refinement.isAvailable).toBe(true);
        expect(settings.refinement.availableTemplates).toHaveLength(2);
        expect(settings.refinement.defaultModel).toBe('llama3:latest');
    });
    
    test('should update refinement settings', async () => {
        await transcriptionService.updateSettings({
            selectedTemplateId: 'template-1',
            refinement: {
                defaultModel: 'gpt4:latest'
            }
        });
        
        expect(transcriptionService.selectedTemplateId).toBe('template-1');
        expect(mockRefinementService.updateSettings).toHaveBeenCalledWith({
            defaultModel: 'gpt4:latest'
        });
    });
    
    test('should set refinement template', () => {
        transcriptionService.setRefinementTemplate('template-2');
        expect(transcriptionService.selectedTemplateId).toBe('template-2');
    });
    
    test('should get available templates', async () => {
        const templates = await transcriptionService.getAvailableTemplates();
        
        expect(templates).toHaveLength(2);
        expect(templates[0].id).toBe('template-1');
        expect(templates[1].id).toBe('template-2');
        expect(mockRefinementService.getAvailableTemplates).toHaveBeenCalled();
    });
    
    test('should check if refinement is available', async () => {
        const isAvailable = await transcriptionService.isRefinementAvailable();
        
        expect(isAvailable).toBe(true);
        expect(mockRefinementService.isAvailable).toHaveBeenCalled();
    });
    
    test('should transcribe file with refinement when template is selected', async () => {
        transcriptionService.setRefinementTemplate('template-1');
        
        const result = await transcriptionService.transcribeFile('/mock/file/path');
        
        expect(result.success).toBe(true);
        expect(result.originalText).toBe('Original transcription text');
        expect(result.text).toBe('Refined transcription text');
        expect(result.refinementStatus).toBeDefined();
        expect(result.refinementStatus.success).toBe(true);
        expect(result.refinementStatus.templateId).toBe('template-1');
        expect(result.refinementStatus.templateName).toBe('Template 1');
        
        expect(mockWhisperService.transcribeFile).toHaveBeenCalledWith('/mock/file/path', expect.any(Object));
        expect(mockRefinementService.refineTranscription).toHaveBeenCalledWith(
            'Original transcription text',
            'template-1',
            expect.any(Object)
        );
        
        // Should format the refined text
        expect(mockFormatter.formatTranscription).toHaveBeenCalledTimes(2);
        expect(mockFormatter.formatTranscription).toHaveBeenLastCalledWith({
            text: 'Refined transcription text',
            segments: [{ id: 1, text: 'Original segment' }]
        });
    });
    
    test('should transcribe file without refinement when no template is selected', async () => {
        const result = await transcriptionService.transcribeFile('/mock/file/path');
        
        expect(result.success).toBe(true);
        expect(result.text).toBe('Original transcription text');
        expect(result.refinementStatus).toBeUndefined();
        
        expect(mockWhisperService.transcribeFile).toHaveBeenCalledWith('/mock/file/path', expect.any(Object));
        expect(mockRefinementService.refineTranscription).not.toHaveBeenCalled();
    });
    
    test('should handle refinement unavailability', async () => {
        transcriptionService.setRefinementTemplate('template-1');
        mockRefinementService.isAvailable.mockResolvedValueOnce(false);
        
        const result = await transcriptionService.transcribeFile('/mock/file/path');
        
        expect(result.success).toBe(true);
        expect(result.text).toBe('Original transcription text');
        expect(result.refinementStatus).toBeDefined();
        expect(result.refinementStatus.success).toBe(false);
        expect(result.refinementStatus.message).toContain('Ollama is not available');
        
        expect(mockRefinementService.refineTranscription).not.toHaveBeenCalled();
    });
    
    test('should handle refinement errors', async () => {
        transcriptionService.setRefinementTemplate('template-1');
        mockRefinementService.refineTranscription.mockRejectedValueOnce(new Error('Refinement error'));
        
        const result = await transcriptionService.transcribeFile('/mock/file/path');
        
        expect(result.success).toBe(true);
        expect(result.text).toBe('Original transcription text');
        expect(result.refinementStatus).toBeDefined();
        expect(result.refinementStatus.success).toBe(false);
        expect(result.refinementStatus.message).toContain('Refinement failed: Refinement error');
    });
    
    test('should transcribe buffer with refinement when template is selected', async () => {
        transcriptionService.setRefinementTemplate('template-1');
        
        // Mock the refined transcription for buffer
        mockRefinementService.refineTranscription.mockResolvedValueOnce({
            success: true,
            original: 'Original buffer transcription',
            refined: 'Refined buffer transcription',
            templateId: 'template-1',
            templateName: 'Template 1',
            model: 'llama3:latest'
        });
        
        const result = await transcriptionService.transcribeBuffer(Buffer.from('mock audio data'));
        
        expect(result.success).toBe(true);
        expect(result.originalText).toBe('Original buffer transcription');
        expect(result.text).toBe('Refined buffer transcription');
        expect(result.refinementStatus).toBeDefined();
        expect(result.refinementStatus.success).toBe(true);
        
        expect(mockWhisperService.transcribeBuffer).toHaveBeenCalledWith(
            Buffer.from('mock audio data'),
            expect.any(Object)
        );
        expect(mockRefinementService.refineTranscription).toHaveBeenCalledWith(
            'Original buffer transcription',
            'template-1',
            expect.any(Object)
        );
    });
    
    test('should use template ID from options if provided', async () => {
        // Even though a default template is set, the option should override it
        transcriptionService.setRefinementTemplate('template-1');
        
        const result = await transcriptionService.transcribeFile('/mock/file/path', {
            templateId: 'template-2'
        });
        
        expect(mockRefinementService.refineTranscription).toHaveBeenCalledWith(
            'Original transcription text',
            'template-2',
            expect.any(Object)
        );
    });
});
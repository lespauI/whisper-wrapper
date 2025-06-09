/**
 * Unit tests for Ollama Service
 */

const fetch = require('node-fetch');
const OllamaService = require('../../../src/services/ollamaService');

// Mock node-fetch
jest.mock('node-fetch');

// Mock console methods to prevent logs during tests
global.console = {
    ...global.console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
};

// Mock the global templateService
global.templateService = {
    getSettings: jest.fn().mockResolvedValue({
        ollamaEndpoint: 'http://localhost:11434',
        defaultModel: 'llama3:test',
        timeoutSeconds: 30
    }),
    updateSettings: jest.fn().mockResolvedValue({})
};

describe('OllamaService', () => {
    let ollamaService;
    
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Reset fetch mock responses
        fetch.mockReset();
        
        // Create a new instance for each test
        ollamaService = new OllamaService();
    });
    
    test('should initialize with default values', () => {
        expect(ollamaService.baseURL).toBe('http://localhost:11434');
        expect(ollamaService.defaultModel).toBe('llama3:test'); // Updated to match mock value
        expect(ollamaService.timeoutSeconds).toBe(30);
    });
    
    test('should load settings from templateService if available', async () => {
        await ollamaService.loadSettings();
        
        expect(global.templateService.getSettings).toHaveBeenCalled();
        expect(ollamaService.baseURL).toBe('http://localhost:11434');
        expect(ollamaService.defaultModel).toBe('llama3:test');
        expect(ollamaService.timeoutSeconds).toBe(30);
    });
    
    test('should update settings', async () => {
        const newSettings = {
            ollamaEndpoint: 'http://localhost:8000',
            defaultModel: 'gpt4:latest',
            timeoutSeconds: 60
        };
        
        await ollamaService.updateSettings(newSettings);
        
        expect(ollamaService.baseURL).toBe('http://localhost:8000');
        expect(ollamaService.defaultModel).toBe('gpt4:latest');
        expect(ollamaService.timeoutSeconds).toBe(60);
        expect(global.templateService.updateSettings).toHaveBeenCalledWith({
            ollamaEndpoint: 'http://localhost:8000',
            defaultModel: 'gpt4:latest',
            timeoutSeconds: 60
        });
    });
    
    test('should check if Ollama is available', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({ version: '0.1.0' })
        });
        
        const result = await ollamaService.isAvailable();
        
        expect(result).toBe(true);
        expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/version', expect.any(Object));
    });
    
    test('should return false if Ollama is not available', async () => {
        fetch.mockRejectedValueOnce(new Error('Connection refused'));
        
        const result = await ollamaService.isAvailable();
        
        expect(result).toBe(false);
    });
    
    test('should list available models', async () => {
        const mockModels = [
            { name: 'model1' },
            { name: 'model2' }
        ];
        
        fetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({ models: mockModels })
        });
        
        const result = await ollamaService.listModels();
        
        expect(result).toEqual(mockModels);
        expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/tags', expect.any(Object));
    });
    
    test('should throw error if listing models fails', async () => {
        fetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error'
        });
        
        await expect(ollamaService.listModels()).rejects.toThrow('Failed to list models');
    });
    
    test('should generate text with Ollama', async () => {
        // First mock isAvailable check
        fetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({ version: '0.1.0' })
        });
        
        // Then mock the generate endpoint
        fetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({
                response: 'Generated text response',
                model: 'llama3:test'
            })
        });
        
        const result = await ollamaService.generateText('Test prompt', {
            model: 'llama3:test',
            temperature: 0.5
        });
        
        expect(result.success).toBe(true);
        expect(result.text).toBe('Generated text response');
        expect(result.model).toBe('llama3:test');
        
        // Check the second call to fetch (the generate endpoint)
        expect(fetch.mock.calls[1][0]).toBe('http://localhost:11434/api/generate');
        expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
            model: 'llama3:test',
            prompt: 'Test prompt',
            stream: false,
            options: {
                temperature: 0.5,
                top_p: 0.9,
                top_k: 40,
                num_predict: 500
            }
        });
    });
    
    test('should throw error if Ollama is not available for generation', async () => {
        fetch.mockRejectedValueOnce(new Error('Connection refused'));
        
        await expect(ollamaService.generateText('Test prompt')).rejects.toThrow('Ollama is not available');
    });
    
    test('should throw error if generation request fails', async () => {
        // First mock isAvailable check to succeed
        fetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({ version: '0.1.0' })
        });
        
        // Then mock the generate endpoint to fail
        fetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error'
        });
        
        await expect(ollamaService.generateText('Test prompt')).rejects.toThrow('Ollama API error');
    });
    
    test('should handle timeout error in generation', async () => {
        // First mock isAvailable check to succeed
        fetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({ version: '0.1.0' })
        });
        
        // Then mock the generate endpoint to timeout
        fetch.mockImplementationOnce(() => {
            const error = new Error('The operation was aborted');
            error.name = 'AbortError';
            throw error;
        });
        
        await expect(ollamaService.generateText('Test prompt', { timeout: 5 })).rejects.toThrow('Ollama request timed out after 5 seconds');
    });
});
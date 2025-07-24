/**
 * Unit tests for Ollama Service
 */

const axios = require('axios');

// Mock axios
jest.mock('axios');

// Mock the config
jest.mock('../../../src/config', () => ({
  getAIRefinementSettings: jest.fn().mockReturnValue({
    enabled: true,
    endpoint: 'http://localhost:11434',
    model: 'gemma3:12b',
    timeoutSeconds: 30
  })
}));

// Import after mocking dependencies
const ollamaService = require('../../../src/services/ollamaService');

describe('Ollama Service', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('connection tests', () => {
    it('should successfully test connection', async () => {
      // Setup mock axios response
      axios.mockResolvedValueOnce({
        data: {
          models: [
            { name: 'gemma3:12b' },
            { name: 'llama2:7b' }
          ]
        }
      });
      
      // Test
      const result = await ollamaService.testConnection();
      
      // Assertions
      expect(result.success).toBe(true);
      expect(result.models.length).toBe(2);
      expect(result.models[0].name).toBe('gemma3:12b');
      expect(axios).toHaveBeenCalledWith({
        method: 'GET',
        url: 'http://localhost:11434/api/tags',
        timeout: 30000
      });
    });

    it('should handle connection failure', async () => {
      // Setup mock axios response for failure
      axios.mockRejectedValueOnce(new Error('Connection failed'));
      
      // Test
      const result = await ollamaService.testConnection();
      
      // Assertions
      expect(result.success).toBe(false);
      expect(result.models).toEqual([]);
      expect(result.message).toBe('Connection failed');
    });
  });

  describe('model listing', () => {
    it('should get models from Ollama', async () => {
      // Setup mock axios response
      axios.mockResolvedValueOnce({
        data: {
          models: [
            { name: 'gemma3:12b' },
            { name: 'llama2:7b' }
          ]
        }
      });
      
      // Test
      const models = await ollamaService.getModels();
      
      // Assertions
      expect(models.length).toBe(2);
      expect(models[0].name).toBe('gemma3:12b');
      expect(axios).toHaveBeenCalledWith({
        method: 'GET',
        url: 'http://localhost:11434/api/tags',
        timeout: 30000
      });
    });

    it('should handle failure when getting models', async () => {
      // Setup mock axios response for failure
      axios.mockRejectedValueOnce(new Error('Failed to get models'));
      
      // Test
      const models = await ollamaService.getModels();
      
      // Assertions
      expect(models).toEqual([]);
    });
  });

  describe('text refinement', () => {
    it('should successfully refine text', async () => {
      // Setup mock axios response
      axios.mockResolvedValueOnce({
        data: {
          response: 'Refined text result'
        }
      });
      
      // Test
      const result = await ollamaService.refineText('Original text', 'Format this text: {{text}}');
      
      // Assertions
      expect(result.success).toBe(true);
      expect(result.refinedText).toBe('Refined text result');
      expect(axios).toHaveBeenCalledWith({
        method: 'POST',
        url: 'http://localhost:11434/api/generate',
        timeout: 30000,
        data: {
          model: 'gemma3:12b',
          prompt: 'Format this text: Original text',
          stream: false
        }
      });
    });

    it('should handle failure when refining text', async () => {
      // Setup mock axios response for failure
      axios.mockRejectedValueOnce(new Error('Failed to refine text'));
      
      // Test
      const result = await ollamaService.refineText('Original text', 'Format this text: {{text}}');
      
      // Assertions
      expect(result.success).toBe(false);
      expect(result.refinedText).toBeNull();
      expect(result.message).toBe('Failed to refine text');
    });

    it('should return error when AI refinement is disabled', async () => {
      // Setup - Mock config to disable refinement
      const config = require('../../../src/config');
      config.getAIRefinementSettings.mockReturnValueOnce({
        enabled: false,
        endpoint: 'http://localhost:11434',
        model: 'gemma3:12b',
        timeoutSeconds: 30
      });
      
      // Update settings
      ollamaService.updateSettings();
      
      // Test
      const result = await ollamaService.refineText('Original text', 'Format this text: {{text}}');
      
      // Assertions
      expect(result.success).toBe(false);
      expect(result.refinedText).toBeNull();
      expect(result.message).toBe('AI refinement is disabled');
      expect(axios).not.toHaveBeenCalled();
    });
  });

  describe('settings management', () => {
    it('should update settings', async () => {
      // Test a simpler approach - we'll directly verify that updateSettings
      // correctly sets the settings property on the service
      
      // Get initial state
      const initialEndpoint = ollamaService.settings.endpoint;
      const initialModel = ollamaService.settings.model;
      
      // Setup mock config to return different settings
      const config = require('../../../src/config');
      const newSettings = {
        enabled: true,
        endpoint: 'http://different-endpoint:11434',
        model: 'different-model',
        timeoutSeconds: 60
      };
      config.getAIRefinementSettings.mockReturnValueOnce(newSettings);
      
      // Call updateSettings
      ollamaService.updateSettings();
      
      // Verify the settings were updated correctly
      expect(ollamaService.settings.endpoint).toBe(newSettings.endpoint);
      expect(ollamaService.settings.model).toBe(newSettings.model);
      expect(ollamaService.settings.enabled).toBe(newSettings.enabled);
      expect(ollamaService.settings.timeoutSeconds).toBe(newSettings.timeoutSeconds);
      
      // Now test that the updateSettings inside refineText actually works
      
      // Reset back to the original mock
      config.getAIRefinementSettings.mockReturnValue({
        enabled: true,
        endpoint: initialEndpoint,
        model: initialModel,
        timeoutSeconds: 30
      });
      
      // Re-initialize the settings
      ollamaService.updateSettings();
    });
  });
});
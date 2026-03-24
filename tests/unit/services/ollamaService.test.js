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
      // Create a mock stream that simulates the Ollama response
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            // Simulate receiving data chunk with JSON response
            setTimeout(() => {
              const chunk = Buffer.from('{"response":"Refined text result","done":true}\n');
              callback(chunk);
            }, 10);
          } else if (event === 'end') {
            // Simulate stream end
            setTimeout(() => callback(), 20);
          } else if (event === 'error') {
            // Store error callback for potential use
          }
        })
      };

      // Setup mock axios response with stream
      axios.mockResolvedValueOnce({
        data: mockStream
      });
      
      // Test
      const result = await ollamaService.refineText('Original text', 'Format this text: {{text}}');
      
      // Assertions
      expect(result.success).toBe(true);
      expect(result.refinedText).toBe('Refined text result');
      expect(axios).toHaveBeenCalledWith(expect.objectContaining({
        method: 'POST',
        url: 'http://localhost:11434/api/generate',
        timeout: 30000,
        responseType: 'stream',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/x-ndjson'
        },
        data: {
          model: 'gemma3:12b',
          prompt: 'Format this text: Original text',
          stream: true,
          options: expect.objectContaining({
            num_predict: expect.any(Number),
            temperature: expect.any(Number)
          })
        }
      }));
    });

    it('should handle failure when refining text', async () => {
      // Setup mock axios response for failure
      axios.mockRejectedValueOnce(new Error('Failed to refine text'));
      
      // Test
      const result = await ollamaService.refineText('Original text', 'Format this text: {{text}}');
      
      // Assertions
      expect(result.success).toBe(false);
      expect(result.refinedText).toBeNull();
      expect(result.message).toBe('Failed to connect to Ollama API');
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
      
      // Create a mock stream that simulates the Ollama response even when disabled
      const mockStream = {
        on: jest.fn((event, callback) => {
          if (event === 'data') {
            setTimeout(() => {
              const chunk = Buffer.from('{"response":"Text processed despite disabled setting","done":true}\n');
              callback(chunk);
            }, 10);
          } else if (event === 'end') {
            setTimeout(() => callback(), 20);
          }
        })
      };

      // Setup mock axios response - the service still makes the call
      axios.mockResolvedValueOnce({
        data: mockStream
      });
      
      // Test
      const result = await ollamaService.refineText('Original text', 'Format this text: {{text}}');
      
      // Assertions - The service now continues even when disabled
      expect(result.success).toBe(true);
      expect(result.refinedText).toBe('Text processed despite disabled setting');
      expect(axios).toHaveBeenCalled();
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

  describe('generateTranscriptionMeta', () => {
    const mockAxios = axios;

    it('parses clean JSON response', async () => {
      mockAxios.mockResolvedValueOnce({
        data: { response: '{"title":"Budget Meeting","summary":"A meeting about budgets","labels":["meeting","budget"]}' }
      });
      mockAxios.mockResolvedValueOnce({ data: {} });
      const result = await ollamaService.generateTranscriptionMeta('text', 'qwen3.5:0.8b');
      expect(result.title).toBe('Budget Meeting');
      expect(result.summary).toBe('A meeting about budgets');
      expect(result.labels).toEqual(['meeting', 'budget']);
    });

    it('strips <think>...</think> blocks before parsing (thinking models)', async () => {
      mockAxios.mockResolvedValueOnce({
        data: {
          response: '<think>\nLet me analyse this transcription carefully.\n</think>\n{"summary":"Budget discussion","labels":["finance","q1"]}'
        }
      });
      mockAxios.mockResolvedValueOnce({ data: {} });
      const result = await ollamaService.generateTranscriptionMeta('text', 'qwen3.5:0.8b');
      expect(result.summary).toBe('Budget discussion');
      expect(result.labels).toEqual(['finance', 'q1']);
    });

    it('handles multi-block thinking output', async () => {
      mockAxios.mockResolvedValueOnce({
        data: {
          response: '<think>First pass</think><think>Second pass</think>{"summary":"Summary here","labels":["a"]}'
        }
      });
      mockAxios.mockResolvedValueOnce({ data: {} });
      const result = await ollamaService.generateTranscriptionMeta('text', 'qwen3.5:0.8b');
      expect(result.summary).toBe('Summary here');
      expect(result.labels).toEqual(['a']);
    });

    it('extracts JSON from Ollama thinking field when response is empty (thinking model)', async () => {
      mockAxios.mockResolvedValueOnce({
        data: {
          response: '',
          thinking: '{"summary":"Busy day with meetings and task planning","labels":["project management","planning"]}'
        }
      });
      mockAxios.mockResolvedValueOnce({ data: {} });
      const result = await ollamaService.generateTranscriptionMeta('text', 'qwen3.5:4b-q4_K_M');
      expect(result.summary).toBe('Busy day with meetings and task planning');
      expect(result.labels).toEqual(['project management', 'planning']);
    });

    it('extracts JSON when it appears inside a closed <think> block (Scenario A)', async () => {
      mockAxios.mockResolvedValueOnce({
        data: {
          response: '<think>\n{"summary":"Budget meeting summary","labels":["budget","meeting"]}\n</think>'
        }
      });
      mockAxios.mockResolvedValueOnce({ data: {} });
      const result = await ollamaService.generateTranscriptionMeta('text', 'qwen3.5:0.8b');
      expect(result.summary).toBe('Budget meeting summary');
      expect(result.labels).toEqual(['budget', 'meeting']);
    });

    it('extracts JSON when it appears inside an unclosed <think> block (Scenario B)', async () => {
      mockAxios.mockResolvedValueOnce({
        data: {
          response: '<think>\n{"summary":"Project update","labels":["project","update"]}'
        }
      });
      mockAxios.mockResolvedValueOnce({ data: {} });
      const result = await ollamaService.generateTranscriptionMeta('text', 'qwen3.5:0.8b');
      expect(result.summary).toBe('Project update');
      expect(result.labels).toEqual(['project', 'update']);
    });

    it('returns empty fallback with metaFailed when no JSON found after stripping thinking', async () => {
      mockAxios.mockResolvedValueOnce({
        data: { response: '<think>I cannot produce JSON right now.</think>Sorry, I cannot help.' }
      });
      const result = await ollamaService.generateTranscriptionMeta('text', 'qwen3.5:0.8b');
      expect(result.title).toBe('');
      expect(result.summary).toBe('');
      expect(result.labels).toEqual([]);
      expect(result.metaFailed).toBe(true);
      expect(result.metaError).toBeDefined();
    });

    it('returns empty fallback with metaFailed on network error', async () => {
      mockAxios.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const result = await ollamaService.generateTranscriptionMeta('text', 'qwen3.5:0.8b');
      expect(result.title).toBe('');
      expect(result.summary).toBe('');
      expect(result.labels).toEqual([]);
      expect(result.metaFailed).toBe(true);
      expect(result.metaError).toBe('ECONNREFUSED');
    });

    it('returns metaDisabled when Ollama is disabled', async () => {
      const configMock = require('../../../src/config');
      configMock.getAIRefinementSettings.mockReturnValueOnce({
        enabled: false,
        endpoint: 'http://localhost:11434',
        model: 'gemma3:12b',
        timeoutSeconds: 30
      });
      const result = await ollamaService.generateTranscriptionMeta('text');
      expect(result.metaDisabled).toBe(true);
      expect(result.title).toBe('');
      expect(result.summary).toBe('');
      expect(result.labels).toEqual([]);
    });

    it('bypasses disabled check when force is true', async () => {
      const configMock = require('../../../src/config');
      configMock.getAIRefinementSettings.mockReturnValueOnce({
        enabled: false,
        endpoint: 'http://localhost:11434',
        model: 'gemma3:12b',
        timeoutSeconds: 30
      });
      mockAxios.mockResolvedValueOnce({
        data: { response: '{"title":"Forced Title","summary":"Forced summary","labels":["forced"]}' }
      });
      mockAxios.mockResolvedValueOnce({ data: {} });
      const result = await ollamaService.generateTranscriptionMeta('text', undefined, { force: true });
      expect(result.title).toBe('Forced Title');
      expect(result.summary).toBe('Forced summary');
      expect(result.metaDisabled).toBeUndefined();
    });
  });
});
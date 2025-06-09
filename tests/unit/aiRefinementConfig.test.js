/**
 * Unit tests for AI Refinement Configuration
 */

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue(JSON.stringify({
    aiRefinement: {
      enabled: true,
      endpoint: 'http://localhost:11434',
      model: 'gemma3:12b',
      timeoutSeconds: 30,
      defaultTemplateId: 'format-email'
    }
  })),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn()
}));

// Import after mocking dependencies
const config = require('../../src/config');

describe('AI Refinement Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AI Refinement settings', () => {
    it('should have AI Refinement settings in configuration', () => {
      // This assumes that config is loaded and contains aiRefinement settings
      expect(config.aiRefinement).toBeDefined();
      
      // After the config loads (happens on import), it should have AI Refinement properties
      expect(config.aiRefinement.enabled !== undefined).toBe(true);
      expect(config.aiRefinement.endpoint).toBeDefined();
      expect(config.aiRefinement.model).toBeDefined();
      expect(config.aiRefinement.timeoutSeconds).toBeDefined();
      expect(config.aiRefinement.defaultTemplateId !== undefined).toBe(true);
    });

    it('should get AI Refinement settings', () => {
      const settings = config.getAIRefinementSettings();
      
      expect(settings).toBeDefined();
      expect(settings.enabled !== undefined).toBe(true);
      expect(settings.endpoint).toBeDefined();
      expect(settings.model).toBeDefined();
      expect(settings.timeoutSeconds).toBeDefined();
      expect(settings.defaultTemplateId !== undefined).toBe(true);
    });

    it('should use default values when settings are missing', () => {
      // Temporarily modify the config object to remove aiRefinement settings
      const originalConfig = { ...config.aiRefinement };
      config.aiRefinement = undefined;
      
      // Get settings - should use defaults
      const settings = config.getAIRefinementSettings();
      
      // Restore the original config
      config.aiRefinement = originalConfig;
      
      // Verify default values are provided
      expect(settings.enabled).toBe(false);
      expect(settings.endpoint).toBe('http://localhost:11434');
      expect(settings.model).toBe('gemma3:12b');
      expect(settings.timeoutSeconds).toBe(30);
      expect(settings.defaultTemplateId).toBe(null);
    });

    it('should save AI Refinement settings', () => {
      // Mock fs.writeFileSync implementation
      const fs = require('fs');
      
      // Setup new settings
      const newSettings = {
        enabled: true,
        model: 'new-model',
        defaultTemplateId: 'new-template'
      };
      
      // Save the settings
      const changed = config.saveAIRefinementSettings(newSettings);
      
      // Assertions
      expect(changed).toBe(true);
      expect(config.aiRefinement.enabled).toBe(true);
      expect(config.aiRefinement.model).toBe('new-model');
      expect(config.aiRefinement.defaultTemplateId).toBe('new-template');
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should not save when settings are unchanged', () => {
      // Mock fs.writeFileSync implementation
      const fs = require('fs');
      fs.writeFileSync.mockClear();
      
      // Get current settings
      const currentSettings = config.getAIRefinementSettings();
      
      // Save the same settings
      const changed = config.saveAIRefinementSettings(currentSettings);
      
      // Assertions - no changes, shouldn't write to file
      expect(changed).toBe(false);
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should create aiRefinement section if missing', () => {
      // Temporarily remove the aiRefinement section
      const originalConfig = { ...config.aiRefinement };
      config.aiRefinement = undefined;
      
      // Save new settings
      const newSettings = {
        enabled: true,
        endpoint: 'http://test:11434'
      };
      
      const changed = config.saveAIRefinementSettings(newSettings);
      
      // Verify the section was created and settings were saved
      expect(changed).toBe(true);
      expect(config.aiRefinement).toBeDefined();
      expect(config.aiRefinement.enabled).toBe(true);
      expect(config.aiRefinement.endpoint).toBe('http://test:11434');
      
      // Restore original
      config.aiRefinement = originalConfig;
    });
  });
});
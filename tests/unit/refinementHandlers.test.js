/**
 * Unit tests for Refinement IPC Handlers
 */

// Mock the electron module
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn()
  }
}));

// Mock the template manager
jest.mock('../../src/services/templateManager', () => ({
  getAllTemplates: jest.fn(),
  getTemplateById: jest.fn(),
  getDefaultTemplate: jest.fn(),
  createTemplate: jest.fn(),
  updateTemplate: jest.fn(),
  deleteTemplate: jest.fn(),
  setDefaultTemplate: jest.fn()
}));

// Mock the ollama service
jest.mock('../../src/services/ollamaService', () => ({
  testConnection: jest.fn(),
  getModels: jest.fn(),
  refineText: jest.fn(),
  updateSettings: jest.fn()
}));

// Mock the config
jest.mock('../../src/config', () => ({
  getAIRefinementSettings: jest.fn(),
  saveAIRefinementSettings: jest.fn()
}));

// Import mocks first, then the module under test
const { ipcMain } = require('electron');
const templateManager = require('../../src/services/templateManager');
const ollamaService = require('../../src/services/ollamaService');
const config = require('../../src/config');

// Import after mocking dependencies
const RefinementHandlers = require('../../src/main/refinementHandlers');

describe('Refinement IPC Handlers', () => {
  let refinementHandlers;
  let eventMock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a mock event object with a sender.send method
    eventMock = {
      sender: {
        send: jest.fn()
      }
    };
    
    // Reset the handlers setup count
    ipcMain.handle.mockClear();
    
    // Create a new instance to test
    refinementHandlers = new RefinementHandlers();
  });

  describe('initialization', () => {
    it('should register all IPC handlers', () => {
      // Check that all expected handlers are registered
      expect(ipcMain.handle).toHaveBeenCalledWith('template:getAll', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('template:get', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('template:getDefault', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('template:create', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('template:update', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('template:delete', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('template:setDefault', expect.any(Function));
      
      expect(ipcMain.handle).toHaveBeenCalledWith('ollama:testConnection', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('ollama:getModels', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('ollama:refineText', expect.any(Function));
      
      expect(ipcMain.handle).toHaveBeenCalledWith('aiRefinement:getSettings', expect.any(Function));
      expect(ipcMain.handle).toHaveBeenCalledWith('aiRefinement:saveSettings', expect.any(Function));
    });
  });

  describe('template handlers', () => {
    it('should handle getAllTemplates', async () => {
      // Setup mock return
      const mockTemplates = [{ id: 'template-1' }, { id: 'template-2' }];
      templateManager.getAllTemplates.mockReturnValue(mockTemplates);
      
      // Get the registered handler function
      const handler = refinementHandlers.handleGetAllTemplates.bind(refinementHandlers);
      
      // Call the handler
      const result = await handler();
      
      // Assertions
      expect(result.success).toBe(true);
      expect(result.templates).toEqual(mockTemplates);
      expect(templateManager.getAllTemplates).toHaveBeenCalled();
    });

    it('should handle getTemplate success', async () => {
      // Setup mock return
      const mockTemplate = { id: 'template-1', name: 'Test Template' };
      templateManager.getTemplateById.mockReturnValue(mockTemplate);
      
      // Get the registered handler function
      const handler = refinementHandlers.handleGetTemplate.bind(refinementHandlers);
      
      // Call the handler
      const result = await handler(eventMock, 'template-1');
      
      // Assertions
      expect(result.success).toBe(true);
      expect(result.template).toEqual(mockTemplate);
      expect(templateManager.getTemplateById).toHaveBeenCalledWith('template-1');
    });

    it('should handle getTemplate not found', async () => {
      // Setup mock return
      templateManager.getTemplateById.mockReturnValue(null);
      
      // Get the registered handler function
      const handler = refinementHandlers.handleGetTemplate.bind(refinementHandlers);
      
      // Call the handler
      const result = await handler(eventMock, 'non-existent');
      
      // Assertions
      expect(result.success).toBe(false);
      expect(result.template).toBeNull();
      expect(result.message).toContain('not found');
    });

    it('should handle getDefaultTemplate success', async () => {
      // Setup mock return
      const mockTemplate = { id: 'default-template', isDefault: true };
      templateManager.getDefaultTemplate.mockReturnValue(mockTemplate);
      
      // Get the registered handler function
      const handler = refinementHandlers.handleGetDefaultTemplate.bind(refinementHandlers);
      
      // Call the handler
      const result = await handler();
      
      // Assertions
      expect(result.success).toBe(true);
      expect(result.template).toEqual(mockTemplate);
    });

    it('should handle getDefaultTemplate not found', async () => {
      // Setup mock return
      templateManager.getDefaultTemplate.mockReturnValue(null);
      
      // Get the registered handler function
      const handler = refinementHandlers.handleGetDefaultTemplate.bind(refinementHandlers);
      
      // Call the handler
      const result = await handler();
      
      // Assertions
      expect(result.success).toBe(false);
      expect(result.template).toBeNull();
      expect(result.message).toContain('No default template found');
    });

    it('should handle createTemplate', async () => {
      // Setup mock return
      const mockTemplate = { id: 'new-template', name: 'New Template' };
      const mockTemplateData = { name: 'New Template', prompt: 'Test prompt' };
      templateManager.createTemplate.mockReturnValue(mockTemplate);
      
      // Get the registered handler function
      const handler = refinementHandlers.handleCreateTemplate.bind(refinementHandlers);
      
      // Call the handler
      const result = await handler(eventMock, mockTemplateData);
      
      // Assertions
      expect(result.success).toBe(true);
      expect(result.template).toEqual(mockTemplate);
      expect(templateManager.createTemplate).toHaveBeenCalledWith(mockTemplateData);
    });

    it('should handle updateTemplate success', async () => {
      // Setup mock return
      const mockTemplate = { id: 'template-1', name: 'Updated Template' };
      const mockTemplateData = { name: 'Updated Template' };
      templateManager.updateTemplate.mockReturnValue(mockTemplate);
      
      // Get the registered handler function
      const handler = refinementHandlers.handleUpdateTemplate.bind(refinementHandlers);
      
      // Call the handler
      const result = await handler(eventMock, 'template-1', mockTemplateData);
      
      // Assertions
      expect(result.success).toBe(true);
      expect(result.template).toEqual(mockTemplate);
      expect(templateManager.updateTemplate).toHaveBeenCalledWith('template-1', mockTemplateData);
    });

    it('should handle updateTemplate not found', async () => {
      // Setup mock return
      templateManager.updateTemplate.mockReturnValue(null);
      
      // Get the registered handler function
      const handler = refinementHandlers.handleUpdateTemplate.bind(refinementHandlers);
      
      // Call the handler
      const result = await handler(eventMock, 'non-existent', { name: 'Updated' });
      
      // Assertions
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should handle deleteTemplate success', async () => {
      // Setup mock return
      templateManager.deleteTemplate.mockReturnValue(true);
      
      // Get the registered handler function
      const handler = refinementHandlers.handleDeleteTemplate.bind(refinementHandlers);
      
      // Call the handler
      const result = await handler(eventMock, 'template-1');
      
      // Assertions
      expect(result.success).toBe(true);
      expect(result.message).toContain('deleted successfully');
      expect(templateManager.deleteTemplate).toHaveBeenCalledWith('template-1');
    });

    it('should handle deleteTemplate not found', async () => {
      // Setup mock return
      templateManager.deleteTemplate.mockReturnValue(false);
      
      // Get the registered handler function
      const handler = refinementHandlers.handleDeleteTemplate.bind(refinementHandlers);
      
      // Call the handler
      const result = await handler(eventMock, 'non-existent');
      
      // Assertions
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found or could not be deleted');
    });

    it('should handle setDefaultTemplate success', async () => {
      // Setup mock return
      templateManager.setDefaultTemplate.mockReturnValue(true);
      
      // Get the registered handler function
      const handler = refinementHandlers.handleSetDefaultTemplate.bind(refinementHandlers);
      
      // Call the handler
      const result = await handler(eventMock, 'template-1');
      
      // Assertions
      expect(result.success).toBe(true);
      expect(result.message).toContain('set successfully');
      expect(templateManager.setDefaultTemplate).toHaveBeenCalledWith('template-1');
    });

    it('should handle setDefaultTemplate not found', async () => {
      // Setup mock return
      templateManager.setDefaultTemplate.mockReturnValue(false);
      
      // Get the registered handler function
      const handler = refinementHandlers.handleSetDefaultTemplate.bind(refinementHandlers);
      
      // Call the handler
      const result = await handler(eventMock, 'non-existent');
      
      // Assertions
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found or could not be set');
    });
  });

  describe('ollama handlers', () => {
    it('should handle testConnection', async () => {
      // Setup mock return
      ollamaService.testConnection.mockResolvedValue({
        success: true,
        models: [{ name: 'gemma3:12b' }],
        message: 'Connected successfully'
      });
      
      // Get the registered handler function
      const handler = refinementHandlers.handleTestConnection.bind(refinementHandlers);
      
      // Call the handler
      const result = await handler();
      
      // Assertions
      expect(result.success).toBe(true);
      expect(result.models.length).toBe(1);
      expect(result.message).toBe('Connected successfully');
      expect(ollamaService.testConnection).toHaveBeenCalled();
    });

    it('should handle getModels', async () => {
      // Setup mock return
      ollamaService.getModels.mockResolvedValue([
        { name: 'gemma3:12b' },
        { name: 'llama2:7b' }
      ]);
      
      // Get the registered handler function
      const handler = refinementHandlers.handleGetModels.bind(refinementHandlers);
      
      // Call the handler
      const result = await handler();
      
      // Assertions
      expect(result.success).toBe(true);
      expect(result.models.length).toBe(2);
      expect(ollamaService.getModels).toHaveBeenCalled();
    });

    it('should handle refineText with specified template', async () => {
      // Setup mock returns
      const mockTemplate = { id: 'template-1', name: 'Test Template', prompt: 'Format: {{text}}' };
      templateManager.getTemplateById.mockReturnValue(mockTemplate);
      
      ollamaService.refineText.mockResolvedValue({
        success: true,
        refinedText: 'Refined text result',
        message: 'Text refined successfully'
      });
      
      // Get the registered handler function
      const handler = refinementHandlers.handleRefineText.bind(refinementHandlers);
      
      // Call the handler
      const result = await handler(eventMock, 'Original text', 'template-1');
      
      // Assertions
      expect(result.success).toBe(true);
      expect(result.refinedText).toBe('Refined text result');
      expect(templateManager.getTemplateById).toHaveBeenCalledWith('template-1');
      expect(ollamaService.refineText).toHaveBeenCalledWith('Original text', 'Format: {{text}}');
      
      // Check that progress updates were sent
      expect(eventMock.sender.send).toHaveBeenCalledWith('refinement:progress', {
        status: 'processing',
        progress: 0,
        message: expect.stringContaining('Test Template')
      });
      
      expect(eventMock.sender.send).toHaveBeenCalledWith('refinement:progress', {
        status: 'completed',
        progress: 100,
        message: 'Text refined successfully'
      });
    });

    it('should handle refineText with default template', async () => {
      // Setup mock returns
      const mockTemplate = { id: 'default-template', name: 'Default Template', prompt: 'Default: {{text}}' };
      templateManager.getTemplateById.mockReturnValue(null); // No specific template
      templateManager.getDefaultTemplate.mockReturnValue(mockTemplate);
      
      ollamaService.refineText.mockResolvedValue({
        success: true,
        refinedText: 'Refined with default',
        message: 'Text refined successfully'
      });
      
      // Get the registered handler function
      const handler = refinementHandlers.handleRefineText.bind(refinementHandlers);
      
      // Call the handler (without templateId)
      const result = await handler(eventMock, 'Original text');
      
      // Assertions
      expect(result.success).toBe(true);
      expect(result.refinedText).toBe('Refined with default');
      expect(templateManager.getDefaultTemplate).toHaveBeenCalled();
      expect(ollamaService.refineText).toHaveBeenCalledWith('Original text', 'Default: {{text}}');
    });

    it('should handle refineText failure - no template', async () => {
      // Setup mock returns - no template found
      templateManager.getTemplateById.mockReturnValue(null);
      templateManager.getDefaultTemplate.mockReturnValue(null);
      
      // Get the registered handler function
      const handler = refinementHandlers.handleRefineText.bind(refinementHandlers);
      
      // Call the handler
      const result = await handler(eventMock, 'Original text');
      
      // Assertions
      expect(result.success).toBe(false);
      expect(result.message).toContain('was not found');
      expect(ollamaService.refineText).not.toHaveBeenCalled();
    });

    it('should handle refineText service failure', async () => {
      // Setup mock returns
      const mockTemplate = { id: 'template-1', name: 'Test Template', prompt: 'Format: {{text}}' };
      templateManager.getTemplateById.mockReturnValue(mockTemplate);
      
      ollamaService.refineText.mockResolvedValue({
        success: false,
        refinedText: null,
        message: 'Service error'
      });
      
      // Get the registered handler function
      const handler = refinementHandlers.handleRefineText.bind(refinementHandlers);
      
      // Call the handler
      const result = await handler(eventMock, 'Original text', 'template-1');
      
      // Assertions
      expect(result.success).toBe(false);
      expect(result.refinedText).toBeNull();
      
      // Check that error progress update was sent
      expect(eventMock.sender.send).toHaveBeenCalledWith('refinement:progress', {
        status: 'error',
        progress: 0,
        message: 'Service error'
      });
    });
  });

  describe('AI refinement settings handlers', () => {
    it('should handle getAIRefinementSettings', async () => {
      // Setup mock return
      const mockSettings = {
        enabled: true,
        endpoint: 'http://localhost:11434',
        model: 'gemma3:12b',
        timeoutSeconds: 30,
        defaultTemplateId: 'template-1'
      };
      config.getAIRefinementSettings.mockReturnValue(mockSettings);
      
      // Get the registered handler function
      const handler = refinementHandlers.handleGetAIRefinementSettings.bind(refinementHandlers);
      
      // Call the handler
      const result = await handler();
      
      // Assertions
      expect(result.success).toBe(true);
      expect(result.settings).toEqual(mockSettings);
      expect(config.getAIRefinementSettings).toHaveBeenCalled();
    });

    it('should handle saveAIRefinementSettings', async () => {
      // Setup mock returns
      const mockSettings = {
        enabled: true,
        model: 'new-model',
        timeoutSeconds: 60
      };
      const updatedSettings = {
        ...mockSettings,
        endpoint: 'http://localhost:11434',
        defaultTemplateId: 'template-1'
      };
      
      config.saveAIRefinementSettings.mockReturnValue(true);
      config.getAIRefinementSettings.mockReturnValue(updatedSettings);
      
      // Get the registered handler function
      const handler = refinementHandlers.handleSaveAIRefinementSettings.bind(refinementHandlers);
      
      // Call the handler
      const result = await handler(eventMock, mockSettings);
      
      // Assertions
      expect(result.success).toBe(true);
      expect(result.changed).toBe(true);
      expect(result.settings).toEqual(updatedSettings);
      expect(config.saveAIRefinementSettings).toHaveBeenCalledWith(mockSettings);
      expect(ollamaService.updateSettings).toHaveBeenCalled();
    });
  });
});
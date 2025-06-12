/**
 * Refinement Handlers - IPC handlers for AI refinement features
 */

const { ipcMain } = require('electron');
const templateManager = require('../services/templateManager');
const ollamaService = require('../services/ollamaService');
const config = require('../config');

class RefinementHandlers {
  constructor() {
    this.setupHandlers();
  }

  setupHandlers() {
    // Template handlers
    ipcMain.handle('template:getAll', this.handleGetAllTemplates.bind(this));
    ipcMain.handle('template:get', this.handleGetTemplate.bind(this));
    ipcMain.handle('template:getDefault', this.handleGetDefaultTemplate.bind(this));
    ipcMain.handle('template:create', this.handleCreateTemplate.bind(this));
    ipcMain.handle('template:update', this.handleUpdateTemplate.bind(this));
    ipcMain.handle('template:delete', this.handleDeleteTemplate.bind(this));
    ipcMain.handle('template:setDefault', this.handleSetDefaultTemplate.bind(this));

    // Ollama handlers
    ipcMain.handle('ollama:testConnection', this.handleTestConnection.bind(this));
    ipcMain.handle('ollama:getModels', this.handleGetModels.bind(this));
    ipcMain.handle('ollama:refineText', this.handleRefineText.bind(this));
    ipcMain.handle('ollama:abortRequest', this.handleAbortRequest.bind(this));
    ipcMain.handle('ollama:abortAllRequests', this.handleAbortAllRequests.bind(this));
    ipcMain.handle('ollama:getActiveRequests', this.handleGetActiveRequests.bind(this));

    // AI Refinement settings handlers
    ipcMain.handle('aiRefinement:getSettings', this.handleGetAIRefinementSettings.bind(this));
    ipcMain.handle('aiRefinement:saveSettings', this.handleSaveAIRefinementSettings.bind(this));
    ipcMain.handle('aiRefinement:debugSettings', this.handleDebugAIRefinementSettings.bind(this));
  }

  // Template handlers
  
  async handleGetAllTemplates() {
    try {
      return {
        success: true,
        templates: templateManager.getAllTemplates()
      };
    } catch (error) {
      console.error('Error getting templates:', error);
      return {
        success: false,
        message: error.message,
        templates: []
      };
    }
  }

  async handleGetTemplate(event, id) {
    try {
      const template = templateManager.getTemplateById(id);
      if (!template) {
        return {
          success: false,
          message: `Template with ID ${id} not found`,
          template: null
        };
      }
      
      return {
        success: true,
        template
      };
    } catch (error) {
      console.error('Error getting template:', error);
      return {
        success: false,
        message: error.message,
        template: null
      };
    }
  }

  async handleGetDefaultTemplate() {
    try {
      const template = templateManager.getDefaultTemplate();
      if (!template) {
        return {
          success: false,
          message: 'No default template found',
          template: null
        };
      }
      
      return {
        success: true,
        template
      };
    } catch (error) {
      console.error('Error getting default template:', error);
      return {
        success: false,
        message: error.message,
        template: null
      };
    }
  }

  async handleCreateTemplate(event, templateData) {
    try {
      const newTemplate = templateManager.createTemplate(templateData);
      return {
        success: true,
        template: newTemplate
      };
    } catch (error) {
      console.error('Error creating template:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  async handleUpdateTemplate(event, id, templateData) {
    try {
      const updatedTemplate = templateManager.updateTemplate(id, templateData);
      if (!updatedTemplate) {
        return {
          success: false,
          message: `Template with ID ${id} not found`
        };
      }
      
      return {
        success: true,
        template: updatedTemplate
      };
    } catch (error) {
      console.error('Error updating template:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  async handleDeleteTemplate(event, id) {
    try {
      const success = templateManager.deleteTemplate(id);
      if (!success) {
        return {
          success: false,
          message: `Template with ID ${id} not found or could not be deleted`
        };
      }
      
      return {
        success: true,
        message: 'Template deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting template:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  async handleSetDefaultTemplate(event, id) {
    try {
      const success = templateManager.setDefaultTemplate(id);
      if (!success) {
        return {
          success: false,
          message: `Template with ID ${id} not found or could not be set as default`
        };
      }
      
      return {
        success: true,
        message: 'Default template set successfully'
      };
    } catch (error) {
      console.error('Error setting default template:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Ollama handlers
  
  async handleTestConnection() {
    try {
      return await ollamaService.testConnection();
    } catch (error) {
      console.error('Error testing Ollama connection:', error);
      return {
        success: false,
        message: error.message,
        models: []
      };
    }
  }

  async handleGetModels() {
    try {
      const models = await ollamaService.getModels();
      return {
        success: true,
        models
      };
    } catch (error) {
      console.error('Error getting Ollama models:', error);
      return {
        success: false,
        message: error.message,
        models: []
      };
    }
  }

  async handleRefineText(event, text, templateId) {
    try {
      // Get the template
      const template = templateId 
        ? templateManager.getTemplateById(templateId) 
        : templateManager.getDefaultTemplate();
        
      if (!template) {
        console.error(`No template found for refinement with ID: ${templateId}`);
        
        // Check if we have any templates at all
        const allTemplates = templateManager.getAllTemplates();
        
        if (allTemplates.length === 0) {
          return {
            success: false,
            message: 'No templates available. Please create a template in Settings.',
            refinedText: null
          };
        } else {
          return {
            success: false,
            message: `Template with ID "${templateId}" was not found. It may have been deleted.`,
            refinedText: null
          };
        }
      }
      
      // Validate template prompt
      if (!template.prompt || template.prompt.trim().length === 0) {
        return {
          success: false,
          message: `Template "${template.name}" has an empty prompt. Please edit the template.`,
          refinedText: null
        };
      }
      
      // Send initial progress update
      event.sender.send('refinement:progress', { 
        status: 'processing', 
        progress: 0,
        message: `Refining text with template: ${template.name}` 
      });
      
      // Refine the text
      const result = await ollamaService.refineText(text, template.prompt);
      
      // If we have an event emitter for streaming results, set up listeners
      if (result.eventEmitter) {
        // Store reference to handler function for proper cleanup
        const progressHandler = (progressData) => {
          // For start event, just forward template information
          if (progressData.type === 'start') {
            event.sender.send('refinement:stream', {
              ...progressData,
              status: 'started',
              templateName: template.name
            });
          }
          // For partial results, send incremental updates
          else if (progressData.type === 'partial') {
            event.sender.send('refinement:stream', {
              ...progressData,
              status: 'streaming',
              templateName: template.name
            });
          }
          // For completion, send final update with all stats
          else if (progressData.type === 'complete') {
            event.sender.send('refinement:stream', {
              ...progressData,
              status: 'completed',
              templateName: template.name
            });
          }
          // Forward error events
          else if (progressData.type === 'error') {
            event.sender.send('refinement:stream', {
              ...progressData,
              status: 'error',
              templateName: template.name
            });
            
            // Also send on the progress channel for redundancy
            event.sender.send('refinement:progress', {
              status: 'error',
              progress: 0,
              message: progressData.message || 'Error during refinement'
            });
          }
          // Forward warning events
          else if (progressData.type === 'warning') {
            event.sender.send('refinement:stream', {
              ...progressData,
              status: 'warning',
              templateName: template.name
            });
          }
        };
        
        // Register the handler
        result.eventEmitter.on('progress', progressHandler);
        
        // Set up a one-time completion listener to clean up
        result.eventEmitter.once('cleanup', () => {
          // Remove listener to prevent memory leaks
          result.eventEmitter.removeListener('progress', progressHandler);
        });
        
        // Clean up the reference to the event emitter in the result
        delete result.eventEmitter;
      }
      else {
        // For non-streaming results or errors, send a completion update
        event.sender.send('refinement:progress', { 
          status: result.success ? 'completed' : 'error',
          progress: result.success ? 100 : 0,
          message: result.message
        });
      }
      
      // If there are stats, include them in the response
      if (result.stats) {
        console.log('Refinement stats:', result.stats);
      }
      
      // Gracefully shut down Ollama service after successful refinement
      console.log('Refinement completed successfully, shutting down Ollama service...');
      try {
        await ollamaService.shutdownOllamaService();
      } catch (shutdownError) {
        console.error('Error shutting down Ollama service:', shutdownError);
      }
      
      return result;
    } catch (error) {
      console.error('Error refining text:', error);
      
      // Send error update
      event.sender.send('refinement:progress', { 
        status: 'error',
        progress: 0,
        message: error.message 
      });
      
      // Also send via stream channel for UI updates
      event.sender.send('refinement:stream', {
        type: 'error',
        status: 'error',
        error: error.message,
        message: `Error during refinement: ${error.message}`
      });
      
      // Gracefully shut down Ollama service even after failed refinement
      console.log('Refinement failed, shutting down Ollama service...');
      try {
        await ollamaService.shutdownOllamaService();
      } catch (shutdownError) {
        console.error('Error shutting down Ollama service after refinement failure:', shutdownError);
      }
      
      return {
        success: false,
        message: error.message,
        refinedText: null,
        error: {
          code: error.code || 'UNKNOWN_ERROR',
          message: error.message || 'Unknown error occurred'
        }
      };
    }
  }

  // AI Refinement settings handlers
  
  async handleGetAIRefinementSettings() {
    try {
      return {
        success: true,
        settings: config.getAIRefinementSettings()
      };
    } catch (error) {
      console.error('Error getting AI refinement settings:', error);
      return {
        success: false,
        message: error.message,
        settings: null
      };
    }
  }

  async handleSaveAIRefinementSettings(event, settings) {
    try {
      console.log('Saving AI refinement settings:', settings);
      
      const changed = config.saveAIRefinementSettings(settings);
      
      // Update Ollama service settings
      ollamaService.updateSettings();
      
      const updatedSettings = config.getAIRefinementSettings();
      console.log('AI refinement settings after save:', updatedSettings);
      
      return {
        success: true,
        changed,
        settings: updatedSettings
      };
    } catch (error) {
      console.error('Error saving AI refinement settings:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
  
  /**
   * Debug AI Refinement settings for troubleshooting
   */
  async handleDebugAIRefinementSettings() {
    try {
      // Get the raw config
      const rawConfig = JSON.stringify(config, null, 2);
      
      // Get the settings from config
      const configSettings = config.getAIRefinementSettings();
      
      // Get the current Ollama service settings
      const ollamaSettings = ollamaService.settings;
      
      // Check if ollamaService has the proper settings
      const ollamaEnabled = ollamaService.settings?.enabled === true;
      
      return {
        success: true,
        rawConfig,
        configSettings,
        ollamaSettings,
        ollamaEnabled,
        message: 'Debug information fetched successfully'
      };
    } catch (error) {
      console.error('Error getting debug settings:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
  
  /**
   * Handle aborting a specific request
   * @param {IpcMainInvokeEvent} event - The IPC event
   * @param {string} requestId - The ID of the request to abort
   * @returns {Object} Result of abort operation
   */
  async handleAbortRequest(event, requestId) {
    try {
      console.log(`Attempting to abort request: ${requestId}`);
      const aborted = ollamaService.abortRequest(requestId);
      
      // If request was aborted, gracefully shut down the Ollama service
      if (aborted) {
        console.log(`Request ${requestId} aborted, shutting down Ollama service...`);
        try {
          await ollamaService.shutdownOllamaService();
        } catch (shutdownError) {
          console.error('Error shutting down Ollama service after request abort:', shutdownError);
        }
      }
      
      return {
        success: true,
        aborted,
        message: aborted 
          ? `Request ${requestId} aborted successfully` 
          : `Request ${requestId} not found or already completed`
      };
    } catch (error) {
      console.error(`Error aborting request ${requestId}:`, error);
      
      // Try to gracefully shut down Ollama service even if abort failed
      try {
        await ollamaService.shutdownOllamaService();
      } catch (shutdownError) {
        console.error('Error shutting down Ollama service after abort failure:', shutdownError);
      }
      
      return {
        success: false,
        message: error.message
      };
    }
  }
  
  /**
   * Handle aborting all active requests
   * @param {IpcMainInvokeEvent} event - The IPC event
   * @returns {Object} Result of abort operation
   */
  async handleAbortAllRequests(event) {
    try {
      // Fix method name (looks like a typo in the original code)
      const count = ollamaService.abortRequest(); // This calls abortRequest with no requestId to abort all
      
      // If any requests were aborted, gracefully shut down the Ollama service
      if (count) {
        console.log(`${count} requests aborted, shutting down Ollama service...`);
        try {
          await ollamaService.shutdownOllamaService();
        } catch (shutdownError) {
          console.error('Error shutting down Ollama service after aborting all requests:', shutdownError);
        }
      }
      
      return {
        success: true,
        count,
        message: count > 0 
          ? `${count} active requests aborted successfully` 
          : 'No active requests to abort'
      };
    } catch (error) {
      console.error('Error aborting all requests:', error);
      
      // Try to gracefully shut down Ollama service even if abort failed
      try {
        await ollamaService.shutdownOllamaService();
      } catch (shutdownError) {
        console.error('Error shutting down Ollama service after abort all failure:', shutdownError);
      }
      
      return {
        success: false,
        message: error.message
      };
    }
  }
  
  /**
   * Get list of active requests
   * @param {IpcMainInvokeEvent} event - The IPC event
   * @returns {Object} List of active request IDs
   */
  async handleGetActiveRequests(event) {
    try {
      const requests = ollamaService.getActiveRequests();
      
      return {
        success: true,
        requests,
        count: requests.length
      };
    } catch (error) {
      console.error('Error getting active requests:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

module.exports = RefinementHandlers;
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

    // AI Refinement settings handlers
    ipcMain.handle('aiRefinement:getSettings', this.handleGetAIRefinementSettings.bind(this));
    ipcMain.handle('aiRefinement:saveSettings', this.handleSaveAIRefinementSettings.bind(this));
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
        return {
          success: false,
          message: 'No template found for refinement',
          refinedText: null
        };
      }
      
      // Send progress update
      event.sender.send('refinement:progress', { 
        status: 'processing', 
        message: `Refining text with template: ${template.name}` 
      });
      
      // Refine the text
      const result = await ollamaService.refineText(text, template.prompt);
      
      // Send completion update
      event.sender.send('refinement:progress', { 
        status: result.success ? 'completed' : 'error', 
        message: result.message 
      });
      
      return result;
    } catch (error) {
      console.error('Error refining text:', error);
      
      // Send error update
      event.sender.send('refinement:progress', { 
        status: 'error', 
        message: error.message 
      });
      
      return {
        success: false,
        message: error.message,
        refinedText: null
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
      const changed = config.saveAIRefinementSettings(settings);
      
      // Update Ollama service settings
      ollamaService.updateSettings();
      
      return {
        success: true,
        changed,
        settings: config.getAIRefinementSettings()
      };
    } catch (error) {
      console.error('Error saving AI refinement settings:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

module.exports = RefinementHandlers;
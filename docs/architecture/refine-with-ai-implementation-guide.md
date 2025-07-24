# Refine with AI - Implementation Guide

This guide provides detailed instructions for implementing the "Refine with AI" feature in the Whisper Wrapper application.

## 1. Configuration Updates

### What to Implement
Extend the existing configuration system to include AI refinement settings.

### How to Implement
1. Update `/src/config.js` to include default AI refinement settings:
   ```javascript
   // Add to defaultConfig
   aiRefinement: {
     enabled: false,
     endpoint: "http://localhost:11434",
     model: "gemma3:12b",
     timeoutSeconds: 30,
     defaultTemplateId: null
   }
   ```

2. Create a new method in the config object to manage AI refinement settings:
   ```javascript
   // Add to config object
   config.getAIRefinementSettings = function() {
     return {
       enabled: this.aiRefinement?.enabled || false,
       endpoint: this.aiRefinement?.endpoint || "http://localhost:11434",
       model: this.aiRefinement?.model || "gemma3:12b",
       timeoutSeconds: this.aiRefinement?.timeoutSeconds || 30,
       defaultTemplateId: this.aiRefinement?.defaultTemplateId || null
     };
   };
   
   config.saveAIRefinementSettings = function(settings) {
     if (!this.aiRefinement) {
       this.aiRefinement = {};
     }
     
     let changed = false;
     
     for (const [key, value] of Object.entries(settings)) {
       if (this.aiRefinement[key] !== value) {
         this.aiRefinement[key] = value;
         changed = true;
       }
     }
     
     if (changed) {
       saveConfig(this);
     }
     
     return changed;
   };
   ```

### Where to Implement
- File: `/src/config.js`

## 2. Template Management

### What to Implement
Create a new service to manage refinement templates.

### How to Implement
1. Create a new file `/src/services/templateManager.js`:
   ```javascript
   /**
    * Template Manager Service
    * Manages AI refinement templates for the application
    */
   
   const fs = require('fs');
   const path = require('path');
   const config = require('../config');
   
   class TemplateManager {
     constructor() {
       this.templatesFilePath = path.join(config.app.dataDirectory, 'templates.json');
       this.templates = [];
       this.loadTemplates();
     }
     
     /**
      * Load templates from file
      */
     loadTemplates() {
       try {
         if (fs.existsSync(this.templatesFilePath)) {
           const fileContent = fs.readFileSync(this.templatesFilePath, 'utf8');
           this.templates = JSON.parse(fileContent);
           console.log(`📝 Loaded ${this.templates.length} templates from ${this.templatesFilePath}`);
         } else {
           console.log(`⚠️ Templates file not found. Creating default templates.`);
           this.createDefaultTemplates();
           this.saveTemplates();
         }
       } catch (error) {
         console.error(`❌ Error loading templates: ${error.message}`);
         this.templates = [];
         this.createDefaultTemplates();
         this.saveTemplates();
       }
       
       return this.templates;
     }
     
     /**
      * Save templates to file
      */
     saveTemplates() {
       try {
         const dataDir = path.dirname(this.templatesFilePath);
         if (!fs.existsSync(dataDir)) {
           fs.mkdirSync(dataDir, { recursive: true });
         }
         
         fs.writeFileSync(this.templatesFilePath, JSON.stringify(this.templates, null, 2), 'utf8');
         console.log(`💾 Templates saved to ${this.templatesFilePath}`);
         return true;
       } catch (error) {
         console.error(`❌ Error saving templates: ${error.message}`);
         return false;
       }
     }
     
     /**
      * Create default templates
      */
     createDefaultTemplates() {
       const now = new Date().toISOString();
       
       this.templates = [
         {
           id: 'format-email',
           name: 'Email Format',
           description: 'Format text as a professional email',
           prompt: 'Format the following transcription as a professional email with proper greeting, paragraphs, and signature:\n\n{{text}}',
           isDefault: true,
           createdAt: now,
           updatedAt: now
         },
         {
           id: 'bullet-points',
           name: 'Bullet Points',
           description: 'Convert text into organized bullet points',
           prompt: 'Convert the following transcription into well-organized bullet points with main topics and subtopics:\n\n{{text}}',
           isDefault: false,
           createdAt: now,
           updatedAt: now
         },
         {
           id: 'grammar-correction',
           name: 'Grammar Correction',
           description: 'Fix grammar and spelling errors',
           prompt: 'Correct any grammar, spelling, or punctuation errors in the following transcription while preserving the original meaning:\n\n{{text}}',
           isDefault: false,
           createdAt: now,
           updatedAt: now
         },
         {
           id: 'meeting-notes',
           name: 'Meeting Notes',
           description: 'Format as structured meeting notes',
           prompt: 'Format the following transcription as structured meeting notes with sections for Attendees, Agenda, Discussion Points, Action Items, and Next Steps:\n\n{{text}}',
           isDefault: false,
           createdAt: now,
           updatedAt: now
         }
       ];
       
       // Set the default template in config
       const defaultTemplate = this.templates.find(t => t.isDefault);
       if (defaultTemplate) {
         config.saveAIRefinementSettings({ defaultTemplateId: defaultTemplate.id });
       }
     }
     
     /**
      * Get all templates
      * @returns {Array} Array of templates
      */
     getAllTemplates() {
       return [...this.templates];
     }
     
     /**
      * Get template by ID
      * @param {string} id Template ID
      * @returns {Object|null} Template object or null if not found
      */
     getTemplateById(id) {
       return this.templates.find(template => template.id === id) || null;
     }
     
     /**
      * Get default template
      * @returns {Object|null} Default template or first template or null
      */
     getDefaultTemplate() {
       const settings = config.getAIRefinementSettings();
       
       // Try to get template by defaultTemplateId from settings
       if (settings.defaultTemplateId) {
         const template = this.getTemplateById(settings.defaultTemplateId);
         if (template) return template;
       }
       
       // Try to get template marked as default
       const defaultTemplate = this.templates.find(t => t.isDefault);
       if (defaultTemplate) return defaultTemplate;
       
       // Return first template or null
       return this.templates.length > 0 ? this.templates[0] : null;
     }
     
     /**
      * Create new template
      * @param {Object} templateData Template data
      * @returns {Object} Created template
      */
     createTemplate(templateData) {
       const now = new Date().toISOString();
       const newTemplate = {
         id: templateData.id || `template-${Date.now()}`,
         name: templateData.name || 'Untitled Template',
         description: templateData.description || '',
         prompt: templateData.prompt || '',
         isDefault: templateData.isDefault || false,
         createdAt: now,
         updatedAt: now
       };
       
       // If this template is set as default, unset default flag on others
       if (newTemplate.isDefault) {
         this.templates.forEach(t => {
           t.isDefault = false;
         });
         
         // Update config with new default template
         config.saveAIRefinementSettings({ defaultTemplateId: newTemplate.id });
       }
       
       this.templates.push(newTemplate);
       this.saveTemplates();
       
       return newTemplate;
     }
     
     /**
      * Update existing template
      * @param {string} id Template ID
      * @param {Object} templateData Updated template data
      * @returns {Object|null} Updated template or null if not found
      */
     updateTemplate(id, templateData) {
       const index = this.templates.findIndex(t => t.id === id);
       if (index === -1) return null;
       
       const now = new Date().toISOString();
       const updatedTemplate = {
         ...this.templates[index],
         name: templateData.name || this.templates[index].name,
         description: templateData.description !== undefined ? templateData.description : this.templates[index].description,
         prompt: templateData.prompt !== undefined ? templateData.prompt : this.templates[index].prompt,
         isDefault: templateData.isDefault !== undefined ? templateData.isDefault : this.templates[index].isDefault,
         updatedAt: now
       };
       
       // If this template is set as default, unset default flag on others
       if (updatedTemplate.isDefault) {
         this.templates.forEach(t => {
           if (t.id !== id) {
             t.isDefault = false;
           }
         });
         
         // Update config with new default template
         config.saveAIRefinementSettings({ defaultTemplateId: updatedTemplate.id });
       }
       
       this.templates[index] = updatedTemplate;
       this.saveTemplates();
       
       return updatedTemplate;
     }
     
     /**
      * Delete template
      * @param {string} id Template ID
      * @returns {boolean} Success status
      */
     deleteTemplate(id) {
       const index = this.templates.findIndex(t => t.id === id);
       if (index === -1) return false;
       
       const wasDefault = this.templates[index].isDefault;
       
       // Remove the template
       this.templates.splice(index, 1);
       
       // If the deleted template was default, set a new default
       if (wasDefault && this.templates.length > 0) {
         this.templates[0].isDefault = true;
         config.saveAIRefinementSettings({ defaultTemplateId: this.templates[0].id });
       }
       
       this.saveTemplates();
       return true;
     }
     
     /**
      * Set default template
      * @param {string} id Template ID
      * @returns {boolean} Success status
      */
     setDefaultTemplate(id) {
       const template = this.getTemplateById(id);
       if (!template) return false;
       
       // Update all templates
       this.templates.forEach(t => {
         t.isDefault = (t.id === id);
       });
       
       // Update config
       config.saveAIRefinementSettings({ defaultTemplateId: id });
       
       this.saveTemplates();
       return true;
     }
   }
   
   module.exports = new TemplateManager();
   ```

### Where to Implement
- File: `/src/services/templateManager.js`

## 3. Ollama Service

### What to Implement
Create a new service to handle communication with the Ollama API.

### How to Implement
1. Create a new file `/src/services/ollamaService.js`:
   ```javascript
   /**
    * Ollama Service
    * Handles communication with Ollama API for AI text refinement
    */
   
   const axios = require('axios');
   const config = require('../config');
   
   class OllamaService {
     constructor() {
       this.settings = config.getAIRefinementSettings();
     }
     
     /**
      * Update service settings
      */
     updateSettings() {
       this.settings = config.getAIRefinementSettings();
     }
     
     /**
      * Test connection to Ollama
      * @returns {Promise<Object>} Connection status
      */
     async testConnection() {
       try {
         const response = await axios({
           method: 'GET',
           url: `${this.settings.endpoint}/api/tags`,
           timeout: this.settings.timeoutSeconds * 1000
         });
         
         return {
           success: true,
           models: response.data.models || [],
           message: 'Successfully connected to Ollama'
         };
       } catch (error) {
         console.error('Ollama connection test failed:', error);
         return {
           success: false,
           models: [],
           message: error.message || 'Failed to connect to Ollama'
         };
       }
     }
     
     /**
      * Get available models from Ollama
      * @returns {Promise<Array>} List of available models
      */
     async getModels() {
       try {
         const response = await axios({
           method: 'GET',
           url: `${this.settings.endpoint}/api/tags`,
           timeout: this.settings.timeoutSeconds * 1000
         });
         
         return response.data.models || [];
       } catch (error) {
         console.error('Failed to get Ollama models:', error);
         return [];
       }
     }
     
     /**
      * Refine text using Ollama
      * @param {string} text Text to refine
      * @param {string} prompt Prompt template
      * @returns {Promise<Object>} Refined text result
      */
     async refineText(text, prompt) {
       if (!this.settings.enabled) {
         return {
           success: false,
           refinedText: text,
           message: 'AI refinement is disabled'
         };
       }
       
       try {
         // Replace {{text}} placeholder in prompt with actual text
         const fullPrompt = prompt.replace('{{text}}', text);
         
         const response = await axios({
           method: 'POST',
           url: `${this.settings.endpoint}/api/generate`,
           timeout: this.settings.timeoutSeconds * 1000,
           data: {
             model: this.settings.model,
             prompt: fullPrompt,
             stream: false
           }
         });
         
         return {
           success: true,
           refinedText: response.data.response,
           message: 'Text successfully refined'
         };
       } catch (error) {
         console.error('Text refinement failed:', error);
         return {
           success: false,
           refinedText: text, // Return original text on error
           message: error.message || 'Failed to refine text'
         };
       }
     }
   }
   
   module.exports = new OllamaService();
   ```

### Where to Implement
- File: `/src/services/ollamaService.js`

## 4. Refinement Controller

### What to Implement
Create a controller to coordinate between UI, services, and data.

### How to Implement
1. Create a new file `/src/renderer/refinementController.js`:
   ```javascript
   /**
    * Refinement Controller
    * Manages the AI refinement workflow and UI interactions
    */
   
   // Import services via IPC or preload
   const { ipcRenderer } = require('electron');
   
   class RefinementController {
     constructor() {
       this.templates = [];
       this.selectedTemplateId = null;
       this.isRefining = false;
       
       // DOM elements - to be initialized after DOM is loaded
       this.templateSelector = null;
       this.refineButton = null;
       this.loadingIndicator = null;
       
       // Initialize
       this.init();
     }
     
     /**
      * Initialize controller
      */
     async init() {
       // Wait for DOM to be fully loaded
       if (document.readyState === 'loading') {
         document.addEventListener('DOMContentLoaded', () => this.initAfterDOMLoaded());
       } else {
         this.initAfterDOMLoaded();
       }
     }
     
     /**
      * Initialize after DOM is loaded
      */
     async initAfterDOMLoaded() {
       // Get settings
       const settings = await ipcRenderer.invoke('get-ai-refinement-settings');
       
       // Load templates
       this.templates = await ipcRenderer.invoke('get-all-templates');
       
       // Set selected template from settings
       this.selectedTemplateId = settings.defaultTemplateId;
       if (!this.selectedTemplateId && this.templates.length > 0) {
         this.selectedTemplateId = this.templates[0].id;
       }
       
       // Initialize UI elements
       this.initUIElements();
       
       // Add event listeners
       this.addEventListeners();
     }
     
     /**
      * Initialize UI elements
      */
     initUIElements() {
       // Create template selector in transcription toolbar
       this.createTemplateSelector();
       
       // Create refine button in transcription actions
       this.createRefineButton();
     }
     
     /**
      * Create template selector
      */
     createTemplateSelector() {
       // Find the transcription toolbar
       const toolbarRight = document.querySelector('.transcription-toolbar .toolbar-right');
       if (!toolbarRight) return;
       
       // Create template selector container
       const selectorContainer = document.createElement('div');
       selectorContainer.className = 'template-selector-container';
       
       // Create label
       const label = document.createElement('label');
       label.textContent = 'AI Template:';
       label.htmlFor = 'template-selector';
       selectorContainer.appendChild(label);
       
       // Create select element
       this.templateSelector = document.createElement('select');
       this.templateSelector.id = 'template-selector';
       this.templateSelector.className = 'template-selector';
       
       // Add templates as options
       this.updateTemplateOptions();
       
       selectorContainer.appendChild(this.templateSelector);
       
       // Insert before the transcription status
       const status = toolbarRight.querySelector('#transcription-status');
       toolbarRight.insertBefore(selectorContainer, status);
     }
     
     /**
      * Update template options in selector
      */
     updateTemplateOptions() {
       if (!this.templateSelector) return;
       
       // Clear existing options
       this.templateSelector.innerHTML = '';
       
       // Add templates as options
       this.templates.forEach(template => {
         const option = document.createElement('option');
         option.value = template.id;
         option.textContent = template.name;
         option.selected = template.id === this.selectedTemplateId;
         this.templateSelector.appendChild(option);
       });
     }
     
     /**
      * Create refine button
      */
     createRefineButton() {
       // Find the transcription actions
       const actions = document.querySelector('.transcription-actions');
       if (!actions) return;
       
       // Create refine button
       this.refineButton = document.createElement('button');
       this.refineButton.id = 'refine-btn';
       this.refineButton.className = 'btn btn-primary';
       this.refineButton.title = 'Refine with AI';
       this.refineButton.innerHTML = '✨ Refine with AI';
       
       // Create loading indicator (hidden by default)
       this.loadingIndicator = document.createElement('div');
       this.loadingIndicator.className = 'refine-loading hidden';
       this.loadingIndicator.innerHTML = '<div class="spinner"></div><span>Refining...</span>';
       
       // Insert before the export dropdown
       const exportDropdown = actions.querySelector('#export-dropdown-btn');
       if (exportDropdown) {
         actions.insertBefore(this.refineButton, exportDropdown);
         actions.insertBefore(this.loadingIndicator, exportDropdown);
       } else {
         actions.appendChild(this.refineButton);
         actions.appendChild(this.loadingIndicator);
       }
     }
     
     /**
      * Add event listeners
      */
     addEventListeners() {
       // Template selector change
       if (this.templateSelector) {
         this.templateSelector.addEventListener('change', (e) => {
           this.selectedTemplateId = e.target.value;
         });
       }
       
       // Refine button click
       if (this.refineButton) {
         this.refineButton.addEventListener('click', () => this.handleRefineClick());
       }
     }
     
     /**
      * Handle refine button click
      */
     async handleRefineClick() {
       if (this.isRefining) return;
       
       // Get current transcription text
       let text;
       const timestampedView = document.querySelector('#transcription-segments');
       const plainTextView = document.querySelector('#transcription-text');
       
       if (timestampedView && !timestampedView.classList.contains('hidden')) {
         // Get text from timestamped view
         text = Array.from(timestampedView.querySelectorAll('.segment-text'))
           .map(el => el.textContent)
           .join(' ');
       } else if (plainTextView && !plainTextView.classList.contains('hidden')) {
         // Get text from plain text view
         text = plainTextView.value;
       } else {
         alert('No transcription text found to refine.');
         return;
       }
       
       if (!text || text.trim() === '') {
         alert('No transcription text found to refine.');
         return;
       }
       
       // Get selected template
       if (!this.selectedTemplateId) {
         alert('Please select a template for refinement.');
         return;
       }
       
       const template = this.templates.find(t => t.id === this.selectedTemplateId);
       if (!template) {
         alert('Selected template not found.');
         return;
       }
       
       // Show loading state
       this.setRefiningState(true);
       
       try {
         // Call refine API
         const result = await ipcRenderer.invoke('refine-text', {
           text,
           templateId: this.selectedTemplateId
         });
         
         if (result.success) {
           // Update transcription with refined text
           if (plainTextView && !plainTextView.classList.contains('hidden')) {
             plainTextView.value = result.refinedText;
             
             // Trigger input event to save changes
             const event = new Event('input', { bubbles: true });
             plainTextView.dispatchEvent(event);
           } else {
             // If in timestamped view, switch to plain text view and update
             if (timestampedView) {
               timestampedView.classList.add('hidden');
             }
             if (plainTextView) {
               plainTextView.classList.remove('hidden');
               plainTextView.value = result.refinedText;
               
               // Trigger input event to save changes
               const event = new Event('input', { bubbles: true });
               plainTextView.dispatchEvent(event);
               
               // Update toggle button text if it exists
               const toggleBtn = document.querySelector('#toggle-view-btn');
               if (toggleBtn) {
                 toggleBtn.innerHTML = '🕒 Timestamped View';
               }
             }
           }
         } else {
           alert(`Refinement failed: ${result.message}`);
         }
       } catch (error) {
         console.error('Refinement error:', error);
         alert(`Refinement error: ${error.message || 'Unknown error'}`);
       } finally {
         // Hide loading state
         this.setRefiningState(false);
       }
     }
     
     /**
      * Set refining state
      * @param {boolean} isRefining Whether refinement is in progress
      */
     setRefiningState(isRefining) {
       this.isRefining = isRefining;
       
       if (this.refineButton) {
         this.refineButton.disabled = isRefining;
       }
       
       if (this.loadingIndicator) {
         if (isRefining) {
           this.loadingIndicator.classList.remove('hidden');
         } else {
           this.loadingIndicator.classList.add('hidden');
         }
       }
     }
   }
   
   // Initialize controller
   const refinementController = new RefinementController();
   
   // Export for testing
   if (typeof module !== 'undefined') {
     module.exports = refinementController;
   }
   ```

### Where to Implement
- File: `/src/renderer/refinementController.js`

## 5. Main Process IPC Handlers

### What to Implement
Add IPC handlers in the main process to bridge between renderer and services.

### How to Implement
1. Create a new file `/src/main/refinementHandlers.js`:
   ```javascript
   /**
    * Refinement IPC Handlers
    * Handles IPC communication for AI refinement features
    */
   
   const { ipcMain } = require('electron');
   const config = require('../config');
   const templateManager = require('../services/templateManager');
   const ollamaService = require('../services/ollamaService');
   
   /**
    * Register all IPC handlers for refinement
    */
   function registerRefinementHandlers() {
     // Get AI refinement settings
     ipcMain.handle('get-ai-refinement-settings', () => {
       return config.getAIRefinementSettings();
     });
     
     // Save AI refinement settings
     ipcMain.handle('save-ai-refinement-settings', (event, settings) => {
       return config.saveAIRefinementSettings(settings);
     });
     
     // Test Ollama connection
     ipcMain.handle('test-ollama-connection', async () => {
       ollamaService.updateSettings();
       return await ollamaService.testConnection();
     });
     
     // Get Ollama models
     ipcMain.handle('get-ollama-models', async () => {
       ollamaService.updateSettings();
       return await ollamaService.getModels();
     });
     
     // Get all templates
     ipcMain.handle('get-all-templates', () => {
       return templateManager.getAllTemplates();
     });
     
     // Get template by ID
     ipcMain.handle('get-template-by-id', (event, id) => {
       return templateManager.getTemplateById(id);
     });
     
     // Get default template
     ipcMain.handle('get-default-template', () => {
       return templateManager.getDefaultTemplate();
     });
     
     // Create template
     ipcMain.handle('create-template', (event, templateData) => {
       return templateManager.createTemplate(templateData);
     });
     
     // Update template
     ipcMain.handle('update-template', (event, id, templateData) => {
       return templateManager.updateTemplate(id, templateData);
     });
     
     // Delete template
     ipcMain.handle('delete-template', (event, id) => {
       return templateManager.deleteTemplate(id);
     });
     
     // Set default template
     ipcMain.handle('set-default-template', (event, id) => {
       return templateManager.setDefaultTemplate(id);
     });
     
     // Refine text
     ipcMain.handle('refine-text', async (event, { text, templateId }) => {
       ollamaService.updateSettings();
       
       // Get template
       const template = templateManager.getTemplateById(templateId);
       if (!template) {
         return {
           success: false,
           refinedText: text,
           message: 'Template not found'
         };
       }
       
       // Refine text
       return await ollamaService.refineText(text, template.prompt);
     });
   }
   
   module.exports = { registerRefinementHandlers };
   ```

2. Update `/src/main/index.js` to register the handlers:
   ```javascript
   // Add this import
   const { registerRefinementHandlers } = require('./refinementHandlers');
   
   // Add this line in the app.whenReady() callback
   registerRefinementHandlers();
   ```

### Where to Implement
- File: `/src/main/refinementHandlers.js`
- File: `/src/main/index.js` (update)

## 6. Settings UI Updates

### What to Implement
Update the settings panel to include AI refinement settings.

### How to Implement
1. Add AI refinement settings to the settings panel in `/src/renderer/index.html`:
   ```html
   <!-- Add this after the Prompt Settings card in the settings-grid -->
   <div class="settings-card ai-card">
     <h4 class="settings-card-title">AI Refinement</h4>
     
     <div class="form-group">
       <div class="checkbox-container">
         <input type="checkbox" id="enable-ai-refinement-checkbox" class="styled-checkbox">
         <label for="enable-ai-refinement-checkbox">Enable AI Refinement</label>
       </div>
       <div class="form-text">Use AI to refine and format transcriptions</div>
     </div>
     
     <div class="form-group">
       <label for="ollama-endpoint">Ollama Endpoint</label>
       <input type="text" id="ollama-endpoint" class="form-control" placeholder="http://localhost:11434">
       <div class="form-text">URL of your local Ollama instance</div>
     </div>
     
     <div class="form-group">
       <label for="ollama-model">Ollama Model</label>
       <input type="text" id="ollama-model" class="form-control" placeholder="gemma3:12b">
       <div class="form-text">Name of the model to use (must be available in Ollama)</div>
     </div>
     
     <div class="form-group">
       <label for="ollama-timeout">Request Timeout (seconds)</label>
       <input type="number" id="ollama-timeout" class="form-control" min="5" max="300" value="30">
       <div class="form-text">Maximum time to wait for AI response</div>
     </div>
     
     <div class="form-group">
       <button id="test-ollama-btn" class="btn btn-secondary">Test Connection</button>
       <button id="manage-templates-btn" class="btn btn-primary">Manage Templates</button>
     </div>
     
     <div id="ollama-status" class="status-indicator">
       <span id="ollama-status-text">Not tested</span>
     </div>
   </div>
   ```

2. Update the settings JavaScript code to handle AI refinement settings:
   ```javascript
   // Add to the existing settings.js or index.js where settings are handled
   
   // AI Refinement settings elements
   const enableAIRefinementCheckbox = document.getElementById('enable-ai-refinement-checkbox');
   const ollamaEndpointInput = document.getElementById('ollama-endpoint');
   const ollamaModelInput = document.getElementById('ollama-model');
   const ollamaTimeoutInput = document.getElementById('ollama-timeout');
   const testOllamaBtn = document.getElementById('test-ollama-btn');
   const manageTemplatesBtn = document.getElementById('manage-templates-btn');
   const ollamaStatusText = document.getElementById('ollama-status-text');
   
   // Load AI refinement settings
   async function loadAIRefinementSettings() {
     const settings = await ipcRenderer.invoke('get-ai-refinement-settings');
     
     enableAIRefinementCheckbox.checked = settings.enabled;
     ollamaEndpointInput.value = settings.endpoint;
     ollamaModelInput.value = settings.model;
     ollamaTimeoutInput.value = settings.timeoutSeconds;
   }
   
   // Save AI refinement settings
   async function saveAIRefinementSettings() {
     const settings = {
       enabled: enableAIRefinementCheckbox.checked,
       endpoint: ollamaEndpointInput.value,
       model: ollamaModelInput.value,
       timeoutSeconds: parseInt(ollamaTimeoutInput.value, 10)
     };
     
     await ipcRenderer.invoke('save-ai-refinement-settings', settings);
   }
   
   // Test Ollama connection
   testOllamaBtn.addEventListener('click', async () => {
     testOllamaBtn.disabled = true;
     ollamaStatusText.textContent = 'Testing connection...';
     
     try {
       const result = await ipcRenderer.invoke('test-ollama-connection');
       
       if (result.success) {
         ollamaStatusText.textContent = `Connected successfully. ${result.models.length} models available.`;
         ollamaStatusText.className = 'status-success';
       } else {
         ollamaStatusText.textContent = `Connection failed: ${result.message}`;
         ollamaStatusText.className = 'status-error';
       }
     } catch (error) {
       ollamaStatusText.textContent = `Error: ${error.message || 'Unknown error'}`;
       ollamaStatusText.className = 'status-error';
     } finally {
       testOllamaBtn.disabled = false;
     }
   });
   
   // Add to existing save settings function
   saveSettingsBtn.addEventListener('click', async () => {
     // Existing settings save code...
     
     // Save AI refinement settings
     await saveAIRefinementSettings();
     
     // Rest of existing code...
   });
   
   // Add to existing load settings function
   async function loadSettings() {
     // Existing settings load code...
     
     // Load AI refinement settings
     await loadAIRefinementSettings();
     
     // Rest of existing code...
   }
   ```

### Where to Implement
- File: `/src/renderer/index.html` (update)
- File: `/src/renderer/index.js` or appropriate settings JS file (update)

## 7. Template Management Modal

### What to Implement
Create a modal dialog for managing templates.

### How to Implement
1. Add the template management modal HTML to `/src/renderer/index.html`:
   ```html
   <!-- Add this at the end of the body, before closing body tag -->
   <div id="template-modal" class="modal hidden">
     <div class="modal-content">
       <div class="modal-header">
         <h3>Manage AI Refinement Templates</h3>
         <button id="close-template-modal-btn" class="btn-icon">✕</button>
       </div>
       
       <div class="modal-body">
         <div class="templates-list-container">
           <div class="templates-header">
             <h4>Available Templates</h4>
             <button id="add-template-btn" class="btn btn-primary">+ Add Template</button>
           </div>
           
           <div id="templates-list" class="templates-list">
             <!-- Templates will be populated here -->
           </div>
         </div>
         
         <div id="template-form" class="template-form hidden">
           <h4 id="template-form-title">Add New Template</h4>
           
           <div class="form-group">
             <label for="template-name">Template Name</label>
             <input type="text" id="template-name" class="form-control" placeholder="Enter template name">
           </div>
           
           <div class="form-group">
             <label for="template-description">Description (optional)</label>
             <input type="text" id="template-description" class="form-control" placeholder="Enter description">
           </div>
           
           <div class="form-group">
             <label for="template-prompt">Prompt Template</label>
             <textarea id="template-prompt" class="form-control" rows="6" placeholder="Enter prompt template. Use {{text}} as placeholder for transcription text."></textarea>
             <div class="form-text">Use {{text}} where you want the transcription to be inserted.</div>
           </div>
           
           <div class="form-group">
             <div class="checkbox-container">
               <input type="checkbox" id="template-default" class="styled-checkbox">
               <label for="template-default">Set as default template</label>
             </div>
           </div>
           
           <div class="template-form-actions">
             <button id="save-template-btn" class="btn btn-primary">Save Template</button>
             <button id="cancel-template-btn" class="btn btn-secondary">Cancel</button>
           </div>
         </div>
       </div>
     </div>
   </div>
   ```

2. Add CSS for the template modal to `/src/renderer/styles/main.css`:
   ```css
   /* Template Modal Styles */
   .modal {
     position: fixed;
     top: 0;
     left: 0;
     width: 100%;
     height: 100%;
     background-color: rgba(0, 0, 0, 0.5);
     display: flex;
     justify-content: center;
     align-items: center;
     z-index: 1000;
   }
   
   .modal.hidden {
     display: none;
   }
   
   .modal-content {
     background-color: #fff;
     border-radius: 8px;
     box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
     width: 80%;
     max-width: 800px;
     max-height: 90vh;
     overflow-y: auto;
   }
   
   .modal-header {
     display: flex;
     justify-content: space-between;
     align-items: center;
     padding: 16px 20px;
     border-bottom: 1px solid #eee;
   }
   
   .modal-body {
     padding: 20px;
   }
   
   /* Templates List */
   .templates-header {
     display: flex;
     justify-content: space-between;
     align-items: center;
     margin-bottom: 16px;
   }
   
   .templates-list {
     border: 1px solid #eee;
     border-radius: 4px;
     max-height: 300px;
     overflow-y: auto;
   }
   
   .template-item {
     padding: 12px 16px;
     border-bottom: 1px solid #eee;
     display: flex;
     justify-content: space-between;
     align-items: center;
   }
   
   .template-item:last-child {
     border-bottom: none;
   }
   
   .template-info {
     flex: 1;
   }
   
   .template-name {
     font-weight: bold;
     margin-bottom: 4px;
   }
   
   .template-description {
     font-size: 0.9em;
     color: #666;
   }
   
   .template-actions {
     display: flex;
     gap: 8px;
   }
   
   .template-default-badge {
     background-color: #4caf50;
     color: white;
     padding: 2px 6px;
     border-radius: 4px;
     font-size: 0.8em;
     margin-left: 8px;
   }
   
   /* Template Form */
   .template-form {
     border: 1px solid #eee;
     border-radius: 4px;
     padding: 16px;
     margin-top: 20px;
   }
   
   .template-form.hidden {
     display: none;
   }
   
   .template-form-actions {
     display: flex;
     justify-content: flex-end;
     gap: 8px;
     margin-top: 16px;
   }
   
   /* Refinement UI in Transcription Tab */
   .template-selector-container {
     display: flex;
     align-items: center;
     margin-right: 16px;
   }
   
   .template-selector-container label {
     margin-right: 8px;
     white-space: nowrap;
   }
   
   .template-selector {
     min-width: 150px;
   }
   
   .refine-loading {
     display: flex;
     align-items: center;
     margin-right: 16px;
   }
   
   .refine-loading .spinner {
     width: 16px;
     height: 16px;
     margin-right: 8px;
   }
   
   .refine-loading.hidden {
     display: none;
   }
   ```

3. Add JavaScript for the template modal:
   ```javascript
   // Add to the existing index.js or create a new templateModal.js file
   
   // Template modal elements
   const templateModal = document.getElementById('template-modal');
   const closeTemplateModalBtn = document.getElementById('close-template-modal-btn');
   const addTemplateBtn = document.getElementById('add-template-btn');
   const templatesList = document.getElementById('templates-list');
   const templateForm = document.getElementById('template-form');
   const templateFormTitle = document.getElementById('template-form-title');
   const templateNameInput = document.getElementById('template-name');
   const templateDescriptionInput = document.getElementById('template-description');
   const templatePromptInput = document.getElementById('template-prompt');
   const templateDefaultCheckbox = document.getElementById('template-default');
   const saveTemplateBtn = document.getElementById('save-template-btn');
   const cancelTemplateBtn = document.getElementById('cancel-template-btn');
   
   // Template management state
   let templates = [];
   let editingTemplateId = null;
   
   // Open template modal
   manageTemplatesBtn.addEventListener('click', () => {
     openTemplateModal();
   });
   
   // Close template modal
   closeTemplateModalBtn.addEventListener('click', () => {
     templateModal.classList.add('hidden');
   });
   
   // Open template modal and load templates
   async function openTemplateModal() {
     // Load templates
     templates = await ipcRenderer.invoke('get-all-templates');
     
     // Render templates list
     renderTemplatesList();
     
     // Hide form initially
     templateForm.classList.add('hidden');
     
     // Show modal
     templateModal.classList.remove('hidden');
   }
   
   // Render templates list
   function renderTemplatesList() {
     templatesList.innerHTML = '';
     
     if (templates.length === 0) {
       templatesList.innerHTML = '<div class="empty-state">No templates found. Click "Add Template" to create one.</div>';
       return;
     }
     
     templates.forEach(template => {
       const templateItem = document.createElement('div');
       templateItem.className = 'template-item';
       
       const templateInfo = document.createElement('div');
       templateInfo.className = 'template-info';
       
       const templateName = document.createElement('div');
       templateName.className = 'template-name';
       templateName.textContent = template.name;
       
       if (template.isDefault) {
         const defaultBadge = document.createElement('span');
         defaultBadge.className = 'template-default-badge';
         defaultBadge.textContent = 'Default';
         templateName.appendChild(defaultBadge);
       }
       
       const templateDescription = document.createElement('div');
       templateDescription.className = 'template-description';
       templateDescription.textContent = template.description || 'No description';
       
       templateInfo.appendChild(templateName);
       templateInfo.appendChild(templateDescription);
       
       const templateActions = document.createElement('div');
       templateActions.className = 'template-actions';
       
       const editBtn = document.createElement('button');
       editBtn.className = 'btn btn-small';
       editBtn.textContent = 'Edit';
       editBtn.addEventListener('click', () => editTemplate(template.id));
       
       const deleteBtn = document.createElement('button');
       deleteBtn.className = 'btn btn-small btn-danger';
       deleteBtn.textContent = 'Delete';
       deleteBtn.addEventListener('click', () => deleteTemplate(template.id));
       
       const setDefaultBtn = document.createElement('button');
       setDefaultBtn.className = 'btn btn-small btn-primary';
       setDefaultBtn.textContent = 'Set as Default';
       setDefaultBtn.disabled = template.isDefault;
       setDefaultBtn.addEventListener('click', () => setDefaultTemplate(template.id));
       
       templateActions.appendChild(editBtn);
       templateActions.appendChild(deleteBtn);
       
       if (!template.isDefault) {
         templateActions.appendChild(setDefaultBtn);
       }
       
       templateItem.appendChild(templateInfo);
       templateItem.appendChild(templateActions);
       
       templatesList.appendChild(templateItem);
     });
   }
   
   // Add new template
   addTemplateBtn.addEventListener('click', () => {
     // Reset form
     templateFormTitle.textContent = 'Add New Template';
     templateNameInput.value = '';
     templateDescriptionInput.value = '';
     templatePromptInput.value = '';
     templateDefaultCheckbox.checked = false;
     editingTemplateId = null;
     
     // Show form
     templateForm.classList.remove('hidden');
   });
   
   // Cancel template form
   cancelTemplateBtn.addEventListener('click', () => {
     templateForm.classList.add('hidden');
   });
   
   // Save template
   saveTemplateBtn.addEventListener('click', async () => {
     // Validate form
     if (!templateNameInput.value) {
       alert('Please enter a template name');
       return;
     }
     
     if (!templatePromptInput.value) {
       alert('Please enter a prompt template');
       return;
     }
     
     if (!templatePromptInput.value.includes('{{text}}')) {
       alert('Prompt template must include {{text}} placeholder');
       return;
     }
     
     // Prepare template data
     const templateData = {
       name: templateNameInput.value,
       description: templateDescriptionInput.value,
       prompt: templatePromptInput.value,
       isDefault: templateDefaultCheckbox.checked
     };
     
     try {
       if (editingTemplateId) {
         // Update existing template
         await ipcRenderer.invoke('update-template', editingTemplateId, templateData);
       } else {
         // Create new template
         await ipcRenderer.invoke('create-template', templateData);
       }
       
       // Reload templates
       templates = await ipcRenderer.invoke('get-all-templates');
       
       // Render templates list
       renderTemplatesList();
       
       // Hide form
       templateForm.classList.add('hidden');
     } catch (error) {
       alert(`Error saving template: ${error.message || 'Unknown error'}`);
     }
   });
   
   // Edit template
   async function editTemplate(id) {
     const template = templates.find(t => t.id === id);
     if (!template) return;
     
     // Set form values
     templateFormTitle.textContent = 'Edit Template';
     templateNameInput.value = template.name;
     templateDescriptionInput.value = template.description || '';
     templatePromptInput.value = template.prompt;
     templateDefaultCheckbox.checked = template.isDefault;
     editingTemplateId = template.id;
     
     // Show form
     templateForm.classList.remove('hidden');
   }
   
   // Delete template
   async function deleteTemplate(id) {
     if (!confirm('Are you sure you want to delete this template?')) return;
     
     try {
       await ipcRenderer.invoke('delete-template', id);
       
       // Reload templates
       templates = await ipcRenderer.invoke('get-all-templates');
       
       // Render templates list
       renderTemplatesList();
     } catch (error) {
       alert(`Error deleting template: ${error.message || 'Unknown error'}`);
     }
   }
   
   // Set default template
   async function setDefaultTemplate(id) {
     try {
       await ipcRenderer.invoke('set-default-template', id);
       
       // Reload templates
       templates = await ipcRenderer.invoke('get-all-templates');
       
       // Render templates list
       renderTemplatesList();
     } catch (error) {
       alert(`Error setting default template: ${error.message || 'Unknown error'}`);
     }
   }
   ```

### Where to Implement
- File: `/src/renderer/index.html` (update)
- File: `/src/renderer/styles/main.css` (update)
- File: `/src/renderer/index.js` or new file `/src/renderer/templateModal.js` (create)

## 8. Integration with Transcription Tab

### What to Implement
Integrate the refinement controller with the transcription tab.

### How to Implement
1. Update `/src/renderer/index.html` to include the refinement controller script:
   ```html
   <!-- Add this before the closing body tag -->
   <script src="refinementController.js"></script>
   ```

2. Add CSS for the refinement UI in the transcription tab to `/src/renderer/styles/main.css`:
   ```css
   /* Add to existing CSS */
   
   /* Refine button */
   #refine-btn {
     margin-right: 8px;
   }
   
   /* Loading indicator */
   .refine-loading {
     display: flex;
     align-items: center;
     margin-right: 8px;
   }
   
   .refine-loading .spinner {
     width: 16px;
     height: 16px;
     border: 2px solid #f3f3f3;
     border-top: 2px solid #3498db;
     border-radius: 50%;
     animation: spin 1s linear infinite;
     margin-right: 8px;
   }
   
   @keyframes spin {
     0% { transform: rotate(0deg); }
     100% { transform: rotate(360deg); }
   }
   ```

### Where to Implement
- File: `/src/renderer/index.html` (update)
- File: `/src/renderer/styles/main.css` (update)

## 9. Testing

### What to Implement
Create tests for the new components.

### How to Implement
1. Create a test file for the template manager:
   ```javascript
   // /tests/unit/templateManager.test.js
   
   const path = require('path');
   const fs = require('fs');
   const templateManager = require('../../src/services/templateManager');
   
   // Mock config
   jest.mock('../../src/config', () => ({
     app: {
       dataDirectory: path.join(__dirname, '../fixtures/data')
     },
     getAIRefinementSettings: jest.fn().mockReturnValue({
       defaultTemplateId: null
     }),
     saveAIRefinementSettings: jest.fn()
   }));
   
   describe('TemplateManager', () => {
     const testTemplatesPath = path.join(__dirname, '../fixtures/data/templates.json');
     
     beforeEach(() => {
       // Ensure test directory exists
       const dir = path.dirname(testTemplatesPath);
       if (!fs.existsSync(dir)) {
         fs.mkdirSync(dir, { recursive: true });
       }
       
       // Reset templates file
       if (fs.existsSync(testTemplatesPath)) {
         fs.unlinkSync(testTemplatesPath);
       }
       
       // Reset templates in memory
       templateManager.templates = [];
     });
     
     afterAll(() => {
       // Clean up
       if (fs.existsSync(testTemplatesPath)) {
         fs.unlinkSync(testTemplatesPath);
       }
     });
     
     test('should create default templates when none exist', () => {
       templateManager.loadTemplates();
       expect(templateManager.templates.length).toBeGreaterThan(0);
       expect(templateManager.templates[0].name).toBeDefined();
     });
     
     test('should create a new template', () => {
       const template = templateManager.createTemplate({
         name: 'Test Template',
         description: 'Test Description',
         prompt: 'Test prompt with {{text}} placeholder',
         isDefault: true
       });
       
       expect(template.id).toBeDefined();
       expect(template.name).toBe('Test Template');
       expect(template.description).toBe('Test Description');
       expect(template.prompt).toBe('Test prompt with {{text}} placeholder');
       expect(template.isDefault).toBe(true);
     });
     
     test('should update an existing template', () => {
       // Create a template first
       const template = templateManager.createTemplate({
         name: 'Original Name',
         description: 'Original Description',
         prompt: 'Original prompt with {{text}} placeholder',
         isDefault: false
       });
       
       // Update it
       const updated = templateManager.updateTemplate(template.id, {
         name: 'Updated Name',
         description: 'Updated Description',
         prompt: 'Updated prompt with {{text}} placeholder',
         isDefault: true
       });
       
       expect(updated.id).toBe(template.id);
       expect(updated.name).toBe('Updated Name');
       expect(updated.description).toBe('Updated Description');
       expect(updated.prompt).toBe('Updated prompt with {{text}} placeholder');
       expect(updated.isDefault).toBe(true);
     });
     
     test('should delete a template', () => {
       // Create a template first
       const template = templateManager.createTemplate({
         name: 'Template to Delete',
         description: 'Will be deleted',
         prompt: 'Delete me {{text}}',
         isDefault: false
       });
       
       const initialCount = templateManager.templates.length;
       
       // Delete it
       const result = templateManager.deleteTemplate(template.id);
       
       expect(result).toBe(true);
       expect(templateManager.templates.length).toBe(initialCount - 1);
       expect(templateManager.getTemplateById(template.id)).toBeNull();
     });
     
     test('should set a template as default', () => {
       // Create two templates
       const template1 = templateManager.createTemplate({
         name: 'Template 1',
         prompt: 'Prompt 1 {{text}}',
         isDefault: false
       });
       
       const template2 = templateManager.createTemplate({
         name: 'Template 2',
         prompt: 'Prompt 2 {{text}}',
         isDefault: false
       });
       
       // Set template2 as default
       const result = templateManager.setDefaultTemplate(template2.id);
       
       expect(result).toBe(true);
       
       // Reload templates to verify
       templateManager.loadTemplates();
       
       const reloadedTemplate1 = templateManager.getTemplateById(template1.id);
       const reloadedTemplate2 = templateManager.getTemplateById(template2.id);
       
       expect(reloadedTemplate1.isDefault).toBe(false);
       expect(reloadedTemplate2.isDefault).toBe(true);
     });
   });
   ```

2. Create a test file for the Ollama service:
   ```javascript
   // /tests/unit/ollamaService.test.js
   
   const axios = require('axios');
   const ollamaService = require('../../src/services/ollamaService');
   
   // Mock axios
   jest.mock('axios');
   
   // Mock config
   jest.mock('../../src/config', () => ({
     getAIRefinementSettings: jest.fn().mockReturnValue({
       enabled: true,
       endpoint: 'http://localhost:11434',
       model: 'test-model',
       timeoutSeconds: 10
     })
   }));
   
   describe('OllamaService', () => {
     beforeEach(() => {
       jest.clearAllMocks();
       ollamaService.updateSettings();
     });
     
     test('should test connection successfully', async () => {
       axios.mockResolvedValueOnce({
         data: {
           models: ['model1', 'model2']
         }
       });
       
       const result = await ollamaService.testConnection();
       
       expect(result.success).toBe(true);
       expect(result.models).toEqual(['model1', 'model2']);
       expect(axios).toHaveBeenCalledWith({
         method: 'GET',
         url: 'http://localhost:11434/api/tags',
         timeout: 10000
       });
     });
     
     test('should handle connection test failure', async () => {
       axios.mockRejectedValueOnce(new Error('Connection failed'));
       
       const result = await ollamaService.testConnection();
       
       expect(result.success).toBe(false);
       expect(result.message).toBe('Connection failed');
     });
     
     test('should get models successfully', async () => {
       axios.mockResolvedValueOnce({
         data: {
           models: ['model1', 'model2']
         }
       });
       
       const models = await ollamaService.getModels();
       
       expect(models).toEqual(['model1', 'model2']);
     });
     
     test('should refine text successfully', async () => {
       axios.mockResolvedValueOnce({
         data: {
           response: 'Refined text'
         }
       });
       
       const result = await ollamaService.refineText('Original text', 'Refine this: {{text}}');
       
       expect(result.success).toBe(true);
       expect(result.refinedText).toBe('Refined text');
       expect(axios).toHaveBeenCalledWith({
         method: 'POST',
         url: 'http://localhost:11434/api/generate',
         timeout: 10000,
         data: {
           model: 'test-model',
           prompt: 'Refine this: Original text',
           stream: false
         }
       });
     });
     
     test('should handle refinement failure', async () => {
       axios.mockRejectedValueOnce(new Error('Refinement failed'));
       
       const result = await ollamaService.refineText('Original text', 'Refine this: {{text}}');
       
       expect(result.success).toBe(false);
       expect(result.refinedText).toBe('Original text'); // Should return original text on error
       expect(result.message).toBe('Refinement failed');
     });
     
     test('should not refine when disabled', async () => {
       // Mock config to return disabled
       require('../../src/config').getAIRefinementSettings.mockReturnValueOnce({
         enabled: false,
         endpoint: 'http://localhost:11434',
         model: 'test-model',
         timeoutSeconds: 10
       });
       
       ollamaService.updateSettings();
       
       const result = await ollamaService.refineText('Original text', 'Refine this: {{text}}');
       
       expect(result.success).toBe(false);
       expect(result.refinedText).toBe('Original text');
       expect(result.message).toBe('AI refinement is disabled');
       expect(axios).not.toHaveBeenCalled();
     });
   });
   ```

### Where to Implement
- File: `/tests/unit/templateManager.test.js`
- File: `/tests/unit/ollamaService.test.js`
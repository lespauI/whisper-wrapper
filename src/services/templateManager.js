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
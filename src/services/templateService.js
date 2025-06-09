/**
 * Template Service - Manages refinement templates
 */

const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const { v4: uuidv4 } = require('uuid');

class TemplateService {
    constructor() {
        console.log('🎯 TemplateService: Initializing...');
        this.templatesPath = path.join(config.app.dataDirectory, 'templates.json');
        this.templates = [];
        this.settings = {
            ollamaEndpoint: 'http://localhost:11434',
            defaultModel: 'llama3:latest',
            timeoutSeconds: 30
        };
        
        // Initialize templates
        this.initialize();
    }

    /**
     * Initialize the template service
     */
    async initialize() {
        try {
            // Ensure data directory exists
            await fs.mkdir(config.app.dataDirectory, { recursive: true });
            
            // Load templates from file or create default templates
            try {
                await this.loadTemplates();
                console.log(`✅ TemplateService: Loaded ${this.templates.length} templates`);
            } catch (error) {
                console.log('⚠️ TemplateService: Could not load templates, creating default templates');
                await this.createDefaultTemplates();
                console.log(`✅ TemplateService: Created default templates`);
            }
        } catch (error) {
            console.error('❌ TemplateService: Initialization error:', error);
        }
    }

    /**
     * Load templates from file
     */
    async loadTemplates() {
        const data = await fs.readFile(this.templatesPath, 'utf8');
        const parsed = JSON.parse(data);
        this.templates = parsed.templates || [];
        this.settings = parsed.settings || this.settings;
    }

    /**
     * Save templates to file
     */
    async saveTemplates() {
        const data = JSON.stringify({
            templates: this.templates,
            settings: this.settings
        }, null, 2);
        await fs.writeFile(this.templatesPath, data, 'utf8');
    }

    /**
     * Create default templates
     */
    async createDefaultTemplates() {
        this.templates = [
            {
                id: 'email-format',
                name: 'Email Format',
                description: 'Formats transcription as a professional email',
                prompt: 'Reformat the following transcription as a professional email. Correct grammar and punctuation: {{transcription}}',
                isActive: true
            },
            {
                id: 'bullet-points',
                name: 'Bullet Points',
                description: 'Converts transcription into bullet point format',
                prompt: 'Convert the following transcription into concise bullet points, highlighting key information: {{transcription}}',
                isActive: true
            },
            {
                id: 'meeting-notes',
                name: 'Meeting Notes',
                description: 'Formats as structured meeting notes with action items',
                prompt: 'Format the following transcription as meeting notes. Include sections for Discussion, Decisions, and Action Items: {{transcription}}',
                isActive: true
            }
        ];
        
        this.settings = {
            ollamaEndpoint: 'http://localhost:11434',
            defaultModel: 'llama3:latest',
            timeoutSeconds: 30
        };
        
        await this.saveTemplates();
    }

    /**
     * Get all templates
     * @returns {Array} - All templates
     */
    async getAllTemplates() {
        if (this.templates.length === 0) {
            await this.loadTemplates();
        }
        return this.templates;
    }

    /**
     * Get active templates
     * @returns {Array} - Active templates
     */
    async getActiveTemplates() {
        if (this.templates.length === 0) {
            await this.loadTemplates();
        }
        return this.templates.filter(template => template.isActive);
    }

    /**
     * Get template by ID
     * @param {string} id - Template ID
     * @returns {Object} - Template object
     */
    async getTemplateById(id) {
        if (this.templates.length === 0) {
            await this.loadTemplates();
        }
        return this.templates.find(template => template.id === id);
    }

    /**
     * Create a new template
     * @param {Object} template - Template object
     * @returns {Object} - Created template
     */
    async createTemplate(template) {
        const newTemplate = {
            id: template.id || uuidv4(),
            name: template.name,
            description: template.description,
            prompt: template.prompt,
            isActive: template.isActive !== undefined ? template.isActive : true
        };
        
        this.templates.push(newTemplate);
        await this.saveTemplates();
        return newTemplate;
    }

    /**
     * Update a template
     * @param {string} id - Template ID
     * @param {Object} updates - Template updates
     * @returns {Object} - Updated template
     */
    async updateTemplate(id, updates) {
        const index = this.templates.findIndex(template => template.id === id);
        if (index === -1) {
            throw new Error(`Template with ID ${id} not found`);
        }
        
        this.templates[index] = {
            ...this.templates[index],
            ...updates
        };
        
        await this.saveTemplates();
        return this.templates[index];
    }

    /**
     * Delete a template
     * @param {string} id - Template ID
     * @returns {boolean} - Success status
     */
    async deleteTemplate(id) {
        const initialLength = this.templates.length;
        this.templates = this.templates.filter(template => template.id !== id);
        
        if (this.templates.length === initialLength) {
            throw new Error(`Template with ID ${id} not found`);
        }
        
        await this.saveTemplates();
        return true;
    }

    /**
     * Get template settings
     * @returns {Object} - Template settings
     */
    async getSettings() {
        if (!this.settings) {
            await this.loadTemplates();
        }
        return this.settings;
    }

    /**
     * Update template settings
     * @param {Object} updates - Settings updates
     * @returns {Object} - Updated settings
     */
    async updateSettings(updates) {
        this.settings = {
            ...this.settings,
            ...updates
        };
        
        await this.saveTemplates();
        return this.settings;
    }
}

module.exports = TemplateService;
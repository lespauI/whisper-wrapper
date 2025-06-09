/**
 * Refinement Service - Handles AI-powered refinement of transcriptions
 */

const OllamaService = require('./ollamaService');
const TemplateService = require('./templateService');

class RefinementService {
    constructor() {
        console.log('🎯 RefinementService: Initializing...');
        this.ollamaService = new OllamaService();
        this.templateService = new TemplateService();
        
        // Make services available globally for access from other services
        global.ollamaService = this.ollamaService;
        global.templateService = this.templateService;
    }

    /**
     * Check if refinement is available
     * @returns {Promise<boolean>} - Whether refinement is available
     */
    async isAvailable() {
        return await this.ollamaService.isAvailable();
    }

    /**
     * Get available templates
     * @returns {Promise<Array>} - List of available templates
     */
    async getAvailableTemplates() {
        return await this.templateService.getActiveTemplates();
    }

    /**
     * Get template by ID
     * @param {string} templateId - Template ID
     * @returns {Promise<Object>} - Template object
     */
    async getTemplate(templateId) {
        return await this.templateService.getTemplateById(templateId);
    }

    /**
     * Format prompt with transcription
     * @param {string} promptTemplate - Prompt template
     * @param {string} transcription - Transcription text
     * @param {Object} additionalContext - Additional context variables
     * @returns {string} - Formatted prompt
     */
    formatPrompt(promptTemplate, transcription, additionalContext = {}) {
        let formattedPrompt = promptTemplate;
        
        // Replace transcription placeholder
        formattedPrompt = formattedPrompt.replace(/{{transcription}}/g, transcription);
        
        // Replace any additional context variables
        Object.entries(additionalContext).forEach(([key, value]) => {
            const placeholder = new RegExp(`{{${key}}}`, 'g');
            formattedPrompt = formattedPrompt.replace(placeholder, value);
        });
        
        return formattedPrompt;
    }

    /**
     * Refine transcription using template
     * @param {string} transcription - Original transcription text
     * @param {string} templateId - Template ID
     * @param {Object} options - Refinement options
     * @returns {Promise<Object>} - Refined transcription
     */
    async refineTranscription(transcription, templateId, options = {}) {
        console.log(`🎯 RefinementService: Refining transcription with template ID: ${templateId}`);
        
        try {
            // Check if Ollama is available
            const isAvailable = await this.isAvailable();
            if (!isAvailable) {
                throw new Error('Ollama is not available. Please ensure Ollama is installed and running.');
            }
            
            // Get template
            const template = await this.templateService.getTemplateById(templateId);
            if (!template) {
                throw new Error(`Template with ID ${templateId} not found`);
            }
            
            // Format prompt
            const additionalContext = options.context || {};
            const formattedPrompt = this.formatPrompt(
                template.prompt,
                transcription,
                additionalContext
            );
            
            console.log(`📝 RefinementService: Formatted prompt (${formattedPrompt.length} chars)`);
            
            // Generate refined text with Ollama
            const ollamaOptions = {
                model: options.model || (await this.templateService.getSettings()).defaultModel,
                temperature: options.temperature || 0.7,
                max_tokens: options.max_tokens || 2000,
                timeout: options.timeout || (await this.templateService.getSettings()).timeoutSeconds
            };
            
            console.log(`⚙️ RefinementService: Using Ollama options:`, ollamaOptions);
            
            const result = await this.ollamaService.generateText(formattedPrompt, ollamaOptions);
            
            if (!result.success) {
                throw new Error(`Refinement failed: ${result.error || 'Unknown error'}`);
            }
            
            console.log(`✅ RefinementService: Refinement successful (${result.text.length} chars)`);
            
            return {
                success: true,
                original: transcription,
                refined: result.text,
                templateId: templateId,
                templateName: template.name,
                model: result.model
            };
        } catch (error) {
            console.error('❌ RefinementService: Refinement failed:', error);
            throw new Error(`Refinement failed: ${error.message}`);
        }
    }

    /**
     * Validate template
     * @param {Object} template - Template to validate
     * @returns {Object} - Validation result
     */
    validateTemplate(template) {
        const errors = [];
        
        if (!template.name || template.name.trim() === '') {
            errors.push('Template name is required');
        }
        
        if (!template.prompt || template.prompt.trim() === '') {
            errors.push('Template prompt is required');
        } else if (!template.prompt.includes('{{transcription}}')) {
            errors.push('Template prompt must contain {{transcription}} placeholder');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Get refinement settings
     * @returns {Promise<Object>} - Current settings
     */
    async getSettings() {
        const templateSettings = await this.templateService.getSettings();
        const isOllamaAvailable = await this.ollamaService.isAvailable();
        
        return {
            ollamaEndpoint: templateSettings.ollamaEndpoint,
            defaultModel: templateSettings.defaultModel,
            timeoutSeconds: templateSettings.timeoutSeconds,
            isOllamaAvailable
        };
    }

    /**
     * Update refinement settings
     * @param {Object} settings - New settings
     * @returns {Promise<Object>} - Updated settings
     */
    async updateSettings(settings) {
        await this.templateService.updateSettings(settings);
        await this.ollamaService.updateSettings(settings);
        
        return await this.getSettings();
    }
}

module.exports = RefinementService;
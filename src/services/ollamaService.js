/**
 * Ollama Service - Handles communication with local Ollama
 */

const fetch = require('node-fetch');
const config = require('../config');

class OllamaService {
    constructor() {
        console.log('🎯 OllamaService: Initializing...');
        this.baseURL = 'http://localhost:11434'; // Default Ollama endpoint
        this.defaultModel = 'llama3:latest';
        this.timeoutSeconds = 30;
        
        // Load settings if they exist
        this.loadSettings();
    }

    /**
     * Load settings from config
     */
    async loadSettings() {
        try {
            // If we have a templateService, get settings from there
            if (global.templateService) {
                const settings = await global.templateService.getSettings();
                this.baseURL = settings.ollamaEndpoint || this.baseURL;
                this.defaultModel = settings.defaultModel || this.defaultModel;
                this.timeoutSeconds = settings.timeoutSeconds || this.timeoutSeconds;
            }
            console.log(`✅ OllamaService: Configuration loaded`);
            console.log(`   - Endpoint: ${this.baseURL}`);
            console.log(`   - Default model: ${this.defaultModel}`);
            console.log(`   - Timeout: ${this.timeoutSeconds} seconds`);
        } catch (error) {
            console.error('❌ OllamaService: Failed to load settings:', error);
        }
    }

    /**
     * Update service settings
     * @param {Object} settings - New settings
     */
    async updateSettings(settings) {
        if (settings.ollamaEndpoint) {
            this.baseURL = settings.ollamaEndpoint;
        }
        if (settings.defaultModel) {
            this.defaultModel = settings.defaultModel;
        }
        if (settings.timeoutSeconds) {
            this.timeoutSeconds = settings.timeoutSeconds;
        }
        
        // If we have a templateService, update settings there
        if (global.templateService) {
            await global.templateService.updateSettings({
                ollamaEndpoint: this.baseURL,
                defaultModel: this.defaultModel,
                timeoutSeconds: this.timeoutSeconds
            });
        }
    }

    /**
     * Check if Ollama is available
     * @returns {Promise<boolean>} - Whether Ollama is available
     */
    async isAvailable() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(`${this.baseURL}/api/version`, {
                method: 'GET',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            return response.ok;
        } catch (error) {
            console.log('⚠️ OllamaService: Ollama is not available:', error.message);
            return false;
        }
    }

    /**
     * List available models
     * @returns {Promise<Array>} - List of available models
     */
    async listModels() {
        try {
            const response = await fetch(`${this.baseURL}/api/tags`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to list models: ${response.statusText}`);
            }
            
            const data = await response.json();
            return data.models || [];
        } catch (error) {
            console.error('❌ OllamaService: Failed to list models:', error);
            throw new Error(`Failed to list Ollama models: ${error.message}`);
        }
    }

    /**
     * Generate text using Ollama
     * @param {string} prompt - Prompt text
     * @param {Object} options - Generation options
     * @returns {Promise<Object>} - Generation result
     */
    async generateText(prompt, options = {}) {
        try {
            console.log(`🎯 OllamaService: Generating text with model ${options.model || this.defaultModel}`);
            
            // Check if Ollama is available
            const isAvailable = await this.isAvailable();
            if (!isAvailable) {
                throw new Error('Ollama is not available. Please ensure Ollama is installed and running.');
            }
            
            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
            }, (options.timeout || this.timeoutSeconds) * 1000);
            
            // Prepare request body
            const requestBody = {
                model: options.model || this.defaultModel,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: options.temperature || 0.7,
                    top_p: options.top_p || 0.9,
                    top_k: options.top_k || 40,
                    num_predict: options.max_tokens || 500
                }
            };
            
            // Make API request
            const response = await fetch(`${this.baseURL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`✅ OllamaService: Text generation successful (${data.response.length} chars)`);
            
            return {
                success: true,
                text: data.response,
                model: options.model || this.defaultModel
            };
        } catch (error) {
            console.error('❌ OllamaService: Text generation failed:', error);
            
            // Handle timeout specifically
            if (error.name === 'AbortError') {
                throw new Error(`Ollama request timed out after ${options.timeout || this.timeoutSeconds} seconds`);
            }
            
            throw new Error(`Ollama text generation failed: ${error.message}`);
        }
    }
}

module.exports = OllamaService;
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
        refinedText: null,
        message: 'AI refinement is disabled'
      };
    }
    
    // Update settings in case they've changed
    this.updateSettings();
    
    // Replace {{text}} placeholder with actual text
    const fullPrompt = prompt.replace('{{text}}', text);
    
    try {
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
        message: 'Text refined successfully'
      };
    } catch (error) {
      console.error('Text refinement failed:', error);
      return {
        success: false,
        refinedText: null,
        message: error.message || 'Failed to refine text'
      };
    }
  }
}

module.exports = new OllamaService();
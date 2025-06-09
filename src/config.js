/**
 * Configuration settings for the application
 */

const path = require('path');
const os = require('os');

// Default configuration
const config = {
    // Whisper settings
    whisper: {
        defaultModel: 'base',
        defaultLanguage: 'auto',
        defaultThreads: 4,
        modelsDirectory: path.join(process.cwd(), 'models'),
        tempDirectory: path.join(os.tmpdir(), 'whisper-wrapper'),
        useInitialPrompt: true,  // Default to using initial prompt if provided
        initialPrompt: '',       // Default empty initial prompt
    },
    
    // Application settings
    app: {
        dataDirectory: path.join(process.cwd(), 'data'),
        maxRecordingLength: 3600, // 1 hour in seconds
        autoSaveInterval: 5000,   // 5 seconds
    },
    
    // Ollama settings
    ollama: {
        endpoint: 'http://localhost:11434',
        defaultModel: 'llama3:latest',
        timeoutSeconds: 30,
    },

    // Get simplified configuration for the UI
    getSimplified() {
        return {
            model: this.whisper.defaultModel,
            language: this.whisper.defaultLanguage,
            threads: this.whisper.defaultThreads,
            translate: false,
            useInitialPrompt: this.whisper.useInitialPrompt !== undefined ? this.whisper.useInitialPrompt : true,
            initialPrompt: this.whisper.initialPrompt || '',
            // Ollama settings
            ollamaEndpoint: this.ollama.endpoint,
            ollamaModel: this.ollama.defaultModel,
            ollamaTimeout: this.ollama.timeoutSeconds
        };
    },

    // Set simplified configuration from the UI
    setSimplified(newConfig) {
        if (newConfig.model) {
            this.whisper.defaultModel = newConfig.model;
        }
        if (newConfig.language) {
            this.whisper.defaultLanguage = newConfig.language;
        }
        if (newConfig.threads) {
            this.whisper.defaultThreads = newConfig.threads;
        }
        if (newConfig.useInitialPrompt !== undefined) {
            this.whisper.useInitialPrompt = newConfig.useInitialPrompt;
            console.log(`🔄 Config: Initial prompt ${newConfig.useInitialPrompt ? 'ENABLED' : 'DISABLED'}`);
        }
        if (newConfig.initialPrompt !== undefined) {
            this.whisper.initialPrompt = newConfig.initialPrompt;
        }
        // Ollama settings
        if (newConfig.ollamaEndpoint) {
            this.ollama.endpoint = newConfig.ollamaEndpoint;
        }
        if (newConfig.ollamaModel) {
            this.ollama.defaultModel = newConfig.ollamaModel;
        }
        if (newConfig.ollamaTimeout) {
            this.ollama.timeoutSeconds = newConfig.ollamaTimeout;
        }
    }
};

module.exports = config;
/**
 * Configuration settings for the application
 * Using JSON file as database for persistent storage
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

// Define config file path
const CONFIG_FILE_PATH = path.join(process.cwd(), 'data', 'config.json');

// Default configuration
const defaultConfig = {
    // Whisper settings
    whisper: {
        defaultModel: 'base',
        defaultLanguage: 'auto',
        defaultThreads: 4,
        modelsDirectory: path.join(process.cwd(), 'models'),
        tempDirectory: path.join(os.tmpdir(), 'whisper-wrapper'),
        useInitialPrompt: true,  // Default to using initial prompt if provided
        initialPrompt: '',       // Default empty initial prompt
        translate: false
    },
    
    // Application settings
    app: {
        dataDirectory: path.join(process.cwd(), 'data'),
        maxRecordingLength: 3600, // 1 hour in seconds
        autoSaveInterval: 5000,   // 5 seconds
        theme: "light",
        startTab: "upload",
        recentFiles: []
    },
    
    // Ollama settings including refinement capabilities
    ollama: {
        endpoint: "http://localhost:11434",
        defaultModel: "gemma3:12b",
        timeoutSeconds: 300,
        refinement: {
            enabled: false,
            defaultTemplateId: null
        }
    },
    
    // Recording settings
    recording: {
        quality: "medium",
        format: "wav",
        autoTranscribe: true,
        autoSaveInterval: 60000
    }
};

// Function to load configuration from JSON file
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE_PATH)) {
            console.log(`📝 Loading configuration from ${CONFIG_FILE_PATH}`);
            const fileContent = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
            return JSON.parse(fileContent);
        } else {
            console.log(`⚠️ Config file not found. Creating default configuration.`);
            saveConfig(defaultConfig);
            return defaultConfig;
        }
    } catch (error) {
        console.error(`❌ Error loading configuration: ${error.message}`);
        console.log(`⚠️ Using default configuration`);
        return defaultConfig;
    }
}

// Function to save configuration to JSON file
function saveConfig(configToSave) {
    try {
        // Ensure the data directory exists
        const dataDir = path.dirname(CONFIG_FILE_PATH);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(configToSave, null, 2), 'utf8');
        console.log(`💾 Configuration saved to ${CONFIG_FILE_PATH}`);
    } catch (error) {
        console.error(`❌ Error saving configuration: ${error.message}`);
    }
}

// Load the configuration from file or use default
const config = loadConfig();

// Add methods to the config object
config.getSimplified = function() {
    return {
        model: this.whisper.defaultModel,
        language: this.whisper.defaultLanguage,
        threads: this.whisper.defaultThreads,
        translate: this.whisper.translate !== undefined ? this.whisper.translate : false,
        useInitialPrompt: this.whisper.useInitialPrompt !== undefined ? this.whisper.useInitialPrompt : true,
        initialPrompt: this.whisper.initialPrompt || ''
    };
};

config.setSimplified = function(newConfig) {
    let changed = false;
    
    if (newConfig.model && this.whisper.defaultModel !== newConfig.model) {
        this.whisper.defaultModel = newConfig.model;
        changed = true;
    }
    
    if (newConfig.language && this.whisper.defaultLanguage !== newConfig.language) {
        this.whisper.defaultLanguage = newConfig.language;
        changed = true;
    }
    
    if (newConfig.threads && this.whisper.defaultThreads !== newConfig.threads) {
        this.whisper.defaultThreads = newConfig.threads;
        changed = true;
    }
    
    if (newConfig.translate !== undefined && this.whisper.translate !== newConfig.translate) {
        this.whisper.translate = newConfig.translate;
        changed = true;
    }
    
    if (newConfig.useInitialPrompt !== undefined && this.whisper.useInitialPrompt !== newConfig.useInitialPrompt) {
        this.whisper.useInitialPrompt = newConfig.useInitialPrompt;
        console.log(`🔄 Config: Initial prompt ${newConfig.useInitialPrompt ? 'ENABLED' : 'DISABLED'}`);
        changed = true;
    }
    
    if (newConfig.initialPrompt !== undefined && this.whisper.initialPrompt !== newConfig.initialPrompt) {
        this.whisper.initialPrompt = newConfig.initialPrompt;
        changed = true;
    }
    
    // Save changes to the config file if anything was modified
    if (changed) {
        saveConfig(this);
    }
};

// Save any settings method to update arbitrary settings
config.saveSettings = function(section, settings) {
    if (!this[section]) {
        this[section] = {};
    }
    
    let changed = false;
    
    // Update the settings in the specified section
    for (const [key, value] of Object.entries(settings)) {
        if (this[section][key] !== value) {
            this[section][key] = value;
            changed = true;
        }
    }
    
    // Save to file if changes were made
    if (changed) {
        saveConfig(this);
    }
    
    return changed;
};

// Get AI Refinement settings (from ollama config)
config.getAIRefinementSettings = function() {
    // For backward compatibility - if old aiRefinement section exists, migrate it
    if (this.aiRefinement) {
        console.log('Migrating old aiRefinement settings to ollama.refinement');
        
        // Initialize refinement if needed
        if (!this.ollama) this.ollama = {};
        if (!this.ollama.refinement) this.ollama.refinement = {};
        
        // Copy settings (maintain endpoint/model/timeout at the ollama level)
        this.ollama.endpoint = this.aiRefinement.endpoint || this.ollama.endpoint || "http://localhost:11434";
        this.ollama.defaultModel = this.aiRefinement.model || this.ollama.defaultModel || "gemma3:12b";
        this.ollama.timeoutSeconds = this.aiRefinement.timeoutSeconds || this.ollama.timeoutSeconds || 300;
        
        // Copy refinement-specific settings
        this.ollama.refinement.enabled = this.aiRefinement.enabled || false;
        this.ollama.refinement.defaultTemplateId = this.aiRefinement.defaultTemplateId || null;
        
        // Remove old section
        delete this.aiRefinement;
        
        // Save the config with the migration
        saveConfig(this);
    }
    
    // Ensure all properties exist
    if (!this.ollama) this.ollama = {};
    if (!this.ollama.refinement) this.ollama.refinement = {};
    
    return {
        enabled: this.ollama.refinement?.enabled || false,
        endpoint: this.ollama.endpoint || "http://localhost:11434",
        model: this.ollama.defaultModel || "gemma3:12b",
        timeoutSeconds: this.ollama.timeoutSeconds || 300,
        defaultTemplateId: this.ollama.refinement?.defaultTemplateId || null
    };
};

// Save AI Refinement settings
config.saveAIRefinementSettings = function(settings) {
    if (!this.ollama) {
        this.ollama = {
            endpoint: "http://localhost:11434",
            defaultModel: "gemma3:12b",
            timeoutSeconds: 300,
            refinement: {}
     };
    }
    
    if (!this.ollama.refinement) {
        this.ollama.refinement = {};
    }
    
    let changed = false;
    
    // Handle common Ollama settings
    if (settings.endpoint !== undefined && this.ollama.endpoint !== settings.endpoint) {
        this.ollama.endpoint = settings.endpoint;
        changed = true;
    }
    
    if (settings.model !== undefined && this.ollama.defaultModel !== settings.model) {
        this.ollama.defaultModel = settings.model;
        changed = true;
    }
    
    if (settings.timeoutSeconds !== undefined && this.ollama.timeoutSeconds !== settings.timeoutSeconds) {
        this.ollama.timeoutSeconds = settings.timeoutSeconds;
        changed = true;
    }
    
    // Handle refinement-specific settings
    if (settings.enabled !== undefined && this.ollama.refinement.enabled !== settings.enabled) {
           this.ollama.refinement.enabled = settings.enabled;
        changed = true;
    }
    
    if (settings.defaultTemplateId !== undefined && this.ollama.refinement.defaultTemplateId !== settings.defaultTemplateId) {
        this.ollama.refinement.defaultTemplateId = settings.defaultTemplateId;
        changed = true;
    }
    
    if (changed) {
        saveConfig(this);
    }
    
    return changed;
};

module.exports = config;
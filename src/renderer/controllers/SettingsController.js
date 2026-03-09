/**
 * Settings Controller
 * Manages application settings, Whisper configuration, and AI refinement settings
 */

import { SELECTORS, CSS_CLASSES } from '../utils/Constants.js';
import { EventHandler } from '../utils/EventHandler.js';
import { UIHelpers } from '../utils/UIHelpers.js';

export class SettingsController {
    constructor(appState, statusController) {
        this.appState = appState;
        this.statusController = statusController;
        
        // Settings state
        this.isSettingsOpen = false;
        this.availableModels = [];
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeSettings();
    }

    /**
     * Set up event listeners for settings functionality
     */
    setupEventListeners() {
        // Settings toggle button
        EventHandler.addListener(SELECTORS.SETTINGS_BTN, 'click', () => {
            this.openSettings();
        });

        // Save settings
        EventHandler.addListener(SELECTORS.SAVE_SETTINGS_BTN, 'click', () => {
            this.saveSettings();
        });

        // Close settings buttons
        EventHandler.addListener(SELECTORS.CLOSE_SETTINGS_BTN, 'click', () => {
            this.closeSettings();
        });

        EventHandler.addListener(SELECTORS.CANCEL_SETTINGS_BTN, 'click', () => {
            this.closeSettings();
        });

        // Debug AI settings
        EventHandler.addListener('#debug-ai-settings-btn', 'click', async () => {
            await this.debugAISettings();
        });

        // Test Ollama connection
        EventHandler.addListener('#test-ollama-btn', 'click', async () => {
            await this.testOllamaConnection();
        });

        // Refresh models
        EventHandler.addListener('#refresh-models-btn', 'click', async () => {
            await this.refreshOllamaModels();
        });

        // Model selection change
        EventHandler.addListener('#model-select', 'change', (e) => {
            this.updateModelDescription(e.target.value);
        });

        // Initial prompt checkbox change
        EventHandler.addListener('#use-initial-prompt-checkbox', 'change', () => {
            this.updateInitialPromptState();
        });

        // Setup Whisper button
        EventHandler.addListener('#setup-whisper-btn', 'click', async () => {
            await this.setupWhisper();
        });

        // Hardware acceleration toggle
        EventHandler.addListener('#hardware-acceleration-checkbox', 'change', () => {
            this.updateGpuBackendState();
        });

        // GPU backend description update
        EventHandler.addListener('#gpu-backend-select', 'change', (e) => {
            this.updateGpuBackendDescription(e.target.value);
        });
    }

    /**
     * Initialize settings on startup
     */
    async initializeSettings() {
        // Update model options and check Whisper status
        await this.updateModelOptions();
        await this.checkWhisperStatus();
    }

    /**
     * Open settings panel
     */
    async openSettings() {
        const settingsHeader = UIHelpers.getElementById('settings-header');
        const settingsBtn = UIHelpers.getElementById('settings-btn');
        
        if (!settingsHeader || !settingsBtn) {
            console.error('Settings elements not found');
            return;
        }

        // Show settings
        UIHelpers.removeClass(settingsHeader, CSS_CLASSES.HIDDEN);
        UIHelpers.addClass(settingsHeader, 'visible');
        UIHelpers.addClass(settingsBtn, CSS_CLASSES.ACTIVE);
        
        this.isSettingsOpen = true;
        
        // Update content
        await this.updateModelOptions();
        await this.checkWhisperStatus();
        await this.loadSettings();
        await this.detectAndSuggestGpuBackend();
        
        this.statusController.updateStatus('Settings opened');
    }

    /**
     * Close settings panel
     */
    async closeSettings() {
        const settingsHeader = UIHelpers.getElementById('settings-header');
        const settingsBtn = UIHelpers.getElementById('settings-btn');
        
        if (!settingsHeader || !settingsBtn) {
            console.error('Settings elements not found');
            return;
        }

        // Hide settings
        UIHelpers.removeClass(settingsHeader, 'visible');
        UIHelpers.removeClass(settingsBtn, CSS_CLASSES.ACTIVE);
        
        // After animation completes
        setTimeout(() => {
            if (!settingsHeader.classList.contains('visible')) {
                UIHelpers.addClass(settingsHeader, CSS_CLASSES.HIDDEN);
            }
        }, 300);
        
        this.isSettingsOpen = false;
        this.statusController.updateStatus('Settings closed');
    }

    /**
     * Save all settings
     */
    async saveSettings() {
        try {
            this.statusController.updateStatus('Saving settings...');
            
            // Get basic Whisper settings
            const model = UIHelpers.getValue('#model-select');
            const language = UIHelpers.getValue('#language-select');
            const threads = parseInt(UIHelpers.getValue('#threads-select'));
            const translate = UIHelpers.isChecked('#translate-checkbox');
            const useInitialPrompt = UIHelpers.isChecked('#use-initial-prompt-checkbox');
            const initialPrompt = UIHelpers.getValue('#initial-prompt');
            const hardwareAcceleration = UIHelpers.isChecked('#hardware-acceleration-checkbox');
            const gpuBackend = UIHelpers.getValue('#gpu-backend-select');
            
            const settings = {
                model,
                language,
                threads,
                translate,
                useInitialPrompt,
                initialPrompt,
                hardwareAcceleration,
                gpuBackend
            };
            
            console.log('Saving settings:', settings);
            
            // Save settings via IPC
            const result = await window.electronAPI.setConfig(settings);
            
            // Check if model needs to be downloaded
            if (result.needsDownload) {
                const shouldDownload = await this.showModelDownloadDialog(result.modelName);
                if (shouldDownload) {
                    await this.downloadModel(result.modelName);
                    // Try saving settings again after download
                    const retryResult = await window.electronAPI.setConfig(settings);
                    if (!retryResult.success) {
                        throw new Error('Failed to save configuration after model download');
                    }
                } else {
                    // User cancelled download, don't save settings
                    return;
                }
            }
            
            // Save AI Refinement settings
            await this.saveAIRefinementSettings();
            
            this.closeSettings();
            this.statusController.updateStatus('Settings saved successfully');
            
        } catch (error) {
            console.error('Error saving settings:', error);
            this.statusController.showError(error.message || 'Failed to save settings');
        }
    }

    /**
     * Load all settings
     */
    async loadSettings() {
        try {
            const settings = await window.electronAPI.getConfig();
            console.log('Loaded settings:', settings);
            
            // Update UI with settings
            if (settings.model) {
                UIHelpers.setValue('#model-select', settings.model);
                this.updateModelDescription(settings.model);
            }
            if (settings.language) {
                UIHelpers.setValue('#language-select', settings.language);
            }
            if (settings.threads) {
                UIHelpers.setValue('#threads-select', settings.threads.toString());
            }
            if (settings.translate !== undefined) {
                UIHelpers.setChecked('#translate-checkbox', settings.translate);
            }
            if (settings.useInitialPrompt !== undefined) {
                UIHelpers.setChecked('#use-initial-prompt-checkbox', settings.useInitialPrompt);
            }
            if (settings.initialPrompt !== undefined) {
                UIHelpers.setValue('#initial-prompt', settings.initialPrompt);
            }
            if (settings.hardwareAcceleration !== undefined) {
                UIHelpers.setChecked('#hardware-acceleration-checkbox', settings.hardwareAcceleration);
            }
            if (settings.gpuBackend) {
                UIHelpers.setValue('#gpu-backend-select', settings.gpuBackend);
                this.updateGpuBackendDescription(settings.gpuBackend);
            }
            
            // Update initial prompt textarea state based on checkbox
            this.updateInitialPromptState();
            this.updateGpuBackendState();
            
            // Load AI Refinement settings
            await this.loadAIRefinementSettings();
            
        } catch (error) {
            console.error('Error loading settings:', error);
            this.statusController.showError('Failed to load settings');
        }
    }

    /**
     * Save AI Refinement settings
     */
    async saveAIRefinementSettings() {
        try {
            console.log('Saving AI Refinement settings');
            
            // Check if the API is available
            if (!window.electronAPI || !window.electronAPI.saveAIRefinementSettings) {
                console.warn('AI Refinement API not available');
                return;
            }
            
            // Get AI Refinement settings from UI
            const enabled = UIHelpers.isChecked('#ai-refinement-enabled-checkbox');
            const endpoint = UIHelpers.getValue('#ollama-endpoint') || 'http://localhost:11434';
            const model = UIHelpers.getValue('#ollama-model-select');
            const timeoutSeconds = parseInt(UIHelpers.getValue('#ollama-timeout')) || 300;
            
            const aiRefinementSettings = {
                enabled,
                endpoint,
                model,
                timeoutSeconds
            };
            
            // Save using the dedicated method
            const result = await window.electronAPI.saveAIRefinementSettings(aiRefinementSettings);
            if (!result.success) {
                throw new Error('Failed to save AI Refinement settings');
            }
            
            console.log('AI Refinement settings saved successfully');
            
        } catch (error) {
            console.error('Error saving AI Refinement settings:', error);
            throw error;
        }
    }

    /**
     * Load AI Refinement settings
     */
    async loadAIRefinementSettings() {
        try {
            // Check if the API is available
            if (!window.electronAPI || !window.electronAPI.getAIRefinementSettings) {
                console.warn('AI Refinement API not available');
                return;
            }
            
            // Get AI Refinement settings using the dedicated method
            const aiSettings = await window.electronAPI.getAIRefinementSettings();
            if (aiSettings) {
                // Update UI elements
                UIHelpers.setChecked('#ai-refinement-enabled-checkbox', aiSettings.enabled || false);
                UIHelpers.setValue('#ollama-endpoint', aiSettings.endpoint || 'http://localhost:11434');
                UIHelpers.setValue('#ollama-timeout', aiSettings.timeoutSeconds || 300);
                
                // Load available models and set selected model
                await this.refreshOllamaModels();
                if (aiSettings.model) {
                    UIHelpers.setValue('#ollama-model-select', aiSettings.model);
                }
                // If the saved model is not in the dropdown (e.g. uninstalled), sync config
                const modelSelect = UIHelpers.getElementById('ollama-model-select');
                if (modelSelect && modelSelect.value && aiSettings.model && modelSelect.value !== aiSettings.model) {
                    await window.electronAPI.saveAIRefinementSettings({ model: modelSelect.value });
                }
                
                console.log('AI Refinement settings loaded successfully');
            }
            
        } catch (error) {
            console.error('Error loading AI Refinement settings:', error);
        }
    }

    /**
     * Check Whisper status
     */
    async checkWhisperStatus() {
        try {
            const statusElement = UIHelpers.getElementById('whisper-status');
            const statusText = UIHelpers.getElementById('whisper-status-text');
            const setupButton = UIHelpers.getElementById('setup-whisper-btn');
            
            if (!statusElement || !statusText || !setupButton) {
                return;
            }
            
            UIHelpers.setText(statusText, 'Checking...');
            statusElement.className = 'status-indicator';
            UIHelpers.hide(setupButton);
            
            // Test local Whisper installation
            const testResult = await window.electronAPI.testWhisper();
            
            if (testResult.success) {
                UIHelpers.setText(statusText, 'Local Whisper is ready');
                statusElement.className = 'status-indicator success';
                
                // Update model options with available models
                if (testResult.details && testResult.details.availableModels) {
                    this.updateModelOptions(testResult.details.availableModels);
                }
            } else {
                UIHelpers.setText(statusText, testResult.message || 'Local Whisper not available');
                statusElement.className = 'status-indicator error';
                UIHelpers.show(setupButton);
            }
            
        } catch (error) {
            console.error('Error checking Whisper status:', error);
            
            const statusElement = UIHelpers.getElementById('whisper-status');
            const statusText = UIHelpers.getElementById('whisper-status-text');
            const setupButton = UIHelpers.getElementById('setup-whisper-btn');
            
            if (statusText) UIHelpers.setText(statusText, 'Error checking Whisper status');
            if (statusElement) statusElement.className = 'status-indicator error';
            if (setupButton) UIHelpers.show(setupButton);
        }
    }

    /**
     * Update model options
     */
    async updateModelOptions(availableModels) {
        const modelSelect = UIHelpers.getElementById('model-select');
        if (!modelSelect) return;
        
        // Clear existing options
        modelSelect.innerHTML = '';
        
        // Get default models from configuration or use fallback
        let modelsToUse;
        try {
            const config = await window.electronAPI.getConfig();
            modelsToUse = config.whisper?.availableModels || this.getDefaultModels();
        } catch (error) {
            console.warn('Could not load models from config, using defaults:', error);
            modelsToUse = this.getDefaultModels();
        }
        
        // Create a set of available model names for marking which ones are downloaded
        const downloadedModels = new Set();
        if (availableModels && Array.isArray(availableModels)) {
            availableModels.forEach(model => {
                downloadedModels.add(model.name);
            });
        }
        
        modelsToUse.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            const isDownloaded = downloadedModels.has(model.name);
            option.textContent = `${model.name} (${model.size}) ${isDownloaded ? '✓' : '○'}`;
            option.title = model.description;
            modelSelect.appendChild(option);
        });
    }

    /**
     * Get default model list
     */
    getDefaultModels() {
        return [
            { name: 'tiny', size: '39M', description: 'Tiny model - fastest, least accurate' },
            { name: 'tiny.en', size: '39M', description: 'Tiny English-only model' },
            { name: 'base', size: '74M', description: 'Base model - good balance of speed and accuracy' },
            { name: 'base.en', size: '74M', description: 'Base English-only model' },
            { name: 'small', size: '244M', description: 'Small model - better accuracy' },
            { name: 'small.en', size: '244M', description: 'Small English-only model' },
            { name: 'medium', size: '769M', description: 'Medium model - high accuracy' },
            { name: 'medium.en', size: '769M', description: 'Medium English-only model' },
            { name: 'large', size: '1550M', description: 'Large model - highest accuracy, slowest' },
            { name: 'turbo', size: '809M', description: 'Turbo model - optimized for speed' }
        ];
    }

    /**
     * Update model description
     */
    updateModelDescription(modelName) {
        const descriptionElement = UIHelpers.getElementById('model-description');
        if (!descriptionElement) return;
        
        const models = this.getDefaultModels();
        const model = models.find(m => m.name === modelName);
        
        if (model) {
            UIHelpers.setText(descriptionElement, model.description);
        } else {
            UIHelpers.setText(descriptionElement, 'Select a model to see detailed information');
        }
    }

    /**
     * Update GPU backend dropdown enabled/disabled state based on hardware acceleration toggle
     */
    updateGpuBackendState() {
        const checkbox = UIHelpers.getElementById('hardware-acceleration-checkbox');
        const select = UIHelpers.getElementById('gpu-backend-select');
        if (!checkbox || !select) return;
        
        select.disabled = !checkbox.checked;
        if (!checkbox.checked) {
            UIHelpers.addClass(select, 'disabled');
        } else {
            UIHelpers.removeClass(select, 'disabled');
        }
    }

    /**
     * Update GPU backend description text
     * @param {string} backend - Selected backend value
     */
    updateGpuBackendDescription(backend) {
        const descriptions = {
            auto: 'Automatically selects the best available backend',
            metal: 'GPU acceleration via Metal (Apple Silicon Macs, 3-5x faster)',
            coreml: 'Neural Engine via CoreML (Apple, requires pre-converted models)',
            cuda: 'GPU acceleration via CUDA (NVIDIA GPUs on Windows/Linux)',
            vulkan: 'GPU acceleration via Vulkan (AMD/Intel GPUs on Windows/Linux)',
            cpu: 'No GPU acceleration, uses CPU only'
        };
        const descEl = UIHelpers.getElementById('gpu-backend-description');
        if (descEl) {
            UIHelpers.setText(descEl, descriptions[backend] || 'Select a backend');
        }
    }

    /**
     * Detect the suggested GPU backend and update the dropdown if set to 'auto'
     */
    async detectAndSuggestGpuBackend() {
        try {
            if (!window.electronAPI || !window.electronAPI.detectGpuBackend) return;
            const result = await window.electronAPI.detectGpuBackend();
            if (!result.success) return;
            
            const select = UIHelpers.getElementById('gpu-backend-select');
            if (!select || select.value !== 'auto') return;
            
            const descEl = UIHelpers.getElementById('gpu-backend-description');
            if (descEl && result.suggestedBackend !== 'auto') {
                const backendsLabels = { metal: 'Metal', coreml: 'CoreML', cuda: 'CUDA', vulkan: 'Vulkan', cpu: 'CPU' };
                const label = backendsLabels[result.suggestedBackend] || result.suggestedBackend;
                UIHelpers.setText(descEl, `Auto-detect: will use ${label} on this system`);
            }
        } catch (error) {
            console.warn('Could not detect GPU backend:', error);
        }
    }

    /**
     * Update initial prompt state based on checkbox
     */
    updateInitialPromptState() {
        const checkbox = UIHelpers.getElementById('use-initial-prompt-checkbox');
        const textarea = UIHelpers.getElementById('initial-prompt');
        
        if (!checkbox || !textarea) return;
        
        if (checkbox.checked) {
            textarea.disabled = false;
            UIHelpers.removeClass(textarea, 'disabled');
        } else {
            textarea.disabled = true;
            UIHelpers.addClass(textarea, 'disabled');
        }
    }

    /**
     * Test Ollama connection
     */
    async testOllamaConnection() {
        try {
            this.statusController.updateStatus('Testing Ollama connection...');
            
            const endpoint = UIHelpers.getValue('#ollama-endpoint') || 'http://localhost:11434';
            const result = await window.electronAPI.testOllamaConnection(endpoint);
            
            const statusElement = UIHelpers.getElementById('ollama-status');
            const statusText = UIHelpers.getElementById('ollama-status-text');
            
            if (result.success) {
                if (statusText) UIHelpers.setText(statusText, 'Connected');
                if (statusElement) statusElement.className = 'status-indicator success';
                
                // Load available models
                await this.refreshOllamaModels();
                
                this.statusController.updateStatus('Ollama connection successful');
            } else {
                if (statusText) UIHelpers.setText(statusText, 'Connection failed');
                if (statusElement) statusElement.className = 'status-indicator error';
                this.statusController.showError(`Ollama connection failed: ${result.message}`);
            }
            
        } catch (error) {
            console.error('Error testing Ollama connection:', error);
            this.statusController.showError('Failed to test Ollama connection');
        }
    }

    /**
     * Refresh Ollama models list
     */
    async refreshOllamaModels() {
        try {
            const endpoint = UIHelpers.getValue('#ollama-endpoint') || 'http://localhost:11434';
            const result = await window.electronAPI.getOllamaModels(endpoint);
            
            const modelSelect = UIHelpers.getElementById('ollama-model-select');
            if (!modelSelect) return;
            
            // Clear existing options
            modelSelect.innerHTML = '';
            
            if (result.success && result.models && result.models.length > 0) {
                result.models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.name;
                    option.textContent = `${model.name} (${model.size || 'Unknown size'})`;
                    modelSelect.appendChild(option);
                });
                
                console.log(`Loaded ${result.models.length} Ollama models`);
            } else {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'No models available';
                modelSelect.appendChild(option);
            }
            
        } catch (error) {
            console.error('Error refreshing Ollama models:', error);
            const modelSelect = UIHelpers.getElementById('ollama-model-select');
            if (modelSelect) {
                modelSelect.innerHTML = '<option value="">Error loading models</option>';
            }
        }
    }

    /**
     * Debug AI settings
     */
    async debugAISettings() {
        try {
            const debug = await window.electronAPI.debugAIRefinementSettings();
            console.log('AI Refinement Debug Information:', debug);
            
            // Show a summary as an alert
            const summary = `
AI Refinement Debug Info:
- Enabled in config: ${debug.configSettings.enabled}
- Enabled in Ollama service: ${debug.ollamaEnabled}
- Model: ${debug.ollamaSettings.model}
- Endpoint: ${debug.ollamaSettings.endpoint}
            `;
            
            alert(summary);
        } catch (error) {
            console.error('Error getting debug info:', error);
            this.statusController.showError(`Error debugging: ${error.message}`);
        }
    }

    /**
     * Setup Whisper
     */
    async setupWhisper() {
        try {
            this.statusController.updateStatus('Setting up Whisper...');
            
            const result = await window.electronAPI.setupWhisper();
            
            if (result.success) {
                this.statusController.updateStatus('Whisper setup completed');
                await this.checkWhisperStatus(); // Refresh status
            } else {
                this.statusController.showError(result.message || 'Whisper setup failed');
            }
            
        } catch (error) {
            console.error('Error setting up Whisper:', error);
            this.statusController.showError('Failed to setup Whisper');
        }
    }

    /**
     * Show model download dialog
     */
    async showModelDownloadDialog(modelName) {
        return confirm(`The model "${modelName}" needs to be downloaded. This may take a few minutes. Do you want to continue?`);
    }

    /**
     * Download model
     */
    async downloadModel(modelName) {
        try {
            this.statusController.updateStatus(`Downloading model: ${modelName}...`);
            
            const result = await window.electronAPI.downloadModel(modelName);
            
            if (result.success) {
                this.statusController.updateStatus(`Model ${modelName} downloaded successfully`);
            } else {
                throw new Error(result.message || 'Download failed');
            }
            
        } catch (error) {
            console.error('Error downloading model:', error);
            this.statusController.showError(`Failed to download model: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get current settings state
     */
    getCurrentState() {
        return {
            isSettingsOpen: this.isSettingsOpen,
            availableModels: this.availableModels
        };
    }

    /**
     * Destroy the controller and clean up resources
     */
    destroy() {
        // Close settings if open
        if (this.isSettingsOpen) {
            this.closeSettings();
        }
        
        console.log('SettingsController destroyed');
    }
}
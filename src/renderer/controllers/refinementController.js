/**
 * Refinement Controller
 * Manages the workflow for refining transcriptions with AI
 */

class RefinementController {
    constructor(app) {
        this.app = app;
        this.isRefining = false;
        this.lastRefinementTime = 0;
        this.refinementCooldownMs = 1000; // Prevent clicking multiple times within 1 second
        this.currentTemplateId = null;
        this.currentRequestId = null;
        this.templateSelector = document.getElementById('template-selector');
        this.refineButton = document.getElementById('refine-with-ai-btn');
        this.stopButton = document.getElementById('stop-refinement-btn') || this.createStopButton();
        this.refinementControls = document.getElementById('ai-refinement-controls');
        this.refinementLoading = document.getElementById('refinement-loading');
        
        this.init();
    }
    
    /**
     * Create the stop button if it doesn't exist
     * @returns {HTMLButtonElement} The stop button
     */
    createStopButton() {
        // Create stop button if it doesn't exist
        const stopButton = document.createElement('button');
        stopButton.id = 'stop-refinement-btn';
        stopButton.className = 'btn btn-danger hidden';
        stopButton.innerHTML = '⏹️ Stop';
        stopButton.title = 'Stop the current AI refinement';
        
        // Insert after refine button
        if (this.refineButton && this.refineButton.parentNode) {
            this.refineButton.parentNode.insertBefore(stopButton, this.refineButton.nextSibling);
        } else {
            // Fallback - add to controls
            this.refinementControls?.appendChild(stopButton);
        }
        
        return stopButton;
    }
    
    /**
     * Initialize the controller
     */
    init() {
        // Set up event listeners
        this.refineButton.addEventListener('click', () => this.refineTranscription());
        this.stopButton.addEventListener('click', () => this.stopRefinement());
        
        // Flag to prevent recursive calls
        this.isUpdatingSelector = false;
        
        // NOTE: The template selector change event is now attached in updateTemplateSelector
        // after the selector is rebuilt to prevent event loops
        
        // Create a progress bar for refinement
        this.progressBarContainer = document.createElement('div');
        this.progressBarContainer.className = 'progress-container hidden';
        this.progressBar = document.createElement('div');
        this.progressBar.className = 'progress-bar';
        this.progressBarLabel = document.createElement('div');
        this.progressBarLabel.className = 'progress-label';
        this.progressBarLabel.textContent = '0%';
        
        this.progressBarContainer.appendChild(this.progressBar);
        this.progressBarContainer.appendChild(this.progressBarLabel);
        this.refinementLoading.appendChild(this.progressBarContainer);
        
        // Create a stream preview container for showing partial results
        this.streamPreviewContainer = document.createElement('div');
        this.streamPreviewContainer.className = 'stream-preview-container hidden';
        this.streamPreviewText = document.createElement('div');
        this.streamPreviewText.className = 'stream-preview-text';
        this.streamPreviewContainer.appendChild(this.streamPreviewText);
        document.querySelector('.transcription-content').appendChild(this.streamPreviewContainer);
        
        // Add indicator for refined text
        this.refinedIndicator = document.createElement('div');
        this.refinedIndicator.className = 'refined-indicator hidden';
        this.refinedIndicator.innerHTML = '<span>✨ AI Refined</span>';
        document.querySelector('.transcription-content').appendChild(this.refinedIndicator);
        
        // Create a status display for streaming
        this.streamStatusContainer = document.createElement('div');
        this.streamStatusContainer.className = 'stream-status-container hidden';
        this.streamStatusText = document.createElement('div');
        this.streamStatusText.className = 'stream-status-text';
        this.streamStatusContainer.appendChild(this.streamStatusText);
        
        // Create a stats display
        this.statsContainer = document.createElement('div');
        this.statsContainer.className = 'stats-container hidden';
        document.querySelector('.transcription-content').appendChild(this.statsContainer);
        
        document.querySelector('.transcription-content').appendChild(this.streamStatusContainer);
        
        // Listen for refinement progress updates
        window.electronAPI.onRefinementProgress((event, data) => {
            console.log('Refinement progress:', data);
            
            // Update progress bar
            if (data.progress !== undefined) {
                this.updateProgressBar(data.progress);
            }
            
            // Update status message
            if (data.message) {
                this.app.updateStatus(data.message);
            }
            
            // Handle different event types
            if (data.status === 'error') {
                // Show error in status container
                this.streamStatusContainer.classList.remove('hidden');
                this.streamStatusText.textContent = data.message || 'Error during refinement';
                this.streamStatusText.className = 'stream-status-text error';
                
                // Hide loading after a delay
                setTimeout(() => {
                    this.refinementLoading.classList.add('hidden');
                    this.progressBarContainer.classList.add('hidden');
                }, 1500);
            }
        });
        
        // Listen for streaming updates
        window.electronAPI.onRefinementStream((event, data) => {
            console.log('Refinement stream update:', data.status, data.text ? `${data.text.length} chars` : '');
            
            // Different handling based on the update type
            if (data.type === 'error') {
                // Show error in status
                this.streamStatusContainer.classList.remove('hidden');
                this.streamStatusText.textContent = data.message || 'Error during refinement';
                this.streamStatusText.className = 'stream-status-text error';
                
                // Hide loading and progress
                this.refinementLoading.classList.add('hidden');
                this.progressBarContainer.classList.add('hidden');
                
                // Hide after delay
                setTimeout(() => {
                    this.streamStatusContainer.classList.add('hidden');
                }, 5000);
                
                return;
            }
            
            if (data.type === 'warning') {
                // Show warning but don't stop
                this.streamStatusContainer.classList.remove('hidden');
                this.streamStatusText.textContent = data.message || 'Warning during refinement';
                this.streamStatusText.className = 'stream-status-text warning';
                
                // Hide after delay
                setTimeout(() => {
                    this.streamStatusContainer.classList.add('hidden');
                }, 3000);
                
                return;
            }
            
            // Handle partial updates
            if (data.type === 'partial' && data.text) {
                // Show the preview container if hidden
                this.streamPreviewContainer.classList.remove('hidden');
                
                // Update the preview text
                this.streamPreviewText.textContent = data.text;
                
                // Update progress if available
                if (data.progress !== undefined) {
                    this.updateProgressBar(data.progress);
                }
                
                // Update status with token count if available
                if (data.tokens) {
                    this.app.updateStatus(`Refining: ${data.tokens} tokens generated`);
                }
            }
            
            // Handle complete response
            if (data.type === 'complete' && data.text) {
                // Show completion stats
                if (data.tokens && data.elapsedMs) {
                    const seconds = Math.max(1, Math.round(data.elapsedMs / 1000));
                    const tokensPerSec = Math.round(data.tokens / seconds);
                    
                    this.statsContainer.classList.remove('hidden');
                    this.statsContainer.innerHTML = `
                        <div class="stats-title">Refinement Stats</div>
                        <div class="stats-item">Tokens: ${data.tokens}</div>
                        <div class="stats-item">Time: ${seconds}s</div>
                        <div class="stats-item">Speed: ${tokensPerSec} tokens/sec</div>
                    `;
                    
                    // Hide stats after a few seconds
                    setTimeout(() => {
                        this.statsContainer.classList.add('hidden');
                    }, 5000);
                }
                
                // Hide the preview after a short delay to allow user to see the final result
                setTimeout(() => {
                    this.streamPreviewContainer.classList.add('hidden');
                }, 500);
                
                // Update progress to 100%
                this.updateProgressBar(100);
            }
        });
        
        // Load the last selected template if available
        const lastSelectedTemplateId = localStorage.getItem('lastSelectedTemplateId');
        
        // Validate the ID format before accepting it
        if (lastSelectedTemplateId && /^[a-zA-Z0-9_-]+$/.test(lastSelectedTemplateId)) {
            // Check if this ID includes just the template- prefix without an actual ID
            if (lastSelectedTemplateId === 'template-') {
                console.warn('Found incomplete template ID "template-" in localStorage, removing it');
                localStorage.removeItem('lastSelectedTemplateId');
                this.currentTemplateId = null;
            } else {
                // Ensure it's a valid format - only load IDs with valid characters
                this.currentTemplateId = lastSelectedTemplateId;
                console.log(`Retrieved last template ID from storage: ${lastSelectedTemplateId}`);
            }
        } else if (lastSelectedTemplateId) {
            // Invalid format - ignore and remove from storage
            console.warn(`Invalid template ID format in localStorage: "${lastSelectedTemplateId}", removing it`);
            localStorage.removeItem('lastSelectedTemplateId');
            this.currentTemplateId = null;
        }
    }
    
    /**
     * Update the progress bar
     * @param {number} percent - Percentage complete (0-100)
     */
    updateProgressBar(percent) {
        // Ensure percent is a number between 0-100
        const validPercent = Math.min(100, Math.max(0, percent || 0));
        
        // Show progress container if not already visible
        this.progressBarContainer.classList.remove('hidden');
        
        // Update progress bar width and label
        this.progressBar.style.width = `${validPercent}%`;
        this.progressBarLabel.textContent = `${Math.round(validPercent)}%`;
    }
    
    /**
     * Check if refinement is available
     * @returns {boolean} True if refinement is available
     */
    isRefinementAvailable() {
        return (
            this.app.aiRefinementState.enabled &&
            this.app.aiRefinementState.connected &&
            this.app.aiRefinementState.templates.length > 0 &&
            this.app.aiRefinementState.ollamaModel
        );
    }
    
    /**
     * Update the UI based on refinement availability
     */
    updateRefinementUI() {
        // Controls are always visible now - no need to hide them
        
        // Update template selector
        this.updateTemplateSelector();
        
        // Enable/disable refine button based on template availability
        if (this.app.aiRefinementState.templates.length === 0) {
            this.refineButton.disabled = true;
            this.refineButton.title = "Please create templates in Settings first";
        } else {
            this.refineButton.disabled = false;
            this.refineButton.title = "Refine your transcription with AI";
        }
    }
    
    /**
     * Static flag to prevent multiple simultaneous updates
     */
    static isUpdatingTemplateSelectorGlobal = false;
    
    /**
     * Flag to indicate if the template selector has already been initialized
     */
    static hasInitializedTemplateSelector = false;
    
    /**
     * Last time the selector was updated
     */
    static lastUpdateTime = 0;
    
    /**
     * Update the template selector with available templates
     */
    updateTemplateSelector(forceUpdate = false) {
        // Only initialize once unless forced
        if (RefinementController.hasInitializedTemplateSelector && !forceUpdate) {
            return;
        }
        
        // Debounce updates
        const now = Date.now();
        const timeSinceLastUpdate = now - RefinementController.lastUpdateTime;
        
        if (timeSinceLastUpdate < 5000 && !forceUpdate) {
            return;
        }
        
        // Prevent recursive calls
        if (RefinementController.isUpdatingTemplateSelectorGlobal) {
            return;
        }
        
        // Set the global updating flag
        RefinementController.isUpdatingTemplateSelectorGlobal = true;
        RefinementController.lastUpdateTime = now;
        
        try {
            if (!this.templateSelector) {
                return;
            }
            
            // Remove event listeners to prevent event cascade
            const oldTemplateSelector = this.templateSelector;
            const newTemplateSelector = oldTemplateSelector.cloneNode(false);
            oldTemplateSelector.parentNode.replaceChild(newTemplateSelector, oldTemplateSelector);
            this.templateSelector = newTemplateSelector;
            
            // Clear existing options
            this.templateSelector.innerHTML = '';
            
            // Safely check if templates exist and are an array
            const templates = this.app.aiRefinementState?.templates || [];
            
            if (!Array.isArray(templates) || templates.length === 0) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'No templates available';
                this.templateSelector.appendChild(option);
                
                // Disable refine button if no templates
                if (this.refineButton) {
                    this.refineButton.disabled = true;
                    this.refineButton.title = "Please create templates in Settings first";
                }
                return;
            }
            
            // Add templates
            templates.forEach(template => {
                const option = document.createElement('option');
                option.value = template.id;
                option.textContent = template.name;
                if (template.isDefault) {
                    option.textContent += ' (Default)';
                }
                this.templateSelector.appendChild(option);
            });
            
            // Check for partial or incomplete template IDs before validation
            if (this.currentTemplateId === 'template-') {
                this.currentTemplateId = null;
                localStorage.removeItem('lastSelectedTemplateId');
            }
            
            // Select the current template or default
            const isCurrentTemplateValid = this.currentTemplateId && templates.some(t => t.id === this.currentTemplateId);
                        
            if (isCurrentTemplateValid) {
                // Current template exists, select it
                this.templateSelector.value = this.currentTemplateId;
            } else {
                // Try to select default template
                const defaultTemplate = templates.find(t => t.isDefault);
                if (defaultTemplate) {
                    this.templateSelector.value = defaultTemplate.id;
                    this.currentTemplateId = defaultTemplate.id;
                } else if (templates.length > 0) {
                    // No default, select first available
                    this.templateSelector.value = templates[0].id;
                    this.currentTemplateId = templates[0].id;
                }
            }
            
            // Save the new selection to localStorage
            if (this.currentTemplateId) {
                // Validate the ID format before saving
                if (/^[a-zA-Z0-9_-]+$/.test(this.currentTemplateId)) {
                    localStorage.setItem('lastSelectedTemplateId', this.currentTemplateId);
                } else {
                    localStorage.removeItem('lastSelectedTemplateId');
                }
            } else {
                localStorage.removeItem('lastSelectedTemplateId');
            }
            
            // Enable refine button if we have templates
            if (this.refineButton && templates.length > 0) {
                this.refineButton.disabled = false;
                this.refineButton.title = "Refine your transcription with AI";
            }
            
            // Re-attach event listener AFTER the update is complete
            this.templateSelector.addEventListener('change', (e) => {
                const selectedId = e.target.value;
                
                // Validate the selection
                if (selectedId) {
                    const templates = this.app.aiRefinementState.templates || [];
                    const isValid = templates.some(t => t.id === selectedId);
                    
                    if (isValid) {
                        // Only update if actually changed
                        if (this.currentTemplateId !== selectedId) {
                            this.currentTemplateId = selectedId;
                            
                            // Save the selected template ID to localStorage for persistence
                            if (/^[a-zA-Z0-9_-]+$/.test(this.currentTemplateId)) {
                                localStorage.setItem('lastSelectedTemplateId', this.currentTemplateId);
                            } else {
                                localStorage.removeItem('lastSelectedTemplateId');
                            }
                        }
                    }
                } else {
                    // Empty selection
                    this.currentTemplateId = null;
                    localStorage.removeItem('lastSelectedTemplateId');
                }
            });
            
            // Mark as initialized
            RefinementController.hasInitializedTemplateSelector = true;
            
        } finally {
            // Always release the global flag after a short delay
            setTimeout(() => {
                RefinementController.isUpdatingTemplateSelectorGlobal = false;
            }, 500);
        }
    }
    
    /**
     * Refine the current transcription using AI
     */
    async refineTranscription() {
        try {
            // Check if we're already refining
            if (this.isRefining) {
                console.log('Already refining, please wait...');
                return;
            }
            
            // Check for rapid repeated clicks (cooldown)
            const now = Date.now();
            if (now - this.lastRefinementTime < this.refinementCooldownMs) {
                console.log('Please wait a moment before trying again');
                return;
            }
            
            // Reset the request ID to ensure we don't have a stale one
            this.currentRequestId = null;
            
            // Update last refinement time
            this.lastRefinementTime = now;
            
            // Get current text
            const currentText = this.app.transcriptionState.currentText;
            if (!currentText) {
                this.app.showError('No transcription to refine.');
                return;
            }
            
            // Check for very large inputs that might cause issues
            const MAX_SAFE_LENGTH = 15000; // ~15k chars is reasonable for most LLMs
            if (currentText.length > MAX_SAFE_LENGTH) {
                const confirmLarge = confirm(
                    `Warning: The text is very large (${currentText.length.toLocaleString()} characters). ` + 
                    `This may cause Ollama to be slow or timeout. Continue anyway?`
                );
                
                if (!confirmLarge) {
                    return;
                }
            }
            
            // Auto-select a template if none is selected
            if (!this.currentTemplateId) {
                // Try to get the default template
                const templates = this.app.aiRefinementState?.templates || [];
                
                // Make sure templates are available
                if (!Array.isArray(templates) || templates.length === 0) {
                    this.app.showError('Please create a template for refinement in Settings.');
                    
                    // Highlight the settings button if available
                    const settingsButton = document.querySelector('.settings-toggle');
                    if (settingsButton) {
                        settingsButton.classList.add('attention-highlight');
                        setTimeout(() => {
                            settingsButton.classList.remove('attention-highlight');
                        }, 3000);
                    }
                    
                    return;
                }
                
                // Use updateTemplateSelector to select a template
                if (!RefinementController.isUpdatingTemplateSelectorGlobal) {
                    this.updateTemplateSelector();
                    
                    // If we still don't have a template after the update, show an error
                    if (!this.currentTemplateId) {
                        this.app.showError('Could not select a template. Please try again or select one manually.');
                        return;
                    }
                } else {
                    // Wait a bit and check if we have a template
                    await new Promise(resolve => setTimeout(resolve, 300));
                    
                    if (!this.currentTemplateId) {
                        this.app.showError('No template selected. Please select one manually.');
                        return;
                    }
                }
            }
            
            // Check connection and show warnings
            if (!this.app.aiRefinementState.enabled) {
                const confirmContinue = confirm('AI Refinement is not enabled in settings. Enable it now and continue?');
                if (confirmContinue) {
                    // Enable the feature
                    await window.electronAPI.saveAIRefinementSettings({
                        enabled: true
                    });
                    this.app.aiRefinementState.enabled = true;
                } else {
                    return; // User cancelled
                }
            }
            
            // If still not connected, try to test the connection first
            if (!this.app.aiRefinementState.connected) {
                this.app.updateStatus('Checking Ollama connection...');
                
                try {
                    // Test the connection first
                    const connectionTest = await window.electronAPI.testOllamaConnection();
                    
                    if (!connectionTest.success) {
                        const confirmContinue = confirm(`Not connected to Ollama (${connectionTest.message}). Make sure Ollama is running and try again?`);
                        if (!confirmContinue) {
                            return; // User cancelled
                        }
                    } else {
                        // Connection successful, update state
                        this.app.aiRefinementState.connected = true;
                        console.log('Connection to Ollama successful');
                    }
                } catch (connectionError) {
                    console.error('Error testing Ollama connection:', connectionError);
                    const confirmContinue = confirm('Error testing Ollama connection. Make sure Ollama is running and try again?');
                    if (!confirmContinue) {
                        return; // User cancelled
                    }
                }
            }
            
            // Show loading state
            this.isRefining = true;
            this.refinementLoading.classList.remove('hidden');
            this.progressBarContainer.classList.remove('hidden');
            this.updateProgressBar(0); // Reset progress bar
            this.app.updateStatus('Refining transcription with AI...');
            
            // Hide the refined indicator if it's visible
            this.refinedIndicator.classList.add('hidden');
            
            // Get template name for display
            const selectedTemplate = this.app.aiRefinementState.templates.find(
                t => t.id === this.currentTemplateId
            );
            
            // Validate template again just before processing
            if (!selectedTemplate) {
                this.app.showError(`The selected template no longer exists. Please select another template.`);
                
                // Show template selector with highlight
                this.templateSelector.classList.add('error-highlight');
                setTimeout(() => this.templateSelector.classList.remove('error-highlight'), 3000);
                
                return;
            }
            
            const templateName = selectedTemplate.name || 'Selected Template';
            
            // Call API to refine text
            console.log(`Refining text with template: ${this.currentTemplateId} (${templateName})`);
            
            // Show stop button during refinement
            this.refineButton.classList.add('hidden');
            this.stopButton.classList.remove('hidden');
            
            let result;
            try {
                result = await window.electronAPI.refineText(currentText, this.currentTemplateId);
                
                // Store the request ID if available
                if (result.requestId) {
                    this.currentRequestId = result.requestId;
                    console.log(`Stored requestId: ${this.currentRequestId}`);
                }
                
                // Check for connection errors
                if (result.error && result.error.code === 'CONNECTION_FAILED') {
                    throw new Error(`Could not connect to Ollama. Is the Ollama service running?`);
                }
            } catch (error) {
                // Keep track of the request ID even if we get an error
                // This ensures the stop button will still work
                if (this.currentRequestId) {
                    console.log(`Keeping request ID ${this.currentRequestId} despite error`);
                }
                throw error;
            }
            
            // Process result (only if we got a successful result)
            if (result && result.success && result.refinedText) {
                // Save current text in history before replacing
                this.app.saveTranscriptionToHistory();
                
                // Update text
                this.app.updateTranscriptionText(result.refinedText);
                
                // Make sure segments are preserved after refinement
                // Without this, the toggle button will be disabled after refinement
                if (this.app.transcriptionState.segments.length > 0) {
                    // Force UI update to ensure toggle button is enabled
                    this.app.updateToggleButton();
                }
                
                // Show the refined indicator
                this.refinedIndicator.classList.remove('hidden');
                
                // Show stats if available
                if (result.stats) {
                    const seconds = Math.max(1, Math.round(result.stats.elapsedMs / 1000));
                    const tokensPerSec = Math.round(result.stats.tokens / seconds);
                    
                    this.statsContainer.classList.remove('hidden');
                    this.statsContainer.innerHTML = `
                        <div class="stats-title">Refinement Complete</div>
                        <div class="stats-item">Tokens: ${result.stats.tokens}</div>
                        <div class="stats-item">Time: ${seconds}s</div>
                        <div class="stats-item">Speed: ${tokensPerSec} tokens/sec</div>
                    `;
                    
                    // Hide stats after a few seconds
                    setTimeout(() => {
                        this.statsContainer.classList.add('hidden');
                    }, 5000);
                }
                
                // Update status with template name and token count
                const tokenInfo = result.stats ? ` (${result.stats.tokens} tokens)` : '';
                this.app.updateStatus(`Transcription refined successfully using "${templateName}"${tokenInfo}`);
                
                // Show success message
                this.streamStatusContainer.classList.remove('hidden');
                this.streamStatusText.textContent = 'Refinement completed successfully';
                this.streamStatusText.className = 'stream-status-text success';
                
                // Hide success message after delay
                setTimeout(() => {
                    this.streamStatusContainer.classList.add('hidden');
                }, 3000);
            } else {
                // Handle error with more details
                let errorMessage = 'Failed to refine transcription';
                
                if (result.error && result.error.code) {
                    console.error(`Error code: ${result.error.code}`, result.error);
                    
                    if (result.error.code === 'ECONNREFUSED') {
                        errorMessage = 'Cannot connect to Ollama. Is it running?';
                    } else if (['ETIMEDOUT', 'ESOCKETTIMEDOUT'].includes(result.error.code)) {
                        errorMessage = 'Connection to Ollama timed out. Try a simpler template or shorter text.';
                    } else {
                        errorMessage = result.message || result.error.message || errorMessage;
                    }
                } else {
                    errorMessage = result.message || errorMessage;
                }
                
                // Show error in status
                this.streamStatusContainer.classList.remove('hidden');
                this.streamStatusText.textContent = errorMessage;
                this.streamStatusText.className = 'stream-status-text error';
                
                // Hide after delay
                setTimeout(() => {
                    this.streamStatusContainer.classList.add('hidden');
                }, 5000);
                
                throw new Error(errorMessage);
            }
        } catch (error) {
            console.error('Error refining transcription:', error);
            
            // Show a more user-friendly error message based on the error type
            let userMessage = `Error refining transcription: ${error.message}`;
            
            // Check for common error types
            if (error.message.includes('connect to Ollama') || 
                (error.code === 'ECONNREFUSED') || 
                error.message.includes('CONNECTION_FAILED')) {
                
                // Ollama connection error
                userMessage = 'Cannot connect to Ollama. Please make sure Ollama is running and try again.';
                
                // Show connection instructions
                this.streamStatusContainer.classList.remove('hidden');
                this.streamStatusText.innerHTML = `
                    <strong>Ollama Connection Error</strong><br>
                    1. Make sure Ollama is installed and running<br>
                    2. Check Ollama settings in the Settings panel<br>
                    3. Try restarting the Ollama service
                `;
                this.streamStatusText.className = 'stream-status-text error';
                
                // Keep status visible longer for connection errors
                setTimeout(() => {
                    this.streamStatusContainer.classList.add('hidden');
                }, 10000);
            }
            
            this.app.showError(userMessage);
        } finally {
            // Hide loading state
            this.isRefining = false;
            
            // Ensure all UI elements are properly hidden
            this.refinementLoading.classList.add('hidden');
            this.progressBarContainer.classList.add('hidden');
            this.streamPreviewContainer.classList.add('hidden');
            
            // Show refine button and hide stop button
            this.refineButton.classList.remove('hidden');
            this.stopButton.classList.add('hidden');
            
            // Clear current request ID
            this.currentRequestId = null;
            
            // Add a safety check to hide all status displays after a delay
            // This ensures they don't get stuck if there's any timing issue
            setTimeout(() => {
                if (!this.isRefining) {
                    // Only hide if we're not in another refinement process
                    this.streamStatusContainer?.classList.add('hidden');
                    this.progressBarContainer?.classList.add('hidden');
                }
            }, 8000); // 8 seconds is enough for any animations or displays to complete
        }
    }
    
    /**
     * Stop an ongoing refinement request
     */
    async stopRefinement() {
        try {
            // First check if we have an active request ID locally
            if (!this.currentRequestId) {
                console.log('No local request ID found, checking for active requests...');
                
                // Check if there are any active requests on the server
                const activeRequests = await window.electronAPI.getActiveRefinements();
                
                if (activeRequests && activeRequests.success && activeRequests.requests && activeRequests.requests.length > 0) {
                    // Use the first active request
                    this.currentRequestId = activeRequests.requests[0];
                    console.log(`Found active request: ${this.currentRequestId}`);
                } else {
                    console.log('No active requests found');
                    this.streamStatusContainer.classList.remove('hidden');
                    this.streamStatusText.textContent = 'No active refinement to stop';
                    this.streamStatusText.className = 'stream-status-text warning';
                    
                    // Hide status after a delay
                    setTimeout(() => {
                        this.streamStatusContainer.classList.add('hidden');
                    }, 3000);
                    return;
                }
            }
            
            console.log(`Attempting to stop refinement request: ${this.currentRequestId}`);
            
            // Show status
            this.streamStatusContainer.classList.remove('hidden');
            this.streamStatusText.textContent = 'Stopping refinement...';
            this.streamStatusText.className = 'stream-status-text warning';
            
            // Call API to abort the request
            const result = await window.electronAPI.abortRefinement(this.currentRequestId);
            
            if (result.success) {
                console.log(`Successfully stopped refinement: ${result.message}`);
                
                // Update status message
                this.streamStatusText.textContent = 'Refinement stopped successfully';
                this.streamStatusText.className = 'stream-status-text success';
                
                // Hide refinement UI
                this.refinementLoading.classList.add('hidden');
                this.progressBarContainer.classList.add('hidden');
                this.streamPreviewContainer.classList.add('hidden');
                
                // Show refine button and hide stop button
                this.refineButton.classList.remove('hidden');
                this.stopButton.classList.add('hidden');
                
                // Reset state
                this.isRefining = false;
                this.currentRequestId = null;
                
                // Hide status after a delay
                setTimeout(() => {
                    this.streamStatusContainer.classList.add('hidden');
                }, 3000);
            } else {
                console.warn(`Failed to stop refinement: ${result.message}`);
                
                // Update status message
                this.streamStatusText.textContent = `Failed to stop refinement: ${result.message}`;
                this.streamStatusText.className = 'stream-status-text warning';
                
                // Hide status after a delay
                setTimeout(() => {
                    this.streamStatusContainer.classList.add('hidden');
                }, 3000);
            }
        } catch (error) {
            console.error('Error stopping refinement:', error);
            
            // Show error
            this.streamStatusContainer.classList.remove('hidden');
            this.streamStatusText.textContent = `Error stopping refinement: ${error.message}`;
            this.streamStatusText.className = 'stream-status-text error';
            
            // Hide status after a delay
            setTimeout(() => {
                this.streamStatusContainer.classList.add('hidden');
            }, 3000);
        }
    }
}

// Export the controller
window.RefinementController = RefinementController;
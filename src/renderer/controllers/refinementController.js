/**
 * Refinement Controller
 * Manages the workflow for refining transcriptions with AI
 */

class RefinementController {
    constructor(app) {
        this.app = app;
        this.isRefining = false;
        this.currentTemplateId = null;
        this.templateSelector = document.getElementById('template-selector');
        this.refineButton = document.getElementById('refine-with-ai-btn');
        this.refinementControls = document.getElementById('ai-refinement-controls');
        this.refinementLoading = document.getElementById('refinement-loading');
        
        this.init();
    }
    
    /**
     * Initialize the controller
     */
    init() {
        // Set up event listeners
        this.refineButton.addEventListener('click', () => this.refineTranscription());
        this.templateSelector.addEventListener('change', (e) => {
            this.currentTemplateId = e.target.value;
        });
        
        // Listen for refinement progress updates
        window.electronAPI.onRefinementProgress((event, data) => {
            console.log('Refinement progress:', data);
            // Handle progress updates if needed
        });
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
        const isAvailable = this.isRefinementAvailable();
        
        // Show/hide refinement controls
        if (isAvailable) {
            this.refinementControls.classList.remove('hidden');
        } else {
            this.refinementControls.classList.add('hidden');
        }
        
        // Update template selector
        this.updateTemplateSelector();
    }
    
    /**
     * Update the template selector with available templates
     */
    updateTemplateSelector() {
        if (!this.templateSelector) return;
        
        // Clear existing options
        this.templateSelector.innerHTML = '';
        
        const templates = this.app.aiRefinementState.templates;
        
        if (templates.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No templates available';
            this.templateSelector.appendChild(option);
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
        
        // Select the current template or default
        if (this.currentTemplateId && templates.some(t => t.id === this.currentTemplateId)) {
            this.templateSelector.value = this.currentTemplateId;
        } else {
            const defaultTemplate = templates.find(t => t.isDefault);
            if (defaultTemplate) {
                this.templateSelector.value = defaultTemplate.id;
                this.currentTemplateId = defaultTemplate.id;
            } else if (templates.length > 0) {
                this.templateSelector.value = templates[0].id;
                this.currentTemplateId = templates[0].id;
            }
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
            
            // Validate requirements
            if (!this.isRefinementAvailable()) {
                this.app.showError('AI Refinement is not available. Please check your settings.');
                return;
            }
            
            if (!this.currentTemplateId) {
                this.app.showError('Please select a template for refinement.');
                return;
            }
            
            // Get current text
            const currentText = this.app.transcriptionState.currentText;
            if (!currentText) {
                this.app.showError('No transcription to refine.');
                return;
            }
            
            // Show loading state
            this.isRefining = true;
            this.refinementLoading.classList.remove('hidden');
            this.app.updateStatus('Refining transcription with AI...');
            
            // Call API to refine text
            console.log(`Refining text with template: ${this.currentTemplateId}`);
            const result = await window.electronAPI.refineText(currentText, this.currentTemplateId);
            
            // Process result
            if (result.success && result.refinedText) {
                // Save current text in history before replacing
                this.app.saveTranscriptionToHistory();
                
                // Update text
                this.app.updateTranscriptionText(result.refinedText);
                this.app.updateStatus('Transcription refined successfully.');
            } else {
                throw new Error(result.error || 'Failed to refine transcription.');
            }
        } catch (error) {
            console.error('Error refining transcription:', error);
            this.app.showError(`Error refining transcription: ${error.message}`);
        } finally {
            // Hide loading state
            this.isRefining = false;
            this.refinementLoading.classList.add('hidden');
        }
    }
}

// Export the controller
window.RefinementController = RefinementController;
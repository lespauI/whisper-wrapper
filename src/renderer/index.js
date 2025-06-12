// Main renderer process script
class WhisperWrapperApp {
    constructor() {
        this.currentTab = 'upload';
        this.isRecording = false;
        this.isPaused = false;
        this.recordingStartTime = null;
        this.recordingTimer = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.dataArray = null;
        this.animationId = null;
        this.recordingBlob = null;
        this.recordingSettings = {
            quality: 'medium',
            format: 'wav',
            autoTranscribe: true,
            autoSaveInterval: 60000, // Save chunks every 60 seconds (1 minute)
            enableAutoSave: true
        };
        
        // Auto-save recording state
        this.recordingAutoSave = {
            sessionId: null,
            chunkIndex: 0,
            savedChunks: [],
            autoSaveTimer: null,
            tempDirectory: null
        };
        
        // Transcription editing state
        this.transcriptionState = {
            originalText: '',
            currentText: '',
            isDirty: false,
            lastSaved: null,
            autoSaveTimer: null,
            history: [],
            historyIndex: -1,
            segments: [], // Store original segments with timestamps
            viewMode: 'timestamped' // 'timestamped' or 'plain'
        };
        
        // AI Refinement state
        this.aiRefinementState = {
            enabled: false,
            connected: false,
            ollamaEndpoint: 'http://localhost:11434',
            ollamaModel: '',
            availableModels: [],
            timeout: 30,
            templates: [],
            currentTemplateId: null,
            templateBeingEdited: null,
            isTemplateModalOpen: false
        };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupTabNavigation();
        this.setupFileUpload();
        this.setupRecording();
        this.setupTranscription();
        this.setupSettings();
        this.loadSettings();
        this.checkForOrphanedRecordings();
        
        // Initialize refinement controller
        try {
            if (typeof RefinementController !== 'undefined') {
                this.refinementController = new RefinementController(this);
                console.log('Refinement controller initialized successfully');
            } else {
                console.warn('RefinementController not defined. AI refinement features will be unavailable.');
            }
        } catch (error) {
            console.error('Error initializing refinement controller:', error);
        }
        
        this.updateStatus('Ready');
        this.updateToggleButton(); // Initialize toggle button state
    }

    setupEventListeners() {
        // Helper function to safely add event listeners
        const addListener = (selector, event, callback) => {
            const element = selector.startsWith('#') ? 
                document.getElementById(selector.substring(1)) : 
                document.querySelector(selector);
                
            if (element) {
                element.addEventListener(event, callback);
            } else {
                console.warn(`Element not found: ${selector}`);
            }
        };
        
        // Helper function to safely add event listeners to multiple elements
        const addListenerAll = (selector, event, callback) => {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                elements.forEach(el => el.addEventListener(event, callback));
            } else {
                console.warn(`No elements found for: ${selector}`);
            }
        };

        // Tab navigation
        addListenerAll('.tab-btn', 'click', (e) => {
            this.switchTab(e.target.dataset.tab);
        });

        // Settings toggle
        addListener('#settings-btn', 'click', () => {
            this.openSettings();
        });

        addListener('#save-settings-btn', 'click', () => {
            this.saveSettings();
            this.closeSettings();
        });
        
        // Debug AI settings button
        addListener('#debug-ai-settings-btn', 'click', async () => {
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
                this.showError(`Error debugging: ${error.message}`);
            }
        });
        
        // Settings close buttons
        addListener('#close-settings-btn', 'click', () => {
            this.closeSettings();
        });
        
        addListener('#cancel-settings-btn', 'click', () => {
            this.closeSettings();
        });

        // Setup Whisper button
        addListener('#setup-whisper-btn', 'click', () => {
            this.setupWhisper();
        });

        // Model comparison modal
        addListener('#model-info-btn', 'click', () => {
            this.openModelComparison();
        });

        addListener('#close-model-comparison-btn', 'click', () => {
            this.closeModelComparison();
        });

        // Close model comparison modal on backdrop click
        addListener('#model-comparison-modal', 'click', (e) => {
            if (e.target === e.currentTarget) {
                this.closeModelComparison();
            }
        });

        // Model selection change handler
        addListener('#model-select', 'change', (e) => {
            this.updateModelDescription(e.target.value);
        });
        
        // AI Refinement - Ollama connection test
        addListener('#test-ollama-btn', 'click', () => {
            this.testOllamaConnection();
        });
        
        // AI Refinement - Refresh models
        addListener('#refresh-models-btn', 'click', () => {
            this.refreshOllamaModels();
        });
        
        // AI Refinement - Model selection change
        addListener('#ollama-model-select', 'change', async (e) => {
            const selectedModel = e.target.value;
            console.log(`Ollama model changed to: ${selectedModel}`);
            
            // Update state
            this.aiRefinementState.ollamaModel = selectedModel;
            
            // Save the selection immediately
            try {
                const result = await window.electronAPI.saveAIRefinementSettings({
                    model: selectedModel
                });
                console.log(`Saved Ollama model selection: ${selectedModel}`, result);
            } catch (error) {
                console.error('Error saving Ollama model selection:', error);
            }
        });
        
        // AI Refinement - Timeout change
        addListener('#ollama-timeout', 'change', async (e) => {
            const timeoutValue = parseInt(e.target.value);
            console.log(`Ollama timeout changed to: ${timeoutValue} seconds`);
            
            // Update state
            this.aiRefinementState.timeout = timeoutValue;
            
            // Save the timeout immediately
            try {
                const result = await window.electronAPI.saveAIRefinementSettings({
                    timeoutSeconds: timeoutValue
                });
                console.log(`Saved Ollama timeout: ${timeoutValue} seconds`, result);
            } catch (error) {
                console.error('Error saving Ollama timeout:', error);
            }
        });
        
        // AI Refinement - Enable/disable checkbox
        addListener('#ai-refinement-enabled-checkbox', 'change', async (e) => {
            const enabled = e.target.checked;
            console.log(`AI Refinement enabled checkbox changed to: ${enabled}`);
            
            // Update local state
            this.aiRefinementState.enabled = enabled;
            this.updateAIRefinementUIState();
            
            // Force setting the enabled state and other settings
            const timeoutValue = parseInt(document.getElementById('ollama-timeout').value);
            const settings = {
                enabled: enabled,
                endpoint: document.getElementById('ollama-endpoint').value,
                model: document.getElementById('ollama-model-select').value,
                timeoutSeconds: isNaN(timeoutValue) ? 300 : timeoutValue // Ensure valid timeout with fallback
            };
            
            // Update local state to match
            this.aiRefinementState.timeout = settings.timeoutSeconds;
            
            // Save to settings
            try {
                console.log('Explicitly saving AI Refinement enabled state:', settings);
                const result = await window.electronAPI.saveAIRefinementSettings(settings);
                
                // Debug: Check if settings were properly saved
                const debug = await window.electronAPI.debugAIRefinementSettings();
                console.log('AI Refinement Debug Info after enable/disable:', debug);
                
                console.log(`AI Refinement enabled state saved: ${enabled}`, result);
            } catch (error) {
                console.error('Error saving AI Refinement enabled state:', error);
            }
        });
        
        // AI Refinement - Manage templates button
        addListener('#manage-templates-btn', 'click', () => {
            this.openTemplateModal();
        });
        
        // Template modal - Close button
        addListener('#close-template-modal-btn', 'click', () => {
            this.closeTemplateModal();
        });
        
        // Template modal - Create new template button
        addListener('#create-template-btn', 'click', () => {
            this.createNewTemplate();
        });
        
        // Template modal - Save template button
        addListener('#save-template-btn', 'click', () => {
            this.saveTemplate();
        });
        
        // Template modal - Cancel edit button
        addListener('#cancel-template-edit-btn', 'click', () => {
            this.cancelTemplateEdit();
        });
        
        // Template modal - Delete template button
        addListener('#delete-template-btn', 'click', () => {
            this.confirmDeleteTemplate();
        });
        
        // Delete confirmation modal - Close button
        addListener('#close-delete-modal-btn', 'click', () => {
            this.closeDeleteConfirmationModal();
        });
        
        // Delete confirmation modal - Cancel button
        addListener('#cancel-delete-btn', 'click', () => {
            this.closeDeleteConfirmationModal();
        });
        
        // Delete confirmation modal - Confirm button
        addListener('#confirm-delete-btn', 'click', () => {
            this.deleteTemplate();
        });
        
        // Close modals on backdrop click
        addListener('#template-modal', 'click', (e) => {
            if (e.target === e.currentTarget) {
                this.closeTemplateModal();
            }
        });
        
        addListener('#delete-template-modal', 'click', (e) => {
            if (e.target === e.currentTarget) {
                this.closeDeleteConfirmationModal();
            }
        });
        
        // Initial prompt checkbox handler
        addListener('#use-initial-prompt-checkbox', 'change', () => {
            this.updateInitialPromptState();
        });
    }

    setupTabNavigation() {
        // Initial tab setup is handled in init
    }

    setupFileUpload() {
        const uploadArea = document.getElementById('file-upload');
        const browseBtn = document.getElementById('browse-btn');

        // Click to browse
        browseBtn.addEventListener('click', () => {
            this.selectFile();
        });

        uploadArea.addEventListener('click', () => {
            this.selectFile();
        });

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                this.handleFileUpload(files[0].path);
            }
        });
    }

    setupRecording() {
        const startBtn = document.getElementById('start-record-btn');
        const pauseBtn = document.getElementById('pause-record-btn');
        const resumeBtn = document.getElementById('resume-record-btn');
        const stopBtn = document.getElementById('stop-record-btn');
        const saveBtn = document.getElementById('save-record-btn');
        const transcribeBtn = document.getElementById('transcribe-record-btn');
        const clearBtn = document.getElementById('clear-record-btn');

        // Recording controls
        startBtn.addEventListener('click', () => {
            this.startRecording();
        });

        pauseBtn.addEventListener('click', () => {
            this.pauseRecording();
        });

        resumeBtn.addEventListener('click', () => {
            this.resumeRecording();
        });

        stopBtn.addEventListener('click', () => {
            this.stopRecording();
        });

        saveBtn.addEventListener('click', () => {
            this.saveRecording();
        });

        transcribeBtn.addEventListener('click', () => {
            this.transcribeRecording();
        });

        clearBtn.addEventListener('click', () => {
            this.clearRecording();
        });

        // Recording settings
        document.getElementById('quality-select').addEventListener('change', (e) => {
            this.recordingSettings.quality = e.target.value;
        });

        document.getElementById('format-select').addEventListener('change', (e) => {
            this.recordingSettings.format = e.target.value;
        });

        document.getElementById('auto-transcribe').addEventListener('change', (e) => {
            this.recordingSettings.autoTranscribe = e.target.checked;
            // Update UI to show/hide transcribe button if recording is completed
            this.updateRecordingUI();
        });

        // Initialize canvas for visualization
        this.initializeVisualization();
    }

    setupTranscription() {
        const copyBtn = document.getElementById('copy-btn');
        const transcriptionText = document.getElementById('transcription-text');

        // Basic actions
        copyBtn.addEventListener('click', () => {
            this.copyTranscription();
        });

        // Enhanced export options
        this.setupExportDropdown();

        // Undo/Redo buttons
        document.getElementById('undo-btn').addEventListener('click', () => {
            this.undoTranscription();
        });

        document.getElementById('redo-btn').addEventListener('click', () => {
            this.redoTranscription();
        });



        // Clear draft
        document.getElementById('clear-draft-btn').addEventListener('click', () => {
            this.clearDraft();
        });

        // Toggle view mode
        document.getElementById('toggle-view-btn').addEventListener('click', () => {
            this.toggleViewMode();
        });



        // Auto-save functionality
        transcriptionText.addEventListener('input', (e) => {
            this.handleTranscriptionEdit(e.target.value);
        });

        // Keyboard shortcuts
        transcriptionText.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // Load any saved draft on startup
        this.loadTranscriptionDraft();

        // Save draft before page unload
        window.addEventListener('beforeunload', () => {
            this.saveTranscriptionDraft();
        });

        // Update UI state periodically
        setInterval(() => {
            this.updateTranscriptionStatus();
            this.updateUndoRedoButtons();
            
            // Update AI refinement UI if controller is initialized
            if (this.refinementController) {
                this.refinementController.updateRefinementUI();
            }
        }, 1000);
    }

    setupSettings() {
        // Settings are handled in the modal event listeners
    }
    
    // Helper function to update the AI Refinement UI state
    updateAIRefinementUIState() {
        const enabled = this.aiRefinementState.enabled;
        const aiSettingsFields = document.querySelectorAll('.ai-refinement-card .form-group:not(:first-child), .ai-refinement-card .status-card');
        
        aiSettingsFields.forEach(field => {
            if (enabled) {
                field.classList.remove('disabled');
            } else {
                field.classList.add('disabled');
            }
        });
        
        // Enable/disable input fields
        document.getElementById('ollama-endpoint').disabled = !enabled;
        document.getElementById('ollama-model-select').disabled = !enabled;
        document.getElementById('ollama-timeout').disabled = !enabled;
        document.getElementById('test-ollama-btn').disabled = !enabled;
        document.getElementById('refresh-models-btn').disabled = !enabled;
        document.getElementById('manage-templates-btn').disabled = !enabled;
    }
    
    // Load refinement templates from storage
    async loadTemplates() {
        try {
            // Use getAllTemplates (the correct method name) instead of getTemplates
            const result = await window.electronAPI.getAllTemplates();
            
            if (result && result.success && Array.isArray(result.templates)) {
                this.aiRefinementState.templates = result.templates;
                console.log(`Loaded ${result.templates.length} refinement templates`);
                
                // If refinement controller exists, initialize or update the template selector
                if (this.refinementController) {
                    if (!this.refinementController.constructor.hasInitializedTemplateSelector) {
                        this.refinementController.updateTemplateSelector(false); // initial setup
                    } else {
                        this.refinementController.updateTemplateSelector(true); // force update
                    }
                }
            } else {
                console.warn('No templates found or invalid template data', result);
                this.aiRefinementState.templates = [];
            }
        } catch (error) {
            console.error('Error loading templates:', error);
            this.aiRefinementState.templates = [];
        }
    }
    
    // Template modal management
    async openTemplateModal() {
        try {
            console.log('Opening template modal');
            // Load templates if needed
            if (this.aiRefinementState.templates.length === 0) {
                await this.loadTemplates();
            }
            
            // Show modal
            const templateModal = document.getElementById('template-modal');
            if (templateModal) {
                templateModal.classList.remove('hidden');
                
                // Render template list if the function exists
                if (typeof this.renderTemplateList === 'function') {
                    this.renderTemplateList();
                } else {
                    console.warn('renderTemplateList function not found');
                }
                
                this.aiRefinementState.isTemplateModalOpen = true;
            } else {
                console.error('Template modal element not found');
            }
        } catch (error) {
            console.error('Error opening template modal:', error);
            this.showError('Failed to open template manager');
        }
    }
    
    closeTemplateModal() {
        console.log('Closing template modal');
        const templateModal = document.getElementById('template-modal');
        if (templateModal) {
            templateModal.classList.add('hidden');
            
            // Reset template being edited
            this.aiRefinementState.templateBeingEdited = null;
            
            // Hide edit form
            const editForm = document.getElementById('template-editor-section');
            const templateList = document.getElementById('template-list-section');
            
            if (editForm && templateList) {
                editForm.classList.add('hidden');
                templateList.classList.remove('hidden');
            }
            
            this.aiRefinementState.isTemplateModalOpen = false;
        } else {
            console.error('Template modal element not found');
        }
    }
    
    // Render the list of available templates in the modal
    renderTemplateList() {
        console.log('Rendering template list');
        const templateListContainer = document.getElementById('template-list');
        if (!templateListContainer) {
            console.error('Template list container not found');
            return;
        }
        
        // Clear existing list
        templateListContainer.innerHTML = '';
        
        // Get templates from state
        const templates = this.aiRefinementState.templates || [];
        
        if (templates.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'template-empty-message';
            emptyMessage.textContent = 'No templates available. Create your first template!';
            templateListContainer.appendChild(emptyMessage);
            return;
        }
        
        // Create a template item for each template
        templates.forEach(template => {
            const item = document.createElement('div');
            item.className = 'template-item';
            if (template.isDefault) {
                item.classList.add('default-template');
            }
            
            const header = document.createElement('div');
            header.className = 'template-header';
            
            const title = document.createElement('h4');
            title.textContent = template.name;
            
            const badges = document.createElement('div');
            badges.className = 'template-badges';
            
            if (template.isDefault) {
                const defaultBadge = document.createElement('span');
                defaultBadge.className = 'badge default-badge';
                defaultBadge.textContent = 'Default';
                badges.appendChild(defaultBadge);
            }
            
            header.appendChild(title);
            header.appendChild(badges);
            
            const description = document.createElement('p');
            description.className = 'template-description';
            description.textContent = template.description || 'No description';
            
            const actions = document.createElement('div');
            actions.className = 'template-actions';
            
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-sm';
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', () => {
                this.editTemplate(template.id);
            });
            
            const defaultBtn = document.createElement('button');
            defaultBtn.className = 'btn btn-sm';
            defaultBtn.textContent = template.isDefault ? 'Default ✓' : 'Set as Default';
            defaultBtn.disabled = template.isDefault;
            if (!template.isDefault) {
                defaultBtn.addEventListener('click', () => {
                    this.setDefaultTemplate(template.id);
                });
            }
            
            actions.appendChild(editBtn);
            actions.appendChild(defaultBtn);
            
            item.appendChild(header);
            item.appendChild(description);
            item.appendChild(actions);
            
            templateListContainer.appendChild(item);
        });
    }
    
    // Edit a template
    async editTemplate(templateId) {
        console.log(`Editing template: ${templateId}`);
        try {
            // Find the template in the list
            const template = this.aiRefinementState.templates.find(t => t.id === templateId);
            if (!template) {
                throw new Error(`Template with ID ${templateId} not found`);
            }
            
            // Set as current template being edited
            this.aiRefinementState.templateBeingEdited = { ...template };
            
            // Show edit form, hide list
            const editForm = document.getElementById('template-editor-section');
            const templateList = document.getElementById('template-list-section');
            
            if (editForm && templateList) {
                // Fill form fields
                document.getElementById('template-name').value = template.name || '';
                document.getElementById('template-description').value = template.description || '';
                document.getElementById('template-prompt').value = template.prompt || '';
                
                // Show form, hide list
                editForm.classList.remove('hidden');
                templateList.classList.add('hidden');
                
                // Update form title
                const formTitle = document.getElementById('template-form-title');
                if (formTitle) {
                    formTitle.textContent = 'Edit Template';
                }
                
                // Show delete button
                const deleteBtn = document.getElementById('delete-template-btn');
                if (deleteBtn) {
                    deleteBtn.classList.remove('hidden');
                }
            } else {
                console.error('Template edit form or list container not found');
            }
        } catch (error) {
            console.error('Error editing template:', error);
            this.showError(`Failed to edit template: ${error.message}`);
        }
    }
    
    // Create a new template
    createNewTemplate() {
        console.log('Creating new template');
        // Create empty template
        this.aiRefinementState.templateBeingEdited = {
            id: null, // Will be assigned when saving
            name: '',
            description: '',
            prompt: '',
            isDefault: false
        };
        
        // Show edit form, hide list
        const editForm = document.getElementById('template-editor-section');
        const templateList = document.getElementById('template-list-section');
        
        if (editForm && templateList) {
            // Clear form fields
            document.getElementById('template-name').value = '';
            document.getElementById('template-description').value = '';
            document.getElementById('template-prompt').value = '';
            
            // Show form, hide list
            editForm.classList.remove('hidden');
            templateList.classList.add('hidden');
            
            // Update form title
            const formTitle = document.getElementById('template-form-title');
            if (formTitle) {
                formTitle.textContent = 'Create New Template';
            }
            
            // Hide delete button
            const deleteBtn = document.getElementById('delete-template-btn');
            if (deleteBtn) {
                deleteBtn.classList.add('hidden');
            }
        } else {
            console.error('Template edit form or list container not found');
        }
    }
    
    // Cancel template editing
    cancelTemplateEdit() {
        console.log('Canceling template edit');
        // Reset template being edited
        this.aiRefinementState.templateBeingEdited = null;
        
        // Hide edit form, show list
        const editForm = document.getElementById('template-editor-section');
        const templateList = document.getElementById('template-list-section');
        
        if (editForm && templateList) {
            editForm.classList.add('hidden');
            templateList.classList.remove('hidden');
        } else {
            console.error('Template edit form or list container not found');
        }
    }
    
    // Save template (create or update)
    async saveTemplate() {
        console.log('Saving template');
        try {
            // Get template being edited
            const template = this.aiRefinementState.templateBeingEdited;
            if (!template) {
                throw new Error('No template being edited');
            }
            
            // Get form values
            const name = document.getElementById('template-name').value.trim();
            const description = document.getElementById('template-description').value.trim();
            const prompt = document.getElementById('template-prompt').value.trim();
            
            // Validate
            if (!name) {
                throw new Error('Template name is required');
            }
            
            if (!prompt) {
                throw new Error('Template prompt is required');
            }
            
            // Update template data
            template.name = name;
            template.description = description;
            template.prompt = prompt;
            
            // Save template
            let result;
            if (template.id) {
                // Update existing template
                result = await window.electronAPI.updateTemplate(template.id, template);
            } else {
                // Create new template
                result = await window.electronAPI.createTemplate(template);
            }
            
            if (!result.success) {
                throw new Error(result.message || 'Failed to save template');
            }
            
            // Reload templates
            await this.loadTemplates();
            
            // Return to list view
            this.cancelTemplateEdit();
            
            // Render updated list
            this.renderTemplateList();
            
        } catch (error) {
            console.error('Error saving template:', error);
            this.showError(`Failed to save template: ${error.message}`);
        }
    }
    
    // Confirm delete template
    confirmDeleteTemplate() {
        console.log('Confirming template deletion');
        // Get template being edited
        const template = this.aiRefinementState.templateBeingEdited;
        if (!template || !template.id) {
            console.error('No template selected for deletion');
            return;
        }
        
        // Show confirmation modal
        const deleteModal = document.getElementById('delete-template-modal');
        if (deleteModal) {
            // Set template name in confirmation message
            const templateName = document.getElementById('delete-template-name');
            if (templateName) {
                templateName.textContent = template.name;
            }
            
            deleteModal.classList.remove('hidden');
        } else {
            console.error('Delete confirmation modal not found');
        }
    }
    
    // Close delete confirmation modal
    closeDeleteConfirmationModal() {
        console.log('Closing delete confirmation modal');
        const deleteModal = document.getElementById('delete-template-modal');
        if (deleteModal) {
            deleteModal.classList.add('hidden');
        } else {
            console.error('Delete confirmation modal not found');
        }
    }
    
    // Delete template
    async deleteTemplate() {
        console.log('Deleting template');
        try {
            // Get template being edited
            const template = this.aiRefinementState.templateBeingEdited;
            if (!template || !template.id) {
                throw new Error('No template selected for deletion');
            }
            
            // Delete template
            const result = await window.electronAPI.deleteTemplate(template.id);
            
            if (!result.success) {
                throw new Error(result.message || 'Failed to delete template');
            }
            
            // Close confirmation modal
            this.closeDeleteConfirmationModal();
            
            // Reload templates
            await this.loadTemplates();
            
            // Return to list view
            this.cancelTemplateEdit();
            
            // Render updated list
            this.renderTemplateList();
            
        } catch (error) {
            console.error('Error deleting template:', error);
            this.showError(`Failed to delete template: ${error.message}`);
        }
    }
    
    // Set a template as default
    async setDefaultTemplate(templateId) {
        console.log(`Setting template ${templateId} as default`);
        try {
            // Set default template
            const result = await window.electronAPI.setDefaultTemplate(templateId);
            
            if (!result.success) {
                throw new Error(result.message || 'Failed to set default template');
            }
            
            // Reload templates
            await this.loadTemplates();
            
            // Render updated list
            this.renderTemplateList();
            
        } catch (error) {
            console.error('Error setting default template:', error);
            this.showError(`Failed to set default template: ${error.message}`);
        }
    }
    
    // Helper function to show error messages
    showError(message) {
        console.error(message);
        // Show error notification if available
        if (typeof this.showNotification === 'function') {
            this.showNotification({
                type: 'error',
                message: message
            });
        } else {
            // Fallback to alert
            alert(message);
        }
    }
    
    // Test connection to Ollama server
    async testOllamaConnection() {
        try {
            // Update UI to show testing state
            const statusText = document.getElementById('ollama-status-text');
            statusText.textContent = 'Testing connection...';
            
            // Get endpoint from input field
            const endpoint = document.getElementById('ollama-endpoint').value;
            this.aiRefinementState.ollamaEndpoint = endpoint;
            
            // Call API to test connection
            const result = await window.electronAPI.testOllamaConnection(endpoint);
            
            if (result.success) {
                this.aiRefinementState.connected = true;
                statusText.textContent = 'Connected ✅';
                statusText.classList.remove('error');
                statusText.classList.add('success');
                
                return true;
            } else {
                throw new Error(result.error || 'Connection failed');
            }
        } catch (error) {
            console.error('Ollama connection test failed:', error);
            this.aiRefinementState.connected = false;
            
            const statusText = document.getElementById('ollama-status-text');
            statusText.textContent = `Not connected ❌ (${error.message})`;
            statusText.classList.remove('success');
            statusText.classList.add('error');
            
            return false;
        }
    }
    
    // Refresh list of available Ollama models
    async refreshOllamaModels() {
        try {
            // Only proceed if connected
            if (!this.aiRefinementState.connected) {
                return false;
            }
            
            const modelSelect = document.getElementById('ollama-model-select');
            modelSelect.innerHTML = '<option value="">Loading models...</option>';
            
            // Get endpoint from state
            const endpoint = this.aiRefinementState.ollamaEndpoint;
            
            // Call API to get models
            const result = await window.electronAPI.getOllamaModels(endpoint);
            
            if (result.success && result.models) {
                // Clear select options
                modelSelect.innerHTML = '';
                
                // Store models in state
                this.aiRefinementState.availableModels = result.models;
                
                // Create option for each model
                result.models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.name;
                    option.textContent = `${model.name} (${Math.round(model.size / (1024 * 1024))}MB)`;
                    modelSelect.appendChild(option);
                });
                
                // Select current model if it exists
                if (this.aiRefinementState.ollamaModel && 
                    result.models.some(m => m.name === this.aiRefinementState.ollamaModel)) {
                    console.log(`Setting Ollama model select to saved value: ${this.aiRefinementState.ollamaModel}`);
                    modelSelect.value = this.aiRefinementState.ollamaModel;
                    
                    // Save this selection explicitly to ensure it persists
                    try {
                        await window.electronAPI.saveAIRefinementSettings({
                            model: this.aiRefinementState.ollamaModel
                        });
                        console.log(`Saved selected Ollama model: ${this.aiRefinementState.ollamaModel}`);
                    } catch (error) {
                        console.error('Error saving Ollama model selection:', error);
                    }
                } else if (result.models.length > 0) {
                    // Otherwise select first model
                    this.aiRefinementState.ollamaModel = result.models[0].name;
                    modelSelect.value = result.models[0].name;
                    
                    // Save this default selection
                    try {
                        await window.electronAPI.saveAIRefinementSettings({
                            model: result.models[0].name
                        });
                        console.log(`Saved default Ollama model: ${result.models[0].name}`);
                    } catch (error) {
                        console.error('Error saving default Ollama model:', error);
                    }
                }
                
                return true;
            } else {
                throw new Error(result.error || 'Failed to retrieve models');
            }
        } catch (error) {
            console.error('Error refreshing Ollama models:', error);
            
            const modelSelect = document.getElementById('ollama-model-select');
            modelSelect.innerHTML = '<option value="">Failed to load models</option>';
            
            return false;
        }
    }

    async switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        this.currentTab = tabName;
        
        // If switching to transcription tab, ensure templates are loaded and dropdown is updated
        if (tabName === 'transcription' && this.refinementController) {
            try {
                // Reload templates in case they were added in settings
                await this.loadTemplates();
                
                // Check if template selector needs initialization
                if (this.refinementController && 
                    typeof this.refinementController.updateTemplateSelector === 'function') {
                    
                    // Initialize if needed
                    if (!this.refinementController.constructor.hasInitializedTemplateSelector) {
                        setTimeout(() => {
                            this.refinementController.updateTemplateSelector(false);
                        }, 500);
                    }
                }
            } catch (error) {
                console.error('Error loading templates for transcription tab:', error);
            }
        }
    }

    async selectFile() {
        try {
            const result = await window.electronAPI.selectFile();
            
            if (!result.canceled) {
                this.handleFileUpload(result.filePath, result.fileInfo);
            }
        } catch (error) {
            console.error('Error selecting file:', error);
            this.showError('Failed to select file');
        }
    }

    async handleFileUpload(filePath, fileInfo = null) {
        try {
            this.updateStatus('Processing file...');
            this.showProgress(true);
            this.showTranscriptionLoading(true);
            
            // Set up progress listener
            window.electronAPI.onTranscriptionProgress((event, progress) => {
                this.updateTranscriptionProgress(progress);
            });

            // Start transcription
            const result = await window.electronAPI.transcribeFile(filePath);
            console.log('🎬 Transcription result from IPC:', result);
            
            if (result.success) {
                this.showTranscriptionResult(result.text, result.segments);
                this.updateStatus(`Transcription completed (Language: ${result.language || 'unknown'})`);
                this.switchTab('transcription');
            } else {
                throw new Error('Transcription failed');
            }
            
        } catch (error) {
            console.error('Error processing file:', error);
            this.showError(error.message || 'Failed to process file');
        } finally {
            // Always hide loading states and progress
            this.showProgress(false);
            this.showTranscriptionLoading(false);
            // Clean up progress listener
            window.electronAPI.removeAllListeners('transcription:progress');
        }
    }

    isValidFileExtension(filename) {
        const validExtensions = ['.mp3', '.wav', '.m4a', '.flac', '.ogg', '.mp4', '.mov', '.avi', '.mkv', '.webm'];
        return validExtensions.some(ext => filename.toLowerCase().endsWith(ext));
    }

    async simulateProgress() {
        const progressFill = document.querySelector('.progress-fill');
        const progressText = document.querySelector('.progress-text');
        
        for (let i = 0; i <= 100; i += 10) {
            progressFill.style.width = `${i}%`;
            
            if (i < 30) {
                progressText.textContent = 'Validating file...';
            } else if (i < 70) {
                progressText.textContent = 'Processing audio...';
            } else {
                progressText.textContent = 'Preparing for transcription...';
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    async startRecording() {
        try {
            // Get recording constraints based on quality setting
            const constraints = this.getRecordingConstraints();
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Set up audio context for visualization and level monitoring
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.8;
            this.microphone.connect(this.analyser);
            
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);
            
            // Set up MediaRecorder
            const mimeType = this.getMimeType();
            this.mediaRecorder = new MediaRecorder(stream, { mimeType });
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: mimeType });
                this.recordingBlob = audioBlob;
                this.handleRecordingComplete(audioBlob);
            };
            
            this.mediaRecorder.start(100); // Collect data every 100ms
            this.isRecording = true;
            this.isPaused = false;
            this.recordingStartTime = Date.now();
            
            // Initialize auto-save session
            await this.initializeAutoSaveSession();
            
            this.updateRecordingUI();
            this.startRecordingTimer();
            this.startVisualization();
            this.startAutoSaveTimer();
            this.updateStatus('Recording... (Auto-save enabled)');
            
        } catch (error) {
            console.error('Error starting recording:', error);
            this.showError('Failed to start recording. Please check microphone permissions.');
        }
    }

    pauseRecording() {
        if (this.mediaRecorder && this.isRecording && !this.isPaused) {
            this.mediaRecorder.pause();
            this.isPaused = true;
            this.updateRecordingUI();
            this.stopRecordingTimer();
            this.stopVisualization();
            this.updateStatus('Recording paused');
        }
    }

    resumeRecording() {
        if (this.mediaRecorder && this.isPaused) {
            this.mediaRecorder.resume();
            this.isPaused = false;
            this.updateRecordingUI();
            this.startRecordingTimer();
            this.startVisualization();
            this.updateStatus('Recording...');
        }
    }

    async stopRecording() {
        if (this.mediaRecorder) {
            // Save final chunk before stopping
            await this.saveCurrentRecordingChunk();
            
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            
            // Clean up audio context
            if (this.audioContext) {
                this.audioContext.close();
                this.audioContext = null;
            }
            
            this.isRecording = false;
            this.isPaused = false;
            this.stopAutoSaveTimer();
            this.updateRecordingUI();
            this.stopRecordingTimer();
            this.stopVisualization();
            this.updateStatus('Processing recording...');
        }
    }

    updateRecordingUI() {
        const indicator = document.getElementById('record-indicator');
        const statusText = document.getElementById('record-status-text');
        const startBtn = document.getElementById('start-record-btn');
        const pauseBtn = document.getElementById('pause-record-btn');
        const resumeBtn = document.getElementById('resume-record-btn');
        const stopBtn = document.getElementById('stop-record-btn');
        const saveBtn = document.getElementById('save-record-btn');
        const transcribeBtn = document.getElementById('transcribe-record-btn');
        const clearBtn = document.getElementById('clear-record-btn');

        if (this.isRecording && !this.isPaused) {
            // Currently recording
            indicator.classList.add('recording');
            indicator.classList.remove('paused');
            statusText.textContent = 'Recording...';
            startBtn.classList.add('hidden');
            pauseBtn.classList.remove('hidden');
            resumeBtn.classList.add('hidden');
            stopBtn.classList.remove('hidden');
            saveBtn.classList.add('hidden');
            transcribeBtn.classList.add('hidden');
            clearBtn.classList.add('hidden');
        } else if (this.isPaused) {
            // Recording paused
            indicator.classList.remove('recording');
            indicator.classList.add('paused');
            statusText.textContent = 'Paused';
            startBtn.classList.add('hidden');
            pauseBtn.classList.add('hidden');
            resumeBtn.classList.remove('hidden');
            stopBtn.classList.remove('hidden');
            saveBtn.classList.add('hidden');
            transcribeBtn.classList.add('hidden');
            clearBtn.classList.add('hidden');
        } else if (this.recordingBlob) {
            // Recording completed
            indicator.classList.remove('recording', 'paused');
            statusText.textContent = 'Recording ready';
            startBtn.classList.remove('hidden');
            pauseBtn.classList.add('hidden');
            resumeBtn.classList.add('hidden');
            stopBtn.classList.add('hidden');
            saveBtn.classList.remove('hidden');
            clearBtn.classList.remove('hidden');
            
            // Always show transcribe button when recording is available
            // Users can transcribe again with different settings or models
            transcribeBtn.classList.remove('hidden');
        } else {
            // Ready to record
            indicator.classList.remove('recording', 'paused');
            statusText.textContent = 'Ready to record';
            startBtn.classList.remove('hidden');
            pauseBtn.classList.add('hidden');
            resumeBtn.classList.add('hidden');
            stopBtn.classList.add('hidden');
            saveBtn.classList.add('hidden');
            transcribeBtn.classList.add('hidden');
            clearBtn.classList.add('hidden');
        }
    }

    startRecordingTimer() {
        this.recordingTimer = setInterval(() => {
            const elapsed = Date.now() - this.recordingStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            document.getElementById('record-time').textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            // Update estimated file size
            this.updateRecordingSize(elapsed);
        }, 1000);
    }

    stopRecordingTimer() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
    }

    async handleRecordingComplete(audioBlob) {
        try {
            // Combine all saved chunks with the final recording
            const finalAudioBlob = await this.combineRecordingChunks(audioBlob);
            this.recordingBlob = finalAudioBlob;
            
            // Show recording info
            this.showRecordingInfo(finalAudioBlob);
            
            // Update UI to show the recording buttons now that recordingBlob is set
            this.updateRecordingUI();
            
            // Auto-transcribe if enabled
            if (this.recordingSettings.autoTranscribe) {
                this.showTranscriptionLoading(true);
                this.updateStatus('Processing recording...');
                
                // Convert blob to array buffer
                const arrayBuffer = await finalAudioBlob.arrayBuffer();
                
                // Set up progress listener
                window.electronAPI.onTranscriptionProgress((event, progress) => {
                    this.updateTranscriptionProgress(progress);
                });

                // Start transcription
                const result = await window.electronAPI.transcribeAudio(arrayBuffer);
                console.log('🎬 Audio transcription result from IPC:', result);
                console.log('🎬 Result text:', result.text);
                console.log('🎬 Result segments:', result.segments);
                console.log('🎬 Result segments length:', result.segments?.length);
                
                if (result.success) {
                    console.log('🎬 Calling showTranscriptionResult with:', {
                        text: result.text,
                        segments: result.segments,
                        textLength: result.text?.length,
                        segmentsLength: result.segments?.length
                    });
                    this.showTranscriptionResult(result.text, result.segments);
                    this.updateStatus(`Recording transcribed (Language: ${result.language || 'unknown'})`);
                    this.switchTab('transcription');
                    
                    // Keep recording available for saving or re-transcribing
                    // User can come back to recording tab and use the buttons
                } else {
                    throw new Error('Transcription failed');
                }
            } else {
                this.updateStatus('Recording completed. Use the buttons below to save, transcribe, or clear the recording.');
            }
            
        } catch (error) {
            console.error('Error processing recording:', error);
            this.showError('Failed to process recording');
            this.showTranscriptionLoading(false);
        } finally {
            // Clean up progress listener
            if (window.electronAPI) {
                window.electronAPI.removeAllListeners('transcription:progress');
            }
        }
    }

    showTranscriptionResult(text, segments = null) {
        console.log('🎬 showTranscriptionResult called with:', { 
            textLength: text?.length, 
            segmentsCount: segments?.length,
            segments: segments 
        });
        
        const transcriptionText = document.getElementById('transcription-text');
        const transcriptionSegments = document.getElementById('transcription-segments');
        const emptyState = document.getElementById('transcription-empty');
        const loadingState = document.getElementById('transcription-loading');
        const editor = document.getElementById('transcription-editor');
        
        console.log('🎬 DOM elements found:', {
            transcriptionText: !!transcriptionText,
            transcriptionSegments: !!transcriptionSegments,
            emptyState: !!emptyState,
            loadingState: !!loadingState,
            editor: !!editor
        });
        
        // Hide loading and empty states, show editor
        emptyState.classList.add('hidden');
        loadingState.classList.add('hidden');
        editor.classList.remove('hidden');
        console.log('🎬 Hidden loading and empty states, shown editor');
        
        // Initialize transcription state
        this.transcriptionState.originalText = text;
        this.transcriptionState.currentText = text;
        this.transcriptionState.isDirty = false;
        this.transcriptionState.lastSaved = new Date();
        this.transcriptionState.history = [text];
        this.transcriptionState.historyIndex = 0;
        this.transcriptionState.segments = segments || [];
        console.log('🎬 Updated transcription state');
        
        // Set up both views
        transcriptionText.value = text;
        console.log('🎬 Set transcription text value:', text?.substring(0, 50) + '...');
        
        if (segments && segments.length > 0) {
            console.log('🎬 Has segments, rendering timestamped view');
            this.renderTimestampedSegments(segments);
            
            // Make sure the appropriate view is shown based on the current mode
            if (this.transcriptionState.viewMode === 'timestamped') {
                console.log('🎬 Showing timestamped view after rendering segments');
                this.showTimestampedView();
            } else {
                console.log('🎬 Showing plain text view after rendering segments');
                this.showPlainTextView();
            }
        } else {
            // If no segments, always default to plain text view
            console.log('🎬 No segments, defaulting to plain text view');
            this.transcriptionState.viewMode = 'plain';
            this.showPlainTextView();
        }
    }
    
    /**
     * Update the transcription text and related UI state
     * Used by AI refinement and other processes
     * @param {string} text The new text to display
     */
    updateTranscriptionText(text) {
        const transcriptionText = document.getElementById('transcription-text');
        
        // Update the current text
        this.transcriptionState.currentText = text;
        this.transcriptionState.isDirty = true;
        
        // Update the text view
        transcriptionText.value = text;
        
        // When using plain view, ensure the segments view is hidden
        if (this.transcriptionState.viewMode === 'plain') {
            document.getElementById('transcription-segments').classList.add('hidden');
            transcriptionText.classList.remove('hidden');
        }
        
        // Auto-save the draft
        this.saveTranscriptionDraft();
        
        // Update UI indicators
        this.updateTranscriptionStatus();
        this.updateToggleButton();
    }
    
    /**
     * Save the current transcription text to history for undo/redo
     * Used before making significant changes like AI refinement
     */
    saveTranscriptionToHistory() {
        const currentText = this.transcriptionState.currentText;
        
        // Only add to history if we have text and it's different from the last entry
        if (currentText && 
            (this.transcriptionState.history.length === 0 || 
             currentText !== this.transcriptionState.history[this.transcriptionState.historyIndex])) {
            
            // If we're in the middle of the history stack, truncate the future history
            if (this.transcriptionState.historyIndex < this.transcriptionState.history.length - 1) {
                this.transcriptionState.history = this.transcriptionState.history.slice(0, this.transcriptionState.historyIndex + 1);
            }
            
            // Add current text to history
            this.transcriptionState.history.push(currentText);
            this.transcriptionState.historyIndex = this.transcriptionState.history.length - 1;
            
            // Limit history size to prevent memory issues (keep last 50 states)
            if (this.transcriptionState.history.length > 50) {
                this.transcriptionState.history = this.transcriptionState.history.slice(-50);
                this.transcriptionState.historyIndex = this.transcriptionState.history.length - 1;
            }
            
            // Update UI
            this.updateUndoRedoButtons();
        }
    }

    renderTimestampedSegments(segments) {
        console.log('🎬 Rendering timestamped segments:', segments);
        console.log('🎬 First segment example:', segments[0]);
        
        const container = document.getElementById('transcription-segments');
        if (!container) {
            console.error('🎬 ERROR: transcription-segments container not found!');
            return;
        }
        
        console.log('🎬 Container found, clearing content');
        container.innerHTML = '';
        
        // Group segments into paragraphs based on pauses or content breaks
        console.log('🎬 Grouping segments into paragraphs...');
        const paragraphs = this.groupSegmentsIntoParagraphs(segments);
        console.log('🎬 Grouped into', paragraphs.length, 'paragraphs');
        
        paragraphs.forEach((paragraph, paragraphIndex) => {
            paragraph.forEach((segment, segmentIndex) => {
                const segmentDiv = document.createElement('div');
                segmentDiv.className = 'transcription-segment';
                segmentDiv.dataset.segmentId = segment.id || `${paragraphIndex}-${segmentIndex}`;
                
                // Check if this is a speaker block (various dash formats)
                const text = segment.text.trim();
                const isSpeakerBlock = this.detectSpeakerChange(text);
                if (isSpeakerBlock) {
                    segmentDiv.classList.add('speaker-block');
                }
                
                // Create timestamp with duration info for merged blocks
                const timestampDiv = document.createElement('div');
                timestampDiv.className = 'segment-timestamp';
                const duration = segment.end - segment.start;
                const timestampText = segment.originalSegments 
                    ? `${this.formatTimestamp(segment.start)} - ${this.formatTimestamp(segment.end)} (${segment.originalSegments.length} parts)`
                    : this.formatTimestamp(segment.start);
                timestampDiv.textContent = timestampText;
                
                // Create text content
                const textDiv = document.createElement('div');
                textDiv.className = 'segment-text';
                textDiv.textContent = text;
                
                segmentDiv.appendChild(timestampDiv);
                segmentDiv.appendChild(textDiv);
                container.appendChild(segmentDiv);
            });
            
            // Add paragraph break if not the last paragraph
            if (paragraphIndex < paragraphs.length - 1) {
                const breakDiv = document.createElement('div');
                breakDiv.className = 'segment-paragraph-break';
                container.appendChild(breakDiv);
            }
        });
        
        console.log('🎬 Rendered', segments.length, 'segments in', paragraphs.length, 'paragraphs');
        console.log('🎬 Container innerHTML length:', container.innerHTML.length);
        console.log('🎬 Container children count:', container.children.length);
        
        // Debug container dimensions
        setTimeout(() => {
            const containerHeight = container.offsetHeight;
            const containerScrollHeight = container.scrollHeight;
            const containerClientHeight = container.clientHeight;
            console.log('🎬 Container dimensions:', {
                offsetHeight: containerHeight,
                scrollHeight: containerScrollHeight,
                clientHeight: containerClientHeight,
                hasScroll: containerScrollHeight > containerClientHeight,
                isVisible: !container.classList.contains('hidden'),
                innerHTML: container.innerHTML.substring(0, 200) + '...'
            });
        }, 100);
    }
    
    groupSegmentsIntoParagraphs(segments) {
        if (!segments || segments.length === 0) return [];
        
        console.log('🎭 Grouping segments by speaker...');
        
        // First, split segments that contain multiple speakers
        const expandedSegments = this.splitMultiSpeakerSegments(segments);
        console.log(`🎭 Expanded ${segments.length} segments into ${expandedSegments.length} segments after splitting multi-speaker segments`);
        
        const speakerBlocks = [];
        let currentBlock = [];
        
        for (let i = 0; i < expandedSegments.length; i++) {
            const segment = expandedSegments[i];
            const text = segment.text.trim();
            
            // Check if this segment indicates a new speaker (various dash formats)
            const isNewSpeaker = this.detectSpeakerChange(text);
            
            if (isNewSpeaker && currentBlock.length > 0) {
                // We hit a new speaker, so finish the current block
                const mergedBlock = this.mergeSegmentsIntoBlock(currentBlock);
                speakerBlocks.push([mergedBlock]);
                console.log(`🎭 Completed speaker block: ${mergedBlock.start}s-${mergedBlock.end}s (${currentBlock.length} segments)`);
                currentBlock = [];
            }
            
            // Add current segment to the block
            currentBlock.push(segment);
            
            // If this is the last segment, finish the current block
            if (i === expandedSegments.length - 1 && currentBlock.length > 0) {
                const mergedBlock = this.mergeSegmentsIntoBlock(currentBlock);
                speakerBlocks.push([mergedBlock]);
                console.log(`🎭 Completed final speaker block: ${mergedBlock.start}s-${mergedBlock.end}s (${currentBlock.length} segments)`);
            }
        }
        
        console.log(`🎭 Created ${speakerBlocks.length} speaker blocks from ${expandedSegments.length} expanded segments`);
        return speakerBlocks;
    }

    /**
     * Split segments that contain multiple speakers within the same segment
     */
    splitMultiSpeakerSegments(segments) {
        const expandedSegments = [];
        
        for (const segment of segments) {
            const text = segment.text.trim();
            
            // Find all speaker indicators within the text
            const speakerSplits = this.findSpeakerSplitsInText(text);
            
            if (speakerSplits.length <= 1) {
                // No splits needed, keep original segment
                expandedSegments.push(segment);
            } else {
                // Split the segment into multiple parts
                console.log(`🎭 Splitting segment with ${speakerSplits.length} speakers: "${text.substring(0, 50)}..."`);
                
                const duration = segment.end - segment.start;
                const segmentDuration = duration / speakerSplits.length;
                
                speakerSplits.forEach((splitText, index) => {
                    const startTime = segment.start + (index * segmentDuration);
                    const endTime = segment.start + ((index + 1) * segmentDuration);
                    
                    const newSegment = {
                        start: startTime,
                        end: endTime,
                        text: splitText.trim(),
                        id: segment.id ? `${segment.id}-split-${index}` : `split-${index}`,
                        originalSegment: segment // Keep reference to original
                    };
                    
                    expandedSegments.push(newSegment);
                    console.log(`🎭   Split ${index + 1}: ${startTime.toFixed(2)}s-${endTime.toFixed(2)}s "${splitText.trim().substring(0, 30)}..."`);
                });
            }
        }
        
        return expandedSegments;
    }

    /**
     * Find speaker splits within a text segment
     */
    findSpeakerSplitsInText(text) {
        if (!text || typeof text !== 'string') {
            return [text];
        }
        
        // Pattern to match speaker indicators (em dash, en dash, regular dash, double angle brackets)
        const speakerPattern = /(?:^|\s)(—|–|-|>>)\s*/g;
        
        const splits = [];
        let lastIndex = 0;
        let match;
        
        // Find all speaker indicators
        while ((match = speakerPattern.exec(text)) !== null) {
            const matchStart = match.index;
            const matchEnd = speakerPattern.lastIndex;
            
            // If this isn't the first match, add the previous text as a split
            if (matchStart > lastIndex) {
                const previousText = text.substring(lastIndex, matchStart).trim();
                if (previousText) {
                    splits.push(previousText);
                }
            }
            
            // Start the next split from this speaker indicator
            lastIndex = matchStart;
        }
        
        // Add the remaining text as the final split
        if (lastIndex < text.length) {
            const remainingText = text.substring(lastIndex).trim();
            if (remainingText) {
                splits.push(remainingText);
            }
        }
        
        // If no splits were found, return the original text
        if (splits.length === 0) {
            return [text];
        }
        
        return splits;
    }

    /**
     * Merge multiple segments into a single block with combined text and span timestamps
     */
    mergeSegmentsIntoBlock(segments) {
        if (!segments || segments.length === 0) {
            return { start: 0, end: 0, text: '' };
        }
           if (segments.length === 1) {
            return segments[0];
        }
        
        // Combine all text, preserving spaces
        const combinedText = segments
            .map(segment => segment.text.trim())
            .join(' ')
            .replace(/\s+/g, ' ') // Normalize multiple spaces
     
            .trim();
        
        // Use start time of first segment and end time of last segment
        const startTime = segments[0].start;
        const endTime = segments[segments.length - 1].end;
        
        console.log(`🎭 Merged ${segments.length} segments: ${startTime}s-${endTime}s "${combinedText.substring(0, 50)}..."`);
        
        return {
            start: startTime,
            end: endTime,
            text: combinedText,
            originalSegments: segments // Keep reference to original segments for debugging
        };
    }

    /**
     * Detect if text indicates a speaker change (various dash formats)
     */
    detectSpeakerChange(text) {
        if (!text || typeof text !== 'string') {
            return false;
        }
        
        // Normalize the text by trimming whitespace
        const normalizedText = text.trim();
        
        // Check for various speaker indicators:
        // "-", "- ", " -", " - ", "—", "— ", " —", " — ", ">>", ">> ", " >>", " >> ", etc.
        const speakerPatterns = [
            /^-\s*/, // Starts with regular dash, optionally followed by spaces
            /^\s*-\s*/, // Starts with optional spaces, regular dash, optional spaces
            /^—\s*/, // Starts with em dash, optionally followed by spaces
            /^\s*—\s*/, // Starts with optional spaces, em dash, optional spaces
            /^–\s*/, // Starts with en dash, optionally followed by spaces
            /^\s*–\s*/, // Starts with optional spaces, en dash, optional spaces
            /^>>\s*/, // Starts with double angle brackets, optionally followed by spaces
            /^\s*>>\s*/, // Starts with optional spaces, double angle brackets, optional spaces
        ];
        
        const isNewSpeaker = speakerPatterns.some(pattern => pattern.test(normalizedText));
        
        if (isNewSpeaker) {
            console.log(`🎭 Detected speaker change in: "${normalizedText.substring(0, 30)}..."`);
        }
        
        return isNewSpeaker;
    }
    
    formatTimestamp(seconds) {
        // Handle invalid or missing values
        if (seconds === null || seconds === undefined || isNaN(seconds) || seconds < 0) {
            console.warn('Invalid timestamp value:', seconds);
            return '00:00.00';
        }
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        const milliseconds = Math.floor((seconds % 1) * 100);
        
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
    }
    
    toggleViewMode() {
        // Check if we have segments first
        if (this.transcriptionState.segments.length === 0 && this.transcriptionState.viewMode === 'plain') {
            // No segments available and trying to switch to timestamped view
            console.log('🎬 Cannot switch to timestamped view - no segments available');
            
            // Show a notification to the user
            this.showNotification('No timestamp data available. The transcript needs to be generated with timestamps.', 'warning');
            
            // Keep in plain text mode
            this.transcriptionState.viewMode = 'plain';
        } else if (this.transcriptionState.viewMode === 'timestamped') {
            // Switching to plain text view
            this.transcriptionState.viewMode = 'plain';
            this.showPlainTextView();
        } else {
            // Switching to timestamped view
            this.transcriptionState.viewMode = 'timestamped';
            this.showTimestampedView();
        }
        
        // Update the button text/state
        this.updateToggleButton();
    }
    
    /**
     * Show a notification to the user
     * @param {string} message - The message to display
     * @param {string} type - The type of notification (info, warning, error)
     */
    showNotification(message, type = 'info') {
        const container = document.getElementById('notification-container') || this.createNotificationContainer();
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        container.appendChild(notification);
        
        // Auto-remove after a delay
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                if (container.contains(notification)) {
                    container.removeChild(notification);
                }
            }, 500);
        }, 3000);
    }
    
    /**
     * Create a notification container if it doesn't exist
     * @returns {HTMLElement} The notification container
     */
    createNotificationContainer() {
        const container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'notification-container';
        document.body.appendChild(container);
        return container;
    }
    
    showTimestampedView() {
        console.log('🎬 showTimestampedView called');
        const transcriptionText = document.getElementById('transcription-text');
        const transcriptionSegments = document.getElementById('transcription-segments');
        
        console.log('🎬 showTimestampedView elements:', {
            transcriptionText: !!transcriptionText,
            transcriptionSegments: !!transcriptionSegments,
            segmentsContent: transcriptionSegments?.innerHTML?.length
        });
        
        transcriptionText.classList.add('hidden');
        transcriptionSegments.classList.remove('hidden');
        console.log('🎬 Switched to timestamped view');
    }
    
    showPlainTextView() {
        console.log('🎬 showPlainTextView called');
        const transcriptionText = document.getElementById('transcription-text');
        const transcriptionSegments = document.getElementById('transcription-segments');
        
        console.log('🎬 showPlainTextView elements:', {
            transcriptionText: !!transcriptionText,
            transcriptionSegments: !!transcriptionSegments,
            textValue: transcriptionText?.value?.length,
            stateText: this.transcriptionState?.currentText?.length
        });
        
        // Ensure the textarea has the current text from the transcription state
        if (transcriptionText && this.transcriptionState.currentText) {
            transcriptionText.value = this.transcriptionState.currentText;
            console.log('🎬 Synced textarea with current text:', this.transcriptionState.currentText.substring(0, 50) + '...');
        }
        
        transcriptionSegments.classList.add('hidden');
        transcriptionText.classList.remove('hidden');
        console.log('🎬 Switched to plain text view');
    }
    
    updateToggleButton() {
        const toggleBtn = document.getElementById('toggle-view-btn');
        
        // Always enable the button, regardless of segments availability
        toggleBtn.disabled = false;
        
        if (this.transcriptionState.segments.length === 0) {
            // No segments available, but button still enabled
            if (this.transcriptionState.viewMode === 'timestamped') {
                // Force to plain text view if no segments are available
                this.transcriptionState.viewMode = 'plain';
                toggleBtn.textContent = '🕒 Timestamped View';
                toggleBtn.title = 'Switch to timestamped view (no timestamps currently available)';
            } else {
                toggleBtn.textContent = '🕒 Timestamped View';
                toggleBtn.title = 'Switch to timestamped view (no timestamps currently available)';
            }
        } else {
            // Has segments, normal behavior
            if (this.transcriptionState.viewMode === 'timestamped') {
                toggleBtn.textContent = '📝 Plain Text View';
                toggleBtn.title = 'Switch to plain text editing view';
            } else {
                toggleBtn.textContent = '🕒 Timestamped View';
                toggleBtn.title = 'Switch to timestamped segments view';
            }
        }
    }

    copyTranscription() {
        let textToCopy = '';
        
        if (this.transcriptionState.viewMode === 'timestamped' && this.transcriptionState.segments.length > 0) {
            // Copy with timestamps in the format [timestamp] text
            const paragraphs = this.groupSegmentsIntoParagraphs(this.transcriptionState.segments);
            
            paragraphs.forEach((paragraph, paragraphIndex) => {
                paragraph.forEach(segment => {
                    textToCopy += `[${this.formatTimestamp(segment.start)}] ${segment.text.trim()}\n`;
                });
                
                // Add paragraph break
                if (paragraphIndex < paragraphs.length - 1) {
                    textToCopy += '\n';
                }
            });
        } else {
            // Copy plain text
            const transcriptionText = document.getElementById('transcription-text');
            textToCopy = transcriptionText.value;
        }
        
        if (textToCopy) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                this.updateStatus('Transcription copied to clipboard');
            }).catch(() => {
                this.showError('Failed to copy to clipboard');
            });
        }
    }

    async downloadTranscription() {
        const transcriptionText = document.getElementById('transcription-text');
        
        if (transcriptionText.value) {
            try {
                const filename = `transcription-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
                const result = await window.electronAPI.saveFile(transcriptionText.value, filename);
                
                if (!result.canceled) {
                    this.updateStatus('Transcription saved successfully');
                    // Mark as saved
                    this.transcriptionState.isDirty = false;
                    this.transcriptionState.lastSaved = new Date();
                    this.updateTranscriptionStatus();
                }
            } catch (error) {
                console.error('Error saving transcription:', error);
                this.showError('Failed to save transcription');
            }
        }
    }

    // Auto-save and editing functionality
    handleTranscriptionEdit(newText) {
        const oldText = this.transcriptionState.currentText;
        
        if (newText !== oldText) {
            this.transcriptionState.currentText = newText;
            this.transcriptionState.isDirty = true;
            
            // Add to history for undo/redo
            if (this.transcriptionState.historyIndex < this.transcriptionState.history.length - 1) {
                // Remove future history if we're not at the end
                this.transcriptionState.history = this.transcriptionState.history.slice(0, this.transcriptionState.historyIndex + 1);
            }
            this.transcriptionState.history.push(newText);
            this.transcriptionState.historyIndex = this.transcriptionState.history.length - 1;
            
            // Limit history size
            if (this.transcriptionState.history.length > 50) {
                this.transcriptionState.history.shift();
                this.transcriptionState.historyIndex--;
            }
            
            // Update status
            this.updateTranscriptionStatus();
            
            // Schedule auto-save
            this.scheduleAutoSave();
        }
    }

    scheduleAutoSave() {
        // Clear existing timer
        if (this.transcriptionState.autoSaveTimer) {
            clearTimeout(this.transcriptionState.autoSaveTimer);
        }
        
        // Schedule new auto-save in 2 seconds
        this.transcriptionState.autoSaveTimer = setTimeout(() => {
            this.saveTranscriptionDraft();
        }, 2000);
    }

    async saveTranscriptionDraft() {
        if (this.transcriptionState.isDirty && this.transcriptionState.currentText) {
            try {
                const draft = {
                    text: this.transcriptionState.currentText,
                    originalText: this.transcriptionState.originalText,
                    timestamp: new Date().toISOString(),
                    wordCount: this.getWordCount(this.transcriptionState.currentText)
                };
                
                localStorage.setItem('whisper-transcription-draft', JSON.stringify(draft));
                this.transcriptionState.lastSaved = new Date();
                this.updateTranscriptionStatus();
                
                console.log('Draft auto-saved');
            } catch (error) {
                console.error('Failed to save draft:', error);
            }
        }
    }

    loadTranscriptionDraft() {
        try {
            const draftData = localStorage.getItem('whisper-transcription-draft');
            if (draftData) {
                const draft = JSON.parse(draftData);
                const transcriptionText = document.getElementById('transcription-text');
                
                // Only load if there's no current transcription
                if (!transcriptionText.value && draft.text) {
                    transcriptionText.value = draft.text;
                    this.transcriptionState.currentText = draft.text;
                    this.transcriptionState.originalText = draft.originalText || '';
                    this.transcriptionState.isDirty = true;
                    this.transcriptionState.lastSaved = new Date(draft.timestamp);
                    
                    this.updateTranscriptionStatus();
                    this.updateStatus('Draft loaded from previous session');
                    
                    // Show transcription tab content
                    const emptyState = document.getElementById('transcription-empty');
                    emptyState.classList.add('hidden');
                }
            }
        } catch (error) {
            console.error('Failed to load draft:', error);
        }
    }

    clearTranscriptionDraft() {
        localStorage.removeItem('whisper-transcription-draft');
        this.transcriptionState.isDirty = false;
        this.updateTranscriptionStatus();
    }

    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + Z for undo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            this.undoTranscription();
        }
        
        // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y for redo
        if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') || 
            ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
            e.preventDefault();
            this.redoTranscription();
        }
        
        // Ctrl/Cmd + S for save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            this.downloadTranscription();
        }
        

        
        // Ctrl/Cmd + A for select all
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            // Let default behavior happen
        }
    }

    undoTranscription() {
        // Only perform the undo if there's history to undo to
        if (this.transcriptionState.historyIndex > 0) {
            this.transcriptionState.historyIndex--;
            const previousText = this.transcriptionState.history[this.transcriptionState.historyIndex];
            
            const transcriptionText = document.getElementById('transcription-text');
            transcriptionText.value = previousText;
            this.transcriptionState.currentText = previousText;
            this.transcriptionState.isDirty = previousText !== this.transcriptionState.originalText;
            
            this.updateTranscriptionStatus();
            this.scheduleAutoSave();
        } else {
            // If no history to undo to, just show a status update
            this.updateStatus('Nothing to undo');
        }
    }

    redoTranscription() {
        // Only perform the redo if there's history to redo to
        if (this.transcriptionState.historyIndex < this.transcriptionState.history.length - 1) {
            this.transcriptionState.historyIndex++;
            const nextText = this.transcriptionState.history[this.transcriptionState.historyIndex];
            
            const transcriptionText = document.getElementById('transcription-text');
            transcriptionText.value = nextText;
            this.transcriptionState.currentText = nextText;
            this.transcriptionState.isDirty = nextText !== this.transcriptionState.originalText;
            
            this.updateTranscriptionStatus();
            this.scheduleAutoSave();
        } else {
            // If no history to redo to, just show a status update
            this.updateStatus('Nothing to redo');
        }
    }

    getWordCount(text) {
        if (!text) return 0;
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    getCharacterCount(text) {
        return text ? text.length : 0;
    }

    updateTranscriptionStatus() {
        const wordCount = this.getWordCount(this.transcriptionState.currentText);
        const charCount = this.getCharacterCount(this.transcriptionState.currentText);
        
        // Update status in footer or transcription area
        let statusText = `${wordCount} words, ${charCount} characters`;
        
        if (this.transcriptionState.isDirty) {
            statusText += ' • Unsaved changes';
        } else if (this.transcriptionState.lastSaved) {
            const timeSince = Math.floor((new Date() - this.transcriptionState.lastSaved) / 1000);
            if (timeSince < 60) {
                statusText += ' • Saved just now';
            } else if (timeSince < 3600) {
                statusText += ` • Saved ${Math.floor(timeSince / 60)}m ago`;
            } else {
                statusText += ` • Saved ${Math.floor(timeSince / 3600)}h ago`;
            }
        }
        
        // Update the status text
        const statusElement = document.getElementById('transcription-status');
        if (statusElement) {
            statusElement.textContent = statusText;
        }
    }

    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        
        // Always keep buttons enabled as requested
        if (undoBtn) {
            undoBtn.disabled = false;
        }
        
        if (redoBtn) {
            redoBtn.disabled = false;
        }
    }

    // Export dropdown functionality
    setupExportDropdown() {
        const dropdownBtn = document.getElementById('export-dropdown-btn');
        const dropdownMenu = document.getElementById('export-dropdown');
        
        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle('hidden');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            dropdownMenu.classList.add('hidden');
        });
        
        // Export handlers
        document.getElementById('export-txt-btn').addEventListener('click', () => {
            this.exportAs('txt');
            dropdownMenu.classList.add('hidden');
        });
        
        document.getElementById('export-md-btn').addEventListener('click', () => {
            this.exportAs('md');
            dropdownMenu.classList.add('hidden');
        });
        
        document.getElementById('export-json-btn').addEventListener('click', () => {
            this.exportAs('json');
            dropdownMenu.classList.add('hidden');
        });
    }

    async exportAs(format) {
        const transcriptionText = document.getElementById('transcription-text');
        
        if (!transcriptionText.value) {
            this.showError('No transcription to export');
            return;
        }
        
        try {
            let content = '';
            let extension = '';
            let mimeType = '';
            
            switch (format) {
                case 'txt':
                    content = transcriptionText.value;
                    extension = 'txt';
                    mimeType = 'text/plain';
                    break;
                    
                case 'md':
                    content = this.formatAsMarkdown(transcriptionText.value);
                    extension = 'md';
                    mimeType = 'text/markdown';
                    break;
                    
                case 'json':
                    content = this.formatAsJSON(transcriptionText.value);
                    extension = 'json';
                    mimeType = 'application/json';
                    break;
                    
                default:
                    throw new Error('Unsupported format');
            }
            
            const filename = `transcription-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${extension}`;
            const result = await window.electronAPI.saveFile(content, filename);
            
            if (!result.canceled) {
                this.updateStatus(`Transcription exported as ${format.toUpperCase()}`);
                // Mark as saved if it's the current content
                if (format === 'txt') {
                    this.transcriptionState.isDirty = false;
                    this.transcriptionState.lastSaved = new Date();
                    this.updateTranscriptionStatus();
                }
            }
        } catch (error) {
            console.error('Error exporting transcription:', error);
            this.showError(`Failed to export as ${format.toUpperCase()}`);
        }
    }

    formatAsMarkdown(text) {
        const timestamp = new Date().toISOString();
        const wordCount = this.getWordCount(text);
        
        return `# Transcription

**Generated:** ${timestamp}  
**Word Count:** ${wordCount}

---

${text}

---

*Generated by Whisper Wrapper*`;
    }

    formatAsJSON(text) {
        const data = {
            transcription: text,
            metadata: {
                timestamp: new Date().toISOString(),
                wordCount: this.getWordCount(text),
                characterCount: this.getCharacterCount(text),
                generatedBy: 'Whisper Wrapper'
            }
        };
        
        return JSON.stringify(data, null, 2);
    }



    clearDraft() {
        if (confirm('Are you sure you want to clear the current transcription? This action cannot be undone.')) {
            const transcriptionText = document.getElementById('transcription-text');
            const transcriptionSegments = document.getElementById('transcription-segments');
            
            // Clear both text and segments
            transcriptionText.value = '';
            transcriptionSegments.innerHTML = '';
            
            // Reset state
            this.transcriptionState = {
                originalText: '',
                currentText: '',
                isDirty: false,
                lastSaved: null,
                autoSaveTimer: null,
                history: [''],
                historyIndex: 0,
                viewMode: this.transcriptionState.viewMode || 'plain' // Preserve view mode
            };
            
            // Clear stored segments
            this.currentSegments = [];
            
            this.clearTranscriptionDraft();
            this.updateTranscriptionStatus();
            this.updateUndoRedoButtons();
            
            // Show empty state and hide both views
            const emptyState = document.getElementById('transcription-empty');
            emptyState.classList.remove('hidden');
            transcriptionText.classList.add('hidden');
            transcriptionSegments.classList.add('hidden');
            
            console.log('🧹 Cleared transcription in both plain text and timestamped views');
            
            this.updateStatus('Transcription cleared');
        }
    }

    async openSettings() {
        const settingsHeader = document.getElementById('settings-header');
        const settingsBtn = document.getElementById('settings-btn');
        
        // Show settings
        settingsHeader.classList.remove('hidden');
        settingsHeader.classList.add('visible');
        settingsBtn.classList.add('active');
        
        // Update content
        await this.updateModelOptions();
        await this.checkWhisperStatus();
        await this.loadSettings();
    }
    
    async closeSettings() {
        const settingsHeader = document.getElementById('settings-header');
        const settingsBtn = document.getElementById('settings-btn');
        
        // Hide settings
        settingsHeader.classList.remove('visible');
        settingsBtn.classList.remove('active');
        
        // After animation completes
        setTimeout(() => {
            if (!settingsHeader.classList.contains('visible')) {
                settingsHeader.classList.add('hidden');
            }
        }, 300);
    }
    
    // Keep this method for compatibility with existing code
    async toggleSettings() {
        const settingsHeader = document.getElementById('settings-header');
        const isHidden = settingsHeader.classList.contains('hidden');
        
        if (isHidden) {
            await this.openSettings();
        } else {
            await this.closeSettings();
        }
    }

    async saveSettings() {
        try {
            const model = document.getElementById('model-select').value;
            const language = document.getElementById('language-select').value;
            const threads = parseInt(document.getElementById('threads-select').value);
            const translate = document.getElementById('translate-checkbox').checked;
            const useInitialPrompt = document.getElementById('use-initial-prompt-checkbox').checked;
            const initialPrompt = document.getElementById('initial-prompt').value;
            
            const settings = {
                model,
                language,
                threads,
                translate,
                useInitialPrompt,
                initialPrompt
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
            try {
                console.log('Saving AI Refinement settings');
                // Check if the API is available
                if (!window.electronAPI || !window.electronAPI.getConfig || !window.electronAPI.setConfig) {
                    console.warn('electronAPI methods not available for saving AI Refinement settings');
                    return;
                }
                
                // Get current config to update only the AI Refinement section
                const currentConfig = await window.electronAPI.getConfig();
                
                // Update AI Refinement settings
                const enabledCheckbox = document.getElementById('ai-refinement-enabled-checkbox');
                const endpointInput = document.getElementById('ollama-endpoint');
                const modelSelect = document.getElementById('ollama-model-select');
                const timeoutInput = document.getElementById('ollama-timeout');
                
                // Create updated settings object
                const aiRefinementSettings = {
                    enabled: enabledCheckbox ? enabledCheckbox.checked : false,
                    endpoint: endpointInput ? endpointInput.value : 'http://localhost:11434',
                    model: modelSelect && modelSelect.value ? modelSelect.value : this.aiRefinementState.ollamaModel,
                    timeoutSeconds: timeoutInput ? parseInt(timeoutInput.value) : 30
                };
                
                // Update state
                this.aiRefinementState.enabled = aiRefinementSettings.enabled;
                this.aiRefinementState.ollamaEndpoint = aiRefinementSettings.endpoint;
                this.aiRefinementState.ollamaModel = aiRefinementSettings.model;
                this.aiRefinementState.timeout = aiRefinementSettings.timeoutSeconds;
                
                // Save using the dedicated method instead of mixing with main config
                const result = await window.electronAPI.saveAIRefinementSettings(aiRefinementSettings);
                if (!result.success) {
                    throw new Error('Failed to save AI Refinement settings');
                }
                
                console.log('AI Refinement settings saved successfully');
            } catch (error) {
                console.error('Error saving AI Refinement settings:', error);
                throw error; // Rethrow to be caught by parent function
            }
            
            this.closeSettings();
            this.updateStatus('Settings saved');
            
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showError(error.message || 'Failed to save settings');
        }
    }

    async loadSettings() {
        try {
            const settings = await window.electronAPI.getConfig();
            console.log('Loaded settings:', settings);
            
            if (settings.model) {
                document.getElementById('model-select').value = settings.model;
                this.updateModelDescription(settings.model);
            }
            if (settings.language) {
                document.getElementById('language-select').value = settings.language;
            }
            if (settings.threads) {
                document.getElementById('threads-select').value = settings.threads.toString();
            }
            if (settings.translate !== undefined) {
                document.getElementById('translate-checkbox').checked = settings.translate;
            }
            if (settings.useInitialPrompt !== undefined) {
                document.getElementById('use-initial-prompt-checkbox').checked = settings.useInitialPrompt;
            }
            if (settings.initialPrompt !== undefined) {
                document.getElementById('initial-prompt').value = settings.initialPrompt;
            }
            
            // Update initial prompt textarea state based on checkbox
            this.updateInitialPromptState();
            
            // Load AI Refinement settings
            try {
                // Check if the API is available
                if (!window.electronAPI || !window.electronAPI.getConfig) {
                    console.warn('electronAPI.getConfig not available for loading AI Refinement settings');
                    return;
                }
                
                // Get AI Refinement settings using the dedicated method
                const aiSettings = await window.electronAPI.getAIRefinementSettings();
                if (aiSettings) {
                    this.aiRefinementState.enabled = aiSettings.enabled || false;
                    this.aiRefinementState.ollamaEndpoint = aiSettings.endpoint || 'http://localhost:11434';
                    this.aiRefinementState.ollamaModel = aiSettings.model || '';
                    this.aiRefinementState.timeout = aiSettings.timeoutSeconds || 300; // Use 300s as default to match config.js
                    
                    // Update UI elements if they exist
                    const enabledCheckbox = document.getElementById('ai-refinement-enabled-checkbox');
                    const endpointInput = document.getElementById('ollama-endpoint');
                    const timeoutInput = document.getElementById('ollama-timeout');
                    const modelSelect = document.getElementById('ollama-model-select');
                    
                    if (enabledCheckbox) enabledCheckbox.checked = this.aiRefinementState.enabled;
                    if (endpointInput) endpointInput.value = this.aiRefinementState.ollamaEndpoint;
                    if (timeoutInput) timeoutInput.value = this.aiRefinementState.timeout;
                    
                    // We'll populate the model after fetching the list of models, but store it for later use
                    console.log('Stored Ollama model from settings:', this.aiRefinementState.ollamaModel);
                    
                    // Update UI state if the method exists
                    if (typeof this.updateAIRefinementUIState === 'function') {
                        this.updateAIRefinementUIState();
                    }
                }
            } catch (error) {
                console.error('Error loading AI Refinement settings:', error);
            }
            
            // Test Ollama connection if AI Refinement is enabled
            if (this.aiRefinementState.enabled) {
                await this.testOllamaConnection();
                await this.refreshOllamaModels();
            }
            
            // Always load templates - needed for dropdown population regardless of enabled state
            await this.loadTemplates();
            
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }
    
    updateInitialPromptState() {
        const useInitialPrompt = document.getElementById('use-initial-prompt-checkbox').checked;
        const initialPromptTextarea = document.getElementById('initial-prompt');
        
        // Enable/disable the textarea based on checkbox state
        initialPromptTextarea.disabled = !useInitialPrompt;
        
        // Visual feedback - make it look disabled/enabled
        if (useInitialPrompt) {
            initialPromptTextarea.classList.remove('disabled');
            initialPromptTextarea.style.opacity = '1';
        } else {
            initialPromptTextarea.classList.add('disabled');
            initialPromptTextarea.style.opacity = '0.5';
        }
        
        console.log(`🔄 Initial prompt checkbox toggled: ${useInitialPrompt ? 'ENABLED ✅' : 'DISABLED ❌'}`);
        
        // Immediately update the setting in the main process
        this.updateInitialPromptSetting(useInitialPrompt);
    }
    
    async updateInitialPromptSetting(useInitialPrompt) {
        try {
            // Get current settings first
            const currentSettings = await window.electronAPI.getConfig();
            
            // Update just the useInitialPrompt setting
            const updatedSettings = {
                ...currentSettings,
                useInitialPrompt: useInitialPrompt
            };
            
            console.log('🔄 Updating initial prompt setting:', { useInitialPrompt });
            
            // Save the updated settings
            const result = await window.electronAPI.setConfig(updatedSettings);
            console.log('🔄 Initial prompt setting updated:', result);
        } catch (error) {
            console.error('❌ Error updating initial prompt setting:', error);
        }
    }

    openModelComparison() {
        document.getElementById('model-comparison-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        
        // Add click handlers for model rows
        document.querySelectorAll('.model-row[data-model]').forEach(row => {
            row.addEventListener('click', (e) => {
                const modelName = e.currentTarget.dataset.model;
                this.selectModelFromComparison(modelName);
            });
        });
    }

    closeModelComparison() {
        const modal = document.getElementById('model-comparison-modal');
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
        
        // Remove event listeners to prevent duplicates
        document.querySelectorAll('.model-row[data-model]').forEach(row => {
            row.replaceWith(row.cloneNode(true));
        });
    }

    selectModelFromComparison(modelName) {
        // Set the model in the settings dropdown
        const modelSelect = document.getElementById('model-select');
        if (modelSelect) {
            modelSelect.value = modelName;
            this.updateModelDescription(modelName);
        }
        
        // Close the comparison modal
        this.closeModelComparison();
        
        // Show a confirmation message
        this.updateStatus(`Selected model: ${modelName}`);
    }

    updateModelDescription(modelName) {
        const descriptions = {
            'tiny': 'Fastest model with basic accuracy. Best for quick transcription on low-resource devices.',
            'tiny.en': 'Fastest English-only model with improved accuracy over multilingual tiny. Ideal for English content.',
            'base': 'Good balance of speed and accuracy. Recommended for most general use cases.',
            'base.en': 'English-only base model with better accuracy than multilingual base for English content.',
            'small': 'Higher accuracy with moderate speed. Good for professional transcription needs.',
            'small.en': 'English-only small model with enhanced accuracy for English content.',
            'medium': 'High accuracy model suitable for professional and production use.',
            'medium.en': 'English-only medium model with excellent accuracy for English content.',
            'large': 'Highest accuracy model. Best for research, production, and critical applications.',
            'turbo': 'Optimized large model with 8x faster processing and minimal accuracy loss. Best overall choice for most users.'
        };

        const descriptionElement = document.getElementById('model-description');
        if (descriptionElement && descriptions[modelName]) {
            descriptionElement.textContent = descriptions[modelName];
        }
    }

    showProgress(show) {
        const uploadArea = document.getElementById('file-upload');
        const progressArea = document.getElementById('upload-progress');
        
        if (show) {
            uploadArea.classList.add('hidden');
            progressArea.classList.remove('hidden');
        } else {
            uploadArea.classList.remove('hidden');
            progressArea.classList.add('hidden');
        }
    }

    updateStatus(message) {
        document.getElementById('status-text').textContent = message;
    }

    showError(message) {
        this.updateStatus(`Error: ${message}`);
        console.error(message);
    }

    showTranscriptionLoading(show) {
        const loadingState = document.getElementById('transcription-loading');
        const emptyState = document.getElementById('transcription-empty');
        const editor = document.getElementById('transcription-editor');
        
        if (show) {
            loadingState.classList.remove('hidden');
            emptyState.classList.add('hidden');
            editor.classList.add('hidden');
        } else {
            loadingState.classList.add('hidden');
            editor.classList.remove('hidden');
        }
    }

    updateTranscriptionProgress(progress) {
        const progressText = document.querySelector('.progress-text');
        const loadingText = document.querySelector('#transcription-loading p');
        
        if (progress.status === 'processing') {
            if (progressText) {
                progressText.textContent = progress.message;
            }
            if (loadingText) {
                loadingText.textContent = progress.message;
            }
        } else if (progress.status === 'error') {
            this.showError(progress.message);
        }
    }

    // Enhanced Recording Methods

    getRecordingConstraints() {
        const constraints = { audio: true };
        
        switch (this.recordingSettings.quality) {
        case 'medium':
            constraints.audio = {
                sampleRate: { ideal: 22050 },
                channelCount: { ideal: 1 },
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            };
            break;
        case 'low':
            constraints.audio = {
                sampleRate: { ideal: 16000 },
                channelCount: { ideal: 1 },
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            };
            break;
        default:
            // Fallback to basic audio constraints
            constraints.audio = true;
            break;
        }
        
        return constraints;
    }

    getMimeType() {
        const format = this.recordingSettings.format;
        
        if (format === 'webm' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            return 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/wav')) {
            return 'audio/wav';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            return 'audio/mp4';
        } else {
            return 'audio/webm';
        }
    }

    initializeVisualization() {
        const canvas = document.getElementById('audio-visualizer');
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.fillStyle = '#f7fafc';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw placeholder text
        ctx.fillStyle = '#a0aec0';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Audio visualization will appear here during recording', canvas.width / 2, canvas.height / 2);
    }

    startVisualization() {
        if (!this.analyser) return;
        
        const canvas = document.getElementById('audio-visualizer');
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        const draw = () => {
            if (!this.isRecording || this.isPaused) return;
            
            this.animationId = requestAnimationFrame(draw);
            
            this.analyser.getByteFrequencyData(this.dataArray);
            
            // Clear canvas
            ctx.fillStyle = '#f7fafc';
            ctx.fillRect(0, 0, width, height);
            
            // Draw frequency bars
            const barWidth = width / this.dataArray.length * 2.5;
            let barHeight;
            let x = 0;
            
            for (let i = 0; i < this.dataArray.length; i++) {
                barHeight = (this.dataArray[i] / 255) * height * 0.8;
                
                const hue = (i / this.dataArray.length) * 360;
                ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
                
                ctx.fillRect(x, height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }
            
            // Update audio level meter
            this.updateAudioLevel();
        };
        
        draw();
    }

    stopVisualization() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Reset visualization
        this.initializeVisualization();
        
        // Reset audio level
        document.getElementById('audio-level-bar').style.width = '0%';
        document.getElementById('audio-level-text').textContent = '0%';
    }

    updateAudioLevel() {
        if (!this.analyser) return;
        
        this.analyser.getByteFrequencyData(this.dataArray);
        
        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i];
        }
        const average = sum / this.dataArray.length;
        const percentage = Math.round((average / 255) * 100);
        
        // Update UI
        document.getElementById('audio-level-bar').style.width = `${percentage}%`;
        document.getElementById('audio-level-text').textContent = `${percentage}%`;
    }

    updateRecordingSize(elapsed) {
        // Estimate file size based on quality settings and elapsed time
        let bytesPerSecond;
        
        switch (this.recordingSettings.quality) {
        case 'high':
            bytesPerSecond = 176400; // 44.1kHz * 2 channels * 2 bytes
            break;
        case 'medium':
            bytesPerSecond = 44100; // 22kHz * 1 channel * 2 bytes
            break;
        case 'low':
            bytesPerSecond = 32000; // 16kHz * 1 channel * 2 bytes
            break;
        default:
            bytesPerSecond = 44100;
        }
        
        const estimatedBytes = (elapsed / 1000) * bytesPerSecond;
        const sizeText = this.formatFileSize(estimatedBytes);
        
        document.getElementById('record-size').textContent = sizeText;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 KB';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    showRecordingInfo(audioBlob) {
        const duration = Date.now() - this.recordingStartTime;
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        const durationText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        const sizeText = this.formatFileSize(audioBlob.size);
        const qualityText = this.recordingSettings.quality.charAt(0).toUpperCase() + this.recordingSettings.quality.slice(1);
        
        document.getElementById('final-duration').textContent = durationText;
        document.getElementById('final-size').textContent = sizeText;
        document.getElementById('final-quality').textContent = qualityText;
        document.getElementById('recording-info').classList.remove('hidden');
    }

    async saveRecording() {
        if (!this.recordingBlob) {
            this.showError('No recording to save');
            return;
        }
        
        try {
            // Convert blob to array buffer
            const arrayBuffer = await this.recordingBlob.arrayBuffer();
            
            // Create filename with timestamp
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const extension = this.recordingSettings.format === 'webm' ? 'webm' : 'wav';
            const filename = `recording-${timestamp}.${extension}`;
            
            // Save file using Electron API
            const result = await window.electronAPI.saveFile(arrayBuffer, filename);
            
            if (!result.canceled) {
                this.updateStatus('Recording saved successfully');
            }
        } catch (error) {
            console.error('Error saving recording:', error);
            this.showError('Failed to save recording');
        }
    }

    async transcribeRecording() {
        if (!this.recordingBlob) {
            this.showError('No recording to transcribe');
            return;
        }
        
        try {
            this.showTranscriptionLoading(true);
            this.updateStatus('Processing recording...');
            
            // Convert blob to array buffer
            const arrayBuffer = await this.recordingBlob.arrayBuffer();
            
            // Set up progress listener
            window.electronAPI.onTranscriptionProgress((event, progress) => {
                this.updateTranscriptionProgress(progress);
            });

            // Start transcription
            const result = await window.electronAPI.transcribeAudio(arrayBuffer);
            console.log('🎬 Manual transcription result from IPC:', result);
            
            if (result.success) {
                this.showTranscriptionResult(result.text, result.segments);
                this.updateStatus(`Recording transcribed (Language: ${result.language || 'unknown'})`);
                this.switchTab('transcription');
            } else {
                throw new Error('Transcription failed');
            }
            
        } catch (error) {
            console.error('Error transcribing recording:', error);
            this.showError('Failed to transcribe recording');
            this.showTranscriptionLoading(false);
        } finally {
            // Clean up progress listener
            if (window.electronAPI) {
                window.electronAPI.removeAllListeners('transcription:progress');
            }
        }
    }

    clearRecording() {
        if (!this.recordingBlob) {
            return;
        }
        
        // Ask for confirmation
        if (confirm('Are you sure you want to clear the recording? This action cannot be undone.')) {
            // Clear recording state
            this.recordingBlob = null;
            this.updateRecordingUI();
            document.getElementById('recording-info').classList.add('hidden');
            document.getElementById('record-time').textContent = '00:00';
            document.getElementById('record-size').textContent = '0 KB';
            this.updateStatus('Recording cleared');
        }
    }

    // Local Whisper Methods

    async checkWhisperStatus() {
        try {
            const statusElement = document.getElementById('whisper-status');
            const statusText = document.getElementById('whisper-status-text');
            const setupButton = document.getElementById('setup-whisper-btn');
            
            statusText.textContent = 'Checking...';
            statusElement.className = 'status-indicator';
            setupButton.style.display = 'none';
            
            // Test local Whisper installation
            const testResult = await window.electronAPI.testWhisper();
            
            if (testResult.success) {
                statusText.textContent = 'Local Whisper is ready';
                statusElement.className = 'status-indicator success';
                
                // Update model options with available models
                this.updateModelOptions(testResult.details.availableModels);
            } else {
                statusText.textContent = testResult.message || 'Local Whisper not available';
                statusElement.className = 'status-indicator error';
                setupButton.style.display = 'inline-block';
            }
            
        } catch (error) {
            console.error('Error checking Whisper status:', error);
            const statusElement = document.getElementById('whisper-status');
            const statusText = document.getElementById('whisper-status-text');
            const setupButton = document.getElementById('setup-whisper-btn');
            
            statusText.textContent = 'Error checking Whisper status';
            statusElement.className = 'status-indicator error';
            setupButton.style.display = 'inline-block';
        }
    }

    async updateModelOptions(availableModels) {
        const modelSelect = document.getElementById('model-select');
        
        // Clear existing options
        modelSelect.innerHTML = '';
        
        // Always use the full list of models from configuration, not just the ones physically present
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
            
            // Create display text based on model data
            let displayText;
            if (model.display) {
                displayText = model.display;
            } else {
                const displayName = model.name.includes('.en') 
                    ? `${model.name.replace('.en', '')} English-only`.replace(/^\w/, c => c.toUpperCase())
                    : model.name.charAt(0).toUpperCase() + model.name.slice(1);
                displayText = `${displayName} (${model.size}, ${model.vram}, ${model.speed} speed)`;
            }
            
            // Add download status indicator
            const isDownloaded = downloadedModels.has(model.name);
            if (isDownloaded) {
                option.textContent = `✓ ${displayText}`;
                option.style.color = '#22c55e'; // Green color for downloaded models
            } else {
                option.textContent = `⬇ ${displayText}`;
                option.style.color = '#6b7280'; // Gray color for not downloaded models
                option.disabled = true; // Disable models that aren't downloaded
            }
            
            modelSelect.appendChild(option);
        });
    }

    getDefaultModels() {
        return [
            { name: 'tiny', size: '39M params', vram: '~1GB', speed: '~10x', type: 'multilingual' },
            { name: 'tiny.en', size: '39M params', vram: '~1GB', speed: '~10x', type: 'english-only' },
            { name: 'base', size: '74M params', vram: '~1GB', speed: '~7x', type: 'multilingual' },
            { name: 'base.en', size: '74M params', vram: '~1GB', speed: '~7x', type: 'english-only' },
            { name: 'small', size: '244M params', vram: '~2GB', speed: '~4x', type: 'multilingual' },
            { name: 'small.en', size: '244M params', vram: '~2GB', speed: '~4x', type: 'english-only' },
            { name: 'medium', size: '769M params', vram: '~5GB', speed: '~2x', type: 'multilingual' },
            { name: 'medium.en', size: '769M params', vram: '~5GB', speed: '~2x', type: 'english-only' },
            { name: 'large', size: '1550M params', vram: '~10GB', speed: '1x', type: 'multilingual' },
            { name: 'turbo', size: '809M params', vram: '~6GB', speed: '~8x', type: 'multilingual' }
        ];
    }

    async showModelDownloadDialog(modelName) {
        return new Promise((resolve) => {
            // Create modal dialog
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Download Model</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>The model <strong>${modelName}</strong> is not downloaded yet.</p>
                        <p>Would you like to download it now?</p>
                        <div class="model-info">
                            <small>This will download the model file from Hugging Face.</small>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary cancel-btn">Cancel</button>
                        <button class="btn btn-primary download-btn">Download</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            document.body.style.overflow = 'hidden';

            // Event handlers
            const closeModal = (result) => {
                document.body.removeChild(modal);
                document.body.style.overflow = 'auto';
                resolve(result);
            };

            modal.querySelector('.modal-close').addEventListener('click', () => closeModal(false));
            modal.querySelector('.cancel-btn').addEventListener('click', () => closeModal(false));
            modal.querySelector('.download-btn').addEventListener('click', () => closeModal(true));

            // Close on overlay click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal(false);
            });
        });
    }

    async downloadModel(modelName) {
        return new Promise((resolve, reject) => {
            // Create download progress modal
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Downloading Model</h3>
                    </div>
                    <div class="modal-body">
                        <p>Downloading <strong>${modelName}</strong>...</p>
                        <div class="progress-container">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: 0%"></div>
                            </div>
                            <div class="progress-text">0%</div>
                        </div>
                        <div class="download-details">
                            <small id="download-size">Preparing download...</small>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            document.body.style.overflow = 'hidden';

            const progressFill = modal.querySelector('.progress-fill');
            const progressText = modal.querySelector('.progress-text');
            const downloadSize = modal.querySelector('#download-size');

            // Listen for progress updates
            const progressHandler = (event, progress) => {
                if (progress.modelName === modelName) {
                    progressFill.style.width = `${progress.progress}%`;
                    progressText.textContent = `${progress.progress}%`;
                    
                    if (progress.totalSize) {
                        const downloaded = this.formatBytes(progress.downloadedSize);
                        const total = this.formatBytes(progress.totalSize);
                        downloadSize.textContent = `${downloaded} / ${total}`;
                    }
                }
            };

            window.electronAPI.onModelDownloadProgress(progressHandler);

            // Start download
            window.electronAPI.downloadModel(modelName)
                .then((result) => {
                    // Clean up
                    window.electronAPI.removeAllListeners('model:download:progress');
                    document.body.removeChild(modal);
                    document.body.style.overflow = 'auto';
                    
                    this.updateStatus(`Model ${modelName} downloaded successfully`);
                    resolve(result);
                })
                .catch((error) => {
                    // Clean up
                    window.electronAPI.removeAllListeners('model:download:progress');
                    document.body.removeChild(modal);
                    document.body.style.overflow = 'auto';
                    
                    this.showError(`Failed to download model: ${error.message}`);
                    reject(error);
                });
        });
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async setupWhisper() {
        try {
            this.updateStatus('Setting up local Whisper...');
            
            // Show setup instructions
            const message = `To set up local Whisper:

1. Open a terminal in the project directory
2. Run the setup script:
   - macOS/Linux: ./scripts/setup-whisper.sh
   - Windows: scripts\\setup-whisper.bat

This will download and build whisper.cpp and the required models.

Would you like to open the project directory?`;
            
            if (confirm(message)) {
                await window.electronAPI.openProjectDirectory();
            }
            
        } catch (error) {
            console.error('Error setting up Whisper:', error);
            this.showError('Failed to setup Whisper');
        }
    }
    // Auto-save recording functionality
    async initializeAutoSaveSession() {
        if (!this.recordingSettings.enableAutoSave) {
            return;
        }

        try {
            // Generate unique session ID
            this.recordingAutoSave.sessionId = `recording_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this.recordingAutoSave.chunkIndex = 0;
            this.recordingAutoSave.savedChunks = [];

            // Get temp directory from main process
            const paths = await window.electronAPI.getAppPaths();
            this.recordingAutoSave.tempDirectory = paths.temp;

            console.log(`Auto-save session initialized: ${this.recordingAutoSave.sessionId}`);
        } catch (error) {
            console.error('Failed to initialize auto-save session:', error);
            this.recordingSettings.enableAutoSave = false;
        }
    }

    startAutoSaveTimer() {
        if (!this.recordingSettings.enableAutoSave) {
            return;
        }

        this.recordingAutoSave.autoSaveTimer = setInterval(async () => {
            if (this.isRecording && !this.isPaused) {
                await this.saveCurrentRecordingChunk();
            }
        }, this.recordingSettings.autoSaveInterval);

        console.log(`Auto-save timer started (interval: ${this.recordingSettings.autoSaveInterval}ms)`);
    }

    stopAutoSaveTimer() {
        if (this.recordingAutoSave.autoSaveTimer) {
            clearInterval(this.recordingAutoSave.autoSaveTimer);
            this.recordingAutoSave.autoSaveTimer = null;
            console.log('Auto-save timer stopped');
        }
    }

    async saveCurrentRecordingChunk() {
        if (!this.recordingSettings.enableAutoSave || !this.audioChunks.length) {
            return;
        }

        try {
            // Create blob from current audio chunks
            const mimeType = this.getMimeType();
            const chunkBlob = new Blob([...this.audioChunks], { type: mimeType });
            
            if (chunkBlob.size === 0) {
                return; // No data to save
            }

            // Convert to array buffer
            const arrayBuffer = await chunkBlob.arrayBuffer();
            
            // Generate chunk filename
            const chunkFilename = `${this.recordingAutoSave.sessionId}_chunk_${this.recordingAutoSave.chunkIndex.toString().padStart(3, '0')}.webm`;
            
            // Save chunk via IPC
            const result = await window.electronAPI.saveRecordingChunk(arrayBuffer, chunkFilename);
            
            if (result.success) {
                this.recordingAutoSave.savedChunks.push({
                    filename: chunkFilename,
                    filePath: result.filePath,
                    size: result.size,
                    chunkIndex: this.recordingAutoSave.chunkIndex,
                    timestamp: Date.now()
                });
                
                this.recordingAutoSave.chunkIndex++;
                
                // Clear saved chunks from memory to prevent memory buildup
                this.audioChunks = [];
                
                console.log(`Saved recording chunk: ${chunkFilename} (${result.size} bytes)`);
                this.updateStatus(`Recording... (Auto-saved ${this.recordingAutoSave.savedChunks.length} chunks)`);
            }
        } catch (error) {
            console.error('Failed to save recording chunk:', error);
            // Don't disable auto-save on single failure, just log it
        }
    }

    async combineRecordingChunks(finalBlob) {
        if (!this.recordingSettings.enableAutoSave || this.recordingAutoSave.savedChunks.length === 0) {
            return finalBlob;
        }

        try {
            console.log(`Combining ${this.recordingAutoSave.savedChunks.length} saved chunks with final recording`);
            
            // Load all saved chunks
            const chunkBlobs = [];
            
            for (const chunkInfo of this.recordingAutoSave.savedChunks) {
                try {
                    const chunkData = await window.electronAPI.loadRecordingChunk(chunkInfo.filePath);
                    if (chunkData) {
                        chunkBlobs.push(new Blob([chunkData], { type: this.getMimeType() }));
                    }
                } catch (error) {
                    console.error(`Failed to load chunk ${chunkInfo.filename}:`, error);
                    // Continue with other chunks
                }
            }
            
            // Add final recording blob
            chunkBlobs.push(finalBlob);
            
            // Combine all blobs
            const combinedBlob = new Blob(chunkBlobs, { type: this.getMimeType() });
            
            // Clean up temporary files
            await this.cleanupAutoSaveFiles();
            
            console.log(`Combined recording: ${combinedBlob.size} bytes total`);
            return combinedBlob;
            
        } catch (error) {
            console.error('Failed to combine recording chunks:', error);
            // Return final blob as fallback
            return finalBlob;
        }
    }

    async cleanupAutoSaveFiles() {
        if (this.recordingAutoSave.savedChunks.length === 0) {
            return;
        }

        const failedChunks = [];
        
        for (const chunkInfo of this.recordingAutoSave.savedChunks) {
            try {
                await window.electronAPI.deleteRecordingChunk(chunkInfo.filePath);
            } catch (error) {
                console.error(`Failed to delete chunk ${chunkInfo.filePath}:`, error);
                failedChunks.push(chunkInfo);
            }
        }
        
        const deletedCount = this.recordingAutoSave.savedChunks.length - failedChunks.length;
        if (deletedCount > 0) {
            console.log(`Cleaned up ${deletedCount} temporary recording files`);
        }
        
        if (failedChunks.length > 0) {
            console.warn(`Failed to delete ${failedChunks.length} temporary files, will retry later`);
            this.recordingAutoSave.savedChunks = failedChunks;
        } else {
            // Only reset state if all chunks were successfully deleted
            this.recordingAutoSave.savedChunks = [];
            this.recordingAutoSave.chunkIndex = 0;
            this.recordingAutoSave.sessionId = null;
        }
    }

    async recoverRecordingFromChunks(sessionId) {
        try {
            // This function can be called to recover a recording from a previous session
            // if the app crashed before completion
            const recoveredChunks = await window.electronAPI.findRecordingChunks(sessionId);
            
            if (recoveredChunks.length > 0) {
                console.log(`Found ${recoveredChunks.length} chunks for session ${sessionId}`);
                
                const chunkBlobs = [];
                for (const chunkPath of recoveredChunks) {
                    const chunkData = await window.electronAPI.loadRecordingChunk(chunkPath);
                    if (chunkData) {
                        chunkBlobs.push(new Blob([chunkData], { type: this.getMimeType() }));
                    }
                }
                
                if (chunkBlobs.length > 0) {
                    const recoveredBlob = new Blob(chunkBlobs, { type: this.getMimeType() });
                    this.recordingBlob = recoveredBlob;
                    this.showRecordingInfo(recoveredBlob);
                    this.updateRecordingUI();
                    this.updateStatus(`Recovered recording from ${chunkBlobs.length} chunks`);
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.error('Failed to recover recording from chunks:', error);
            return false;
        }
    }

    async checkForOrphanedRecordings() {
        try {
            // Check if the API is available
            if (!window.electronAPI || !window.electronAPI.getAppPaths || !window.electronAPI.findRecordingChunks) {
                console.warn('electronAPI methods not available for checking orphaned recordings');
                return;
            }
            
            // Look for any recording chunks that might be left from a previous session
            const tempDir = await window.electronAPI.getAppPaths();
            
            // Get all files in the recordings temp directory
            const allChunks = await window.electronAPI.findRecordingChunks('recording_');
            
            if (allChunks.length > 0) {
                console.log(`Found ${allChunks.length} orphaned recording chunks`);
                
                // Group chunks by session ID
                const sessionGroups = {};
                allChunks.forEach(chunkPath => {
                    const filename = chunkPath.split('/').pop();
                    const sessionMatch = filename.match(/^(recording_\d+_[a-z0-9]+)_chunk_/);
                    if (sessionMatch) {
                        const sessionId = sessionMatch[1];
                        if (!sessionGroups[sessionId]) {
                            sessionGroups[sessionId] = [];
                        }
                        sessionGroups[sessionId].push(chunkPath);
                    }
                });
                
                // Show recovery dialog for sessions with multiple chunks
                const recoverableSessions = Object.entries(sessionGroups)
                    .filter(([sessionId, chunks]) => chunks.length > 0)
                    .sort(([, a], [, b]) => b.length - a.length); // Sort by chunk count
                
                if (recoverableSessions.length > 0) {
                    this.showRecoveryDialog(recoverableSessions);
                }
            }
        } catch (error) {
            console.error('Error checking for orphaned recordings:', error);
        }
    }

    showRecoveryDialog(recoverableSessions) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>🔄 Recover Previous Recordings</h2>
                    <span class="modal-close">&times;</span>
                </div>
                <div class="modal-body">
                    <p>Found ${recoverableSessions.length} incomplete recording(s) from previous sessions:</p>
                    <div id="recovery-sessions">
                        ${recoverableSessions.map(([sessionId, chunks], index) => `
                            <div class="recovery-session" data-session-id="${sessionId}">
                                <h4>Session ${index + 1}</h4>
                                <p>${chunks.length} chunks found</p>
                                <button class="btn btn-primary recover-btn" data-session-id="${sessionId}">
                                    Recover This Recording
                                </button>
                                <button class="btn btn-secondary delete-btn" data-session-id="${sessionId}">
                                    Delete Chunks
                                </button>
                            </div>
                        `).join('')}
                    </div>
                    <div class="recovery-actions">
                        <button class="btn btn-secondary" id="delete-all-chunks">Delete All</button>
                        <button class="btn btn-secondary" id="cancel-recovery">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listeners
        modal.querySelector('.modal-close').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.querySelector('#cancel-recovery').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.querySelector('#delete-all-chunks').addEventListener('click', async () => {
            try {
                for (const [sessionId, chunks] of recoverableSessions) {
                    for (const chunkPath of chunks) {
                        await window.electronAPI.deleteRecordingChunk(chunkPath);
                    }
                }
                this.updateStatus('All orphaned recording chunks deleted');
                document.body.removeChild(modal);
            } catch (error) {
                console.error('Error deleting chunks:', error);
                this.showError('Failed to delete some chunks');
            }
        });
        
        // Add recover button listeners
        modal.querySelectorAll('.recover-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const sessionId = e.target.dataset.sessionId;
                try {
                    const recovered = await this.recoverRecordingFromChunks(sessionId);
                    if (recovered) {
                        this.switchTab('record');
                        document.body.removeChild(modal);
                    } else {
                        this.showError('Failed to recover recording');
                    }
                } catch (error) {
                    console.error('Error recovering recording:', error);
                    this.showError('Failed to recover recording');
                }
            });
        });
        
        // Add delete button listeners
        modal.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const sessionId = e.target.dataset.sessionId;
                try {
                    const chunks = recoverableSessions.find(([id]) => id === sessionId)[1];
                    for (const chunkPath of chunks) {
                        await window.electronAPI.deleteRecordingChunk(chunkPath);
                    }
                    e.target.closest('.recovery-session').remove();
                    this.updateStatus(`Deleted chunks for session ${sessionId}`);
                } catch (error) {
                    console.error('Error deleting chunks:', error);
                    this.showError('Failed to delete chunks');
                }
            });
        });
    }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WhisperWrapperApp;
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WhisperWrapperApp();
});

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
        case 'o':
            e.preventDefault();
            // Trigger file open
            break;
        case 's':
            e.preventDefault();
            // Trigger save
            break;
        case 'r':
            e.preventDefault();
            if (e.shiftKey) {
                // Stop recording
            } else {
                // Start recording
            }
            break;
        }
    }
});

// ============================
// AI Refinement Methods
// ============================

// Save AI Refinement settings as part of the main settings
async function saveAIRefinementSettings() {
    try {
        const enabled = document.getElementById('ai-refinement-enabled-checkbox').checked;
        const ollamaEndpoint = document.getElementById('ollama-endpoint').value;
        const ollamaModel = document.getElementById('ollama-model-select').value;
        const timeout = parseInt(document.getElementById('ollama-timeout').value);
        
        // Using the combined Ollama config structure
        const settings = {
            enabled,
            endpoint: ollamaEndpoint,
            model: ollamaModel,
            timeoutSeconds: timeout
        };
        
        console.log('Saving AI Refinement settings (using combined Ollama config):', settings);
        const result = await window.electronAPI.saveAIRefinementSettings(settings);
        
        // Debug: Check if settings were properly saved
        const debug = await window.electronAPI.debugAIRefinementSettings();
        console.log('AI Refinement Debug Info:', debug);
        
        if (result.success) {
            this.updateStatus('AI Refinement settings saved');
            
            // Update local state with the latest settings
            this.aiRefinementState.enabled = debug.ollamaSettings.enabled;
            
            return true;
        } else {
            this.showError('Failed to save AI Refinement settings');
            return false;
        }
    } catch (error) {
        console.error('Error saving AI Refinement settings:', error);
        this.showError(`Error saving AI Refinement settings: ${error.message}`);
        return false;
    }
}

// Load AI Refinement settings
async function loadAIRefinementSettings() {
    try {
        const settings = await window.electronAPI.getAIRefinementSettings();
        console.log('Loaded AI Refinement settings:', settings);
        
        if (settings) {
            document.getElementById('ai-refinement-enabled-checkbox').checked = settings.enabled || false;
            document.getElementById('ollama-endpoint').value = settings.endpoint || 'http://localhost:11434';
            document.getElementById('ollama-timeout').value = settings.timeoutSeconds || 30;
            
            console.log('Updating AI Refinement state with settings:', settings);
            
            this.aiRefinementState.enabled = settings.enabled || false;
            this.aiRefinementState.ollamaEndpoint = settings.endpoint || 'http://localhost:11434';
            this.aiRefinementState.ollamaModel = settings.model || '';
            this.aiRefinementState.timeout = settings.timeoutSeconds || 30;
            
            console.log('Updated AI Refinement state:', this.aiRefinementState);
            
            // If we have a model selected, set it
            if (settings.model && this.aiRefinementState.availableModels.length > 0) {
                document.getElementById('ollama-model-select').value = settings.model;
            }
            
            this.updateAIRefinementUIState();
        }
    } catch (error) {
        console.error('Error loading AI Refinement settings:', error);
    }
}

// Update UI elements based on the enabled state
function updateAIRefinementUIState() {
    const enabled = this.aiRefinementState.enabled;
    const elements = [
        document.getElementById('ollama-endpoint'),
        document.getElementById('ollama-model-select'),
        document.getElementById('ollama-timeout'),
        document.getElementById('refresh-models-btn'),
        document.getElementById('test-ollama-btn'),
        document.getElementById('manage-templates-btn')
    ];
    
    elements.forEach(el => {
        if (el) {
            el.disabled = !enabled;
        }
    });
}

// Test connection to Ollama
async function testOllamaConnection() {
    try {
        const ollamaStatus = document.getElementById('ollama-status');
        const ollamaStatusText = document.getElementById('ollama-status-text');
        
        ollamaStatusText.textContent = 'Testing connection...';
        ollamaStatus.className = 'status-indicator loading';
        
        const endpoint = document.getElementById('ollama-endpoint').value;
        
        const result = await window.electronAPI.testOllamaConnection({
            endpoint
        });
        
        if (result.success) {
            ollamaStatusText.textContent = 'Connected';
            ollamaStatus.className = 'status-indicator success';
            this.aiRefinementState.connected = true;
            
            // If we got models, update the dropdown
            if (result.models && result.models.length > 0) {
                this.updateOllamaModelDropdown(result.models);
            }
            
            return true;
        } else {
            ollamaStatusText.textContent = 'Connection failed';
            ollamaStatus.className = 'status-indicator error';
            this.aiRefinementState.connected = false;
            return false;
        }
    } catch (error) {
        console.error('Error testing Ollama connection:', error);
        const ollamaStatus = document.getElementById('ollama-status');
        const ollamaStatusText = document.getElementById('ollama-status-text');
        
        ollamaStatusText.textContent = 'Connection error';
        ollamaStatus.className = 'status-indicator error';
        this.aiRefinementState.connected = false;
        return false;
    }
}

// Refresh available Ollama models
async function refreshOllamaModels() {
    try {
        const endpoint = document.getElementById('ollama-endpoint').value;
        const result = await window.electronAPI.getOllamaModels({
            endpoint
        });
        
        if (result.success && result.models) {
            this.updateOllamaModelDropdown(result.models);
            return true;
        } else {
            this.showError('Failed to get Ollama models');
            return false;
        }
    } catch (error) {
        console.error('Error refreshing Ollama models:', error);
        this.showError(`Error refreshing Ollama models: ${error.message}`);
        return false;
    }
}

// Update the Ollama model dropdown with available models
function updateOllamaModelDropdown(models) {
    const modelSelect = document.getElementById('ollama-model-select');
    const currentValue = modelSelect.value;
    
    // Clear existing options
    modelSelect.innerHTML = '';
    
    if (models.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No models available';
        modelSelect.appendChild(option);
    } else {
        // Add models
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name || model;
            option.textContent = model.name || model;
            modelSelect.appendChild(option);
        });
        
        // Try to restore selected value if it exists
        if (currentValue && models.some(m => (m.name || m) === currentValue)) {
            modelSelect.value = currentValue;
        } else if (this.aiRefinementState.ollamaModel && models.some(m => (m.name || m) === this.aiRefinementState.ollamaModel)) {
            modelSelect.value = this.aiRefinementState.ollamaModel;
        }
    }
    
    this.aiRefinementState.availableModels = models;
}

// Template Management Methods
async function loadTemplates() {
    try {
        const templates = await window.electronAPI.getTemplates();
        
        if (templates && Array.isArray(templates)) {
            this.aiRefinementState.templates = templates;
            
            // If we have a default template, set it as current
            const defaultTemplate = templates.find(t => t.isDefault);
            if (defaultTemplate) {
                this.aiRefinementState.currentTemplateId = defaultTemplate.id;
            } else if (templates.length > 0) {
                this.aiRefinementState.currentTemplateId = templates[0].id;
            }
            
            return templates;
        }
        
        return [];
    } catch (error) {
        console.error('Error loading templates:', error);
        return [];
    }
}

// Open template management modal
async function openTemplateModal() {
    try {
        // Load templates if needed
        if (this.aiRefinementState.templates.length === 0) {
            await this.loadTemplates();
        }
        
        // Show modal
        const templateModal = document.getElementById('template-modal');
        templateModal.classList.remove('hidden');
        
        // Render template list
        this.renderTemplateList();
        
        this.aiRefinementState.isTemplateModalOpen = true;
    } catch (error) {
        console.error('Error opening template modal:', error);
        this.showError('Failed to open template manager');
    }
}

// Close template modal
function closeTemplateModal() {
    const templateModal = document.getElementById('template-modal');
    templateModal.classList.add('hidden');
    
    // Hide editor section
    const editorSection = document.getElementById('template-editor-section');
    editorSection.classList.add('hidden');
    
    this.aiRefinementState.isTemplateModalOpen = false;
    this.aiRefinementState.templateBeingEdited = null;
}

// Render the list of templates
function renderTemplateList() {
    const templateList = document.getElementById('template-list');
    templateList.innerHTML = '';
    
    const templates = this.aiRefinementState.templates;
    
    if (templates.length === 0) {
        templateList.innerHTML = '<div class="template-list-empty">No templates available. Click "Create New" to add one.</div>';
        return;
    }
    
    templates.forEach(template => {
        const templateItem = document.createElement('div');
        templateItem.className = 'template-item';
        templateItem.dataset.id = template.id;
        
        if (template.id === this.aiRefinementState.currentTemplateId) {
            templateItem.classList.add('active');
        }
        
        const header = document.createElement('div');
        header.className = 'template-item-header';
        
        const name = document.createElement('div');
        name.className = 'template-item-name';
        name.textContent = template.name;
        
        header.appendChild(name);
        
        if (template.isDefault) {
            const defaultBadge = document.createElement('div');
            defaultBadge.className = 'template-item-default';
            defaultBadge.textContent = 'Default';
            header.appendChild(defaultBadge);
        }
        
        const description = document.createElement('div');
        description.className = 'template-item-description';
        description.textContent = template.description || 'No description';
        
        templateItem.appendChild(header);
        templateItem.appendChild(description);
        
        // Add click event
        templateItem.addEventListener('click', () => {
            this.editTemplate(template.id);
        });
        
        templateList.appendChild(templateItem);
    });
}

// Create a new template
function createNewTemplate() {
    // Set up empty template
    const newTemplate = {
        id: Date.now().toString(),
        name: '',
        description: '',
        prompt: 'Please improve this transcription: {{text}}',
        isDefault: this.aiRefinementState.templates.length === 0
    };
    
    this.aiRefinementState.templateBeingEdited = newTemplate;
    
    // Show editor with empty values
    this.showTemplateEditor(newTemplate);
}

// Edit an existing template
function editTemplate(templateId) {
    const template = this.aiRefinementState.templates.find(t => t.id === templateId);
    
    if (template) {
        this.aiRefinementState.templateBeingEdited = { ...template };
        this.showTemplateEditor(template);
        
        // Update active class
        const templateItems = document.querySelectorAll('.template-item');
        templateItems.forEach(item => {
            if (item.dataset.id === templateId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
}

// Display template editor with template data
function showTemplateEditor(template) {
    const editorSection = document.getElementById('template-editor-section');
    const editorTitle = document.getElementById('template-editor-title');
    
    // Set title based on whether we're editing or creating
    editorTitle.textContent = template.name ? `Edit Template: ${template.name}` : 'Create New Template';
    
    // Fill form fields
    document.getElementById('template-name').value = template.name || '';
    document.getElementById('template-description').value = template.description || '';
    document.getElementById('template-prompt').value = template.prompt || '';
    document.getElementById('template-default-checkbox').checked = template.isDefault || false;
    
    // Show delete button only for existing templates
    const deleteButton = document.getElementById('delete-template-btn');
    if (template.name) {
        deleteButton.style.display = 'block';
    } else {
        deleteButton.style.display = 'none';
    }
    
    // Show editor section
    editorSection.classList.remove('hidden');
}

// Save template (new or edited)
async function saveTemplate() {
    try {
        const name = document.getElementById('template-name').value.trim();
        const description = document.getElementById('template-description').value.trim();
        const prompt = document.getElementById('template-prompt').value.trim();
        const isDefault = document.getElementById('template-default-checkbox').checked;
        
        if (!name) {
            this.showError('Template name is required');
            return;
        }
        
        if (!prompt) {
            this.showError('Prompt template is required');
            return;
        }
        
        if (!prompt.includes('{{text}}')) {
            this.showError('Prompt template must include {{text}} placeholder');
            return;
        }
        
        // Get current template being edited
        const template = this.aiRefinementState.templateBeingEdited;
        
        if (!template) {
            this.showError('No template is being edited');
            return;
        }
        
        // Update template
        template.name = name;
        template.description = description;
        template.prompt = prompt;
        template.isDefault = isDefault;
        
        // If this is set as default, unset other defaults
        if (isDefault) {
            this.aiRefinementState.templates.forEach(t => {
                if (t.id !== template.id) {
                    t.isDefault = false;
                }
            });
        }
        
        // Check if this is a new template
        const isNew = !this.aiRefinementState.templates.some(t => t.id === template.id);
        
        // Add to templates array if new
        if (isNew) {
            this.aiRefinementState.templates.push(template);
        } else {
            // Update existing
            const index = this.aiRefinementState.templates.findIndex(t => t.id === template.id);
            if (index !== -1) {
                this.aiRefinementState.templates[index] = template;
            }
        }
        
        // Save to backend
        await window.electronAPI.saveTemplates(this.aiRefinementState.templates);
        
        // If this is the only template or is default, set as current
        if (isDefault || this.aiRefinementState.templates.length === 1) {
            this.aiRefinementState.currentTemplateId = template.id;
        }
        
        // Update the list
        this.renderTemplateList();
        
        // Hide editor
        const editorSection = document.getElementById('template-editor-section');
        editorSection.classList.add('hidden');
        
        this.aiRefinementState.templateBeingEdited = null;
        
    } catch (error) {
        console.error('Error saving template:', error);
        this.showError(`Error saving template: ${error.message}`);
    }
}

// Cancel template editing
function cancelTemplateEdit() {
    // Hide editor
    const editorSection = document.getElementById('template-editor-section');
    editorSection.classList.add('hidden');
    
    this.aiRefinementState.templateBeingEdited = null;
}

// Confirm template deletion
function confirmDeleteTemplate() {
    const template = this.aiRefinementState.templateBeingEdited;
    
    if (!template) {
        return;
    }
    
    // Show confirmation modal
    const deleteModal = document.getElementById('delete-template-modal');
    const templateNameSpan = document.getElementById('delete-template-name');
    
    templateNameSpan.textContent = template.name;
    deleteModal.classList.remove('hidden');
}

// Close delete confirmation modal
function closeDeleteConfirmationModal() {
    const deleteModal = document.getElementById('delete-template-modal');
    deleteModal.classList.add('hidden');
}

// Delete the template
async function deleteTemplate() {
    try {
        const template = this.aiRefinementState.templateBeingEdited;
        
        if (!template) {
            return;
        }
        
        // Remove from array
        this.aiRefinementState.templates = this.aiRefinementState.templates.filter(t => t.id !== template.id);
        
        // Save to backend
        await window.electronAPI.saveTemplates(this.aiRefinementState.templates);
        
        // If the deleted template was current, select another one
        if (template.id === this.aiRefinementState.currentTemplateId) {
            const newDefault = this.aiRefinementState.templates.find(t => t.isDefault);
            if (newDefault) {
                this.aiRefinementState.currentTemplateId = newDefault.id;
            } else if (this.aiRefinementState.templates.length > 0) {
                this.aiRefinementState.currentTemplateId = this.aiRefinementState.templates[0].id;
            } else {
                this.aiRefinementState.currentTemplateId = null;
            }
        }
        
        // Update the list
        this.renderTemplateList();
        
        // Hide both modals
        this.closeDeleteConfirmationModal();
        
        // Hide editor
        const editorSection = document.getElementById('template-editor-section');
        editorSection.classList.add('hidden');
        
        this.aiRefinementState.templateBeingEdited = null;
        
    } catch (error) {
        console.error('Error deleting template:', error);
        this.showError(`Error deleting template: ${error.message}`);
        this.closeDeleteConfirmationModal();
    }
}
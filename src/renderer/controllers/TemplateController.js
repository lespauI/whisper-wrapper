/**
 * Template Controller
 * Manages AI refinement templates - CRUD operations, modal management, and template selection
 */

import { CSS_CLASSES } from '../utils/Constants.js';
import { EventHandler } from '../utils/EventHandler.js';
import { UIHelpers } from '../utils/UIHelpers.js';

export class TemplateController {
    constructor(appState, statusController) {
        this.appState = appState;
        this.statusController = statusController;
        
        // Template management state
        this.templates = [];
        this.currentTemplateId = null;
        this.templateBeingEdited = null;
        this.isTemplateModalOpen = false;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadTemplates();
    }

    /**
     * Set up event listeners for template functionality
     */
    setupEventListeners() {
        // Manage templates button
        EventHandler.addListener('#manage-templates-btn', 'click', () => {
            this.openTemplateModal();
        });

        // Template modal - Close button
        EventHandler.addListener('#close-template-modal-btn', 'click', () => {
            this.closeTemplateModal();
        });

        // Template modal - Create new template button
        EventHandler.addListener('#create-template-btn', 'click', () => {
            this.createNewTemplate();
        });

        // Template modal - Save template button
        EventHandler.addListener('#save-template-btn', 'click', () => {
            this.saveTemplate();
        });

        // Template modal - Cancel edit button
        EventHandler.addListener('#cancel-template-edit-btn', 'click', () => {
            this.cancelTemplateEdit();
        });

        // Template modal - Delete template button
        EventHandler.addListener('#delete-template-btn', 'click', () => {
            this.confirmDeleteTemplate();
        });

        // Delete confirmation modal buttons
        EventHandler.addListener('#confirm-delete-btn', 'click', () => {
            this.deleteTemplate();
        });

        EventHandler.addListener('#cancel-delete-btn', 'click', () => {
            this.closeDeleteConfirmationModal();
        });

        // Close modal when clicking overlay
        EventHandler.addListener('#template-modal', 'click', (e) => {
            if (e.target.id === 'template-modal') {
                this.closeTemplateModal();
            }
        });

        EventHandler.addListener('#delete-template-modal', 'click', (e) => {
            if (e.target.id === 'delete-template-modal') {
                this.closeDeleteConfirmationModal();
            }
        });
    }

    /**
     * Load refinement templates from storage
     */
    async loadTemplates() {
        try {
            // Use getAllTemplates (the correct method name) instead of getTemplates
            const result = await window.electronAPI.getAllTemplates();
            
            if (result && result.success && Array.isArray(result.templates)) {
                this.templates = result.templates;
                console.log(`Loaded ${result.templates.length} refinement templates`);
                
                // Update template selector if refinement controller exists
                if (window.app?.refinementController) {
                    if (!window.app.refinementController.constructor.hasInitializedTemplateSelector) {
                        window.app.refinementController.updateTemplateSelector(false); // initial setup
                    } else {
                        window.app.refinementController.updateTemplateSelector(true); // force update
                    }
                }
            } else {
                console.warn('No templates found or invalid template data', result);
                this.templates = [];
            }
        } catch (error) {
            console.error('Error loading templates:', error);
            this.templates = [];
        }
    }

    /**
     * Open template management modal
     */
    async openTemplateModal() {
        try {
            console.log('Opening template modal');
            // Load templates if needed
            if (this.templates.length === 0) {
                await this.loadTemplates();
            }
            
            // Show modal
            const templateModal = UIHelpers.getElementById('template-modal');
            if (templateModal) {
                UIHelpers.removeClass(templateModal, CSS_CLASSES.HIDDEN);
                
                // Render template list
                this.renderTemplateList();
                
                this.isTemplateModalOpen = true;
            } else {
                console.error('Template modal element not found');
            }
        } catch (error) {
            console.error('Error opening template modal:', error);
            this.statusController.showError('Failed to open template manager');
        }
    }

    /**
     * Close template management modal
     */
    closeTemplateModal() {
        console.log('Closing template modal');
        const templateModal = UIHelpers.getElementById('template-modal');
        if (templateModal) {
            UIHelpers.addClass(templateModal, CSS_CLASSES.HIDDEN);
            
            // Reset template being edited
            this.templateBeingEdited = null;
            
            // Hide edit form and show list
            const editForm = UIHelpers.getElementById('template-editor-section');
            const templateList = UIHelpers.getElementById('template-list-section');
            
            if (editForm && templateList) {
                UIHelpers.addClass(editForm, CSS_CLASSES.HIDDEN);
                UIHelpers.removeClass(templateList, CSS_CLASSES.HIDDEN);
            }
            
            this.isTemplateModalOpen = false;
        } else {
            console.error('Template modal element not found');
        }
    }

    /**
     * Render the list of available templates in the modal
     */
    renderTemplateList() {
        console.log('Rendering template list');
        const templateListContainer = UIHelpers.getElementById('template-list');
        if (!templateListContainer) {
            console.error('Template list container not found');
            return;
        }
        
        // Clear existing content
        templateListContainer.innerHTML = '';
        
        const templates = this.templates;
        
        // Show empty message if no templates
        if (!templates || templates.length === 0) {
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

    /**
     * Edit existing template
     */
    async editTemplate(templateId) {
        console.log('Editing template:', templateId);
        try {
            // Find template by ID
            const template = this.templates.find(t => t.id === templateId);
            if (!template) {
                throw new Error(`Template with ID ${templateId} not found`);
            }
            
            // Store template being edited (make a copy)
            this.templateBeingEdited = { ...template };
            
            // Show edit form, hide list
            const editForm = UIHelpers.getElementById('template-editor-section');
            const templateList = UIHelpers.getElementById('template-list-section');
            
            if (editForm && templateList) {
                // Fill form fields
                UIHelpers.setValue('#template-name', template.name || '');
                UIHelpers.setValue('#template-description', template.description || '');
                UIHelpers.setValue('#template-prompt', template.prompt || '');
                
                // Show form, hide list
                UIHelpers.removeClass(editForm, CSS_CLASSES.HIDDEN);
                UIHelpers.addClass(templateList, CSS_CLASSES.HIDDEN);
                
                // Update form title
                const formTitle = UIHelpers.getElementById('template-form-title');
                if (formTitle) {
                    UIHelpers.setText(formTitle, 'Edit Template');
                }
                
                // Show delete button
                const deleteBtn = UIHelpers.getElementById('delete-template-btn');
                if (deleteBtn) {
                    UIHelpers.removeClass(deleteBtn, CSS_CLASSES.HIDDEN);
                }
            } else {
                console.error('Template edit form or list container not found');
            }
        } catch (error) {
            console.error('Error editing template:', error);
            this.statusController.showError(`Failed to edit template: ${error.message}`);
        }
    }

    /**
     * Create a new template
     */
    createNewTemplate() {
        console.log('Creating new template');
        // Create empty template
        this.templateBeingEdited = {
            id: null, // Will be assigned when saving
            name: '',
            description: '',
            prompt: '',
            isDefault: false
        };
        
        // Show edit form, hide list
        const editForm = UIHelpers.getElementById('template-editor-section');
        const templateList = UIHelpers.getElementById('template-list-section');
        
        if (editForm && templateList) {
            // Clear form fields
            UIHelpers.setValue('#template-name', '');
            UIHelpers.setValue('#template-description', '');
            UIHelpers.setValue('#template-prompt', '');
            
            // Show form, hide list
            UIHelpers.removeClass(editForm, CSS_CLASSES.HIDDEN);
            UIHelpers.addClass(templateList, CSS_CLASSES.HIDDEN);
            
            // Update form title
            const formTitle = UIHelpers.getElementById('template-form-title');
            if (formTitle) {
                UIHelpers.setText(formTitle, 'Create New Template');
            }
            
            // Hide delete button
            const deleteBtn = UIHelpers.getElementById('delete-template-btn');
            if (deleteBtn) {
                UIHelpers.addClass(deleteBtn, CSS_CLASSES.HIDDEN);
            }
        } else {
            console.error('Template edit form or list container not found');
        }
    }

    /**
     * Cancel template editing
     */
    cancelTemplateEdit() {
        console.log('Canceling template edit');
        // Reset template being edited
        this.templateBeingEdited = null;
        
        // Hide edit form, show list
        const editForm = UIHelpers.getElementById('template-editor-section');
        const templateList = UIHelpers.getElementById('template-list-section');
        
        if (editForm && templateList) {
            UIHelpers.addClass(editForm, CSS_CLASSES.HIDDEN);
            UIHelpers.removeClass(templateList, CSS_CLASSES.HIDDEN);
        } else {
            console.error('Template edit form or list container not found');
        }
    }

    /**
     * Save template (create or update)
     */
    async saveTemplate() {
        console.log('Saving template');
        try {
            // Get template being edited
            const template = this.templateBeingEdited;
            if (!template) {
                throw new Error('No template being edited');
            }
            
            // Get form values
            const name = UIHelpers.getValue('#template-name').trim();
            const description = UIHelpers.getValue('#template-description').trim();
            const prompt = UIHelpers.getValue('#template-prompt').trim();
            
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
            
            this.statusController.updateStatus('Template saved successfully');
            
        } catch (error) {
            console.error('Error saving template:', error);
            this.statusController.showError(`Failed to save template: ${error.message}`);
        }
    }

    /**
     * Confirm delete template
     */
    confirmDeleteTemplate() {
        console.log('Confirming template deletion');
        // Get template being edited
        const template = this.templateBeingEdited;
        if (!template || !template.id) {
            console.error('No template selected for deletion');
            return;
        }
        
        // Show confirmation modal
        const deleteModal = UIHelpers.getElementById('delete-template-modal');
        if (deleteModal) {
            // Set template name in confirmation message
            const templateName = UIHelpers.getElementById('delete-template-name');
            if (templateName) {
                UIHelpers.setText(templateName, template.name);
            }
            
            UIHelpers.removeClass(deleteModal, CSS_CLASSES.HIDDEN);
        } else {
            console.error('Delete confirmation modal not found');
        }
    }

    /**
     * Close delete confirmation modal
     */
    closeDeleteConfirmationModal() {
        console.log('Closing delete confirmation modal');
        const deleteModal = UIHelpers.getElementById('delete-template-modal');
        if (deleteModal) {
            UIHelpers.addClass(deleteModal, CSS_CLASSES.HIDDEN);
        } else {
            console.error('Delete confirmation modal not found');
        }
    }

    /**
     * Delete template
     */
    async deleteTemplate() {
        console.log('Deleting template');
        try {
            // Get template being edited
            const template = this.templateBeingEdited;
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
            
            this.statusController.updateStatus('Template deleted successfully');
            
        } catch (error) {
            console.error('Error deleting template:', error);
            this.statusController.showError(`Failed to delete template: ${error.message}`);
        }
    }

    /**
     * Set template as default
     */
    async setDefaultTemplate(templateId) {
        console.log('Setting default template:', templateId);
        try {
            const result = await window.electronAPI.setDefaultTemplate(templateId);
            
            if (!result.success) {
                throw new Error(result.message || 'Failed to set default template');
            }
            
            // Reload templates to update the default status
            await this.loadTemplates();
            
            // Render updated list
            this.renderTemplateList();
            
            this.statusController.updateStatus('Default template updated');
            
        } catch (error) {
            console.error('Error setting default template:', error);
            this.statusController.showError(`Failed to set default template: ${error.message}`);
        }
    }

    /**
     * Get all templates
     */
    getTemplates() {
        return this.templates;
    }

    /**
     * Get template by ID
     */
    getTemplateById(templateId) {
        return this.templates.find(template => template.id === templateId);
    }

    /**
     * Get default template
     */
    getDefaultTemplate() {
        return this.templates.find(template => template.isDefault);
    }

    /**
     * Get current template being edited
     */
    getCurrentEditingTemplate() {
        return this.templateBeingEdited;
    }

    /**
     * Check if template modal is open
     */
    isModalOpen() {
        return this.isTemplateModalOpen;
    }

    /**
     * Get template management state
     */
    getCurrentState() {
        return {
            templates: this.templates,
            currentTemplateId: this.currentTemplateId,
            templateBeingEdited: this.templateBeingEdited,
            isTemplateModalOpen: this.isTemplateModalOpen,
            templateCount: this.templates.length,
            hasDefaultTemplate: this.templates.some(t => t.isDefault)
        };
    }

    /**
     * Refresh templates from server
     */
    async refreshTemplates() {
        console.log('Refreshing templates...');
        await this.loadTemplates();
        if (this.isTemplateModalOpen) {
            this.renderTemplateList();
        }
        this.statusController.updateStatus('Templates refreshed');
    }

    /**
     * Destroy the controller and clean up resources
     */
    destroy() {
        // Close modal if open
        if (this.isTemplateModalOpen) {
            this.closeTemplateModal();
        }
        
        // Reset state
        this.templates = [];
        this.currentTemplateId = null;
        this.templateBeingEdited = null;
        this.isTemplateModalOpen = false;
        
        console.log('TemplateController destroyed');
    }
}
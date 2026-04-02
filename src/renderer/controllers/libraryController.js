class LibraryController {
    constructor() {
        this.currentEntryId = null;
        this.entries = [];
        this._pendingTags = [];
        this._notesExpanded = false;

        this.searchInput = document.getElementById('library-search-input');
        this.dateFrom = document.getElementById('library-date-from');
        this.dateTo = document.getElementById('library-date-to');
        this.searchBtn = document.getElementById('library-search-btn');
        this.clearBtn = document.getElementById('library-clear-btn');
        this.reindexBtn = document.getElementById('library-reindex-btn');
        this.resultsEl = document.getElementById('library-results');

        this.detailEmpty = document.getElementById('library-detail-empty');
        this.detailContent = document.getElementById('library-detail-content');
        this.detailTitle = document.getElementById('library-detail-title');
        this.detailDate = document.getElementById('library-detail-date');
        this.detailSource = document.getElementById('library-detail-source');
        this.detailWords = document.getElementById('library-detail-words');
        this.detailLabels = document.getElementById('library-detail-labels');
        this.detailSummary = document.getElementById('library-detail-summary-text');
        this.detailText = document.getElementById('library-detail-text');
        this.copyBtn = document.getElementById('library-copy-btn');
        this.deleteBtn = document.getElementById('library-delete-btn');

        this.renameBtn = document.getElementById('library-rename-btn');
        this.renameForm = document.getElementById('library-rename-form');
        this.renameInput = document.getElementById('library-rename-input');
        this.renameSaveBtn = document.getElementById('library-rename-save-btn');
        this.renameCancelBtn = document.getElementById('library-rename-cancel-btn');

        this.editTagsBtn = document.getElementById('library-edit-tags-btn');
        this.tagsForm = document.getElementById('library-tags-form');
        this.tagsList = document.getElementById('library-tags-list');
        this.tagInput = document.getElementById('library-tag-input');
        this.tagAddBtn = document.getElementById('library-tag-add-btn');
        this.tagsSaveBtn = document.getElementById('library-tags-save-btn');
        this.tagsCancelBtn = document.getElementById('library-tags-cancel-btn');

        this.metaErrorEl = document.getElementById('library-meta-error');
        this.metaErrorText = document.getElementById('library-meta-error-text');
        this.regenerateMetaBtn = document.getElementById('library-regenerate-meta-btn');
        this.regenerateBtn = document.getElementById('library-regenerate-btn');

        // Meeting notes elements
        this.notesToggle = document.getElementById('library-meeting-notes-toggle');
        this.notesExpandIcon = document.getElementById('meeting-notes-expand-icon');
        this.notesBody = document.getElementById('library-meeting-notes-body');
        this.notesBadge = document.getElementById('meeting-notes-status-badge');
        this.notesGeneratePanel = document.getElementById('meeting-notes-generate-panel');
        this.notesDisplay = document.getElementById('meeting-notes-display');
        this.notesLoading = document.getElementById('meeting-notes-loading');
        this.notesError = document.getElementById('meeting-notes-error');
        this.notesErrorText = document.getElementById('meeting-notes-error-text');
        this.notesContent = document.getElementById('meeting-notes-content');
        this.notesMetaInfo = document.getElementById('meeting-notes-meta-info');
        this.notesProviderSelect = document.getElementById('meeting-notes-provider');
        this.notesModelInput = document.getElementById('meeting-notes-model');
        this.notesTemplateSelect = document.getElementById('meeting-notes-template');
        this.notesGenerateBtn = document.getElementById('meeting-notes-generate-btn');
        this.notesCopyBtn = document.getElementById('meeting-notes-copy-btn');
        this.notesRegenerateBtn = document.getElementById('meeting-notes-regenerate-btn');
        this.notesDeleteBtn = document.getElementById('meeting-notes-delete-btn');
        this.notesUseContextCheckbox = document.getElementById('meeting-notes-use-context');
        this.notesContextList = document.getElementById('meeting-notes-context-list');
        this.notesContextListInner = document.getElementById('meeting-notes-context-list-inner');

        this.init();
    }

    init() {
        if (this.searchBtn) {
            this.searchBtn.addEventListener('click', () => this.search());
        }
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => this.clearSearch());
        }
        if (this.reindexBtn) {
            this.reindexBtn.addEventListener('click', () => this.reindex());
        }
        if (this.searchInput) {
            this.searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.search();
            });
        }
        if (this.copyBtn) {
            this.copyBtn.addEventListener('click', () => this.copyCurrentText());
        }
        if (this.deleteBtn) {
            this.deleteBtn.addEventListener('click', () => this.deleteCurrentEntry());
        }

        if (this.renameBtn) {
            this.renameBtn.addEventListener('click', () => this.openRenameForm());
        }
        if (this.renameSaveBtn) {
            this.renameSaveBtn.addEventListener('click', () => this.saveRename());
        }
        if (this.renameCancelBtn) {
            this.renameCancelBtn.addEventListener('click', () => this.closeRenameForm());
        }
        if (this.renameInput) {
            this.renameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.saveRename();
                if (e.key === 'Escape') this.closeRenameForm();
            });
        }

        if (this.editTagsBtn) {
            this.editTagsBtn.addEventListener('click', () => this.openTagsForm());
        }
        if (this.tagAddBtn) {
            this.tagAddBtn.addEventListener('click', () => this.addPendingTag());
        }
        if (this.tagInput) {
            this.tagInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.addPendingTag();
                if (e.key === 'Escape') this.closeTagsForm();
            });
        }
        if (this.tagsSaveBtn) {
            this.tagsSaveBtn.addEventListener('click', () => this.saveTags());
        }
        if (this.tagsCancelBtn) {
            this.tagsCancelBtn.addEventListener('click', () => this.closeTagsForm());
        }
        if (this.regenerateMetaBtn) {
            this.regenerateMetaBtn.addEventListener('click', () => this.regenerateMeta());
        }
        if (this.regenerateBtn) {
            this.regenerateBtn.addEventListener('click', () => this.regenerateMeta());
        }

        // Meeting notes event listeners
        if (this.notesToggle) {
            this.notesToggle.addEventListener('click', () => this.toggleMeetingNotes());
        }
        if (this.notesGenerateBtn) {
            this.notesGenerateBtn.addEventListener('click', () => this.generateMeetingNotes());
        }
        if (this.notesCopyBtn) {
            this.notesCopyBtn.addEventListener('click', () => this.copyMeetingNotes());
        }
        if (this.notesRegenerateBtn) {
            this.notesRegenerateBtn.addEventListener('click', () => this.showNotesGeneratePanel());
        }
        if (this.notesDeleteBtn) {
            this.notesDeleteBtn.addEventListener('click', () => this.deleteMeetingNotes());
        }
        if (this.notesProviderSelect) {
            this.notesProviderSelect.addEventListener('change', () => this.onProviderChange());
        }
        if (this.notesUseContextCheckbox) {
            this.notesUseContextCheckbox.addEventListener('change', () => this.toggleContextList());
        }

        this.loadNotesTemplates();
    }

    // ── Meeting Notes ────────────────────────────────────────

    toggleMeetingNotes() {
        this._notesExpanded = !this._notesExpanded;
        if (this.notesBody) {
            this.notesBody.classList.toggle('hidden', !this._notesExpanded);
        }
        if (this.notesExpandIcon) {
            this.notesExpandIcon.textContent = this._notesExpanded ? '▼' : '▶';
        }
    }

    async loadNotesTemplates() {
        if (!window.electronAPI || !window.electronAPI.meetingNotes) return;
        try {
            const result = await window.electronAPI.meetingNotes.getTemplates();
            const templates = (result && result.templates) || [];
            if (this.notesTemplateSelect) {
                this.notesTemplateSelect.innerHTML = templates.map(t =>
                    `<option value="${t.id}" ${t.isDefault ? 'selected' : ''}>${this.escapeHtml(t.name)}</option>`
                ).join('');
            }
        } catch (err) {
            console.error('Failed to load meeting notes templates:', err);
        }
    }

    onProviderChange() {
        if (!this.notesProviderSelect || !this.notesModelInput) return;
        const provider = this.notesProviderSelect.value;
        // Show model hints based on provider
        switch (provider) {
            case 'claude':
                this.notesModelInput.placeholder = 'claude-sonnet-4-20250514 (default)';
                break;
            case 'ollama':
                this.notesModelInput.placeholder = 'Uses Ollama default model';
                break;
            case 'codex':
                this.notesModelInput.placeholder = 'Model name (optional)';
                break;
        }
    }

    async loadMeetingNotes(transcriptionId) {
        if (!window.electronAPI || !window.electronAPI.meetingNotes) return;

        // Reset state
        this._notesExpanded = false;
        if (this.notesBody) this.notesBody.classList.add('hidden');
        if (this.notesExpandIcon) this.notesExpandIcon.textContent = '▶';
        if (this.notesError) this.notesError.classList.add('hidden');
        if (this.notesLoading) this.notesLoading.classList.add('hidden');

        try {
            const result = await window.electronAPI.meetingNotes.get(transcriptionId);
            if (result && result.notes) {
                this.displayMeetingNotes(result.notes);
                if (this.notesBadge) {
                    this.notesBadge.classList.remove('hidden');
                    this.notesBadge.textContent = 'Generated';
                }
            } else {
                this.showNotesGeneratePanel();
                if (this.notesBadge) this.notesBadge.classList.add('hidden');
            }
        } catch (err) {
            console.error('Failed to load meeting notes:', err);
            this.showNotesGeneratePanel();
            if (this.notesBadge) this.notesBadge.classList.add('hidden');
        }
    }

    displayMeetingNotes(notesData) {
        if (this.notesGeneratePanel) this.notesGeneratePanel.classList.add('hidden');
        if (this.notesDisplay) this.notesDisplay.classList.remove('hidden');

        if (this.notesMetaInfo) {
            const date = notesData.generatedAt ? new Date(notesData.generatedAt).toLocaleString() : '';
            const provider = notesData.provider || '';
            const model = notesData.model || '';
            const template = notesData.templateName || '';
            const parts = [];
            if (date) parts.push(date);
            if (provider) parts.push(provider + (model ? ` (${model})` : ''));
            if (template) parts.push(`Template: ${template}`);
            this.notesMetaInfo.textContent = parts.join(' | ');
        }

        if (this.notesContent) {
            // Render as simple HTML — convert markdown-like formatting
            this.notesContent.innerHTML = this.renderNotesMarkdown(notesData.notes || '');
        }
    }

    showNotesGeneratePanel() {
        if (this.notesGeneratePanel) this.notesGeneratePanel.classList.remove('hidden');
        if (this.notesDisplay) this.notesDisplay.classList.add('hidden');
        this.loadNotesTemplates();
    }

    toggleContextList() {
        const checked = this.notesUseContextCheckbox && this.notesUseContextCheckbox.checked;
        if (this.notesContextList) {
            this.notesContextList.classList.toggle('hidden', !checked);
        }
        if (checked) {
            this.populateContextList();
        }
    }

    populateContextList() {
        if (!this.notesContextListInner) return;
        const otherEntries = this.entries.filter(e => e.id !== this.currentEntryId);
        if (otherEntries.length === 0) {
            this.notesContextListInner.innerHTML = '<div class="meeting-notes-context-empty">No other transcripts available</div>';
            return;
        }
        // Show most recent first, limit to 20
        const recent = otherEntries.slice(0, 20);
        this.notesContextListInner.innerHTML = recent.map(e => {
            const title = e.title || e.id;
            const date = e.date ? new Date(e.date).toLocaleDateString() : '';
            return `<label class="meeting-notes-context-item">
                <input type="checkbox" value="${e.id}" class="meeting-notes-context-cb">
                <span class="meeting-notes-context-title">${title}</span>
                <span class="meeting-notes-context-date">${date}</span>
            </label>`;
        }).join('');
    }

    getSelectedContextIds() {
        if (!this.notesUseContextCheckbox || !this.notesUseContextCheckbox.checked) return [];
        if (!this.notesContextListInner) return [];
        const checked = this.notesContextListInner.querySelectorAll('.meeting-notes-context-cb:checked');
        return Array.from(checked).map(cb => cb.value);
    }

    async generateMeetingNotes() {
        if (!this.currentEntryId) return;
        if (!window.electronAPI || !window.electronAPI.meetingNotes) return;

        const provider = this.notesProviderSelect ? this.notesProviderSelect.value : 'claude';
        const model = this.notesModelInput ? this.notesModelInput.value.trim() : '';
        const templateId = this.notesTemplateSelect ? this.notesTemplateSelect.value : '';
        const contextTranscriptIds = this.getSelectedContextIds();

        // Show loading
        if (this.notesGeneratePanel) this.notesGeneratePanel.classList.add('hidden');
        if (this.notesDisplay) this.notesDisplay.classList.add('hidden');
        if (this.notesError) this.notesError.classList.add('hidden');
        if (this.notesLoading) this.notesLoading.classList.remove('hidden');
        if (this.notesGenerateBtn) this.notesGenerateBtn.disabled = true;

        try {
            const options = { provider };
            if (model) options.model = model;
            if (templateId) options.templateId = templateId;
            if (contextTranscriptIds.length > 0) options.contextTranscriptIds = contextTranscriptIds;

            const result = await window.electronAPI.meetingNotes.generate(this.currentEntryId, options);
            if (result && result.success && result.notes) {
                this.displayMeetingNotes(result.notes);
                if (this.notesBadge) {
                    this.notesBadge.classList.remove('hidden');
                    this.notesBadge.textContent = 'Generated';
                }
            } else {
                this.showNotesError((result && result.error) || 'Failed to generate meeting notes');
            }
        } catch (err) {
            console.error('Meeting notes generation failed:', err);
            this.showNotesError(err.message || 'Generation failed');
        } finally {
            if (this.notesLoading) this.notesLoading.classList.add('hidden');
            if (this.notesGenerateBtn) this.notesGenerateBtn.disabled = false;
        }
    }

    showNotesError(msg) {
        if (this.notesError) this.notesError.classList.remove('hidden');
        if (this.notesErrorText) this.notesErrorText.textContent = msg;
        if (this.notesGeneratePanel) this.notesGeneratePanel.classList.remove('hidden');
        if (this.notesDisplay) this.notesDisplay.classList.add('hidden');
    }

    async copyMeetingNotes() {
        const text = this.notesContent ? this.notesContent.innerText : '';
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            if (this.notesCopyBtn) {
                const orig = this.notesCopyBtn.textContent;
                this.notesCopyBtn.textContent = '✅ Copied';
                setTimeout(() => { this.notesCopyBtn.textContent = orig; }, 1500);
            }
        } catch (err) {
            console.error('Copy notes failed:', err);
        }
    }

    async deleteMeetingNotes() {
        if (!this.currentEntryId) return;
        if (!window.electronAPI || !window.electronAPI.meetingNotes) return;
        if (!confirm('Delete meeting notes for this transcription?')) return;

        try {
            await window.electronAPI.meetingNotes.delete(this.currentEntryId);
            this.showNotesGeneratePanel();
            if (this.notesBadge) this.notesBadge.classList.add('hidden');
        } catch (err) {
            console.error('Delete notes failed:', err);
        }
    }

    renderNotesMarkdown(text) {
        // Simple markdown-to-HTML conversion for meeting notes display
        let html = this.escapeHtml(text);
        // Headers
        html = html.replace(/^### (.+)$/gm, '<h5>$1</h5>');
        html = html.replace(/^## (.+)$/gm, '<h4>$1</h4>');
        html = html.replace(/^# (.+)$/gm, '<h3>$1</h3>');
        // Bold
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Italic
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        // Checkboxes
        html = html.replace(/^- \[x\] (.+)$/gm, '<div class="meeting-notes-checkbox checked">☑ $1</div>');
        html = html.replace(/^- \[ \] (.+)$/gm, '<div class="meeting-notes-checkbox">☐ $1</div>');
        // Bullet lists
        html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
        // Wrap consecutive <li> in <ul>
        html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
        // Tables (basic)
        html = html.replace(/^\|(.+)\|$/gm, (match, content) => {
            const cells = content.split('|').map(c => c.trim());
            const tds = cells.map(c => {
                if (/^-+$/.test(c)) return null; // separator row
                return `<td>${c}</td>`;
            });
            if (tds.includes(null)) return ''; // skip separator rows
            return `<tr>${tds.join('')}</tr>`;
        });
        html = html.replace(/((?:<tr>.*<\/tr>\n?)+)/g, '<table class="meeting-notes-table">$1</table>');
        // Paragraphs - wrap remaining text blocks
        html = html.replace(/\n\n/g, '</p><p>');
        html = '<p>' + html + '</p>';
        // Clean up empty paragraphs
        html = html.replace(/<p>\s*<\/p>/g, '');
        html = html.replace(/<p>(<h[345]>)/g, '$1');
        html = html.replace(/(<\/h[345]>)<\/p>/g, '$1');
        html = html.replace(/<p>(<ul>)/g, '$1');
        html = html.replace(/(<\/ul>)<\/p>/g, '$1');
        html = html.replace(/<p>(<table)/g, '$1');
        html = html.replace(/(<\/table>)<\/p>/g, '$1');
        html = html.replace(/<p>(<div)/g, '$1');
        html = html.replace(/(<\/div>)<\/p>/g, '$1');
        return html;
    }

    // ── Existing methods ─────────────────────────────────────

    openRenameForm() {
        if (!this.renameForm || !this.renameInput || !this.detailTitle) return;
        this.renameInput.value = this.detailTitle.textContent;
        this.renameForm.classList.remove('hidden');
        this.renameInput.focus();
        this.renameInput.select();
    }

    closeRenameForm() {
        if (this.renameForm) this.renameForm.classList.add('hidden');
    }

    async saveRename() {
        if (!this.currentEntryId || !this.renameInput) return;
        const newTitle = this.renameInput.value.trim();
        if (!newTitle) return;
        try {
            const result = await window.electronAPI.transcriptions.update(this.currentEntryId, { title: newTitle });
            if (result && result.success) {
                if (this.detailTitle) this.detailTitle.textContent = newTitle;
                this.closeRenameForm();
                await this.search();
            }
        } catch (err) {
            this.closeRenameForm();
        }
    }

    openTagsForm() {
        if (!this.tagsForm) return;
        const entry = this.entries.find(e => e.id === this.currentEntryId);
        this._pendingTags = entry ? [...(entry.labels || [])] : [];
        this.renderPendingTags();
        this.tagsForm.classList.remove('hidden');
        if (this.tagInput) {
            this.tagInput.value = '';
            this.tagInput.focus();
        }
    }

    closeTagsForm() {
        if (this.tagsForm) this.tagsForm.classList.add('hidden');
        this._pendingTags = [];
    }

    renderPendingTags() {
        if (!this.tagsList) return;
        this.tagsList.innerHTML = this._pendingTags.map((tag, i) =>
            `<span class="library-tag-edit-item">${this.escapeHtml(tag)}<button class="library-tag-remove-btn" data-index="${i}" title="Remove">×</button></span>`
        ).join('');
        this.tagsList.querySelectorAll('.library-tag-remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index, 10);
                this._pendingTags.splice(idx, 1);
                this.renderPendingTags();
            });
        });
    }

    addPendingTag() {
        if (!this.tagInput) return;
        const val = this.tagInput.value.trim();
        if (!val) return;
        if (!this._pendingTags.includes(val)) {
            this._pendingTags.push(val);
            this.renderPendingTags();
        }
        this.tagInput.value = '';
        this.tagInput.focus();
    }

    async saveTags() {
        if (!this.currentEntryId) return;
        try {
            const result = await window.electronAPI.transcriptions.update(this.currentEntryId, { labels: this._pendingTags });
            if (result && result.success) {
                if (this.detailLabels) {
                    const labels = this._pendingTags.map(l => `<span class="library-label">${this.escapeHtml(l)}</span>`).join('');
                    this.detailLabels.innerHTML = labels;
                }
                const entry = this.entries.find(e => e.id === this.currentEntryId);
                if (entry) entry.labels = [...this._pendingTags];
                this.closeTagsForm();
                await this.search();
            }
        } catch (err) {
            this.closeTagsForm();
        }
    }

    async load() {
        await this.search();
    }

    async search() {
        if (!window.electronAPI || !window.electronAPI.transcriptions) return;

        const filters = {};
        if (this.searchInput && this.searchInput.value.trim()) {
            filters.query = this.searchInput.value.trim();
        }
        if (this.dateFrom && this.dateFrom.value) {
            filters.dateFrom = this.dateFrom.value;
        }
        if (this.dateTo && this.dateTo.value) {
            filters.dateTo = this.dateTo.value;
        }

        try {
            const result = await window.electronAPI.transcriptions.list(filters);
            this.entries = result.entries || [];
            this.renderResults(this.entries);
        } catch (err) {
            console.error('Library search error:', err);
            this.renderError('Failed to load transcriptions: ' + err.message);
        }
    }

    clearSearch() {
        if (this.searchInput) this.searchInput.value = '';
        if (this.dateFrom) this.dateFrom.value = '';
        if (this.dateTo) this.dateTo.value = '';
        this.search();
    }

    async reindex() {
        if (!window.electronAPI || !window.electronAPI.transcriptions) return;
        try {
            if (this.reindexBtn) this.reindexBtn.disabled = true;
            const result = await window.electronAPI.transcriptions.reindex();
            await this.search();
            console.log('Reindex complete, count:', result.count);
        } catch (err) {
            console.error('Reindex error:', err);
        } finally {
            if (this.reindexBtn) this.reindexBtn.disabled = false;
        }
    }

    renderResults(entries) {
        if (!this.resultsEl) return;

        if (!entries || entries.length === 0) {
            this.resultsEl.innerHTML = '<div class="library-empty">No transcriptions found. Transcribe a file or recording to get started.</div>';
            return;
        }

        const html = entries.map(entry => {
            const date = entry.date ? new Date(entry.date).toLocaleDateString() : '';
            const labels = (entry.labels || []).map(l => `<span class="library-label">${this.escapeHtml(l)}</span>`).join('');
            const title = this.escapeHtml(entry.title || entry.sourceFile || entry.id);
            const summary = entry.summary ? this.escapeHtml(entry.summary.substring(0, 120)) + (entry.summary.length > 120 ? '…' : '') : '';
            const isActive = this.currentEntryId === entry.id ? ' active' : '';
            return `
                <div class="library-result-item${isActive}" data-id="${entry.id}">
                    <div class="library-result-title">${title}</div>
                    <div class="library-result-meta">
                        <span class="library-meta-tag">📅 ${date}</span>
                        ${entry.wordCount ? `<span class="library-meta-tag">📝 ${entry.wordCount} words</span>` : ''}
                    </div>
                    ${labels ? `<div class="library-labels">${labels}</div>` : ''}
                    ${summary ? `<div class="library-result-summary">${summary}</div>` : ''}
                </div>
            `;
        }).join('');

        this.resultsEl.innerHTML = html;

        this.resultsEl.querySelectorAll('.library-result-item').forEach(item => {
            item.addEventListener('click', () => {
                this.resultsEl.querySelectorAll('.library-result-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                this.showDetail(item.dataset.id);
            });
        });
    }

    renderError(msg) {
        if (this.resultsEl) {
            this.resultsEl.innerHTML = `<div class="library-empty library-error">${this.escapeHtml(msg)}</div>`;
        }
    }

    async showDetail(id) {
        if (!window.electronAPI || !window.electronAPI.transcriptions) return;

        this.currentEntryId = id;
        this.closeRenameForm();
        this.closeTagsForm();

        try {
            const result = await window.electronAPI.transcriptions.get(id);
            if (!result || !result.entry) {
                this.clearDetail();
                return;
            }

            const { entry, text } = result;
            const date = entry.date ? new Date(entry.date).toLocaleString() : '';

            if (this.detailTitle) this.detailTitle.textContent = entry.title || entry.sourceFile || entry.id;
            if (this.detailDate) this.detailDate.textContent = date ? '📅 ' + date : '';
            if (this.detailSource) this.detailSource.textContent = entry.sourceFile ? '🗂️ ' + entry.sourceFile : '';
            if (this.detailWords) this.detailWords.textContent = entry.wordCount ? '📝 ' + entry.wordCount + ' words' : '';

            if (this.detailLabels) {
                const labels = (entry.labels || []).map(l => `<span class="library-label">${this.escapeHtml(l)}</span>`).join('');
                this.detailLabels.innerHTML = labels;
            }

            if (this.detailSummary) this.detailSummary.textContent = entry.summary || '(no summary)';
            if (this.detailText) this.detailText.textContent = text || '';

            if (this.metaErrorEl) {
                const showBanner = entry.metaStatus === 'failed' ||
                    entry.metaStatus === 'disabled' ||
                    (!entry.metaStatus && !entry.summary && (!entry.labels || entry.labels.length === 0));
                if (showBanner) {
                    this.metaErrorEl.classList.remove('hidden');
                    if (this.metaErrorText) {
                        let msg;
                        if (entry.metaStatus === 'disabled') {
                            msg = 'AI meta generation is disabled — enable Ollama in settings or click Regenerate';
                        } else if (entry.metaError) {
                            msg = 'AI meta generation failed: ' + entry.metaError;
                        } else {
                            msg = 'AI meta was not generated for this transcription';
                        }
                        this.metaErrorText.textContent = msg;
                    }
                } else {
                    this.metaErrorEl.classList.add('hidden');
                }
            }

            if (this.detailEmpty) this.detailEmpty.classList.add('hidden');
            if (this.detailContent) this.detailContent.classList.remove('hidden');

            // Load meeting notes for this transcription
            this.loadMeetingNotes(id);

            const transcriptionController = window.whisperApp && window.whisperApp.controllers && window.whisperApp.controllers.transcription;
            if (transcriptionController) {
                if (entry.audioFilePath) {
                    transcriptionController.loadAudio(entry.audioFilePath);
                } else {
                    transcriptionController.hideAudioPlayer();
                }
            }

        } catch (err) {
            console.error('Failed to load transcription detail:', err);
            this.clearDetail();
        }
    }

    clearDetail() {
        this.currentEntryId = null;
        if (this.detailEmpty) this.detailEmpty.classList.remove('hidden');
        if (this.detailContent) this.detailContent.classList.add('hidden');
        if (this.metaErrorEl) this.metaErrorEl.classList.add('hidden');
        const transcriptionController = window.whisperApp && window.whisperApp.controllers && window.whisperApp.controllers.transcription;
        if (transcriptionController) {
            transcriptionController.hideAudioPlayer();
        }
    }

    async regenerateMeta() {
        if (!this.currentEntryId) return;
        if (!window.electronAPI || !window.electronAPI.transcriptions) return;

        if (this.regenerateMetaBtn) this.regenerateMetaBtn.disabled = true;
        if (this.regenerateBtn) this.regenerateBtn.disabled = true;

        try {
            const result = await window.electronAPI.transcriptions.regenerateMeta(this.currentEntryId);
            if (result && result.success && result.entry) {
                await this.showDetail(this.currentEntryId);
                await this.search();
            } else {
                const errMsg = (result && result.entry && result.entry.metaError) || (result && result.error) || 'Unknown error';
                if (this.metaErrorEl) {
                    this.metaErrorEl.classList.remove('hidden');
                    if (this.metaErrorText) {
                        this.metaErrorText.textContent = 'AI meta generation failed: ' + errMsg;
                    }
                }
            }
        } catch (err) {
            if (this.metaErrorEl) {
                this.metaErrorEl.classList.remove('hidden');
                if (this.metaErrorText) {
                    this.metaErrorText.textContent = 'AI meta generation failed: ' + err.message;
                }
            }
        } finally {
            if (this.regenerateMetaBtn) this.regenerateMetaBtn.disabled = false;
            if (this.regenerateBtn) this.regenerateBtn.disabled = false;
        }
    }

    async copyCurrentText() {
        const text = this.detailText ? this.detailText.textContent : '';
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            if (this.copyBtn) {
                const orig = this.copyBtn.textContent;
                this.copyBtn.textContent = '✅ Copied';
                setTimeout(() => { this.copyBtn.textContent = orig; }, 1500);
            }
        } catch (err) {
            console.error('Copy failed:', err);
        }
    }

    async deleteCurrentEntry() {
        if (!this.currentEntryId) return;
        if (!window.electronAPI || !window.electronAPI.transcriptions) return;

        const title = this.detailTitle ? this.detailTitle.textContent : this.currentEntryId;
        if (!confirm(`Delete transcription "${title}"? This cannot be undone.`)) return;

        try {
            // Also delete associated meeting notes
            if (window.electronAPI.meetingNotes) {
                await window.electronAPI.meetingNotes.delete(this.currentEntryId).catch(() => {});
            }
            await window.electronAPI.transcriptions.delete(this.currentEntryId);
            this.clearDetail();
            await this.search();
        } catch (err) {
            console.error('Delete failed:', err);
            alert('Failed to delete transcription: ' + err.message);
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

window.LibraryController = LibraryController;

document.addEventListener('DOMContentLoaded', () => {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    function switchTab(tabName) {
        tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
        tabPanes.forEach(pane => pane.classList.toggle('active', pane.id === tabName + '-tab'));

        if (tabName === 'library' && window._libraryController) {
            window._libraryController.load();
        }
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.tab) switchTab(btn.dataset.tab);
        });
    });

    window._libraryController = new LibraryController();
});
